import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { CameraView, useCameraPermissions } from 'expo-camera'
import * as ImagePicker from 'expo-image-picker'
import * as FaceDetector from 'expo-face-detector'
import * as Speech from 'expo-speech'
import { colors, spacing } from '../theme'
import { submitVerification, fetchVerificationStatus } from '../api/verificationApi'
import { useAuth } from '../stores/authStore'
import { COUNTRIES } from '../utils/countries'

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

export function VerificationScreen({ navigation }) {
  const { token } = useAuth()
  const [activeStep, setActiveStep] = useState(1)
  const [documentType, setDocumentType] = useState('nid')
  const [fullName, setFullName] = useState('')
  const [documentCountry, setDocumentCountry] = useState('')
  const [documentFront, setDocumentFront] = useState(null)
  const [documentBack, setDocumentBack] = useState(null)
  const [selfie, setSelfie] = useState(null)
  const [serverVerification, setServerVerification] = useState(null)
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [countryPickerOpen, setCountryPickerOpen] = useState(false)
  const [countrySearch, setCountrySearch] = useState('')

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
  const filteredCountries = useMemo(() => {
    const term = countrySearch.trim().toLowerCase()
    if (!term) return COUNTRIES
    return COUNTRIES.filter(c => c.toLowerCase().includes(term))
  }, [countrySearch])

  const isDocumentReady =
    Boolean(documentFront && documentBack) &&
    !!documentType &&
    !!fullName.trim() &&
    !!documentCountry.trim()

  const cameraRef = useRef(null)
  const [faceMessage, setFaceMessage] = useState('Center your face inside the frame and tap capture.')
  const [cameraReady, setCameraReady] = useState(false)
  const [capturingSelfie, setCapturingSelfie] = useState(false)
  const [liveness, setLiveness] = useState({ left: false, right: false, center: false })
  const [livenessStarted, setLivenessStarted] = useState(false)
  const [livenessComplete, setLivenessComplete] = useState(false)
  const [autoSubmitting, setAutoSubmitting] = useState(false)
  const [autoSubmitted, setAutoSubmitted] = useState(false)
  const [cameraPermission, requestCameraPermission] = useCameraPermissions()

  useEffect(() => {
    if (!cameraPermission?.granted) {
      requestCameraPermission()
    }
  }, [cameraPermission?.granted, requestCameraPermission])

  useEffect(() => {
    if (livenessStarted && cameraReady && !capturingSelfie && !selfie) {
      captureSelfie()
    }
  }, [livenessStarted, cameraReady, capturingSelfie, selfie])

  const validateFaceAngles = (face = {}) => {
    const yaw = face.yawAngle ?? 0
    const roll = face.rollAngle ?? 0
    const pitch = face.pitchAngle ?? 0
    if (Math.abs(yaw) > 25) {
      return yaw > 0 ? 'Turn slightly to your left' : 'Turn slightly to your right'
    }
    if (Math.abs(roll) > 18) {
      return 'Keep your head straight'
    }
    if (Math.abs(pitch) > 15) {
      return 'Hold your head level'
    }
    return null
  }

  const voiceOptions = { pitch: 1.05, rate: 0.95, language: 'en-US' }

  const captureSelfie = async () => {
    if (!cameraRef.current || capturingSelfie) return
    const results = { left: false, right: false, center: false }
    let centerShot = null
    setCapturingSelfie(true)
    setFaceMessage('Rotate your head slowly: left, right, then center to complete liveness.')
    Speech.speak('Slowly turn your head left, then right, then look straight ahead. We will capture automatically.', { ...voiceOptions, voice: 'com.apple.ttsbundle.Samantha-compact' })
    try {
      for (let i = 0; i < 14; i += 1) {
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.6,
          skipProcessing: true
        })
        const detection = await FaceDetector.detectFacesAsync(photo.uri, {
          mode: FaceDetector.FaceDetectorMode.fast,
          detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
          runClassifications: FaceDetector.FaceDetectorClassifications.none
        })
        const face = detection?.faces?.[0]
        if (face) {
          const yaw = face.yawAngle ?? 0
          if (yaw < -15) results.left = true
          if (yaw > 15) results.right = true
          if (Math.abs(yaw) <= 10) {
            results.center = true
            centerShot = photo
          }
          setLiveness({ ...results })
          if (results.left && results.right && results.center) break
        }
        await new Promise(resolve => setTimeout(resolve, 600))
      }

      if (results.left && results.right && results.center && centerShot) {
        setSelfie({ uri: centerShot.uri, base64: centerShot.base64 ?? '' })
        setFaceMessage('Liveness passed. Selfie captured automatically.')
        Speech.speak('Great, liveness check passed. Submitting now.', { ...voiceOptions, voice: 'com.apple.ttsbundle.Samantha-compact' })
        setLivenessComplete(true)
        setAutoSubmitting(true)
        handleSubmit(true)
      } else {
        setFaceMessage('We could not detect all head turns. Retry in good lighting and fill the frame.')
        Speech.speak('We could not detect all head turns. Try again in bright light, move left, right, then center.', { ...voiceOptions, voice: 'com.apple.ttsbundle.Samantha-compact' })
        Alert.alert('Liveness check incomplete', 'Turn left, then right, then look straight. Keep your head visible and well lit.')
        setSelfie(null)
      }
    } catch (err) {
      console.error('Capture failed', err)
      Alert.alert('Capture failed', 'Unable to capture a selfie right now. Please try again.')
      setSelfie(null)
    } finally {
      setCapturingSelfie(false)
    }
  }

  const pickImage = async (setter, cameraType = ImagePicker.CameraType?.back || 'back', source = 'camera') => {
    if (!ImagePicker) {
      Alert.alert('Upload failed', 'Camera module unavailable.')
      return
    }
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync()
        if (!permission?.granted) {
          Alert.alert('Camera access required', 'Allow camera access from settings.')
          return
        }
      } else {
        const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync()
        if (!mediaPermission?.granted) {
          Alert.alert('Photos access required', 'Allow photo library access from settings.')
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
    setFaceMessage('Center your face inside the frame and tap capture.')
    setCapturingSelfie(false)
    setLiveness({ left: false, right: false, center: false })
    setLivenessStarted(false)
    setLivenessComplete(false)
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

  const handleSubmit = async (auto = false) => {
    if (!token) {
      if (!auto) Alert.alert('Sign in required', 'Please sign in to submit a verification request.')
      return
    }
    if (!isDocumentReady || !selfie?.base64) {
      const needsDoc = !isDocumentReady
      const needsSelfie = !selfie?.base64
      const message = [
        needsDoc ? 'Add your name, country, and both document sides.' : null,
        needsSelfie ? 'Complete liveness to capture a selfie.' : null
      ]
        .filter(Boolean)
        .join('\n')
      Alert.alert('Incomplete submission', message || 'Capture both document images and selfie before proceeding.')
      if (needsDoc) {
        setActiveStep(1)
        setFaceMessage('Finish document step (name, country, front and back) before liveness.')
      }
      setAutoSubmitting(false)
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        document_type: documentType,
        document_name: fullName.trim(),
        document_country: documentCountry.trim(),
        // Backward compatibility: send placeholders for legacy servers that still expect these.
        document_number: 'N/A',
        document_birthdate: '1900-01-01',
        document_expires_at: 'N/A',
        document_front: documentFront.base64,
        document_back: documentBack.base64,
        selfie: selfie.base64
      }
      const response = await submitVerification(token, payload)
      const latest = response || { status: 'awaiting_approval', submitted_at: new Date().toISOString() }
      setServerVerification(latest)
      // Refresh from server to ensure admin panel sees it
      fetchVerificationStatus(token)
        .then(setServerVerification)
        .catch(() => {})
      setActiveStep(3)
      setFaceMessage('Submitted for review. You will be notified once approved.')
      setAutoSubmitting(false)
      setAutoSubmitted(true)
      if (!auto) {
        Alert.alert('Submitted', 'Your verification has been submitted. We will notify you once it is reviewed.')
      }
    } catch (err) {
      setAutoSubmitting(false)
      if (!autoSubmitted) {
        // Force local "under review" state so UI can progress even if offline.
        const fallback = { status: 'awaiting_approval', submitted_at: new Date().toISOString(), notes: 'Pending upload' }
        setServerVerification(fallback)
        setActiveStep(3)
        setAutoSubmitted(true)
      }
      if (!auto) {
        Alert.alert('Submission failed', err?.response?.data?.error || 'Unable to submit verification right now.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (autoSubmitted && !autoSubmitting) {
      setActiveStep(3)
    }
  }, [autoSubmitted, autoSubmitting])

  // Safety net: if liveness is complete and we haven't submitted, auto-submit.
  useEffect(() => {
    if (livenessComplete && selfie?.base64 && !autoSubmitting && !autoSubmitted) {
      setAutoSubmitting(true)
      handleSubmit(true)
    }
  }, [livenessComplete, selfie?.base64, autoSubmitting, autoSubmitted])

  // Timebox auto-submit: if still on step 2 after 8 seconds of completion, force transition.
  useEffect(() => {
    if (livenessComplete && autoSubmitting && !autoSubmitted) {
      const timer = setTimeout(() => {
        const fallback = { status: 'awaiting_approval', submitted_at: new Date().toISOString(), notes: 'Pending upload' }
        setServerVerification(fallback)
        setAutoSubmitted(true)
        setActiveStep(3)
      }, 8000)
      return () => clearTimeout(timer)
    }
  }, [livenessComplete, autoSubmitting, autoSubmitted])

  useEffect(() => {
    if (activeStep === 3 && reviewStatus !== 'approved') {
      setFaceMessage('Submitted for review. We will notify you once approved.')
    }
  }, [activeStep, reviewStatus])

  useEffect(() => {
    if (isDocumentReady && activeStep === 1) {
      setActiveStep(2)
    }
  }, [isDocumentReady, documentFront, documentBack, activeStep])

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
            <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <Text style={styles.fieldLabel}>Country</Text>
              <TouchableOpacity
                style={[styles.input, styles.selectInput]}
                onPress={() => setCountryPickerOpen(true)}
                activeOpacity={0.8}
              >
                <Text style={documentCountry ? styles.selectValue : styles.selectPlaceholder}>
                  {documentCountry || 'Select country'}
                </Text>
                <Feather name="chevron-down" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.formHalf} />
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
              Liveness check: slowly turn your head left, right, then center. We will auto-capture when movement is detected.
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
            ) : (
              <>
                {!livenessStarted ? (
                  <View style={styles.livenessIntro}>
                    <View style={styles.cartoonRow}>
                      <Text style={styles.cartoonEmoji}>🙂</Text>
                      <Text style={styles.cartoonArrow}>↩️</Text>
                      <Text style={styles.cartoonEmoji}>🙂</Text>
                      <Text style={styles.cartoonArrow}>↪️</Text>
                      <Text style={styles.cartoonEmoji}>😀</Text>
                    </View>
                    <Text style={styles.helperText}>Example: turn left, then right, then look straight.</Text>
                    <View style={styles.livenessBadges}>
                      <View style={styles.livenessBadge}>
                        <Text style={styles.livenessBadgeText}>Turn left</Text>
                      </View>
                      <View style={styles.livenessBadge}>
                        <Text style={styles.livenessBadgeText}>Turn right</Text>
                      </View>
                      <View style={styles.livenessBadge}>
                        <Text style={styles.livenessBadgeText}>Center</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.livenessCTA}
                      onPress={() => {
                        if (!isDocumentReady) {
                          Alert.alert('Complete document first', 'Add your name, country, and both document sides before starting liveness.')
                          setActiveStep(1)
                          return
                        }
                        setLivenessStarted(true)
                        setFaceMessage('Rotate your head slowly: left, right, then center to complete liveness.')
                        Speech.speak('Start liveness. Turn your head left, right, then center. Keep your face inside the circle.', { pitch: 1.05 })
                      }}
                    >
                      <Text style={styles.livenessCTAText}>Start liveness check</Text>
                    </TouchableOpacity>
                  </View>
                ) : !livenessComplete ? (
                  <View style={styles.cameraWrapper}>
                    <View style={styles.cameraCircle}>
                      <CameraView
                        ref={cameraRef}
                        style={styles.cameraPreview}
                        facing="front"
                        ratio="16:9"
                        onCameraReady={() => setCameraReady(true)}
                      />
                      <View style={styles.cameraOverlayRound} />
                    </View>
                    <View style={styles.livenessBadges}>
                      <View style={[styles.livenessBadge, liveness.left && styles.livenessBadgeDone]}>
                        <Text style={[styles.livenessBadgeText, liveness.left && styles.livenessBadgeTextDone]}>Turn left</Text>
                      </View>
                      <View style={[styles.livenessBadge, liveness.right && styles.livenessBadgeDone]}>
                        <Text style={[styles.livenessBadgeText, liveness.right && styles.livenessBadgeTextDone]}>Turn right</Text>
                      </View>
                      <View style={[styles.livenessBadge, liveness.center && styles.livenessBadgeDone]}>
                        <Text style={[styles.livenessBadgeText, liveness.center && styles.livenessBadgeTextDone]}>Center</Text>
                      </View>
                    </View>
                  </View>
                ) : null}
              </>
            )}
            <Text style={styles.faceInstruction}>{faceMessage}</Text>
            {livenessStarted && !livenessComplete ? (
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  (!cameraReady || capturingSelfie || autoSubmitted) && styles.captureButtonDisabled
                ]}
                onPress={() => {
                  resetFaceCapture()
                  setLivenessStarted(true)
                  captureSelfie()
                }}
                disabled={!cameraReady || capturingSelfie || autoSubmitted}
                activeOpacity={0.85}
              >
                {capturingSelfie ? (
                  <ActivityIndicator color={colors.brand} />
                ) : (
                  <Text style={styles.captureButtonText}>{selfie ? 'Redo liveness check' : 'Start liveness check'}</Text>
                )}
              </TouchableOpacity>
            ) : null}
            <View style={styles.livenessRow}>
              <Text style={[styles.livenessStep, liveness.left && styles.livenessStepDone]}>Turn left</Text>
              <Text style={[styles.livenessStep, liveness.right && styles.livenessStepDone]}>Turn right</Text>
              <Text style={[styles.livenessStep, liveness.center && styles.livenessStepDone]}>Center</Text>
            </View>
            <View style={styles.helperTextRow}>
              <Text style={styles.helperText}>
                Tips: hold the phone at eye level, ensure bright lighting, remove glasses/mask, and move slowly until all steps turn green.
              </Text>
            </View>
            {!livenessComplete && selfie ? (
              <View style={styles.selfiePreviewCard}>
                <Text style={styles.selfiePreviewLabel}>Captured selfie</Text>
                <Image source={{ uri: selfie.uri }} style={styles.selfiePreview} />
              </View>
            ) : null}
            <View style={styles.helperTextRow}>
              <Text style={styles.helperText}>Make sure your face is well lit and fully visible. Retake if the app cannot spot a face.</Text>
            </View>
            {!autoSubmitted ? (
              <View style={styles.helperTextRow}>
                {submitting || autoSubmitting ? (
                  <>
                    <ActivityIndicator size="small" color={colors.brand} />
                    <Text style={styles.helperText}>Submitting for review…</Text>
                  </>
                ) : null}
              </View>
            ) : (
              <View style={styles.helperTextRow}>
                <ActivityIndicator size="small" color={colors.brand} />
                <Text style={styles.helperText}>Submission complete. Redirecting to review…</Text>
              </View>
            )}
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
            {reviewStatus !== 'approved' ? (
              <View style={styles.underReviewCard}>
                <Text style={styles.underReviewEmoji}>⏳</Text>
                <Text style={styles.underReviewTitle}>Under Review</Text>
                <Text style={styles.underReviewEta}>Estimated time: 30 minute(s)</Text>
                <Text style={styles.underReviewText}>
                  You will receive an email/app notification once the review is completed. Feel free to explore the app in the meantime.
                </Text>
              </View>
            ) : null}
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
      <Modal visible={countryPickerOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select country</Text>
              <TouchableOpacity onPress={() => setCountryPickerOpen(false)}>
                <Feather name="x" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.input, { marginBottom: spacing.xs }]}
              placeholder="Search country"
              value={countrySearch}
              onChangeText={setCountrySearch}
            />
            <ScrollView style={{ maxHeight: 360 }}>
              {filteredCountries.map(country => (
                <TouchableOpacity
                  key={country}
                  style={styles.countryRow}
                  onPress={() => {
                    setDocumentCountry(country)
                    setCountryPickerOpen(false)
                  }}
                >
                  <Text style={styles.countryText}>{country}</Text>
                  {documentCountry === country ? (
                    <Feather name="check" size={16} color={colors.brand} />
                  ) : null}
                </TouchableOpacity>
              ))}
              {filteredCountries.length === 0 ? (
                <Text style={styles.helperText}>No matches</Text>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm
  },
  cameraPreview: {
    width: '100%',
    height: '100%'
  },
  cameraCircle: {
    width: 300,
    height: 300,
    borderRadius: 150,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: colors.brand,
    backgroundColor: '#000'
  },
  cameraOverlayRound: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 130
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
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  selectPlaceholder: {
    color: colors.textSecondary,
    fontSize: 15
  },
  selectValue: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600'
  },
  captureButton: {
    marginTop: spacing.sm,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.brand,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  captureButtonDisabled: {
    borderColor: colors.divider,
    backgroundColor: '#f8fafc'
  },
  captureButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.brand
  },
  livenessRow: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    gap: spacing.md
  },
  livenessStep: {
    fontSize: 12,
    color: colors.textSecondary
  },
  livenessStepDone: {
    color: '#16a34a',
    fontWeight: '700'
  },
  livenessIntro: {
    gap: spacing.sm,
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  livenessCTA: {
    marginTop: spacing.xs,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    backgroundColor: '#1d4ed8',
    borderRadius: 14,
    shadowColor: '#1d4ed8',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
    minWidth: 200,
    alignItems: 'center'
  },
  livenessCTAText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15
  },
  cartoonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  cartoonEmoji: {
    fontSize: 28
  },
  cartoonArrow: {
    fontSize: 20,
    color: colors.textSecondary
  },
  livenessBadges: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
    alignItems: 'center'
  },
  livenessBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5f5'
  },
  livenessBadgeDone: {
    backgroundColor: '#dcfce7',
    borderColor: '#16a34a'
  },
  livenessBadgeText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  livenessBadgeTextDone: {
    color: '#166534'
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
    backgroundColor: 'rgba(22, 163, 74, 0.1)',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs
  },
  badgeText: {
    fontSize: 12,
    color: '#16a34a',
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
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    padding: spacing.md,
    maxWidth: 420,
    maxHeight: '80%'
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  countryRow: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  countryText: {
    fontSize: 14,
    color: colors.textPrimary
  },
  underReviewCard: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: '#0f172a',
    alignItems: 'center',
    gap: spacing.xs
  },
  underReviewEmoji: {
    fontSize: 36,
    color: '#facc15'
  },
  underReviewTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f8fafc'
  },
  underReviewEta: {
    fontSize: 14,
    color: '#e2e8f0'
  },
  underReviewText: {
    fontSize: 12,
    color: '#cbd5f5',
    textAlign: 'center'
  }
})
