import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions
} from 'react-native'
import { api } from '../api'

export function ResetPasswordScreen({ navigation, route }) {
  const { width } = useWindowDimensions()
  const tokenFromRoute = route?.params?.token ?? ''
  const [email, setEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [notification, setNotification] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const isCompact = width < 360

  const requestReset = async () => {
    if (!email) {
      setError('Email is required.')
      return
    }
    setLoading(true)
    setError('')
    setNotification('')

    try {
      await api().post('/api/auth/request-password-reset', { email })
      setNotification('If that email exists, a reset link has been generated (check server logs during development).')
    } catch {
      setError('Failed to request a reset link.')
    } finally {
      setLoading(false)
    }
  }

  const submitReset = async () => {
    if (!newPassword) {
      setError('Enter your new password.')
      return
    }

    const token = tokenFromRoute.trim()
    if (!token) {
      setError('Reset token is missing.')
      return
    }

    setLoading(true)
    setError('')
    setNotification('')

    try {
      await api().post('/api/auth/reset-password', {
        token,
        new_password: newPassword
      })
      setNotification('Password updated. You can now sign in with the new credentials.')
    } catch (err) {
      const serverMessage = err?.response?.data?.error
      setError(serverMessage || 'Failed to update your password.')
    } finally {
      setLoading(false)
    }
  }

  const content = tokenFromRoute
    ? (
      <>
        <Text style={styles.title}>Set a new password</Text>
        <Text style={styles.bodyText}>Enter a new password for your account.</Text>
        <View style={styles.field}>
          <Text style={styles.label}>New password</Text>
          <TextInput
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="••••••••"
            placeholderTextColor="#8C9199"
            secureTextEntry
            style={[styles.input, isCompact && styles.inputCompact]}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notification ? <Text style={styles.notice}>{notification}</Text> : null}
        <TouchableOpacity
          style={[styles.button, isCompact && styles.buttonCompact, loading && styles.buttonDisabled]}
          onPress={submitReset}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update password</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Return to sign in</Text>
        </TouchableOpacity>
      </>
      )
    : (
      <>
        <Text style={styles.title}>Reset your password</Text>
        <Text style={styles.bodyText}>Enter the email associated with your account. A reset link is logged on the server in development.</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#8C9199"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={[styles.input, isCompact && styles.inputCompact]}
          />
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {notification ? <Text style={styles.notice}>{notification}</Text> : null}
        <TouchableOpacity
          style={[styles.button, isCompact && styles.buttonCompact, loading && styles.buttonDisabled]}
          onPress={requestReset}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send reset link</Text>}
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Back to sign in</Text>
        </TouchableOpacity>
      </>
      )

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flex}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          isCompact && styles.containerCompact
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, isCompact && styles.cardCompact]}>{content}</View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f8fafc'
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24
  },
  containerCompact: {
    paddingHorizontal: 16,
    paddingVertical: 24
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    rowGap: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 8
  },
  cardCompact: {
    borderRadius: 16,
    padding: 20,
    rowGap: 14
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a'
  },
  bodyText: {
    color: '#334155',
    fontSize: 14
  },
  field: {
    rowGap: 8
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569'
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#0f172a',
    fontSize: 16
  },
  inputCompact: {
    paddingVertical: 10
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14
  },
  buttonCompact: {
    paddingVertical: 12
  },
  buttonDisabled: {
    opacity: 0.6
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16
  },
  error: {
    color: '#b91c1c',
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#fecaca'
  },
  notice: {
    color: '#0369a1',
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#bae6fd'
  },
  link: {
    textAlign: 'center',
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 14
  }
})
