import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import Constants from 'expo-constants'
import { api } from '../api'
import { useAuth } from '../stores/authStore'

export function ReferralCard() {
  const { token } = useAuth()
  const [info, setInfo] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) {
      setInfo(null)
      return
    }
    let mounted = true
    api(token).get('/api/referrals')
      .then(res => {
        if (mounted) setInfo(res.data)
      })
      .catch(err => console.error('Failed to load referrals', err))
    return () => { mounted = false }
  }, [token])

  const link = useMemo(() => {
    if (!info) return ''
    const code = info.referral_code
    const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}
    if (extra.webBaseUrl) {
      return `${extra.webBaseUrl.replace(/\/$/, '')}/signup?ref=${code}`
    }
    return code
  }, [info])

  const handleCopy = async () => {
    if (!link) return
    try {
      await Clipboard.setStringAsync(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy referral link', err)
    }
  }

  if (!info) return null

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.label}>Referral</Text>
        <Text style={styles.title}>Share & earn</Text>
      </View>
      <Text style={styles.subtitle}>Invite friends and receive bonuses when they start trading.</Text>
      <View style={styles.linkBox}>
        <Text style={styles.linkText}>{link}</Text>
      </View>
      <View style={styles.footer}>
        <Text style={styles.count}>
          Total referred: <Text style={styles.countValue}>{info.referred_count}</Text>
        </Text>
        <TouchableOpacity style={styles.copyButton} onPress={handleCopy}>
          <Text style={styles.copyButtonText}>{copied ? 'Copied!' : 'Copy link'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  subtitle: {
    fontSize: 13,
    color: '#64748b'
  },
  linkBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 12
  },
  linkText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#0f172a'
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  count: {
    fontSize: 13,
    color: '#64748b'
  },
  countValue: {
    fontWeight: '700',
    color: '#1d4ed8'
  },
  copyButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#1d4ed8',
    borderRadius: 999
  },
  copyButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13
  }
})
