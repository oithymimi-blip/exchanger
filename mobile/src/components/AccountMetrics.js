import { StyleSheet, Text, View } from 'react-native'
import { formatCurrency } from '../utils/format'

export function AccountMetrics({ metrics = [] }) {
  return (
    <View style={styles.container}>
      {metrics.map((metric) => {
        const Formatter = metric.formatter || formatCurrency
        const value = Formatter(metric.value)
        return (
          <View key={metric.label} style={styles.card}>
            <Text style={styles.label}>{metric.label}</Text>
            <Text style={[styles.value, metric.accent && { color: metric.accent }]}>{value}</Text>
            {metric.secondary ? (
              <Text style={styles.secondary}>{metric.secondary}</Text>
            ) : null}
          </View>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12
  },
  card: {
    width: '47%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 6
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a'
  },
  secondary: {
    fontSize: 12,
    color: '#64748b'
  }
})
