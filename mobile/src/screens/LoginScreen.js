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
import { useAuth } from '../stores/authStore'

export function LoginScreen({ navigation }) {
  const { width } = useWindowDimensions()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const login = useAuth(state => state.login)
  const isCompact = width < 360

  const submit = async () => {
    if (!email || !password) {
      setError('Email and password are required.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api().post('/api/auth/login', { email, password })
      login(response.data.token, response.data.user)
    } catch (err) {
      const serverMessage = err?.response?.data?.error
      if (serverMessage) {
        setError(serverMessage)
      } else {
        setError('Unable to reach the server. Ensure the backend is running on your LAN and try again.')
      }
    } finally {
      setLoading(false)
    }
  }

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
        <View style={[styles.card, isCompact && styles.cardCompact]}>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>Sign in</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
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
              returnKeyType="next"
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor="#8C9199"
              secureTextEntry
              style={[styles.input, isCompact && styles.inputCompact]}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
          </View>
          <TouchableOpacity
            style={[styles.button, isCompact && styles.buttonCompact, loading && styles.buttonDisabled]}
            onPress={submit}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Login</Text>}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('ResetPassword')}>
            <Text style={styles.link}>Forgot password?</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            No account?{' '}
            <Text style={styles.footerLink} onPress={() => navigation.navigate('Signup')}>
              Sign up
            </Text>
          </Text>
        </View>
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
  titleCompact: {
    fontSize: 22
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
    borderColor: '#cbd5f5',
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
  link: {
    textAlign: 'center',
    color: '#1d4ed8',
    fontWeight: '600',
    fontSize: 14
  },
  footer: {
    marginTop: 16,
    alignItems: 'center'
  },
  footerText: {
    color: '#475569',
    fontSize: 14
  },
  footerLink: {
    color: '#1d4ed8',
    fontWeight: '600'
  }
})
