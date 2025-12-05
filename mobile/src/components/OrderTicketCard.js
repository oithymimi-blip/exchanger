import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { api } from '../api'
import { useAuth } from '../stores/authStore'
import { formatCurrency } from '../utils/format'

export function OrderTicketCard({ onPlaced }) {
  const { token } = useAuth()
  const [amount, setAmount] = useState('100')
  const [submitting, setSubmitting] = useState(false)
  const [activeSide, setActiveSide] = useState(null)
  const [message, setMessage] = useState('')

  const submit = async (side) => {
    if (!token) {
      setMessage('Sign in to trade.')
      return
    }
    const value = Number(amount)
    if (!Number.isFinite(value) || value <= 0) {
      setMessage('Enter a valid amount.')
      return
    }

    setSubmitting(true)
    setActiveSide(side)
    setMessage('')

    try {
      const res = await api(token).post('/api/trades', { side, amount: value })
      const fillPrice = Number(res.data?.price)
      if (!Number.isFinite(fillPrice)) {
        throw new Error('Invalid fill price')
      }
      const verb = side === 'buy' ? 'Bought' : 'Sold'
      setMessage(`${verb} ${formatCurrency(value)} @ ${fillPrice.toFixed(2)}`)
      onPlaced?.(res.data)
    } catch (err) {
      setMessage(err?.response?.data?.error || 'Order failed.')
    } finally {
      setSubmitting(false)
      setActiveSide(null)
    }
  }

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Forex order</Text>
      <Text style={styles.label}>Amount (USD)</Text>
      <TextInput
        keyboardType="numeric"
        value={amount}
        onChangeText={setAmount}
        placeholder="100"
        style={styles.input}
      />
      <View style={styles.buttonRow}>
        <TouchableOpacity
          style={[styles.button, styles.buyButton, activeSide === 'buy' && styles.buttonActive]}
          disabled={submitting}
          onPress={() => submit('buy')}
        >
          {submitting && activeSide === 'buy' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Buy @ Market</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.sellButton, activeSide === 'sell' && styles.buttonActive]}
          disabled={submitting}
          onPress={() => submit('sell')}
        >
          {submitting && activeSide === 'sell' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.buttonText}>Sell @ Market</Text>
          )}
        </TouchableOpacity>
      </View>
      {message ? <Text style={styles.message}>{message}</Text> : null}
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
  heading: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#475569',
    fontWeight: '600'
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155'
  },
  input: {
    borderWidth: 1,
    borderColor: '#cbd5f5',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#0f172a',
    backgroundColor: '#f8fafc'
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center'
  },
  buyButton: {
    backgroundColor: '#16a34a'
  },
  sellButton: {
    backgroundColor: '#dc2626'
  },
  buttonActive: {
    opacity: 0.6
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14
  },
  message: {
    fontSize: 12,
    color: '#475569'
  }
})
