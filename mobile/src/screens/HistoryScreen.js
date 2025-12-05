import { useCallback, useEffect, useState } from 'react'
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  useWindowDimensions
} from 'react-native'
import { api } from '../api'
import { useAuth } from '../stores/authStore'
import { formatCurrency } from '../utils/format'

function TradeRow({ trade, compact }) {
  const qty = Number(trade.qty || 0)
  const amount = Number(trade.stake_amount ?? trade.notional ?? trade.price * qty)
  const pipSize = Number(trade.pip_size ?? 0.0001)
  const pipValue = Number(trade.pip_value ?? qty * pipSize)
  const pnlUsd = Number(trade.pnl ?? 0)
  const pipsRealized = pipValue > 0 ? pnlUsd / pipValue : 0

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      <View style={styles.rowHeader}>
        <Text style={styles.rowTime}>{new Date(trade.created_at).toLocaleString()}</Text>
        <Text style={[styles.rowSide, trade.side === 'buy' ? styles.rowSideBuy : styles.rowSideSell]}>
          {trade.side?.toUpperCase?.()}
        </Text>
      </View>
      <View style={[styles.rowGrid, compact && styles.rowGridCompact]}>
        <View>
          <Text style={styles.rowLabel}>Amount</Text>
          <Text style={styles.rowValue}>{formatCurrency(amount)}</Text>
        </View>
        <View>
          <Text style={styles.rowLabel}>Size</Text>
          <Text style={styles.rowValue}>{qty.toFixed(6)}</Text>
        </View>
        <View>
          <Text style={styles.rowLabel}>Entry</Text>
          <Text style={styles.rowValue}>{Number(trade.price ?? 0).toFixed(2)}</Text>
        </View>
        <View>
          <Text style={styles.rowLabel}>Exit</Text>
          <Text style={styles.rowValue}>{Number(trade.exit_price ?? trade.price ?? 0).toFixed(2)}</Text>
        </View>
      </View>
      <View style={[styles.rowFooter, compact && styles.rowFooterCompact]}>
        <Text style={styles.rowLabel}>PnL</Text>
        <Text style={[styles.rowPnl, pnlUsd >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
          {formatCurrency(pnlUsd)}
        </Text>
        <Text style={styles.rowPips}>{`${pipsRealized >= 0 ? '+' : ''}${pipsRealized.toFixed(2)} pips`}</Text>
      </View>
    </View>
  )
}

export function HistoryScreen() {
  const { width } = useWindowDimensions()
  const { token } = useAuth()
  const [trades, setTrades] = useState([])
  const [loading, setLoading] = useState(false)
  const isCompact = width < 360

  const fetchTrades = useCallback(async () => {
    if (!token) {
      setTrades([])
      return
    }
    setLoading(true)
    try {
      const response = await api(token).get('/api/trades')
      setTrades(response.data || [])
    } catch (err) {
      console.error('Failed to load trade history', err)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    fetchTrades()
  }, [fetchTrades])

  return (
    <View style={styles.container}>
      <FlatList
        data={trades}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TradeRow trade={item} compact={isCompact} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={[styles.listContent, isCompact && styles.listContentCompact]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchTrades} tintColor="#1d4ed8" />}
        ListHeaderComponent={
          <View style={[styles.header, isCompact && styles.headerCompact]}>
            <Text style={[styles.title, isCompact && styles.titleCompact]}>Trade history</Text>
            <Text style={styles.subtitle}>Review your filled and closed trades.</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              {token ? 'No trades recorded yet.' : 'Sign in to view your trading history.'}
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  listContent: {
    padding: 20,
    paddingBottom: 40
  },
  listContentCompact: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32
  },
  header: {
    marginBottom: 16,
    gap: 4
  },
  headerCompact: {
    marginBottom: 12
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a'
  },
  titleCompact: {
    fontSize: 20
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b'
  },
  empty: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    marginTop: 24
  },
  emptyText: {
    color: '#475569',
    fontSize: 13
  },
  row: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    padding: 16,
    gap: 12
  },
  rowCompact: {
    padding: 14,
    gap: 10
  },
  rowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  rowTime: {
    fontSize: 13,
    color: '#475569'
  },
  rowSide: {
    fontSize: 14,
    fontWeight: '700'
  },
  rowSideBuy: {
    color: '#16a34a'
  },
  rowSideSell: {
    color: '#dc2626'
  },
  rowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  rowGridCompact: {
    gap: 12
  },
  rowLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#94a3b8'
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  rowFooter: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12
  },
  rowFooterCompact: {
    flexWrap: 'wrap',
    gap: 8
  },
  rowPnl: {
    fontSize: 16,
    fontWeight: '700'
  },
  pnlPositive: {
    color: '#16a34a'
  },
  pnlNegative: {
    color: '#dc2626'
  },
  rowPips: {
    fontSize: 13,
    color: '#64748b'
  }
})
