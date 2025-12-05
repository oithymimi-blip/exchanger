import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { useAuth } from '../stores/authStore'
import { api } from '../api'
import { formatCurrency } from '../utils/format'
import { MarketChart } from './MarketChart'
import { mockBinaryOverview } from '../api/mockData'

const FALLBACK_DURATIONS = [30, 60, 120, 300]

function formatSeconds(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  if (minutes <= 0) {
    return `${remainder}s`
  }
  return `${minutes}m ${remainder.toString().padStart(2, '0')}s`
}

export function BinaryOptionsPanel({
  symbol,
  summary,
  timeframe,
  onTimeframeChange,
  onPriceUpdate,
  onAccountRefresh,
  onBalanceSnapshot
}) {
  const { token } = useAuth()
  const [amount, setAmount] = useState('25')
  const [duration, setDuration] = useState(60)
  const [placingSide, setPlacingSide] = useState(null)
  const [message, setMessage] = useState('Loading binary overview…')
  const [overview, setOverview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [nowTs, setNowTs] = useState(() => Math.floor(Date.now() / 1000))

  useEffect(() => {
    const interval = setInterval(() => setNowTs(Math.floor(Date.now() / 1000)), 1000)
    return () => clearInterval(interval)
  }, [])

  const durations = overview?.durations?.length ? overview.durations : FALLBACK_DURATIONS
  const payoutRate = overview?.payoutRate ?? 0.8

  const fetchOverview = useCallback(async () => {
    if (!token) {
      setOverview(null)
      setMessage('Sign in to trade binary options.')
      return
    }
    setLoading(true)
    try {
      const response = await api(token).get('/api/binary-trades/overview', { params: { limit: 20 } })
      const data = response.data || {}
      setOverview(data)
      if (data.balance) {
        onBalanceSnapshot?.(data.balance)
      }
      if (data.durations?.length && !data.durations.includes(duration)) {
        setDuration(data.durations[0])
      }
      if ((data.open?.length || data.history?.length)) {
        setMessage('')
      } else {
        setMessage('No binary trades yet — place your first position to see results here.')
      }
    } catch (err) {
      console.error('Failed to load binary overview', err)
      const fallback = mockBinaryOverview()
      setOverview(fallback)
      onBalanceSnapshot?.(fallback.balance)
      setMessage('Showing simulated binary data (offline).')
    } finally {
      setLoading(false)
    }
  }, [token, duration, onBalanceSnapshot])

  useEffect(() => {
    fetchOverview()
    const refreshId = setInterval(fetchOverview, 5000)
    return () => clearInterval(refreshId)
  }, [fetchOverview])

  const openTrades = useMemo(() => {
    const now = nowTs
    return (overview?.open || []).map(trade => ({
      ...trade,
      time_left: Math.max(0, Number(trade.expiry_ts ?? 0) - now)
    }))
  }, [overview?.open, nowTs])

  const history = useMemo(() => overview?.history || [], [overview?.history])
  const stats = overview?.stats || { total: 0, win: 0, lose: 0, push: 0, net: 0 }
  const balance = overview?.balance || null

  const place = useCallback(async (direction) => {
    if (!token) {
      setMessage('Sign in to trade binary options.')
      return
    }
    const numericAmount = Number(amount)
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setMessage('Enter a valid stake.')
      return
    }
    setPlacingSide(direction)
    setMessage('')
    try {
      await api(token).post('/api/binary-trades', {
        direction,
        amount: numericAmount,
        duration
      })
      await fetchOverview()
      onAccountRefresh?.()
    } catch (err) {
      console.error('Binary trade failed, using offline simulation', err)
      const fallback = mockBinaryOverview()
      setOverview(fallback)
      setMessage('Offline mode: simulated binary trade recorded.')
    } finally {
      setPlacingSide(null)
    }
  }, [token, amount, duration, fetchOverview, onAccountRefresh])

  if (!token) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.lockedCard}>
          <Text style={styles.lockedTitle}>Binary Options</Text>
          <Text style={styles.lockedText}>Sign in to access binary options trading.</Text>
        </View>
      </View>
    )
  }

  const messageStyle = useMemo(() => {
    if (!message) return null
    if (message.includes('Failed') || message.includes('unable')) {
      return styles.messageError
    }
    if (message.includes('Sign in')) {
      return styles.messageWarn
    }
    if (message.includes('No binary trades')) {
      return styles.messageInfo
    }
    return styles.messageSuccess
  }, [message])

  return (
    <View style={styles.wrapper}>
      <MarketChart
        symbol={symbol}
        trades={[]}
        timeframe={timeframe}
        onTimeframeChange={onTimeframeChange}
        onPriceUpdate={onPriceUpdate}
        summary={summary}
      />

      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Binary Options</Text>
          <Text style={styles.panelSubtitle}>Fixed payout {Math.round(payoutRate * 100)}%</Text>
        </View>

        {message ? (
          <View style={[styles.messageBox, messageStyle]}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Expiry</Text>
          <View style={styles.durationRow}>
            {durations.map(value => {
              const active = value === duration
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.durationButton, active && styles.durationButtonActive]}
                  onPress={() => setDuration(value)}
                >
                  <Text style={[styles.durationText, active && styles.durationTextActive]}>
                    {value >= 60 ? `${value / 60}m` : `${value}s`}
                  </Text>
                </TouchableOpacity>
              )
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Stake (USD)</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            placeholder="25"
            keyboardType="numeric"
            style={styles.input}
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.callButton, placingSide === 'call' && styles.actionButtonDisabled]}
            onPress={() => place('call')}
            disabled={placingSide === 'call'}
          >
            {placingSide === 'call' ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.actionText}>Call (↑)</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.putButton, placingSide === 'put' && styles.actionButtonDisabled]}
            onPress={() => place('put')}
            disabled={placingSide === 'put'}
          >
            {placingSide === 'put' ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.actionText}>Put (↓)</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.balanceGrid}>
          <View style={styles.balanceCell}>
            <Text style={styles.balanceLabel}>Available</Text>
            <Text style={styles.balanceValue}>{balance ? formatCurrency(balance.available) : '--'}</Text>
          </View>
          <View style={styles.balanceCell}>
            <Text style={styles.balanceLabel}>Locked</Text>
            <Text style={styles.balanceValue}>{balance ? formatCurrency(balance.locked) : '--'}</Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsRow}>
            <Text style={styles.statsKey}>Trades</Text>
            <Text style={styles.statsValue}>{stats.total}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsKey}>Wins</Text>
            <Text style={[styles.statsValue, styles.win]}>{stats.win}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsKey}>Losses</Text>
            <Text style={[styles.statsValue, styles.loss]}>{stats.lose}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={styles.statsKey}>Push</Text>
            <Text style={styles.statsValue}>{stats.push}</Text>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsRow}>
            <Text style={[styles.statsKey, styles.statsNet]}>Net Payout</Text>
            <Text style={[styles.statsValue, stats.net >= 0 ? styles.win : styles.loss]}>
              {formatCurrency(stats.net)}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Open positions</Text>
          {openTrades.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No open positions.</Text>
            </View>
          ) : (
            <View style={styles.listStack}>
              {openTrades.map(trade => (
                <View key={trade.id} style={styles.positionCard}>
                  <View>
                    <Text style={[styles.positionDirection, trade.direction === 'call' ? styles.win : styles.loss]}>
                      {trade.direction === 'call' ? 'Call ↑' : 'Put ↓'}
                    </Text>
                    <Text style={styles.positionMeta}>Stake {formatCurrency(trade.stake)}</Text>
                    <Text style={styles.positionMeta}>Potential {formatCurrency(trade.potential_return)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.positionMetaLabel}>Time Left</Text>
                    <Text style={styles.positionCountdown}>{formatSeconds(trade.time_left)}</Text>
                    <Text style={styles.positionMetaLabel}>Entry {formatCurrency(trade.entry_price)}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Recent results</Text>
          {history.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>No settlements yet.</Text>
            </View>
          ) : (
            <View style={styles.listStack}>
              {history.map(trade => (
                <View key={trade.id} style={styles.historyCard}>
                  <View>
                    <Text style={styles.historyTime}>
                      {new Date((trade.settled_ts || trade.expiry_ts) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={styles.historyDirection}>{trade.direction}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text
                      style={[
                        styles.historyResult,
                        trade.result === 'win'
                          ? styles.win
                          : trade.result === 'lose'
                            ? styles.loss
                            : styles.neutral
                      ]}
                    >
                      {trade.result === 'win'
                        ? `+${formatCurrency(trade.payout)}`
                        : trade.result === 'lose'
                          ? `-${formatCurrency(trade.stake)}`
                          : trade.result === 'push'
                            ? 'Push'
                            : 'Pending'}
                    </Text>
                    <Text style={styles.positionMetaLabel}>
                      Close {formatCurrency(trade.settlement_price ?? trade.entry_price)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {loading ? (
          <View style={styles.footerStatus}>
            <ActivityIndicator size="small" color="#1d4ed8" />
            <Text style={styles.footerStatusText}>Refreshing…</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16
  },
  lockedCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 20,
    gap: 8
  },
  lockedTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  lockedText: {
    fontSize: 13,
    color: '#475569'
  },
  panel: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 16
  },
  panelHeader: {
    gap: 4
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  panelSubtitle: {
    fontSize: 13,
    color: '#64748b'
  },
  messageBox: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14
  },
  messageText: {
    fontSize: 12,
    fontWeight: '500'
  },
  messageError: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
    borderWidth: 1
  },
  messageWarn: {
    backgroundColor: '#fef3c7',
    borderColor: '#fde68a',
    borderWidth: 1
  },
  messageInfo: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderWidth: 1
  },
  messageSuccess: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
    borderWidth: 1
  },
  section: {
    gap: 8
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  durationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8
  },
  durationButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#f8fafc'
  },
  durationButtonActive: {
    borderColor: '#34d399',
    backgroundColor: '#dcfce7'
  },
  durationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1e293b'
  },
  durationTextActive: {
    color: '#047857'
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5f5',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#f8fafc',
    color: '#0f172a'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  actionButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  actionButtonDisabled: {
    opacity: 0.7
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff'
  },
  callButton: {
    backgroundColor: '#16a34a'
  },
  putButton: {
    backgroundColor: '#dc2626'
  },
  balanceGrid: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14
  },
  balanceCell: {
    flex: 1,
    gap: 4
  },
  balanceLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  balanceValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a'
  },
  statsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 16,
    gap: 8
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  statsKey: {
    fontSize: 13,
    color: '#475569'
  },
  statsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  statsDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    marginVertical: 4
  },
  statsNet: {
    fontWeight: '700'
  },
  win: {
    color: '#16a34a'
  },
  loss: {
    color: '#dc2626'
  },
  neutral: {
    color: '#64748b'
  },
  listStack: {
    gap: 8
  },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
    padding: 14
  },
  emptyCardText: {
    fontSize: 12,
    color: '#64748b'
  },
  positionCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  positionDirection: {
    fontSize: 14,
    fontWeight: '700'
  },
  positionMeta: {
    fontSize: 12,
    color: '#475569'
  },
  positionMetaLabel: {
    fontSize: 11,
    color: '#94a3b8'
  },
  positionCountdown: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a'
  },
  historyCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  historyTime: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  historyDirection: {
    fontSize: 12,
    color: '#475569',
    textTransform: 'capitalize'
  },
  historyResult: {
    fontSize: 13,
    fontWeight: '700'
  },
  footerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  footerStatusText: {
    fontSize: 12,
    color: '#64748b'
  }
})
