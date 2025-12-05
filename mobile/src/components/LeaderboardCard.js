import { useEffect, useState } from 'react'
import { FlatList, StyleSheet, Text, View } from 'react-native'
import { api } from '../api'
import { formatCurrency } from '../utils/format'

export function LeaderboardCard() {
  const [rows, setRows] = useState([])

  useEffect(() => {
    let mounted = true
    api().get('/api/trades/leaderboard')
      .then(res => {
        if (mounted) setRows(res.data || [])
      })
      .catch(err => console.error('Failed to load leaderboard', err))
    return () => { mounted = false }
  }, [])

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text style={styles.label}>Top traders</Text>
          <Text style={styles.title}>Leaderboard</Text>
        </View>
        <Text style={styles.count}>{rows.length} entries</Text>
      </View>
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No leaderboard entries yet.</Text>
        </View>
      ) : (
        <View style={styles.rowsContainer}>
          {rows.map((item, index) => {
            const pnl = Number(item.realized_pnl ?? 0)
            const positive = pnl >= 0
            return (
              <View key={item.user_id ?? index} style={styles.row}>
                <Text style={styles.rank}>#{index + 1}</Text>
                <View style={styles.rowInfo}>
                  <Text style={styles.handle}>{item.handle || item.email || 'anon'}</Text>
                  <Text style={[styles.pnl, positive ? styles.pnlPositive : styles.pnlNegative]}>
                    {formatCurrency(pnl)}
                  </Text>
                </View>
              </View>
            )
          })}
        </View>
      )}
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
    gap: 16
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  label: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#94a3b8'
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a'
  },
  count: {
    fontSize: 12,
    color: '#64748b'
  },
  empty: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 18,
    alignItems: 'center'
  },
  emptyText: {
    fontSize: 13,
    color: '#94a3b8'
  },
  rowsContainer: {
    gap: 8
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12
  },
  rank: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b'
  },
  rowInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  handle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a'
  },
  pnl: {
    fontFamily: 'monospace',
    fontSize: 14,
    fontWeight: '700'
  },
  pnlPositive: {
    color: '#16a34a'
  },
  pnlNegative: {
    color: '#dc2626'
  }
})
