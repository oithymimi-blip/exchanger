import { CompareFacesCommand, RekognitionClient } from '@aws-sdk/client-rekognition';
import db from './db.js';
import {
  AWS_ACCESS_KEY_ID,
  AWS_FACE_MATCH_THRESHOLD,
  AWS_REGION,
  AWS_SECRET_ACCESS_KEY
} from './config.js';

const hasAwsConfig = AWS_REGION && AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY;

const rekognitionClient = hasAwsConfig
  ? new RekognitionClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID,
        secretAccessKey: AWS_SECRET_ACCESS_KEY
      }
    })
  : null;

const selectVerificationRow = db.prepare('SELECT * FROM verifications WHERE user_id = ?');
const updateFaceCheckRow = db.prepare(`
  UPDATE verifications
  SET
    face_similarity = ?,
    face_confidence = ?,
    face_checked_at = CURRENT_TIMESTAMP,
    face_check_notes = ?,
    status = ?,
    updated_at = CURRENT_TIMESTAMP
  WHERE user_id = ?
`);

function normalizeBase64(value) {
  if (!value || typeof value !== 'string') return null;
  const commaIndex = value.indexOf(',');
  const trimmed = commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
  const cleaned = trimmed.replace(/\s+/g, '');
  if (!cleaned.length) return null;
  return cleaned;
}

function bufferFromBase64(value) {
  const normalized = normalizeBase64(value);
  if (!normalized) return null;
  return Buffer.from(normalized, 'base64');
}

function decodeThreshold() {
  if (!Number.isFinite(AWS_FACE_MATCH_THRESHOLD)) return 90;
  return Math.min(Math.max(AWS_FACE_MATCH_THRESHOLD, 0), 100);
}

export async function performFaceCheck(userId) {
  if (!rekognitionClient) {
    return null;
  }
  const row = selectVerificationRow.get(userId);
  if (!row) return null;
  if (!row.document_front || !row.selfie) {
    return null;
  }

  const sourceBytes = bufferFromBase64(row.document_front);
  const targetBytes = bufferFromBase64(row.selfie);
  if (!sourceBytes || !targetBytes) {
    return null;
  }

  try {
    const command = new CompareFacesCommand({
      SourceImage: { Bytes: sourceBytes },
      TargetImage: { Bytes: targetBytes },
      SimilarityThreshold: 0
    });
    const response = await rekognitionClient.send(command);
    const match = (response.FaceMatches || [])[0];
    const similarity = match?.Similarity ?? 0;
    const confidence = match?.Face?.Confidence ?? 0;
    const threshold = decodeThreshold();
    let nextStatus = row.status;
    if (row.status !== 'approved' && row.status !== 'rejected') {
      nextStatus = similarity >= threshold ? 'approved' : 'awaiting_approval';
    }
    const notes = JSON.stringify({
      similarity,
      confidence,
      threshold,
      message: similarity >= threshold ? 'Face matched automatically' : 'Face did not meet similarity threshold',
      raw: {
        requestId: response.ResponseMetadata?.RequestId,
        faceMatches: response.FaceMatches?.length ?? 0
      }
    });
    updateFaceCheckRow.run(similarity, confidence, notes, nextStatus, userId);
    return { similarity, confidence, nextStatus };
  } catch (err) {
    console.error('Face check failed', err);
    return null;
  }
}
