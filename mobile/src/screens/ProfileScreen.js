import { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions
} from 'react-native'
import { api } from '../api'
import { useAuth } from '../stores/authStore'

export function ProfileScreen() {
  const { width } = useWindowDimensions()
  const { token, user, updateUser, logout } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [handle, setHandle] = useState(user?.handle ?? '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const isCompact = width < 360

  const onSave = async () => {
    if (!token) {
      setMessage('Sign in to manage your profile.')
      return
    }
    setSaving(true)
    setMessage('')
    try {
      const response = await api(token).put('/api/me', { name, handle })
      updateUser(response.data)
      setMessage('Profile updated.')
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Failed to update profile.')
    } finally {
      setSaving(false)
    }
  }

  const onLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout }
    ])
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.content, isCompact && styles.contentCompact]}>
        <View style={[styles.header, isCompact && styles.headerCompact]}>
          <Text style={[styles.title, isCompact && styles.titleCompact]}>Profile</Text>
          <Text style={styles.subtitle}>Update your account information and view credentials.</Text>
        </View>

        <View style={[styles.card, isCompact && styles.cardCompact]}>
          <Text style={styles.sectionLabel}>Account details</Text>
          <View style={styles.row}>
            <Text style={styles.rowHeading}>Email</Text>
            <Text style={styles.rowValue}>{user?.email ?? '—'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowHeading}>Role</Text>
            <Text style={styles.rowValue}>{user?.role ?? 'user'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.rowHeading}>Referral code</Text>
            <Text style={styles.rowValue}>{user?.referral_code ?? '—'}</Text>
          </View>
        </View>

        <View style={[styles.card, isCompact && styles.cardCompact]}>
          <Text style={styles.sectionLabel}>Edit profile</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              style={[styles.input, isCompact && styles.inputCompact]}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Handle</Text>
            <TextInput
              value={handle}
              onChangeText={setHandle}
              placeholder="Unique handle"
              autoCapitalize="none"
              style={[styles.input, isCompact && styles.inputCompact]}
            />
          </View>
          <TouchableOpacity
            style={[styles.button, isCompact && styles.buttonCompact, saving && styles.buttonDisabled]}
            onPress={onSave}
            disabled={saving}
          >
            <Text style={styles.buttonText}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>

        <TouchableOpacity style={[styles.logoutButton, isCompact && styles.logoutButtonCompact]} onPress={onLogout}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  content: {
    padding: 20,
    gap: 20,
    paddingBottom: 40
  },
  contentCompact: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 16
  },
  header: {
    gap: 6
  },
  headerCompact: {
    gap: 4
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0f172a'
  },
  titleCompact: {
    fontSize: 22
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    gap: 16
  },
  cardCompact: {
    borderRadius: 16,
    padding: 16,
    gap: 14
  },
  sectionLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94a3b8',
    fontWeight: '600'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  rowHeading: {
    fontSize: 13,
    color: '#475569',
    fontWeight: '500'
  },
  rowValue: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600'
  },
  field: {
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#0f172a'
  },
  inputCompact: {
    paddingVertical: 8
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center'
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
    fontSize: 15
  },
  message: {
    fontSize: 13,
    color: '#475569'
  },
  logoutButton: {
    marginTop: 8,
    alignSelf: 'center',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#ef4444'
  },
  logoutButtonCompact: {
    paddingHorizontal: 20,
    paddingVertical: 10
  },
  logoutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600'
  }
})
