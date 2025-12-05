import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { colors, spacing } from '../theme'
import { submitForexOrder } from '../api/alpacaTradingApi'

const ORDER_TYPES = ['Market', 'Limit', 'Stop']
const LOT_SIZE = 100000

export function ForexOrderTicket({
  symbol = 'EUR/USD',
  executionSymbol = 'EURUSD',
  assetType = 'forex',
  bid = 1.0845,
  ask = 1.0847,
  timeframe = 'M15',
  defaultSide = 'buy',
  onSubmit
}) {
  const [side, setSide] = useState('buy')
  const [orderType, setOrderType] = useState('Market')
  const [volume, setVolume] = useState(assetType === 'forex' ? 1.0 : 10)
  const [stopLoss, setStopLoss] = useState(null)
  const [takeProfit, setTakeProfit] = useState(null)
  const [comment, setComment] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const priceDecimals = assetType === 'forex' ? 5 : 2
  const volumeStep = assetType === 'forex' ? 0.1 : 1
  const minVolume = assetType === 'forex' ? 0.01 : 1
  const priceStep = assetType === 'forex' ? 0.0005 : 0.1

  useEffect(() => {
    setVolume(assetType === 'forex' ? 1.0 : 10)
    setStopLoss(null)
    setTakeProfit(null)
    setComment('')
    setError(null)
  }, [assetType, symbol])

  useEffect(() => {
    setSide(defaultSide)
  }, [defaultSide])

  const spread = useMemo(() => {
    if (!bid || !ask) return '—'
    const decimals = assetType === 'forex' ? 4 : 2
    return (ask - bid).toFixed(decimals)
  }, [ask, bid, assetType])
  const formatPrice = (value) => {
    if (value === null || value === undefined) return '—'
    return Number(value).toFixed(priceDecimals)
  }
  const formatCurrency = (value) => {
    const number = Number(value ?? 0)
    if (Number.isNaN(number)) return '$0.00'
    return `$${number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }
  const notionalValue = useMemo(() => {
    if (assetType === 'forex') {
      return volume * LOT_SIZE * (bid || ask || 1)
    }
    const mid = (bid && ask) ? (bid + ask) / 2 : ask || bid || 0
    return volume * mid
  }, [assetType, volume, bid, ask])

  const adjustVolume = (delta) => {
    setVolume(prev => {
      const next = Math.max(minVolume, +(prev + delta).toFixed(assetType === 'forex' ? 2 : 0))
      return next
    })
  }

  const adjustLevel = (setter, delta) => {
    setter(prev => {
      const base = prev === null ? bid : prev
      const next = +(base + delta).toFixed(assetType === 'forex' ? 4 : 2)
      return next > 0 ? next : base
    })
  }

  const handleSubmit = async () => {
    setError(null)
    if (!volume || Number.isNaN(volume) || volume <= 0) {
      setError('Size must be greater than zero.')
      return
    }
    const payload = {
      displaySymbol: symbol,
      executionSymbol,
      assetType,
      side,
      orderType,
      volume,
      stopLoss,
      takeProfit,
      price: side === 'buy' ? ask : bid,
      timestamp: new Date().toISOString(),
      timeframe,
      comment: comment.trim()
    }
    try {
      setSubmitting(true)
      const response = await submitForexOrder({
        symbol: executionSymbol,
        assetType,
        side,
        orderType: orderType.toLowerCase(),
        volume,
        stopLoss,
        takeProfit,
        price: payload.price,
        limitPrice: orderType !== 'Market' ? payload.price : undefined,
        stopPrice: orderType === 'Stop' ? stopLoss : undefined,
        comment: payload.comment,
        clientOrderId: `mobile-${Date.now()}`
      })
      if (typeof onSubmit === 'function') {
        onSubmit({ ...payload, response })
      }
      setComment('')
    } catch (err) {
      console.error('submitForexOrder error', err)
      setError(err.message ?? 'Failed to submit order.')
    } finally {
      setSubmitting(false)
    }
  }

  const ctaColor = side === 'buy' ? colors.success : colors.danger
  const volumeLabel = assetType === 'forex' ? 'Volume (Lots)' : 'Quantity (Shares)'
  const displayVolume = volume.toFixed(assetType === 'forex' ? 2 : 0)

  return (
    <View style={styles.ticket}>
      <View style={styles.ticketHeader}>
        <Text style={styles.ticketTitle}>{symbol}</Text>
        <Text style={styles.ticketSubtitle}>{timeframe} • Spread {spread}</Text>
      </View>

      <View style={styles.sideSwitch}>
        {['buy', 'sell'].map(option => (
          <TouchableOpacity
            key={option}
            onPress={() => setSide(option)}
            activeOpacity={0.85}
            style={[
              styles.sideButton,
              option === side && styles.sideButtonActive,
              option === 'buy' ? styles.sideBuy : styles.sideSell
            ]}
          >
            <Text style={[
              styles.sideLabel,
              option === side ? styles.sideLabelActive : styles.sideLabelInactive
            ]}
            >
              {option === 'buy' ? 'Buy' : 'Sell'}
            </Text>
            <Text style={styles.sidePrice}>
              {bid && ask ? formatPrice(option === 'buy' ? ask : bid) : '—'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>{volumeLabel}</Text>
        <View style={styles.adjustRow}>
          <AdjustButton label="−" onPress={() => adjustVolume(-volumeStep)} />
          <TextInput
            style={styles.volumeInput}
            value={displayVolume}
            keyboardType="numeric"
            onChangeText={(text) => {
              const parsed = parseFloat(text)
              if (!Number.isNaN(parsed)) {
                setVolume(parsed)
              } else if (text === '') {
                setVolume(0)
              }
            }}
          />
          <AdjustButton label="+" onPress={() => adjustVolume(volumeStep)} />
        </View>
        <Text style={styles.helperText}>
          Notional ≈ {formatCurrency(notionalValue)}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Order type</Text>
        <View style={styles.typeRow}>
          {ORDER_TYPES.map(type => {
            const active = orderType === type
            return (
              <TouchableOpacity
                key={type}
                onPress={() => setOrderType(type)}
                style={[styles.typeChip, active && styles.typeChipActive]}
                activeOpacity={0.85}
              >
                <Text style={[styles.typeChipLabel, active && styles.typeChipLabelActive]}>
                  {type}
                </Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Risk controls</Text>
        <View style={styles.controlBlock}>
          <Text style={styles.controlLabel}>Stop loss</Text>
          <View style={styles.adjustRow}>
            <AdjustButton label="−" onPress={() => adjustLevel(setStopLoss, -priceStep)} />
            <Text style={styles.adjustValue}>{stopLoss?.toFixed(assetType === 'forex' ? 4 : 2) ?? '—'}</Text>
            <AdjustButton label="+" onPress={() => adjustLevel(setStopLoss, priceStep)} />
          </View>
        </View>
        <View style={styles.controlBlock}>
          <Text style={styles.controlLabel}>Take profit</Text>
          <View style={styles.adjustRow}>
            <AdjustButton label="−" onPress={() => adjustLevel(setTakeProfit, -priceStep)} />
            <Text style={styles.adjustValue}>{takeProfit?.toFixed(assetType === 'forex' ? 4 : 2) ?? '—'}</Text>
            <AdjustButton label="+" onPress={() => adjustLevel(setTakeProfit, priceStep)} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Comment</Text>
        <TextInput
          style={styles.commentInput}
          value={comment}
          placeholder="Add execution notes…"
          placeholderTextColor="#9AA1B1"
          onChangeText={setComment}
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <TouchableOpacity
        onPress={handleSubmit}
        activeOpacity={0.85}
        style={[
          styles.submitButton,
          { backgroundColor: ctaColor },
          submitting && styles.submitButtonDisabled
        ]}
        disabled={submitting}
      >
        <Text style={styles.submitLabel}>
          {submitting
            ? 'Submitting…'
            : side === 'buy'
              ? `Buy ${symbol.split('/')[0]}`
              : `Sell ${symbol.split('/')[0]}`}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function AdjustButton({ label, onPress }) {
  return (
    <TouchableOpacity style={styles.adjustButton} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.adjustButtonLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  ticket: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E3E9F3',
    shadowColor: '#0f172a0a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6
  },
  ticketHeader: {
    gap: 6
  },
  ticketTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary
  },
  ticketSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  sideSwitch: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  sideButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#E6E8EF'
  },
  sideButtonActive: {
    borderColor: '#BBD6FF',
    backgroundColor: '#EAF2FF'
  },
  sideBuy: {},
  sideSell: {},
  sideLabel: {
    fontSize: 14,
    fontWeight: '600'
  },
  sideLabelActive: {
    color: colors.brand
  },
  sideLabelInactive: {
    color: colors.textSecondary
  },
  sidePrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  section: {
    gap: spacing.xs
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  typeChip: {
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: '#D6DCE8'
  },
  typeChipActive: {
    borderColor: colors.brand,
    backgroundColor: colors.brandTint
  },
  typeChipLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  typeChipLabelActive: {
    color: colors.brand
  },
  adjustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  adjustButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D6DCE8',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F2F5FB'
  },
  adjustButtonLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary
  },
  adjustValue: {
    minWidth: 70,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  volumeInput: {
    minWidth: 80,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    borderBottomWidth: 1,
    borderBottomColor: '#D3D8E5'
  },
  controlBlock: {
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  controlLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600'
  },
  commentInput: {
    borderWidth: 1,
    borderColor: '#D6DBE8',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: '#F7F9FC'
  },
  submitButton: {
    marginTop: spacing.sm,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    alignItems: 'center'
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  submitButtonDisabled: {
    opacity: 0.7
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600'
  },
  helperText: {
    fontSize: 11,
    color: colors.textSecondary
  }
})

export default ForexOrderTicket
