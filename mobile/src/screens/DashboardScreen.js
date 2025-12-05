import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { Feather, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons'
import { api } from '../api'
import { useAuth } from '../stores/authStore'
import { useAccount } from '../stores/accountStore'
import { formatCurrency, formatNumber } from '../utils/format'
import { mockMarketState, mockTradeOverview } from '../api/mockData'
import { colors, spacing, typography } from '../theme'

const QUICK_ACTIONS = [
  {
    key: 'transfer',
    label: 'Transfer',
    iconSet: 'MaterialCommunityIcons',
    iconName: 'swap-horizontal',
    iconSize: 18,
    surfaceColor: '#EEF4FF',
    accentColor: '#A3C2FF',
    headline: 'Move assets instantly',
    description: 'Preview the unified transfer desk with simulated balances and destination routing.'
  },
  {
    key: 'convert',
    label: 'Convert',
    iconSet: 'MaterialCommunityIcons',
    iconName: 'autorenew',
    iconSize: 18,
    surfaceColor: '#EBFDF6',
    accentColor: '#60D394',
    headline: 'Swap in seconds',
    description: 'Get a feel for smooth asset conversions with demo liquidity and live rate previews.'
  },
  {
    key: 'staking',
    label: 'Staking',
    iconSet: 'MaterialCommunityIcons',
    iconName: 'chart-areaspline',
    iconSize: 18,
    surfaceColor: '#EDFDFB',
    accentColor: '#4DD0E1',
    headline: 'Earn passively',
    description: 'Preview curated staking vaults, lock-up periods, and projected APY dashboards.'
  },
  {
    key: 'affiliate',
    label: 'Affiliate',
    iconSet: 'Feather',
    iconName: 'users',
    iconSize: 18,
    surfaceColor: '#F5EDFF',
    accentColor: '#C6A3FF',
    headline: 'Grow together',
    description: 'Review dashboards, referral codes, and revenue sharing mockups for partners.'
  },
  {
    key: 'withdraw',
    label: 'Withdraw',
    iconSet: 'Feather',
    iconName: 'download',
    iconSize: 18,
    surfaceColor: '#F2F4F7',
    accentColor: '#A0AEC0',
    headline: 'Cash out securely',
    description: 'Walk through our upcoming withdrawal verification and payout orchestration.'
  },
  {
    key: 'game',
    label: 'Game',
    iconSet: 'MaterialCommunityIcons',
    iconName: 'controller-classic',
    iconSize: 18,
    surfaceColor: '#FFF0F7',
    accentColor: '#FF8FB1',
    headline: 'Play to earn',
    description: 'Sneak peek the arcade hub blending quests, leaderboards, and seasonal drops.'
  },
  {
    key: 'demo',
    label: 'Demo Trading',
    iconSet: 'FontAwesome5',
    iconName: 'chalkboard-teacher',
    iconSize: 17,
    surfaceColor: '#EAF6FF',
    accentColor: '#64B5F6',
    headline: 'Practice strategies',
    description: 'Simulate trades with risk-free capital while we wire in real-time market depth.'
  },
  {
    key: 'more',
    label: 'More',
    iconSet: 'Feather',
    iconName: 'grid',
    iconSize: 18,
    surfaceColor: '#F2F4F7',
    accentColor: '#A0AEC0',
    headline: 'Explore extras',
    description: 'Browse upcoming drops, community perks, and experimental labs as they roll out.'
  }
]

const ICON_SETS = {
  MaterialCommunityIcons,
  Feather,
  FontAwesome5
}

function renderQuickIcon(action, color) {
  const IconComponent = ICON_SETS[action.iconSet] || Feather
  return <IconComponent name={action.iconName} size={action.iconSize} color={color} />
}

const DISCOVER_TABS = ['Discover', 'Following', 'Campaign', 'News', 'Announcements', 'Academy']

const FEATURE_TILES = [
  {
    key: 'p2p',
    title: 'P2P',
    subtitle: 'USDT/BDT',
    badge: 'BUY',
    icon: () => <MaterialCommunityIcons name="currency-usd" size={20} color={colors.textPrimary} />,
    accent: colors.success
  },
  {
    key: 'send-cash',
    title: 'Send Cash',
    subtitle: 'Send Crypto and Receive Fiat',
    icon: () => <MaterialCommunityIcons name="bank-transfer" size={20} color={colors.textPrimary} />,
    accent: colors.brand
  }
]

const SEGMENT_OPTIONS = [
  { key: 'exchange', label: 'Exchange', icon: 'bar-chart-2' },
  { key: 'wallet', label: 'Wallet', icon: 'credit-card' }
]

export function DashboardScreen({ navigation }) {
  const insets = useSafeAreaInsets()
  const { token } = useAuth()
  const setAccountSummary = useAccount(state => state.setSummary)
  const clearAccountSummary = useAccount(state => state.clear)

  const [segment, setSegment] = useState('exchange')
  const [showBalance, setShowBalance] = useState(true)
  const [activeTab, setActiveTab] = useState(DISCOVER_TABS[0])
  const [balances, setBalances] = useState({ available: 0, locked: 0, total: 0 })
  const [todayPnl, setTodayPnl] = useState(0)
  const [pnlPercent, setPnlPercent] = useState(0)
  const [marketState, setMarketState] = useState(null)
  const [loading, setLoading] = useState(false)

  const fetchMarketState = useCallback(async () => {
    try {
      const response = await api().get('/api/market/state')
      setMarketState(response.data)
    } catch {
      setMarketState(mockMarketState())
    }
  }, [])

  const fetchOverview = useCallback(async () => {
    if (!token) {
      setBalances({ available: 0, locked: 0, total: 0 })
      setTodayPnl(0)
      setPnlPercent(0)
      clearAccountSummary()
      return
    }
    setLoading(true)
    try {
      const response = await api(token).get('/api/trades/overview', { params: { limit: 20 } })
      const data = response.data || {}
      const balance = data.balance || {}
      const available = Number(balance.available ?? 0)
      const locked = Number(balance.locked ?? 0)
      const total = Number(balance.total ?? available + locked)
      setBalances({ available, locked, total })
      const pnlValue = Number(data.openPnl ?? 0)
      const pnlRate = total !== 0 ? (pnlValue / total) * 100 : 0
      setTodayPnl(pnlValue)
      setPnlPercent(pnlRate)
      setAccountSummary(data)
    } catch {
      const fallback = mockTradeOverview()
      const total = Number(fallback.balance?.total ?? 0)
      const pnlValue = Number(fallback.openPnl ?? 0)
      setBalances(fallback.balance)
      setTodayPnl(pnlValue)
      setPnlPercent(total !== 0 ? (pnlValue / total) * 100 : 0)
      setAccountSummary(fallback)
    } finally {
      setLoading(false)
    }
  }, [token, clearAccountSummary, setAccountSummary])

  useEffect(() => { fetchMarketState() }, [fetchMarketState])
  useEffect(() => { fetchOverview() }, [fetchOverview])

  const formattedTotal = useMemo(() => formatCurrency(balances.total), [balances.total])
  const pnlDisplay = useMemo(() => formatCurrency(todayPnl), [todayPnl])
  const pnlColor = todayPnl >= 0 ? colors.success : colors.danger
  const pnlPrefix = todayPnl >= 0 ? '+' : ''
  const percentPrefix = pnlPercent >= 0 ? '+' : '-'
  const percentDisplay = `${percentPrefix}${formatNumber(Math.abs(pnlPercent), 2)}%`

  return (
    <SafeAreaView style={[styles.safe, { paddingTop: Math.max(insets.top - 50, 0) }]} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.headerContainer}>
        <View style={styles.headerRow}>
          <View style={styles.headerCluster}>
            <TouchableOpacity
              style={styles.headerIcon}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('UserHome')}
            >
              <Feather name="menu" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.segmentContainer}>
            <View style={styles.segmentTrack}>
              {SEGMENT_OPTIONS.map(option => {
                const selected = segment === option.key
                return (
                  <TouchableOpacity
                    key={option.key}
                    onPress={() => setSegment(option.key)}
                    style={[styles.segmentButton, selected && styles.segmentButtonActive]}
                    activeOpacity={0.7}
                  >
                    <Feather
                      name={option.icon}
                      size={14}
                      color={selected ? colors.brand : colors.textSecondary}
                    />
                    <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          <View style={[styles.headerCluster, styles.headerClusterRight]}>
            <TouchableOpacity style={styles.notificationIcon} activeOpacity={0.85}>
              <Feather name="bell" size={18} color={colors.textPrimary} />
              <View style={styles.badge}><Text style={styles.badgeText}>99+</Text></View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon} activeOpacity={0.85}>
              <Feather name="headphones" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerIcon} activeOpacity={0.85} onPress={() => navigation.navigate('AccountInfo')}>
              <Feather name="user" size={20} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: spacing.bottomNavHeight }]} showsVerticalScrollIndicator={false}>
        <View style={styles.searchBar}>
          <Feather name="search" size={18} color={colors.textSecondary} />
          <Text style={styles.searchPlaceholder}>#MarketPullback</Text>
        </View>

        <LinearGradient colors={['#FFFFFF', '#F5F7FA']} style={styles.balanceCard}>
          <View style={styles.balanceHeader}>
            <TouchableOpacity style={styles.balanceToggle} onPress={() => setShowBalance(prev => !prev)}>
              <Text style={styles.balanceLabel}>Est. Total Value(USD)</Text>
              <Feather name={showBalance ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} activeOpacity={0.85}>
              <Text style={styles.addButtonText}>Add Funds</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.balanceValueRow}>
            <Text style={styles.balanceValue}>{showBalance ? formattedTotal : '****'}</Text>
            {loading ? <ActivityIndicator size="small" color={colors.textPrimary} style={styles.balanceLoader} /> : null}
          </View>

          <Text style={styles.pnlText}>
            Today&apos;s PNL <Text style={[styles.pnlAmount, { color: pnlColor }]}>{pnlPrefix}{pnlDisplay} ({percentDisplay})</Text>
          </Text>
        </LinearGradient>

        <View style={styles.quickGrid}>
          {QUICK_ACTIONS.map(action => (
            <TouchableOpacity
              key={action.key}
              style={styles.quickItem}
              activeOpacity={0.85}
              onPress={() => navigation?.navigate?.('FeatureDemo', {
                actionKey: action.key,
                title: action.label,
                headline: action.headline,
                description: action.description,
                iconSet: action.iconSet,
                iconName: action.iconName,
                iconSize: action.iconSize + 36,
                accentColor: action.accentColor,
                surfaceColor: action.surfaceColor
              })}
            >
              <View
                style={[
                  styles.quickIconSurface,
                  {
                    backgroundColor: action.surfaceColor || colors.surface,
                    borderColor: action.accentColor || colors.divider
                  }
                ]}
              >
                <View style={[styles.quickIconAccent, { backgroundColor: action.accentColor || colors.brandTint }]} />
                {renderQuickIcon(action, colors.textPrimary)}
              </View>
              <Text style={styles.quickLabel} numberOfLines={2}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.widgetCard}>
          <View style={styles.widgetHeader}>
            <Text style={styles.widgetTitle}>Trading Countdown</Text>
            <TouchableOpacity><Feather name="x" size={18} color={colors.textSecondary} /></TouchableOpacity>
          </View>
          <View style={styles.widgetBody}>
            <View style={styles.assetAvatar} />
            <View style={styles.assetInfo}>
              <Text style={styles.assetSymbol}>TRUSTUSDT</Text>
              <View style={styles.assetBadge}><Text style={styles.assetBadgeText}>Perp</Text></View>
            </View>
            <TouchableOpacity style={styles.tradeButton}><Text style={styles.tradeButtonText}>Trade</Text></TouchableOpacity>
          </View>
        </View>

        <View style={styles.bannerCard}>
          <View style={{ flex: 1, gap: spacing.xs }}>
            <Text style={styles.bannerHeadline}>Discover personalized home experiences!</Text>
            <Text style={styles.bannerDescription}>Tailored insights curated for your trading style.</Text>
          </View>
          <TouchableOpacity style={styles.bannerAction}><Feather name="arrow-right" size={18} color={colors.textPrimary} /></TouchableOpacity>
        </View>

        <View style={styles.tileRow}>
          {FEATURE_TILES.map(tile => (
            <TouchableOpacity key={tile.key} style={styles.tileCard} activeOpacity={0.85}>
              <View style={styles.tileHeader}>
                <Text style={styles.tileTitle}>{tile.title}</Text>
                <Feather name="chevron-right" size={18} color={colors.textSecondary} />
              </View>
              <Text style={styles.tileSubtitle}>{tile.subtitle}</Text>
              <View style={styles.tileFooter}>
                <View style={styles.tileIcon}>{tile.icon()}</View>
                {tile.badge ? <View style={[styles.tileBadge, { backgroundColor: tile.accent }]}><Text style={styles.tileBadgeText}>{tile.badge}</Text></View> : null}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabStrip}>
          {DISCOVER_TABS.map(tab => {
            const active = tab === activeTab
            return (
              <TouchableOpacity key={tab} style={styles.tabItem} onPress={() => setActiveTab(tab)}>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{tab}</Text>
                {active ? <View style={styles.tabIndicator} /> : null}
              </TouchableOpacity>
            )
          })}
        </ScrollView>

        <View style={styles.metricRow}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Available</Text>
            <Text style={styles.metricValue}>{formatCurrency(balances.available)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Locked</Text>
            <Text style={styles.metricValue}>{formatCurrency(balances.locked)}</Text>
          </View>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Current Price</Text>
            <Text style={styles.metricValue}>{marketState?.currentPrice ? formatNumber(marketState.currentPrice, 2) : '--'}</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.container, paddingTop: spacing.xs, gap: spacing.sm },
  headerContainer: { paddingHorizontal: spacing.container, marginTop: -6, paddingBottom: spacing.xs },
  headerRow: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  headerClusterRight: {
    justifyContent: 'flex-end'
  },
  headerIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FB',
    borderWidth: 1,
    borderColor: colors.divider,
    shadowColor: '#0f172a1a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3
  },
  notificationIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F7FB',
    borderWidth: 1,
    borderColor: colors.divider,
    position: 'relative',
    shadowColor: '#0f172a1a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3
  },
  segmentContainer: {
    flex: 1,
    alignItems: 'center'
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.brand,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center'
  },
  badgeText: { fontSize: 9, fontWeight: '700', color: '#FFFFFF' },
  segmentTrack: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF3FF',
    borderRadius: 18,
    paddingHorizontal: spacing.xs,
    paddingVertical: 4,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: '#D4E3FF',
    shadowColor: '#1877F20d',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2
  },
  segmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    minWidth: 86
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.brand,
    shadowColor: '#1877F226',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3
  },
  segmentLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  segmentLabelActive: { color: colors.textPrimary },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, marginTop: 3, gap: spacing.sm },
  searchPlaceholder: { fontSize: 14, color: colors.textSecondary },
  balanceCard: { borderRadius: 10, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.xs, backgroundColor: colors.surface, shadowColor: '#0000000a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  balanceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  balanceToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  balanceLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  addButton: { backgroundColor: colors.brand, paddingHorizontal: spacing.sm * 2, height: 32, borderRadius: 8, justifyContent: 'center' },
  addButtonText: { ...typography.button },
  balanceValueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  balanceValue: { fontSize: 32, fontWeight: '700', color: colors.textPrimary },
  balanceLoader: { marginTop: spacing.xs },
  pnlText: { fontSize: 14, color: colors.textSecondary },
  pnlAmount: { fontWeight: '600' },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.xs
  },
  quickItem: {
    width: '23%',
    alignItems: 'center',
    gap: spacing.xs
  },
  quickIconSurface: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.divider,
    position: 'relative',
    shadowColor: '#0f172a0f',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4
  },
  quickIconAccent: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.brandTint
  },
  quickLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center'
  },
  widgetCard: { backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, shadowColor: '#0000000a', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2, gap: spacing.md },
  widgetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  widgetTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  widgetBody: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  assetAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E9EDF5' },
  assetInfo: { flex: 1, gap: spacing.xs },
  assetSymbol: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  assetBadge: { alignSelf: 'flex-start', backgroundColor: colors.surfaceMuted, borderRadius: 6, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  assetBadgeText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  tradeButton: { backgroundColor: colors.brand, borderRadius: 8, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs },
  tradeButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  bannerCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 10, backgroundColor: colors.brand },
  bannerHeadline: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  bannerDescription: { fontSize: 13, color: '#FFFFFF', opacity: 0.9 },
  bannerAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.brandTint, alignItems: 'center', justifyContent: 'center' },
  tileRow: { flexDirection: 'row', gap: spacing.md },
  tileCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, borderWidth: 1, borderColor: colors.divider, gap: spacing.sm },
  tileHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tileTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  tileSubtitle: { fontSize: 13, color: colors.textSecondary },
  tileFooter: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tileIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  tileBadge: { borderRadius: 6, paddingHorizontal: spacing.sm * 2, paddingVertical: spacing.xs },
  tileBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  tabStrip: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  tabItem: { alignItems: 'center', gap: spacing.xs },
  tabLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  tabLabelActive: { color: colors.textPrimary },
  tabIndicator: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand },
  metricRow: { flexDirection: 'row', gap: spacing.md, marginBottom: spacing.md },
  metricCard: { flex: 1, backgroundColor: colors.surface, borderRadius: 10, padding: spacing.md, borderWidth: 1, borderColor: colors.divider, gap: spacing.xs },
  metricLabel: { fontSize: 13, color: colors.textSecondary },
  metricValue: { fontSize: 16, fontWeight: '700', color: colors.textPrimary }
})
