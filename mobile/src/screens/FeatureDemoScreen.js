import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons'
import { colors, spacing, typography } from '../theme'

const ICON_SETS = {
  MaterialCommunityIcons,
  Feather,
  FontAwesome5
}

export function FeatureDemoScreen({ route }) {
  const {
    title = 'Coming soon',
    headline = 'We are polishing this experience.',
    description = 'Thank you for exploring the preview build. Production integrations are on the way.',
    iconSet = 'Feather',
    iconName = 'compass',
    iconSize = 54,
    accentColor = colors.brand,
    surfaceColor = '#F4F6FB'
  } = route?.params ?? {}

  const IconComponent = ICON_SETS[iconSet] || Feather

  const highlightCards = [
    {
      key: 'workflow',
      title: 'Refined workflow',
      copy: 'Curated step-by-step journeys help you preview the final experience before launch.'
    },
    {
      key: 'security',
      title: 'Security first',
      copy: 'Enterprise-grade controls, approvals, and audit trails are baked into every module.'
    },
    {
      key: 'support',
      title: 'Guided support',
      copy: 'Our concierge onboarding and 24/7 desk will make go-live a breeze.'
    }
  ]

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[surfaceColor, '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={[styles.heroIcon, { backgroundColor: `${accentColor}14` }]}>
            <IconComponent name={iconName} size={iconSize} color={accentColor} />
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroHeadline}>{headline}</Text>
          <Text style={styles.heroDescription}>{description}</Text>
        </LinearGradient>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>What&apos;s cooking</Text>
          <View style={styles.sectionDivider} />
          {highlightCards.map(card => (
            <View key={card.key} style={styles.bullet}>
              <View style={[styles.bulletDot, { backgroundColor: accentColor }]} />
              <View style={styles.bulletCopy}>
                <Text style={styles.bulletTitle}>{card.title}</Text>
                <Text style={styles.bulletBody}>{card.copy}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Join the preview waitlist</Text>
          <Text style={styles.sectionBody}>
            We are onboarding the first cohort soon. Share your feedback and be notified when the full experience drops.
          </Text>
          <View style={styles.ctaRow}>
            <View style={[styles.ctaPill, { borderColor: accentColor }]}>
              <Feather name="bell" size={18} color={accentColor} />
              <Text style={[styles.ctaText, { color: accentColor }]}>Notify me</Text>
            </View>
            <View style={styles.ctaGhost}>
              <Feather name="message-circle" size={18} color={colors.textSecondary} />
              <Text style={styles.ctaGhostText}>Share feedback</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background
  },
  container: {
    padding: spacing.container,
    paddingBottom: spacing.bottomNavHeight,
    gap: spacing.md
  },
  hero: {
    borderRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
    shadowColor: '#0f172a11',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start'
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary
  },
  heroHeadline: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary
  },
  heroDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#E6E9F2',
    shadowColor: '#0f172a0b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  sectionDivider: {
    height: 1,
    backgroundColor: '#E8ECF5',
    marginVertical: spacing.xs
  },
  bullet: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start'
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6
  },
  bulletCopy: {
    flex: 1,
    gap: 4
  },
  bulletTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  bulletBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19
  },
  sectionBody: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19
  },
  ctaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  ctaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1.5
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '600'
  },
  ctaGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: '#F1F5F9'
  },
  ctaGhostText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary
  }
})
