import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import { colors, spacing, typography } from '../theme'

const SHORTCUTS = [
  { key: 'wallet', label: 'Binance Wallet', iconSet: 'MaterialCommunityIcons', iconName: 'wallet-outline' },
  { key: 'p2p', label: 'P2P', iconSet: 'Feather', iconName: 'users' },
  { key: 'convert', label: 'Convert', iconSet: 'Feather', iconName: 'repeat' },
  { key: 'pay', label: 'Pay', iconSet: 'Feather', iconName: 'dollar-sign' },
  { key: 'status', label: 'Deposit & Withdrawal Status', iconSet: 'MaterialCommunityIcons', iconName: 'file-document-outline' },
  { key: 'edit', label: 'Edit', iconSet: 'Feather', iconName: 'edit-3' }
]

const RECOMMEND = [
  { key: 'listing', label: 'New Listing Promos', iconSet: 'Feather', iconName: 'plus-circle' },
  { key: 'earn', label: 'Simple Earn', iconSet: 'MaterialCommunityIcons', iconName: 'coins' },
  { key: 'referral', label: 'Referral', iconSet: 'Feather', iconName: 'user-plus' },
  { key: 'events', label: 'Alpha Events', iconSet: 'Feather', iconName: 'calendar' },
  { key: 'p2p', label: 'P2P', iconSet: 'Feather', iconName: 'globe' },
  { key: 'square', label: 'Square', iconSet: 'MaterialCommunityIcons', iconName: 'credit-card-outline' }
]

const ICON_SETS = {
  Feather,
  MaterialCommunityIcons
}

function RenderIcon({ iconSet, iconName, color }) {
  const Icon = ICON_SETS[iconSet] || Feather
  return <Icon name={iconName} size={20} color={color || colors.textPrimary} />
}

export function UserHomeScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const safeTop = Math.max(insets.top - 8, 0)
  return (
    <SafeAreaView
      style={[styles.safe, { paddingTop: safeTop }]}
      edges={['left', 'right']}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerContainer}>
          <View style={styles.navSurface}>
            <View style={styles.navContent}>
              <TouchableOpacity style={styles.iconButton} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                <Feather name="arrow-left" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
              <View style={styles.navRight}>
                <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
                  <Feather name="maximize" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
                  <Feather name="headphones" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} activeOpacity={0.8}>
                  <Feather name="settings" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconButton} activeOpacity={0.8} onPress={() => navigation.navigate('AccountInfo')}>
                  <Feather name="user" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.profileCard}>
          <LinearGradient colors={[colors.brand, colors.brandTint]} style={styles.avatar}>
            <Text style={styles.avatarEmoji}>😎</Text>
          </LinearGradient>
          <View style={styles.profileMeta}>
            <Text style={styles.userId}>ID: 1039813159</Text>
            <View style={styles.nameRow}>
              <Text style={styles.username}>User-08231</Text>
              <Feather name="chevron-right" size={20} color={colors.textSecondary} />
            </View>
            <View style={styles.chipRow}>
              <View style={styles.chip}>
                <Text style={styles.chipText}>Regular</Text>
              </View>
              <View style={[styles.chip, styles.chipVerified]}>
                <Text style={[styles.chipText, styles.chipVerifiedText]}>Verified</Text>
              </View>
            </View>
          </View>
        </View>

        <View>
          <Text style={styles.sectionTitle}>Shortcut</Text>
          <View style={styles.grid}>
            {SHORTCUTS.map(item => (
              <TouchableOpacity key={item.key} style={styles.shortcutCard} activeOpacity={0.85}>
                <View style={styles.shortcutIcon}>
                  <RenderIcon iconSet={item.iconSet} iconName={item.iconName} />
                </View>
                <Text style={styles.shortcutLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View>
          <View style={styles.recommendHeader}>
            <Text style={styles.sectionTitle}>Recommend</Text>
          </View>
          <View style={styles.funGrid}>
            {RECOMMEND.map(item => (
              <TouchableOpacity key={item.key} style={styles.recommendCard} activeOpacity={0.85}>
                <View style={styles.recommendIcon}>
                  <RenderIcon iconSet={item.iconSet} iconName={item.iconName} color={colors.brand} />
                </View>
                <Text style={styles.recommendLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.moreButton} activeOpacity={0.8}>
            <Text style={styles.moreButtonText}>More Services</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomCard}>
          <View style={styles.bottomIcon}>
            <MaterialCommunityIcons name="diamond-outline" size={18} color={colors.textPrimary} />
          </View>
          <View style={styles.bottomCopy}>
            <Text style={styles.bottomTitle}>Lite Experience</Text>
            <Text style={styles.bottomSubtitle}>Trade simple on the lite version</Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.textSecondary} />
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  scroll: { flex: 1 },
  content: { padding: spacing.container, paddingTop: spacing.xs, gap: spacing.sm },
  headerContainer: { marginTop: 0 },
  navSurface: {
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    shadowColor: '#0F172A0F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  navContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  navRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F4F5F7',
    alignItems: 'center',
    justifyContent: 'center'
  },
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    shadowColor: '#0F172A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#F0F1F6'
  },
  avatar: {
    width: 62,
    height: 62,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarEmoji: { fontSize: 28 },
  profileMeta: {
    flex: 1,
    gap: spacing.xs
  },
  userId: { fontSize: 12, color: colors.textSecondary },
  username: { fontSize: 20, fontWeight: '700', color: colors.textPrimary },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  chip: {
    backgroundColor: '#E3F2FF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.brand
  },
  chipVerified: {
    backgroundColor: '#E6FAF1'
  },
  chipVerifiedText: {
    color: colors.success
  },
  sectionTitle: {
    ...typography.section,
    marginBottom: spacing.sm
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between'
  },
  shortcutCard: {
    width: '48%',
    borderRadius: 18,
    padding: spacing.sm,
    backgroundColor: '#FBFBFB',
    borderWidth: 1,
    borderColor: '#F0F1F6',
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  shortcutIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F0F1F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs
  },
  shortcutLabel: {
    textAlign: 'center',
    fontSize: 13,
    color: colors.textPrimary,
    fontWeight: '600'
  },
  recommendHeader: {
    marginBottom: spacing.sm
  },
  funGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs
  },
  recommendCard: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 16,
    backgroundColor: '#F6F7FB',
    borderWidth: 1,
    borderColor: '#E3E7F0',
    marginBottom: spacing.sm
  },
  recommendIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#EEF3FF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  recommendLabel: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary
  },
  moreButton: {
    marginTop: spacing.sm,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    backgroundColor: '#F0F1F6'
  },
  moreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  bottomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    backgroundColor: '#FAFAFA',
    borderWidth: 1,
    borderColor: '#E1E3EA',
    shadowColor: '#0F172A0D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3
  },
  bottomIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E1E3EA',
    alignItems: 'center',
    justifyContent: 'center'
  },
  bottomCopy: {
    flex: 1,
    gap: spacing.xs
  },
  bottomTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  bottomSubtitle: {
    fontSize: 12,
    color: colors.textSecondary
  }
})
