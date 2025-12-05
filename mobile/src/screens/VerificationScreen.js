import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather } from '@expo/vector-icons'
import { Camera, CameraType, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as FaceDetector from 'expo-face-detector'
import { colors, spacing } from '../theme'
import { submitVerification, fetchVerificationStatus } from '../api/verificationApi'
import { useAuth } from '../stores/authStore'

const DOCUMENT_TYPES = [
  { id: 'nid', label: 'National ID' },
  { id: 'passport', label: 'Passport' },
  { id: 'driver_license', label: 'Driver license' }
]

const STEP_DEFS = [
  {
    key: 'document',
    title: 'Document upload',
    description: 'Submit a clear photo of your National ID, passport, or driver license (front/back).'
  },
  {
    key: 'selfie',
    title: 'Face verification',
    description: 'Capture a selfie using your front camera so we can verify it against your ID.'
  },
  {
    key: 'review',
    title: 'Awaiting approval',
    description: 'We will review your submission and notify you once it is approved.'
  }
]

const REVIEW_MESSAGES = {
  awaiting_approval: 'Thanks! Your submission is under review. Most requests complete within 24 hours.',
  approved: 'Your identity has been verified. You can proceed with withdrawals immediately.',
  rejected: 'We were unable to verify the documents. Update any missing info and resubmit.',
  pending: 'We received your submission and are still processing it.',
  not_started: 'Start by uploading a document so we can begin verification.',
  unknown: 'Something went wrong while loading your status. Please try again later.'
}

function formatExpiryInput(value = '') {
  const digits = value.replace(/\D/g, '').slice(0, 6)
  if (digits.length === 0) return ''
  const monthDigits = digits.slice(0, 2)
  const rest = digits.slice(2)
  let normalizedMonth = monthDigits
  if (monthDigits.length === 2) {
    const clamped = Math.min(Math.max(Number(monthDigits) || 0, 0), 12)
    normalizedMonth = clamped.toString().padStart(2, '0')
  }
  if (!rest) {
    return normalizedMonth
  }
  return `${normalizedMonth}/${rest}`
}

export function VerificationScreen({ navigation }) {
  const { token } = useAuth()
  const [activeStep, setActiveStep] = useState(1)
  const [documentType, setDocumentType] = useState('nid')
  const [fullName, setFullName] = useState('')
  const [documentNumber, setDocumentNumber] = useState('')
  const [documentCountry, setDocumentCountry] = useState('')
  const [documentExpires, setDocumentExpires] = useState('')
  const [documentFront, setDocumentFront] = useState(null)
  const [documentBack, setDocumentBack] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [serverVerification, setServerVerification] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!token) {
      setLoadingStatus(false)
      return
    }

    setLoadingStatus(true)
    fetchVerificationStatus(token)
      .then(data => {
        if (cancelled) return
        setServerVerification(data)
        if (data?.status === 'awaiting_approval' || data?.status === 'approved') {
          setActiveStep(3)
        } else if (data?.status === 'rejected') {
          setActiveStep(1)
        } else {
          setActiveStep(1)
        }
      })
      .catch(err => {
        if (!cancelled) {
          console.error('Failed to load verification status', err)
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingStatus(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [token])

  const reviewStatus = serverVerification?.status ?? 'not_started'
  const reviewMessage = REVIEW_MESSAGES[reviewStatus] ?? REVIEW_MESSAGES.unknown

  const isDocumentReady =
    Boolean(documentFront && documentBack) &&
    !!documentType &&
    !!fullName.trim() &&
    !!documentNumber.trim() &&
    !!documentCountry.trim() &&
    !!documentExpires.trim()

  const cameraRef = useRef(null)
  const [faceMessage, setFaceMessage] = useState('Position your face in the frame')
  const [faceStability, setFaceStability] = useState(0)
  const [faceReady, setFaceReady] = useState(false)
  const [faceCaptured, setFaceCaptured] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()
  const CameraComponent =
    typeof Camera === 'function'
      ? Camera
      : typeof Camera?.Camera === 'function'
      ? Camera.Camera
      : null
  const STABILITY_THRESHOLD = 5

  useEffect(() => {
    if (!cameraPermission?.granted) {
      requestCameraPermission()
    }
  }, [cameraPermission?.granted, requestCameraPermission])

  const captureSelfie = async () => {
    if (faceCaptured || !cameraRef.current) return
    try {
      const photo = await cameraRef.current.takePictureAsync({
        base64: true,
        quality: 0.6,
        skipProcessing: true
      })
      setFaceCaptured(true)
      setSelfie({ uri: photo.uri, base64: photo.base64 })
    } catch (err) {
      console.error('Capture failed', err)
    }
  }

const pickImage = async (setter, cameraType = ImagePicker.CameraType?.back || 'back', source = 'camera') => {
  if (!ImagePicker) {
    Alert.alert('Upload failed', 'Camera module unavailable.')
    return
  }
  try {
    if (source === 'camera') {
      const permission = await Camera.requestCameraPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('Camera access required', 'Allow camera access from settings.')
        return
      }
    }
    const resolvedCameraType =
      ImagePicker?.CameraType?.[cameraType] ||
      ImagePicker?.CameraType?.back ||
      (typeof cameraType === 'string' ? cameraType : 'back')

    const result =
      source === 'library'
        ? await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.8,
            base64: true
          })
        : await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.6,
            base64: true,
            cameraType: resolvedCameraType
          })
      if (result.canceled || result.cancelled) return
      const asset = result.assets?.[0] ?? result
      if (!asset?.uri) return
      setter({
        uri: asset.uri,
        base64: asset.base64 ?? ''
      })
    } catch (err) {
      console.error('Image picker failed', err)
      Alert.alert('Upload failed', 'Unable to access camera right now.')
    }
  }

  const resetFaceCapture = () => {
    setFaceStability(0)
    setFaceReady(false)
    setFaceCaptured(false)
  }

  const handleFacesDetected = ({ faces }) => {
    if (!faces?.length) {
      setFaceMessage('Move your face into the frame')
      setFaceStability(0)
      setFaceReady(false)
      return
    }
    const face = faces[0]
    const yaw = face.yawAngle ?? 0
    const roll = face.rollAngle ?? 0
    const pitch = face.pitchAngle ?? 0
    if (Math.abs(yaw) > 20) {
      setFaceMessage(yaw > 0 ? 'Turn slightly to your left' : 'Turn slightly to your right')
      setFaceStability(0)
      setFaceReady(false)
      return
    }
    if (Math.abs(roll) > 13) {
      setFaceMessage('Keep your head straight')
      setFaceStability(0)
      setFaceReady(false)
      return
    }
    if (Math.abs(pitch) > 12) {
      setFaceMessage('Hold your head level')
      setFaceStability(0)
      setFaceReady(false)
      return
    }
    setFaceMessage('Hold still, capturing...')
    setFaceStability(prev => {
      const next = Math.min(STABILITY_THRESHOLD, prev + 1)
      if (next >= STABILITY_THRESHOLD) {
        setFaceReady(true)
        captureSelfie()
      } else {
        setFaceReady(false)
      }
      return next
    })
  }

  const handleDocumentCapture = (side) => {
    const setter = side === 'front' ? setDocumentFront : setDocumentBack
    Alert.alert(
      'Document upload',
      'Capture or upload the front/back of your document',
      [
        {
          text: 'Use camera',
          onPress: () => pickImage(setter, ImagePicker.CameraType.back, 'camera')
        },
        {
          text: 'Photo library',
          onPress: () => pickImage(setter, ImagePicker.CameraType.back, 'library')
        },
        { text: 'Cancel', style: 'cancel' }
      ],
      { cancelable: true }
    )
  }

  const handleDocumentExpiresChange = (value) => {
    setDocumentExpires(formatExpiryInput(value))
  }

  const handleContinueToSelfie = () => {
    if (!isDocumentReady) {
      Alert.alert('Document incomplete', 'Complete each field and capture both sides before continuing.')
      return
    }
    resetFaceCapture()
    setFaceMessage('Position your face for the selfie')
    setActiveStep(2)
  }

  const faceDetectorSettings = FaceDetector?.Constants
    ? {
        mode: FaceDetector.Constants.Mode.fast,
        detectLandmarks: FaceDetector.Constants.Landmarks.none,
        runClassifications: FaceDetector.Constants.Classifications.none
      }
    : undefined

  const handleSubmit = async () => {
    if (!token) {
      Alert.alert('Sign in required', 'Please sign in to submit a verification request.')
      return
    }
    if (!isDocumentReady || !selfie?.base64) {
      Alert.alert('Incomplete submission', 'Capture both document images and selfie before proceeding.')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        document_type: documentType,
        document_number: documentNumber.trim(),
        document_name: fullName.trim(),
        document_country: documentCountry.trim(),
        document_expires_at: documentExpires.trim(),
        document_front: documentFront.base64,
        document_back: documentBack.base64,
        selfie: selfie.base64
      }
      const response = await submitVerification(token, payload)
      setServerVerification(response)
      setActiveStep(3)
      Alert.alert('Submitted', 'Your verification has been submitted. We will notify you once it is reviewed.')
    } catch (err) {
      Alert.alert('Submission failed', err?.response?.data?.error || 'Unable to submit verification right now.')
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (documentFront && documentBack && activeStep === 1) {
      setActiveStep(2)
    }
  }, [documentFront, documentBack, activeStep])

  useEffect(() => {
    if (selfie?.base64 && activeStep === 2) {
      setActiveStep(3)
    }
  }, [selfie?.base64, activeStep])

  useEffect(() => {
    if (documentFront && documentBack && activeStep === 1) {
      setActiveStep(2)
    }
  }, [documentFront, documentBack, activeStep])

  useEffect(() => {
    if (selfie?.base64 && activeStep !== 3) {
      setActiveStep(3)
    }
  }, [selfie?.base64, activeStep])

  const formattedSubmittedAt = useMemo(() => {
    if (!serverVerification?.submitted_at) return null
    const date = new Date(serverVerification.submitted_at)
    if (Number.isNaN(date.getTime())) return null
    return date.toLocaleString()
  }, [serverVerification])

  const stepperItems = STEP_DEFS.map((step, index) => {
    const isActive = activeStep === index + 1
    const isCompleted = activeStep > index + 1 || (reviewStatus === 'approved' && index === 2)
    return (
      <View key={step.key} style={styles.stepItem}>
        <View
          style={[
            styles.stepIndicator,
            isActive && styles.stepIndicatorActive,
            isCompleted && styles.stepIndicatorComplete
          ]}
        >
          {isCompleted ? (
            <Feather name="check" size={16} color={colors.brand} />
          ) : (
            <Text style={[styles.stepIndicatorText, isActive && styles.stepIndicatorTextActive]}>
              {index + 1}
            </Text>
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stepLabel, isActive && styles.stepLabelActive]}>{step.title}</Text>
          <Text style={styles.stepDescription}>{step.description}</Text>
        </View>
      </View>
    )
  })

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verifications</Text>
        <View style={styles.iconButton} />
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Secure identity verification</Text>
        <Text style={styles.subtitle}>
          Complete each step to unlock withdrawals and higher limits. We only need one selfie and your primary ID.
        </Text>
        <View style={styles.stepper}>{stepperItems}</View>

        {activeStep === 1 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 1 · Document</Text>
            <Text style={styles.sectionSubtitle}>
              Submit a verified ID (passport, national ID, or driver license) with both sides visible.
            </Text>
            <View style={styles.chipRow}>
              {DOCUMENT_TYPES.map(type => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.chip,
                    documentType === type.id && styles.chipActive
                  ]}
                  onPress={() => setDocumentType(type.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.chipText,
                      documentType === type.id && styles.chipTextActive
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full legal name</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="As it appears on your ID"
                style={styles.input}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Document number</Text>
              <TextInput
                value={documentNumber}
                onChangeText={setDocumentNumber}
                placeholder="e.g. AA1234567"
                style={styles.input}
              />
            </View>
            <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <Text style={styles.fieldLabel}>Country</Text>
              <TextInput
                value={documentCountry}
                onChangeText={setDocumentCountry}
                placeholder="Country of issue"
                style={styles.input}
              />
            </View>
            <View style={styles.formHalf}>
              <Text style={styles.fieldLabel}>Expires</Text>
              <TextInput
                value={documentExpires}
                onChangeText={handleDocumentExpiresChange}
                placeholder="MM/YYYY"
                style={styles.input}
                keyboardType="number-pad"
                maxLength={7}
              />
            </View>
          </View>
            <Text style={styles.sectionSubtitle}>Capture both sides of your ID in good lighting.</Text>
            <View style={styles.uploadRow}>
              <TouchableOpacity
                style={styles.uploadSlot}
                onPress={() => handleDocumentCapture('front')}
                activeOpacity={0.8}
              >
                {documentFront ? (
                  <Image source={{ uri: documentFront.uri }} style={styles.documentPreview} />
                ) : (
                  <>
                    <Feather name="camera" size={24} color={colors.textSecondary} />
                    <Text style={styles.uploadText}>Front</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadSlot}
                onPress={() => handleDocumentCapture('back')}
                activeOpacity={0.8}
              >
                {documentBack ? (
                  <Image source={{ uri: documentBack.uri }} style={styles.documentPreview} />
                ) : (
                  <>
                    <Feather name="camera" size={24} color={colors.textSecondary} />
                    <Text style={styles.uploadText}>Back</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.primaryButton, !isDocumentReady && styles.primaryButtonDisabled]}
              onPress={handleContinueToSelfie}
              disabled={!isDocumentReady}
            >
              <Text style={styles.buttonText}>Continue to selfie</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeStep === 2 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 2 · Face verification</Text>
            <Text style={styles.sectionSubtitle}>
              Move your face slowly until the overlay turns green. The system will automatically capture a selfie when alignment looks good.
            </Text>
            {cameraPermission?.status !== 'granted' ? (
              <View style={styles.permissionBlock}>
                <Text style={[styles.helperText, styles.cameraPermissionError]}>
                  Camera permission required. Tap below to enable and continue.
                </Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={requestCameraPermission}>
                  <Text style={styles.secondaryText}>Enable camera</Text>
                </TouchableOpacity>
              </View>
            ) : CameraComponent ? (
              <View style={styles.cameraWrapper}>
                <CameraComponent
                  ref={cameraRef}
                  style={styles.cameraPreview}
                  type={CameraType?.front ?? Camera.Constants?.Type?.front ?? 'front'}
                  ratio="16:9"
                  onFacesDetected={handleFacesDetected}
                  faceDetectorSettings={faceDetectorSettings}
                />
                <View
                  style={[
                    styles.cameraOverlay,
                    faceReady && styles.cameraOverlayReady
                  ]}
                />
                <View style={styles.progressRail}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${(faceStability / STABILITY_THRESHOLD) * 100}%` }
                    ]}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.permissionBlock}>
                <Text style={[styles.helperText, styles.cameraPermissionError]}>
                  Camera module is missing in this build. Rebuild the dev client (expo prebuild --clean && expo run:android) and try again.
                </Text>
              </View>
            )}
            <Text style={styles.faceInstruction}>{faceMessage}</Text>
            {faceCaptured && selfie ? (
              <View style={styles.selfiePreviewCard}>
                <Text style={styles.selfiePreviewLabel}>Captured selfie</Text>
                <Image source={{ uri: selfie.uri }} style={styles.selfiePreview} />
              </View>
            ) : null}
            <View style={styles.helperTextRow}>
              <Text style={styles.helperText}>The camera uses face tracking to ensure you're real. Rotate slowly and hold still when prompted.</Text>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={() => setActiveStep(1)}>
                <Text style={styles.backText}>Back to documents</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryButton, (!selfie?.base64 || submitting) && styles.primaryButtonDisabled]}
                onPress={handleSubmit}
                disabled={!selfie?.base64 || submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Submit for review</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {activeStep === 3 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Step 3 · Review & approval</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.badgeText}>
                {reviewStatus === 'approved' ? 'Verified' : 'Under review'}
              </Text>
            </View>
            <Text style={styles.sectionSubtitle}>{reviewMessage}</Text>
            {formattedSubmittedAt ? (
              <Text style={styles.metaText}>Submitted on {formattedSubmittedAt}</Text>
            ) : null}
            {serverVerification?.notes ? (
              <View style={styles.noteCard}>
                <Text style={styles.noteLabel}>Admin note</Text>
                <Text style={styles.noteText}>{serverVerification.notes}</Text>
              </View>
            ) : null}
            {reviewStatus === 'rejected' ? (
              <TouchableOpacity style={styles.secondaryButton} onPress={() => setActiveStep(1)}>
                <Text style={styles.secondaryText}>Update documents</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {loadingStatus && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="small" color={colors.brand} />
            <Text style={styles.loadingText}>Loading verification status…</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.container,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9'
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  content: {
    padding: spacing.container,
    gap: spacing.lg,
    paddingBottom: 40
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs
  },
  stepper: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.md
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md
  },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  stepIndicatorActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint
  },
  stepIndicatorComplete: {
    borderColor: colors.brand,
    backgroundColor: '#ECFDF3'
  },
  stepIndicatorText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary
  },
  stepIndicatorTextActive: {
    color: colors.brand
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  stepLabelActive: {
    color: colors.brand
  },
  stepDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#00000010',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  sectionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFB'
  },
  chipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint
  },
  chipText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  chipTextActive: {
    color: colors.brand
  },
  field: {
    gap: 6
  },
  fieldLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    backgroundColor: '#F8FAFB',
    color: colors.textPrimary
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.md
  },
  formHalf: {
    flex: 1,
    gap: 6
  },
  uploadRow: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap'
  },
  uploadSlot: {
    flex: 1,
    minHeight: 150,
    maxHeight: 200,
    borderWidth: 1.5,
    borderColor: '#D6E0F0',
    borderStyle: 'dashed',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFB',
    gap: spacing.xs,
    padding: spacing.md
  },
  uploadText: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4
  },
  documentPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    resizeMode: 'cover'
  },
  primaryButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.brand,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center'
  },
  primaryButtonDisabled: {
    backgroundColor: '#A5B4FC'
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700'
  },
  cameraWrapper: {
    width: '100%',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#000'
  },
  cameraPreview: {
    width: '100%',
    height: 280
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 20
  },
  cameraOverlayReady: {
    borderColor: 'rgba(46, 204, 113, 0.9)'
  },
  progressRail: {
    position: 'absolute',
    bottom: 10,
    left: 16,
    right: 16,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#2ecc71'
  },
  faceInstruction: {
    marginTop: spacing.sm,
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  helperTextRow: {
    marginTop: spacing.sm
  },
  helperText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  cameraPermissionError: {
    color: colors.danger,
    marginTop: spacing.sm
  },
  permissionBlock: {
    marginTop: spacing.sm,
    gap: spacing.xs
  },
  selfiePreviewCard: {
    marginTop: spacing.sm,
    alignItems: 'center',
    gap: spacing.xs
  },
  selfiePreviewLabel: {
    fontSize: 12,
    color: '#64748b'
  },
  selfiePreview: {
    width: '100%',
    height: 220,
    borderRadius: 14,
    resizeMode: 'cover'
  },
  actionsRow: {
    marginTop: spacing.sm,
    gap: spacing.sm
  },
  backText: {
    fontSize: 13,
    color: colors.brand,
    marginBottom: spacing.xs
  },
  secondaryButton: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start'
  },
  secondaryText: {
    fontSize: 14,
    color: colors.brand,
    fontWeight: '600'
  },
  statusBadge: {
    alignSelf: 'flex-start',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    backgroundColor: colors.brandTint,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  badgeText: {
    fontSize: 12,
    color: colors.brand,
    fontWeight: '600'
  },
  metaText: {
    fontSize: 12,
    color: colors.textSecondary
  },
  noteCard: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFB'
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary
  },
  noteText: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textPrimary
  },
  loadingOverlay: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  loadingText: {
    fontSize: 12,
    color: colors.textSecondary
  }
})
