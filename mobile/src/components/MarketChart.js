import { useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, View, Text, TouchableOpacity, useWindowDimensions } from 'react-native'
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg'
import { api } from '../api'
import { socket } from '../api/socket'
import { formatNumber } from '../utils/format'
import { mockCandles } from '../api/mockData'

const TIMEFRAMES = ['15s', '30s', '1m', '5m', '10m']
const MAX_CANDLES = 120

function tfToSeconds(tf) {
  const match = String(tf).match(/^(\d+)(s|m)$/)
  if (!match) return 60
  const value = Number(match[1])
  if (!Number.isFinite(value) || value <= 0) return 60
  return match[2] === 'm' ? value * 60 : value
}

export function MarketChart({
  symbol = 'BTCUSDT',
  trades = [],
  timeframe,
  onTimeframeChange,
  onPriceUpdate,
  summary = []
}) {
  const [candles, setCandles] = useState([])
  const [loading, setLoading] = useState(true)
  const candlesRef = useRef([])
  const tfSeconds = tfToSeconds(timeframe)
  const { width: windowWidth } = useWindowDimensions()

  useEffect(() => {
    let cancelled = false
    async function loadCandles() {
      setLoading(true)
      try {
        const response = await api().get('/api/market/candles', {
          params: {
            symbol,
            limit: MAX_CANDLES,
            tf: timeframe
          }
        })
        if (cancelled) return
        const formatted = (response.data || []).map(row => ({
          x: new Date((row.time ?? row.ts) * 1000),
          open: Number(row.open),
          close: Number(row.close),
          high: Number(row.high),
          low: Number(row.low)
        }))
        candlesRef.current = formatted
        setCandles(formatted)
      } catch (err) {
        console.error('Failed to fetch candles', err)
        if (!cancelled) {
          const fallback = mockCandles(MAX_CANDLES, tfSeconds)
          const formatted = fallback.map(row => ({
            x: new Date(row.time * 1000),
            open: Number(row.open),
            close: Number(row.close),
            high: Number(row.high),
            low: Number(row.low)
          }))
          candlesRef.current = formatted
          setCandles(formatted)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadCandles()
    return () => {
      cancelled = true
    }
  }, [symbol, timeframe])

  useEffect(() => {
    function handleTick(msg) {
      if (msg.symbol !== symbol) return
      const price = Number(msg.price)
      if (!Number.isFinite(price)) return

      onPriceUpdate?.(price)

      const bucketTime = Math.floor(msg.ts / tfSeconds) * tfSeconds
      const bucketDate = new Date(bucketTime * 1000)
      const nextCandles = [...candlesRef.current]
      const last = nextCandles[nextCandles.length - 1]

      if (!last || last.x.getTime() < bucketDate.getTime()) {
        const newCandle = {
          x: bucketDate,
          open: last?.close ?? price,
          close: price,
          high: price,
          low: price
        }
        nextCandles.push(newCandle)
        if (nextCandles.length > MAX_CANDLES) {
          nextCandles.splice(0, nextCandles.length - MAX_CANDLES)
        }
        candlesRef.current = nextCandles
        setCandles(nextCandles)
        return
      }

      if (last && last.x.getTime() === bucketDate.getTime()) {
        const updated = {
          ...last,
          close: price,
          high: Math.max(last.high, price),
          low: Math.min(last.low, price)
        }
        nextCandles[nextCandles.length - 1] = updated
        candlesRef.current = nextCandles
        setCandles(nextCandles)
      }
    }

    socket.on('tick', handleTick)
    return () => {
      socket.off('tick', handleTick)
    }
  }, [symbol, tfSeconds, onPriceUpdate])

  const chartData = useMemo(() => candles.map(c => ({
    ...c,
    open: Number.isFinite(c.open) ? c.open : 0,
    close: Number.isFinite(c.close) ? c.close : 0,
    high: Number.isFinite(c.high) ? c.high : 0,
    low: Number.isFinite(c.low) ? c.low : 0
  })), [candles])

  const maxCandlesToRender = Math.min(chartData.length, 60)
  const visibleData = useMemo(() => chartData.slice(-maxCandlesToRender), [chartData, maxCandlesToRender])

  const chartWidth = Math.max(240, windowWidth - 64)
  const chartHeight = 280
  const priceHigh = useMemo(() => {
    if (!visibleData.length) return 1
    return Math.max(...visibleData.map(c => c.high))
  }, [visibleData])
  const priceLow = useMemo(() => {
    if (!visibleData.length) return 0
    return Math.min(...visibleData.map(c => c.low))
  }, [visibleData])
  const priceRange = Math.max(priceHigh - priceLow, 1)

  const yScale = (value) => {
    if (!Number.isFinite(value)) return chartHeight / 2
    return chartHeight - ((value - priceLow) / priceRange) * chartHeight
  }

  const candleSpacing = chartWidth / Math.max(visibleData.length, 1)
  const candleBodyWidth = candleSpacing * 0.6

  const yLabels = useMemo(() => {
    return [
      priceHigh,
      priceLow + (priceRange * 0.5),
      priceLow
    ]
  }, [priceHigh, priceLow, priceRange])

  const xLabels = useMemo(() => {
    if (visibleData.length === 0) return []
    const step = Math.max(Math.floor(visibleData.length / 3), 1)
    const indices = []
    for (let i = 0; i < visibleData.length; i += step) {
      indices.push(i)
    }
    if (indices[indices.length - 1] !== visibleData.length - 1) {
      indices.push(visibleData.length - 1)
    }
    return indices.map((dataIndex) => {
      const candle = visibleData[dataIndex]
      return {
        dataIndex,
        label: `${candle.x.getHours().toString().padStart(2, '0')}:${candle.x.getMinutes().toString().padStart(2, '0')}`
      }
    })
  }, [visibleData])

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.headerLabel}>Timeframe</Text>
        <View style={styles.segmented}>
          {TIMEFRAMES.map(tf => {
            const active = tf === timeframe
            return (
              <TouchableOpacity
                key={tf}
                onPress={() => onTimeframeChange?.(tf)}
                style={[styles.segmentButton, active && styles.segmentButtonActive]}
              >
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{tf.toUpperCase()}</Text>
              </TouchableOpacity>
            )
          })}
        </View>
      </View>

      {summary?.length ? (
        <View style={styles.summaryGrid}>
          {summary.map(item => {
            const toneMap = {
              primary: '#111827',
              success: '#15803d',
              danger: '#b91c1c',
              muted: '#64748b'
            }
            const tone = toneMap[item.tone] ?? '#334155'
            return (
              <View key={item.label} style={styles.summaryCell}>
                <Text style={styles.summaryLabel}>{item.label}</Text>
                <Text style={[styles.summaryValue, { color: tone }, item.monospace && styles.summaryMono]}>
                  {item.value ?? '--'}
                </Text>
              </View>
            )
          })}
        </View>
      ) : null}

      <View style={[styles.chartContainer, { height: chartHeight + 48 }]}>
        {loading ? (
          <ActivityIndicator color="#1d4ed8" />
        ) : visibleData.length === 0 ? (
          <Text style={styles.emptyLabel}>No market data</Text>
        ) : (
          <Svg width={chartWidth + 56} height={chartHeight + 40}>
            <G translateX={40} translateY={8}>
              {/* Horizontal grid */}
              {yLabels.map((label, idx) => {
                const y = yScale(label)
                return (
                  <G key={`grid-${idx}`}>
                    <Line
                      x1={0}
                      x2={chartWidth}
                      y1={y}
                      y2={y}
                      stroke="#e2e8f0"
                      strokeDasharray="4 4"
                    />
                    <SvgText x={-8} y={y + 4} fontSize={10} fill="#64748b" textAnchor="end">
                      {formatNumber(label)}
                    </SvgText>
                  </G>
                )
              })}

              {/* Candles */}
              {visibleData.map((candle, idx) => {
                const x = idx * candleSpacing + candleSpacing / 2
                const isBullish = candle.close >= candle.open
                const bodyTop = yScale(isBullish ? candle.close : candle.open)
                const bodyBottom = yScale(isBullish ? candle.open : candle.close)
                const wickHigh = yScale(candle.high)
                const wickLow = yScale(candle.low)
                const color = isBullish ? '#16a34a' : '#dc2626'

                return (
                  <G key={`candle-${idx}`}>
                    <Line
                      x1={x}
                      x2={x}
                      y1={wickHigh}
                      y2={wickLow}
                      stroke={color}
                      strokeWidth={2}
                    />
                    <Rect
                      x={x - candleBodyWidth / 2}
                      y={Math.min(bodyTop, bodyBottom)}
                      width={candleBodyWidth}
                      height={Math.abs(bodyBottom - bodyTop) || 2}
                      fill={color}
                      rx={candleBodyWidth * 0.2}
                    />
                  </G>
                )
              })}

              {/* X-axis */}
              <Line
                x1={0}
                x2={chartWidth}
                y1={chartHeight}
                y2={chartHeight}
                stroke="#e2e8f0"
              />
              {xLabels.map(({ dataIndex, label }, idx) => (
                <SvgText
                  key={`xlabel-${idx}`}
                  x={dataIndex * candleSpacing + candleSpacing / 2}
                  y={chartHeight + 16}
                  fontSize={10}
                  fill="#64748b"
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              ))}
            </G>
          </Svg>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 16
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  headerLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#475569'
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 999,
    padding: 4
  },
  segmentButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999
  },
  segmentButtonActive: {
    backgroundColor: '#1d4ed8'
  },
  segmentLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b'
  },
  segmentLabelActive: {
    color: '#ffffff'
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16
  },
  summaryCell: {
    width: '45%',
    gap: 4
  },
  summaryLabel: {
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#94a3b8'
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700'
  },
  summaryMono: {
    fontFamily: 'monospace'
  },
  chartContainer: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyLabel: {
    fontSize: 12,
    color: '#94a3b8'
  }
})
