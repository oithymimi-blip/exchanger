import { useEffect, useState } from 'react'
import { ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, spacing, typography } from '../theme'
import { fetchVerificationStatus } from '../api/verificationApi'
import { useAuth } from '../stores/authStore'

const ACTION_DEFS = [
  { key: 'verifications', label: 'Verifications', icon: 'shield-check', screen: 'Verification' },
  { key: 'security', label: 'Security', status: '', icon: 'lock' },
  { key: 'twitter', label: 'Twitter', status: 'Unlinked', icon: 'twitter' }
]

const VERIFICATION_STATUS_LABELS = {
  not_started: 'Start verification',
  pending: 'Document pending',
  awaiting_approval: 'In review',
  approved: 'Verified',
  rejected: 'Action required',
  unknown: 'Update required'
}

export function AccountInfoScreen({ navigation }) {
  const { user, token } = useAuth()
  const [verificationStatus, setVerificationStatus] = useState('not_started')
  const [loadingStatus, setLoadingStatus] = useState(true)

  useEffect(() => {
    let canceled = false
    if (!token) {
      setVerificationStatus('not_started')
      setLoadingStatus(false)
      return
    }

    setLoadingStatus(true)
    fetchVerificationStatus(token)
      .then(data => {
        if (canceled) return
        setVerificationStatus(data?.status || 'not_started')
      })
      .catch(err => {
        if (!canceled) {
          console.error('Failed to load verification status', err)
          setVerificationStatus('unknown')
        }
      })
      .finally(() => {
        if (!canceled) {
          setLoadingStatus(false)
        }
      })

    return () => {
      canceled = true
    }
  }, [token])

  const verificationLabel = loadingStatus
    ? 'Checking…'
    : VERIFICATION_STATUS_LABELS[verificationStatus] ?? 'Update required'
  const actions = ACTION_DEFS.map(action => ({
    ...action,
    status: action.key === 'verifications' ? verificationLabel : action.status
  }))
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account Info</Text>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
          <Feather name="user" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#FDE68A', '#FFFFFF']}
          style={styles.profileCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarEmoji}>😎</Text>
          </View>
          <View style={styles.profileMeta}>
            <View style={styles.profileRow}>
              <Text style={styles.profileName}>User-08231</Text>
              <View style={styles.chipBadge}>
                <Text style={styles.chipBadgeText}>Regular</Text>
              </View>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Binance ID (UID)</Text>
              <Text style={styles.dataValue}>{user?.id ?? '1039813159'}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Reg. Info</Text>
              <View style={styles.dataValueRow}>
                <Text style={styles.dataValue}>{user?.email ?? 'user@example.com'}</Text>
                <Feather name="eye" size={16} color={colors.textSecondary} />
              </View>
            </View>
            <View style={styles.vipRow}>
              <View>
                <Text style={styles.vipTitle}>Upgrade to VIP1</Text>
                <Text style={styles.vipSubtitle}>Trade more to reach the next level</Text>
              </View>
              <TouchableOpacity style={styles.vipAction} activeOpacity={0.7}>
                <Text style={styles.vipActionText}>Benefits</Text>
                <Feather name="chevron-right" size={14} color={colors.brand} />
              </TouchableOpacity>
            </View>
            <View style={styles.progressBar}>
              <View style={styles.progressFill} />
            </View>
          </View>
        </LinearGradient>

        {actions.map(action => (
          <TouchableOpacity
            key={action.key}
            style={styles.actionRow}
            activeOpacity={0.7}
            onPress={() => {
              if (action.screen) {
                navigation.navigate(action.screen)
              }
            }}
          >
            <View style={styles.actionIcon}>
              <MaterialCommunityIcons name={action.icon} size={20} color={colors.textPrimary} />
            </View>
            <View style={styles.actionText}>
              <Text style={styles.actionLabel}>{action.label}</Text>
              {action.status ? <Text style={styles.actionStatus}>{action.status}</Text> : null}
            </View>
            <Feather name="chevron-right" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF'
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
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  content: {
    padding: spacing.container,
    gap: spacing.md
  },
  profileCard: {
    borderRadius: 20,
    padding: spacing.md,
    elevation: 2,
    shadowColor: '#00000010',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm
  },
  avatarEmoji: {
    fontSize: 32
  },
  profileMeta: {
    gap: spacing.xs
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary
  },
  chipBadge: {
    backgroundColor: 'rgba(24,119,242,0.15)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12
  },
  chipBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand
  },
  dataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  dataLabel: {
    fontSize: 13,
    color: colors.textSecondary
  },
  dataValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  dataValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  vipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  vipTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  vipSubtitle: {
    fontSize: 12,
    color: colors.textSecondary
  },
  vipAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  vipActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand
  },
  progressBar: {
    height: 6,
    borderRadius: 4,
    backgroundColor: '#E9EDF5',
    marginTop: spacing.sm
  },
  progressFill: {
    width: '52%',
    height: '100%',
    borderRadius: 4,
    backgroundColor: colors.brand
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9'
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm
  },
  actionText: {
    flex: 1
  },
  actionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  actionStatus: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2
  }
})
