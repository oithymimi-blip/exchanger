import { useMemo } from 'react'
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import { formatCurrency } from '../utils/format'

function TradeCard({ trade, onClose, closing }) {
  const pnlPositive = (trade.livePnl ?? trade.pnl ?? 0) >= 0
  const pnlDisplay = formatCurrency(trade.livePnl ?? trade.pnl ?? 0)
  const pipsValue = trade.isOpen ? trade.livePips : trade.realizedPips
  const pipsLabel = Number.isFinite(pipsValue) ? `${pipsValue >= 0 ? '+' : ''}${pipsValue.toFixed(2)} pips` : '--'
  const isOpen = Boolean(trade.isOpen)

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardHeaderLabel}>
          {trade.created_at ? new Date(trade.created_at).toLocaleString() : '--'}
        </Text>
        <Text style={styles.cardHeaderLabel}>{isOpen ? 'Open' : 'Closed'}</Text>
      </View>

      <View style={styles.cardBody}>
        <Text style={[styles.side, trade.side === 'buy' ? styles.sideBuy : styles.sideSell]}>
          {trade.side?.toUpperCase?.() || trade.side}
        </Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Amount</Text>
          <Text style={styles.rowValue}>
            {isOpen && trade.stakeAmount
              ? `${formatCurrency(trade.remainingStake)} / ${formatCurrency(trade.stakeAmount)}`
              : formatCurrency(trade.stakeAmount || trade.remainingStake)}
          </Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Entry</Text>
          <Text style={styles.rowValue}>{Number(trade.price ?? 0).toFixed(2)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>Current</Text>
          <Text style={styles.rowValue}>
            {trade.displayPrice != null ? Number(trade.displayPrice).toFixed(2) : '--'}
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <View>
          <Text style={styles.rowLabel}>PnL</Text>
          <Text style={[styles.pnlValue, pnlPositive ? styles.pnlPositive : styles.pnlNegative]}>{pnlDisplay}</Text>
          <Text style={styles.pipsLabel}>{pipsLabel}</Text>
        </View>
        {isOpen ? (
          <TouchableOpacity
            disabled={closing}
            style={[styles.closeButton, closing && styles.closeButtonDisabled]}
            onPress={() => onClose?.(trade.id)}
          >
            <Text style={styles.closeButtonText}>{closing ? 'Closing…' : 'Close trade'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  )
}

export function TradesList({ trades = [], onClose, closingIds = [], onCloseAll, hasOpenPositions, closingAll, refreshing }) {
  const closingSet = useMemo(() => new Set(closingIds), [closingIds])

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>Recent trades</Text>
          <Text style={styles.headerHint}>{refreshing ? 'Refreshing…' : `${trades.length} entries`}</Text>
        </View>
        {hasOpenPositions ? (
          <TouchableOpacity
            style={[styles.closeAllButton, closingAll && styles.closeButtonDisabled]}
            onPress={onCloseAll}
            disabled={closingAll}
          >
            <Text style={styles.closeAllText}>{closingAll ? 'Closing…' : 'Close all'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {trades.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No trades yet.</Text>
        </View>
      ) : (
        <FlatList
          data={trades}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TradeCard trade={item} onClose={onClose} closing={closingSet.has(item.id)} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={{ paddingVertical: 4 }}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 16,
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  headerHint: {
    fontSize: 12,
    color: '#64748b'
  },
  closeAllButton: {
    backgroundColor: '#1d4ed8',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999
  },
  closeAllText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13
  },
  closeButtonDisabled: {
    opacity: 0.5
  },
  empty: {
    paddingVertical: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8'
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 12
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  cardHeaderLabel: {
    fontSize: 11,
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  cardBody: {
    gap: 8
  },
  side: {
    fontSize: 18,
    fontWeight: '700'
  },
  sideBuy: {
    color: '#16a34a'
  },
  sideSell: {
    color: '#dc2626'
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  rowLabel: {
    fontSize: 12,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  rowValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pnlValue: {
    fontSize: 16,
    fontWeight: '700'
  },
  pnlPositive: {
    color: '#16a34a'
  },
  pnlNegative: {
    color: '#dc2626'
  },
  pipsLabel: {
    fontSize: 11,
    color: '#64748b'
  },
  closeButton: {
    backgroundColor: '#1d4ed8',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 10
  },
  closeButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13
  }
})
