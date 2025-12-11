import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, useWindowDimensions } from 'react-native'
import { Feather } from '@expo/vector-icons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { colors, spacing } from '../theme'
import { TradingViewWidget } from '../components/TradingViewWidget'
import { fetchForexCandles, fetchForexQuote } from '../api/forexApi'
import { fetchOtcCandles, postOtcTick } from '../api/otcApi'
import { api } from '../api'
import { useAuth } from '../stores/authStore'
import { closePosition, fetchAccountSummary, fetchOpenPositions, fetchRecentOrders } from '../api/alpacaTradingApi'

const TRADE_SEGMENTS = [
  { key: 'OTC_PRIMARY', label: 'OTC', icon: 'activity' },
  { key: 'BINARY', label: 'Binary', icon: 'divide-square' },
  { key: 'SPOT', label: 'Spot', icon: 'pie-chart' },
  { key: 'FUTURE', label: 'Future', icon: 'shuffle' },
  { key: 'ALPHA', label: 'Alpha', icon: 'trending-up' }
]
const FOREX_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1']

const TOP_SYMBOLS = [
  { label: 'EUR/USD', value: 'EURUSD', type: 'forex', description: 'EUR base • USD quote' },
  { label: 'GBP/USD', value: 'GBPUSD', type: 'forex', description: 'GBP base • USD quote' },
  { label: 'USD/JPY', value: 'USDJPY', type: 'forex', description: 'USD base • JPY quote' },
  { label: 'AUD/USD', value: 'AUDUSD', type: 'forex', description: 'AUD base • USD quote' },
  { label: 'USD/CAD', value: 'USDCAD', type: 'forex', description: 'USD base • CAD quote' },
  { label: 'XAU/USD', value: 'XAUUSD', type: 'forex', description: 'Gold • USD quote' },
  { label: 'AAPL', value: 'AAPL', type: 'equity', description: 'Apple Inc. — US Equity' },
  { label: 'TSLA', value: 'TSLA', type: 'equity', description: 'Tesla Inc. — US Equity' },
  { label: 'SPY', value: 'SPY', type: 'equity', description: 'S&P 500 ETF — US Equity' }
]

const PRICE_TABS = ['Price', 'Info', 'Trading Data', 'Square', 'Trade+']
const ORDER_TABS = ['Order Book', 'Trades', 'Network']
const OTC_ORDER_TABS = ['Order Book', 'Market Trades', 'Margin Data', 'Info']
const CHART_TOOL_ICONS = ['activity', 'bar-chart-2', 'git-branch', 'sliders', 'aperture', 'grid']
const PERFORMANCE_WINDOWS = [
  { label: 'Today', value: 0.58 },
  { label: '7 Days', value: -4.78 },
  { label: '30 Days', value: -15.53 },
  { label: '90 Days', value: -12.32 },
  { label: '180 Days', value: -0.81 },
  { label: '1 Year', value: 37.52 }
]
const OTC_INDICATORS = ['MA', 'EMA', 'BOLL', 'VOL', 'MACD', 'RSI', 'KDJ']

const ORDER_BOOK_ROWS = [
  { bidAmount: 3.36691, price: 102329.86, askAmount: 0.31766 },
  { bidAmount: 1.24811, price: 102329.45, askAmount: 0.41234 },
  { bidAmount: 0.98761, price: 102329.12, askAmount: 0.50291 },
  { bidAmount: 1.75123, price: 102328.77, askAmount: 0.73442 },
  { bidAmount: 2.02544, price: 102328.41, askAmount: 0.81231 }
]

const OTC_TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'Y1']
const OTC_TIMEFRAME_DRIFT = {
  M1: 0.0003,
  M5: 0.0005,
  M15: 0.0007,
  M30: 0.0009,
  H1: 0.0012,
  H4: 0.0018,
  D1: 0.0025,
  W1: 0.0038,
  Y1: 0.006
}
const TIMEFRAME_SECONDS = {
  M1: 60,
  M5: 300,
  M15: 900,
  M30: 1800,
  H1: 3600,
  H4: 14400,
  D1: 86400,
  W1: 604800,
  Y1: 31536000
}
const TRADINGVIEW_INTERVALS = {
  M1: '1',
  M5: '5',
  M15: '15',
  M30: '30',
  H1: '60',
  H4: '240',
  D1: 'D',
  W1: 'W',
  Y1: 'M'
}
const BINANCE_THEME = {
  primary: '#F0B90B',
  primarySoft: '#FCD535',
  accent: '#FCD535',
  background: '#F5F7FA',
  surface: '#FFFFFF',
  border: '#EAECEF',
  text: '#1E2329',
  muted: '#848E9C'
}

const QUICK_ACTIONS = [
  { label: 'More', icon: 'grid' },
  { label: 'Hub', icon: 'layers' },
  { label: 'Margin', icon: 'briefcase' }
]

const OTC_BASES = ['BTC', 'ETH', 'BNB', 'SOL', 'XRP', 'ADA', 'DOT', 'MATIC', 'DOGE', 'XAU']
const OTC_QUOTES = ['USDT', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'KRW', 'TRY', 'BRL', 'CNY']

const OTC_PAIRS = Array.from({ length: 100 }, (_, index) => {
  const base = OTC_BASES[index % OTC_BASES.length]
  const quote = OTC_QUOTES[Math.floor(index / OTC_BASES.length) % OTC_QUOTES.length]
  const symbol = `${base}/${quote}`
  const price = Number((55 + (index % 12) * 4.2 + (index % 5) * 0.37).toFixed(2))
  const spread = Number((0.04 + (index % 4) * 0.015).toFixed(3))
  const change = Number((((index % 11) - 5) * 0.22).toFixed(2))
  const volume = 45000 + index * 1350
  const status = index % 13 === 0 ? 'maintenance' : index % 9 === 0 ? 'halted' : 'live'
  return { id: `OTC-${index}`, symbol, base, quote, price, spread, change, volume, status }
})
const LIVE_OTC_PRICE_PAIRS = {
  'BTC/USDT': 'BTCUSDT',
  'ETH/USDT': 'ETHUSDT',
  'BNB/USDT': 'BNBUSDT',
  'SOL/USDT': 'SOLUSDT',
  'XRP/USDT': 'XRPUSDT',
  'ADA/USDT': 'ADAUSDT',
  'DOT/USDT': 'DOTUSDT',
  'MATIC/USDT': 'MATICUSDT'
}

const OTC_STATUS_FILTERS = ['all', 'live', 'halted', 'maintenance']
const OTC_STATUS_LABELS = { live: 'Live', halted: 'Halted', maintenance: 'Maintenance' }
const OTC_STATUS_COLORS = {
  live: '#0ECB81',
  halted: '#F6465D',
  maintenance: '#FFB020'
}

const DEFAULT_SERIES = Array.from({ length: 60 }, (_, idx) => {
  const base = 50 + idx * 0.1
  const open = base + Math.sin(idx / 5) * 0.3
  const close = base + Math.cos(idx / 4) * 0.25
  const high = Math.max(open, close) + 0.25
  const low = Math.min(open, close) - 0.25
  const time = Math.floor(Date.now() / 1000) - ((60 - idx) * 60)
  return { time, open, high, low, close }
})

const DEFAULT_SERIES_BASE = DEFAULT_SERIES[0]?.open || 50

const tweakSeries = (bias = 0) => DEFAULT_SERIES.map((candle, idx) => {
  const delta = bias * idx
  const format = (value) => +(value + delta).toFixed(4)
  return {
    time: candle.time,
    open: format(candle.open),
    high: format(Math.max(candle.high, candle.open, candle.close)),
    low: format(Math.min(candle.low, candle.open, candle.close)),
    close: format(candle.close)
  }
})

const FOREX_SERIES = {
  M1: tweakSeries(0),
  M5: tweakSeries(0.0002),
  M15: tweakSeries(0.0003),
  M30: tweakSeries(0.0004),
  H1: tweakSeries(0.0006),
  H4: tweakSeries(0.0008),
  D1: tweakSeries(0.001)
}

const buildOtcSeries = (midPrice = 100, timeframe = 'M15') => {
  const drift = OTC_TIMEFRAME_DRIFT[timeframe] ?? OTC_TIMEFRAME_DRIFT.M15
  const scale = midPrice / (DEFAULT_SERIES_BASE || 1)
  const tfSeconds = TIMEFRAME_SECONDS[timeframe] ?? 900
  const now = Date.now()
  const total = DEFAULT_SERIES.length
  return DEFAULT_SERIES.map((candle, idx) => {
    const offset = (idx - DEFAULT_SERIES.length / 2) * drift * scale * 20
    const timestamp = Math.floor((now - (total - idx) * tfSeconds * 1000) / 1000)
    return {
      time: timestamp,
      open: +(candle.open * scale + offset).toFixed(3),
      high: +(candle.high * scale + offset + drift * 40).toFixed(3),
      low: +(candle.low * scale + offset - drift * 40).toFixed(3),
      close: +(candle.close * scale + offset).toFixed(3)
    }
  })
}

const FOREX_QUOTES = {
  M1: { bid: 1.08452, ask: 1.08473, change: 0.12 },
  M5: { bid: 1.0851, ask: 1.08532, change: 0.18 },
  M15: { bid: 1.08642, ask: 1.08668, change: 0.26 },
  M30: { bid: 1.08814, ask: 1.0884, change: 0.33 },
  H1: { bid: 1.08985, ask: 1.0901, change: 0.41 },
  H4: { bid: 1.09204, ask: 1.09235, change: 0.52 },
  D1: { bid: 1.09612, ask: 1.09641, change: 0.67 }
}

const DEFAULT_POSITIONS = [
  { id: 'POS-8713', symbol: 'EURUSD', type: 'Buy', volume: 50000, entry: 1.0834, price: 1.0868, pnl: 168.5, pnlPct: 0.42, assetClass: 'forex' },
  { id: 'POS-5402', symbol: 'GBPUSD', type: 'Sell', volume: 20000, entry: 1.2841, price: 1.2794, pnl: 94.2, pnlPct: 0.31, assetClass: 'forex' }
]

const DEFAULT_ORDERS = [
  { id: 'ORD-1928', symbol: 'EURUSD', type: 'limit', side: 'buy', volume: 100000, filledAvgPrice: 1.0800, status: 'filled', assetClass: 'forex' },
  { id: 'ORD-1920', symbol: 'USDJPY', type: 'stop', side: 'sell', volume: 50000, filledAvgPrice: 147.30, status: 'filled', assetClass: 'forex' },
  { id: 'ORD-1902', symbol: 'XAUUSD', type: 'market', side: 'buy', volume: 10000, filledAvgPrice: 2352.40, status: 'partial', assetClass: 'forex' }
]

const MIN_TRADE_AMOUNT = 0.01

const formatSymbol = (symbol) => {
  if (!symbol) return ''
  if (symbol.includes('/')) return symbol
  if (symbol.length === 6 && symbol === symbol.toUpperCase()) {
    return `${symbol.slice(0, 3)}/${symbol.slice(3)}`
  }
  return symbol.toUpperCase()
}

const formatCurrency = (value) => {
  const number = Number(value ?? 0)
  const safeNumber = Number.isFinite(number) ? number : 0
  return `$${safeNumber.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const formatSignedCurrency = (value) => {
  const number = Number(value ?? 0)
  const sign = number > 0 ? '+' : number < 0 ? '-' : ''
  return `${sign}${formatCurrency(Math.abs(number))}`
}

const formatCompactNumber = (value) => {
  const formatter = Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 2 })
  return formatter.format(Number(value ?? 0))
}

const formatNumber = (value, decimals = 2) => {
  const number = Number(value ?? 0)
  return number.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const formatPercent = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`

const formatBarTime = (bar) => {
  if (!bar?.time) return 'Awaiting data'
  const date = typeof bar.time === 'string'
    ? new Date(bar.time)
    : new Date(bar.time * 1000)
  if (Number.isNaN(date.getTime())) return 'Awaiting data'
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ComingSoonScreen({ route, navigation }) {
  const { width } = useWindowDimensions()
  const isCompact = width < 360
  const insets = useSafeAreaInsets()
  const {
    title = 'Coming soon',
    subtitle = 'We are polishing this experience for you.',
    icon = 'clock',
    activeSegment = 'OTC'
  } = route?.params ?? {}

  const defaultSymbol = TOP_SYMBOLS[0]
  const [currentSegment, setCurrentSegment] = useState(activeSegment === 'Forex' ? 'OTC' : activeSegment)
  const [selectedSymbol, setSelectedSymbol] = useState(defaultSymbol)
  const [timeframe, setTimeframe] = useState('M15')
  const [positions, setPositions] = useState(DEFAULT_POSITIONS)
  const [orders, setOrders] = useState(DEFAULT_ORDERS)
  const [quote, setQuote] = useState(FOREX_QUOTES[timeframe])
  const [chartSeries, setChartSeries] = useState(FOREX_SERIES[timeframe])
  const [activePriceTab, setActivePriceTab] = useState('Price')
  const [orderSection, setOrderSection] = useState('Order Book')
  const [loadingQuote, setLoadingQuote] = useState(false)
  const [loadingChart, setLoadingChart] = useState(false)
  const [quoteError, setQuoteError] = useState(null)
  const [chartError, setChartError] = useState(null)
  const [loadingPositions, setLoadingPositions] = useState(false)
  const [positionsError, setPositionsError] = useState(null)
  const [loadingOrders, setLoadingOrders] = useState(false)
  const [ordersError, setOrdersError] = useState(null)
  const [closingPositionId, setClosingPositionId] = useState(null)
  const [symbolPickerVisible, setSymbolPickerVisible] = useState(false)
  const [accountSummary, setAccountSummary] = useState(null)
  const [loadingAccount, setLoadingAccount] = useState(false)
  const [accountError, setAccountError] = useState(null)
  const [ticketSide, setTicketSide] = useState('buy')
  const scrollRef = useRef(null)
  const ticketAnchorRef = useRef(0)
  const [otcSearch, setOtcSearch] = useState('')
  const [otcStatusFilter, setOtcStatusFilter] = useState('all')
  const [pairOverrides, setPairOverrides] = useState({})
  const [selectedOtcSymbol, setSelectedOtcSymbol] = useState(OTC_PAIRS[0].symbol)
  const [otcTimeframe, setOtcTimeframe] = useState('M15')
  const [otcPickerVisible, setOtcPickerVisible] = useState(false)
  const [otcOrderTab, setOtcOrderTab] = useState('Order Book')
  const enableLegacyTradeExperience = false
  const [otcQty, setOtcQty] = useState(MIN_TRADE_AMOUNT)
  const [otcQtyInput, setOtcQtyInput] = useState(otcQty.toFixed(2))
  const [otcFills, setOtcFills] = useState([])
  const [showTimeframeDropdown, setShowTimeframeDropdown] = useState(false)
  const [showIndicatorDropdown, setShowIndicatorDropdown] = useState(false)
  const [selectedIndicator, setSelectedIndicator] = useState(OTC_INDICATORS[0])
  const [openTradesList, setOpenTradesList] = useState([])
  const [otcSeriesVersion, setOtcSeriesVersion] = useState(0)
  const otcSeriesRef = useRef({})
  const otcSeriesMetaRef = useRef({})
  const [closingTradeId, setClosingTradeId] = useState(null)
  const [closingAllTrades, setClosingAllTrades] = useState(false)
  const [loadingOtcHistory, setLoadingOtcHistory] = useState(false)
  const [otcHistoryError, setOtcHistoryError] = useState(null)
  const [otcHistoryLoaded, setOtcHistoryLoaded] = useState(false)
  const lastPersistRef = useRef({})
  useEffect(() => {
    const sources = Object.entries(LIVE_OTC_PRICE_PAIRS)
    if (!sources.length) return undefined
    let mounted = true
    const fetchPrices = async () => {
      try {
        const data = await Promise.all(sources.map(async ([pair, ticker]) => {
          const res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${ticker}`)
          if (!res.ok) return null
          const payload = await res.json()
          return {
            pair,
            price: Number(payload.lastPrice ?? payload.price ?? 0),
            change: Number(payload.priceChangePercent ?? 0)
          }
        }))
        if (!mounted) return
        setPairOverrides(prev => {
          const next = { ...prev }
          data.forEach(entry => {
            if (!entry) return
            const spreadEst = Number(Math.max(0.002, (entry.price || 0) * 0.0004).toFixed(3))
            next[entry.pair] = {
              ...(next[entry.pair] ?? {}),
              price: entry.price || (next[entry.pair]?.price ?? 0),
              change: entry.change,
              spread: spreadEst
            }
          })
          return next
        })
      } catch (error) {
        console.warn('live crypto price fetch error', error)
      }
    }
    fetchPrices()
    const interval = setInterval(fetchPrices, 15000)
    return () => {
      mounted = false
      clearInterval(interval)
    }
  }, [])
  const { token } = useAuth()
  const [tradeSyncMsg, setTradeSyncMsg] = useState('')
  const [otcPosition, setOtcPosition] = useState({ qty: 0, avgPrice: 0, realizedPnl: 0 })
  const [accountBalance, setAccountBalance] = useState({ available: 0, locked: 0, total: 0 })
  const [accountOpenPnl, setAccountOpenPnl] = useState(0)
  const [slTpVisible, setSlTpVisible] = useState(false)
  const [slInput, setSlInput] = useState('')
  const [tpInput, setTpInput] = useState('')
  const [slLevel, setSlLevel] = useState(null)
  const [tpLevel, setTpLevel] = useState(null)
  const [pendingSide, setPendingSide] = useState('buy')
  const [pendingPrice, setPendingPrice] = useState('')
  const [pendingAmount, setPendingAmount] = useState(MIN_TRADE_AMOUNT.toFixed(2))
  const [pendingOrders, setPendingOrders] = useState([])
  const [chartHeight, setChartHeight] = useState(320)

  useEffect(() => {
    const desiredSegment = activeSegment === 'Forex' ? 'OTC' : activeSegment
    if (desiredSegment !== currentSegment) {
      setCurrentSegment(desiredSegment)
    }
  }, [activeSegment, currentSegment])

  useEffect(() => {
    if (currentSegment !== 'OTC') return
    ensureSeriesForSymbol(selectedOtcSymbol, selectedOtcBasePrice, otcTimeframe)
  }, [currentSegment, selectedOtcSymbol, selectedOtcBasePrice, otcTimeframe, ensureSeriesForSymbol])

  useEffect(() => {
    refreshTradeOverview()
  }, [refreshTradeOverview])

  useEffect(() => {
    if (currentSegment !== 'OTC' || !selectedOtcSymbol) return
    let cancelled = false
    setLoadingOtcHistory(true)
    setOtcHistoryLoaded(false)
    fetchOtcCandles(selectedOtcSymbol, otcTimeframe, 360)
      .then(bars => {
        if (cancelled) return
        if (Array.isArray(bars) && bars.length) {
          otcSeriesRef.current[selectedOtcSymbol] = bars
          otcSeriesMetaRef.current[selectedOtcSymbol] = { timeframe: otcTimeframe }
          setOtcSeriesVersion(prev => prev + 1)
          setOtcHistoryError(null)
          setOtcHistoryLoaded(true)
        } else {
          setOtcHistoryError('No saved history yet. Live feed will populate automatically.')
          setOtcHistoryLoaded(false)
        }
      })
      .catch(err => {
        console.warn('fetchOtcCandles error', err?.message ?? err)
        if (!cancelled) {
          setOtcHistoryError('Unable to sync saved history; showing live simulation.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingOtcHistory(false)
      })
    return () => { cancelled = true }
  }, [currentSegment, selectedOtcSymbol, otcTimeframe])

  useEffect(() => {
    if (currentSegment !== 'OTC') return
    const interval = setInterval(() => {
      let latestSelectedPrice = null
      let seriesUpdated = false
      setPairOverrides(prev => {
        const next = { ...prev }
        const targets = new Set([selectedOtcSymbol])
        while (targets.size < 8) {
          const randomSymbol = OTC_PAIRS[Math.floor(Math.random() * OTC_PAIRS.length)]?.symbol
          if (randomSymbol) targets.add(randomSymbol)
        }
        const drift = OTC_TIMEFRAME_DRIFT[otcTimeframe] ?? OTC_TIMEFRAME_DRIFT.M15
        targets.forEach(symbol => {
          const basePair = otcPairMap[symbol] ?? {}
          const existing = next[symbol] ?? {}
          const referencePrice = existing.price ?? basePair.price ?? 100
          const noise = referencePrice * (Math.random() - 0.5) * drift * 40
          const price = Number(Math.max(0.01, referencePrice + noise).toFixed(3))
          const spreadSource = existing.spread ?? basePair.spread ?? 0.05
          const spread = Number(Math.max(0.002, spreadSource + (Math.random() - 0.5) * 0.002).toFixed(3))
          const changeSource = existing.change ?? basePair.change ?? 0
          const change = Number((changeSource + (Math.random() - 0.5) * 0.25).toFixed(2))
          next[symbol] = {
            ...existing,
            price,
            spread,
            change
          }
          ensureSeriesForSymbol(symbol, price, otcTimeframe)
          if (appendOtcSeriesPoint(symbol, price, otcTimeframe)) {
            seriesUpdated = true
          }
          if (symbol === selectedOtcSymbol) {
            latestSelectedPrice = price
          }
        })
        return next
      })
      if (seriesUpdated) {
        setOtcSeriesVersion(prev => prev + 1)
      }
      if (latestSelectedPrice != null) {
        persistOtcTick(selectedOtcSymbol, latestSelectedPrice)
      }
    }, 1600)
    return () => clearInterval(interval)
  }, [
    currentSegment,
    selectedOtcSymbol,
    otcPairMap,
    otcTimeframe,
    ensureSeriesForSymbol,
    appendOtcSeriesPoint,
    persistOtcTick
  ])


  const handleSegmentChange = (segment) => {
    setCurrentSegment(segment)
    navigation?.setParams?.({ activeSegment: segment })
  }

  const isForexTab = currentSegment !== 'OTC'
  const isForexSymbol = selectedSymbol.type === 'forex'

  useEffect(() => {
    if (!isForexTab) return
    const fallbackQuote = isForexSymbol
      ? (FOREX_QUOTES[timeframe] ?? FOREX_QUOTES.M15)
      : { bid: 0, ask: 0, change: 0 }
    setQuote(fallbackQuote)
    setQuoteError(null)
    let cancelled = false

    const loadQuote = () => {
      setLoadingQuote(true)
      fetchForexQuote(selectedSymbol.value, { assetType: selectedSymbol.type })
        .then(data => {
          if (!cancelled && data?.bid && data?.ask) {
            setQuote({
              bid: data.bid,
              ask: data.ask,
              change: data.change
            })
          }
        })
        .catch(() => {
          if (!cancelled) {
            setQuoteError('Live quote unavailable; showing preview values.')
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoadingQuote(false)
          }
        })
    }

    loadQuote()
    const intervalId = setInterval(loadQuote, 15000)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [isForexTab, selectedSymbol, timeframe, isForexSymbol])

  useEffect(() => {
    if (!isForexTab) return
    const fallbackSeries = isForexSymbol
      ? (FOREX_SERIES[timeframe] ?? DEFAULT_SERIES)
      : DEFAULT_SERIES
    setChartSeries(fallbackSeries)
    setChartError(null)
    setLoadingChart(true)
    let cancelled = false
    fetchForexCandles(selectedSymbol.value, timeframe, 500, selectedSymbol.type)
      .then(data => {
        if (!cancelled && data?.length) {
          setChartSeries(data)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setChartError('Live candles unavailable; showing preview set.')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingChart(false)
        }
      })
    return () => { cancelled = true }
  }, [isForexTab, selectedSymbol, timeframe, isForexSymbol])

  const refreshPositions = () => {
    setLoadingPositions(true)
    setPositionsError(null)
    fetchOpenPositions()
      .then(data => {
        if (Array.isArray(data)) {
          setPositions(data.length ? data : [])
        }
      })
      .catch(err => {
        console.error('fetchOpenPositions error', err)
        setPositionsError('Unable to sync positions. Showing preview list.')
      })
      .finally(() => setLoadingPositions(false))
  }

  const refreshOrders = () => {
    setLoadingOrders(true)
    setOrdersError(null)
    fetchRecentOrders()
      .then(data => {
        if (Array.isArray(data)) {
          setOrders(data.length ? data : [])
        }
      })
      .catch(err => {
        console.error('fetchRecentOrders error', err)
        setOrdersError('Unable to sync order history. Showing preview list.')
      })
      .finally(() => setLoadingOrders(false))
  }

  const refreshAccount = () => {
    setLoadingAccount(true)
    setAccountError(null)
    fetchAccountSummary()
      .then(data => setAccountSummary(data))
      .catch(err => {
        console.error('fetchAccountSummary error', err)
        setAccountError('Unable to sync account metrics.')
      })
      .finally(() => setLoadingAccount(false))
  }

  useEffect(() => {
    if (!isForexTab) return
    refreshPositions()
    refreshOrders()
    refreshAccount()
  }, [isForexTab, selectedSymbol])

  const spreadDisplay = useMemo(() => {
    if (!quote.bid || !quote.ask) return '—'
    const multiplier = isForexSymbol ? 10000 : 100
    const decimals = isForexSymbol ? 1 : 2
    return ((quote.ask - quote.bid) * multiplier).toFixed(decimals)
  }, [quote, isForexSymbol])

  const visiblePositions = useMemo(
    () => positions.filter(position => formatSymbol(position.symbol) === selectedSymbol.label),
    [positions, selectedSymbol]
  )

  const visibleOrders = useMemo(
    () => orders.filter(order => formatSymbol(order.symbol) === selectedSymbol.label),
    [orders, selectedSymbol]
  )
  const legacyTradingViewSymbol = useMemo(() => {
    if (!selectedSymbol?.value) return 'BINANCE:BTCUSDT'
    const normalized = selectedSymbol.value.replace('/', '').toUpperCase()
    if (selectedSymbol.type === 'forex') {
      return `FX_IDC:${normalized}`
    }
    if (selectedSymbol.type === 'equity') {
      return `NASDAQ:${normalized}`
    }
    return `BINANCE:${normalized}`
  }, [selectedSymbol])
  const legacyTradingViewInterval = useMemo(
    () => TRADINGVIEW_INTERVALS[timeframe] ?? '15',
    [timeframe]
  )
  const groupedSymbols = useMemo(() => ({
    forex: TOP_SYMBOLS.filter(item => item.type === 'forex'),
    equity: TOP_SYMBOLS.filter(item => item.type === 'equity')
  }), [])
  const pairParts = useMemo(() => {
    if (selectedSymbol.type === 'forex') {
      const [base = selectedSymbol.label, quote = 'USD'] = selectedSymbol.label.split('/')
      return { primary: base, secondary: quote }
    }
    return {
      primary: selectedSymbol.label,
      secondary: selectedSymbol.type === 'equity' ? 'USD' : '—'
    }
  }, [selectedSymbol])
  const otcPairMap = useMemo(() => Object.fromEntries(OTC_PAIRS.map(pair => [pair.symbol, pair])), [])
  const mergedOtcPairs = useMemo(
    () => OTC_PAIRS.map(pair => ({ ...pair, ...(pairOverrides[pair.symbol] ?? {}) })),
    [pairOverrides]
  )
  const otcFilteredPairs = useMemo(() => {
    const query = otcSearch.trim().toLowerCase()
    return mergedOtcPairs.filter(pair => {
      const matchesSearch = !query || pair.symbol.toLowerCase().includes(query)
      const matchesStatus = otcStatusFilter === 'all' || pair.status === otcStatusFilter
      return matchesSearch && matchesStatus
    })
  }, [mergedOtcPairs, otcSearch, otcStatusFilter])
  const selectedOtcPair = useMemo(
    () => mergedOtcPairs.find(pair => pair.symbol === selectedOtcSymbol) ?? mergedOtcPairs[0],
    [mergedOtcPairs, selectedOtcSymbol]
  )
  const normalizedOtcSymbol = useMemo(
    () => (selectedOtcSymbol || '').replace('/', '').toUpperCase(),
    [selectedOtcSymbol]
  )
  const selectedOtcBasePrice = pairOverrides[selectedOtcSymbol]?.price ?? selectedOtcPair?.price ?? 0
  const otcMidPrice = selectedOtcPair?.price ?? 0
  const otcSpreadValue = Number(selectedOtcPair?.spread ?? 0.05)
  const otcBid = Number((otcMidPrice - otcSpreadValue / 2).toFixed(3))
  const otcAsk = Number((otcMidPrice + otcSpreadValue / 2).toFixed(3))
  const otcSeriesData = useMemo(() => {
    const existing = otcSeriesRef.current[selectedOtcSymbol]
    if (existing?.length) {
      return existing.slice()
    }
    if (otcHistoryLoaded) {
      return []
    }
    const seeded = buildOtcSeries(selectedOtcBasePrice || 100, otcTimeframe)
    otcSeriesRef.current[selectedOtcSymbol] = seeded
    otcSeriesMetaRef.current[selectedOtcSymbol] = { timeframe: otcTimeframe }
    return seeded.slice()
  }, [selectedOtcSymbol, selectedOtcBasePrice, otcTimeframe, otcSeriesVersion, otcHistoryLoaded])
  const tradingViewSymbol = useMemo(() => {
    const pairSymbol = selectedOtcPair?.symbol ?? 'BTC/USDT'
    const cleaned = pairSymbol.replace('/', '').toUpperCase()
    return `BINANCE:${cleaned}`
  }, [selectedOtcPair])
  const tradingViewInterval = useMemo(
    () => TRADINGVIEW_INTERVALS[otcTimeframe] ?? '15',
    [otcTimeframe]
  )

  const handleSetOtcStatus = (symbol, status) => {
    setPairOverrides(prev => ({
      ...prev,
      [symbol]: {
        ...(prev[symbol] ?? {}),
        status
      }
    }))
  }

  const cycleOtcStatus = (symbol) => {
    const order = ['live', 'halted', 'maintenance']
    const current = pairOverrides[symbol]?.status ?? otcPairMap[symbol]?.status ?? 'live'
    const next = order[(order.indexOf(current) + 1) % order.length]
    handleSetOtcStatus(symbol, next)
  }

  const handleSpreadAdjust = (symbol, delta) => {
    const reference = pairOverrides[symbol]?.spread ?? otcPairMap[symbol]?.spread ?? 0
    const nextSpread = Math.max(0, Number((reference + delta).toFixed(3)))
    setPairOverrides(prev => ({
      ...prev,
      [symbol]: {
        ...(prev[symbol] ?? {}),
        spread: nextSpread
      }
    }))
  }

  const clearOtcOverride = (symbol) => {
    setPairOverrides(prev => {
      if (!prev[symbol]) return prev
      const next = { ...prev }
      delete next[symbol]
      return next
    })
  }
  const ensureSeriesForSymbol = useCallback((symbol, basePrice, timeframe) => {
    if (!symbol) return
    if (otcHistoryLoaded) return
    const meta = otcSeriesMetaRef.current[symbol]
    const existing = otcSeriesRef.current[symbol]
    if (!existing?.length || meta?.timeframe !== timeframe) {
      otcSeriesRef.current[symbol] = buildOtcSeries(basePrice ?? 100, timeframe)
      otcSeriesMetaRef.current[symbol] = { timeframe }
      setOtcSeriesVersion(prev => prev + 1)
    }
  }, [])
  const appendOtcSeriesPoint = useCallback((symbol, midPrice, timeframe) => {
    if (!symbol) return false
    const store = otcSeriesRef.current[symbol]
    if (!store?.length) return false
    const tfSeconds = TIMEFRAME_SECONDS[timeframe] ?? 900
    const prevBar = store[store.length - 1]
    const timestamp = (prevBar?.time ?? Math.floor(Date.now() / 1000)) + tfSeconds
    const open = prevBar?.close ?? midPrice
    const close = Number(midPrice.toFixed(3))
    const volatility = Math.max(0.0001, Math.abs(close - open) || midPrice * 0.0006)
    const high = Number((Math.max(open, close) + volatility * (0.3 + Math.random() * 0.4))).toFixed(3)
    const low = Number((Math.min(open, close) - volatility * (0.3 + Math.random() * 0.4))).toFixed(3)
    const nextBar = {
      time: timestamp,
      open,
      high: Number(high),
      low: Number(low),
      close
    }
    otcSeriesRef.current[symbol] = [...store.slice(-199), nextBar]
    return true
  }, [])
  const persistOtcTick = useCallback((symbol, price) => {
    if (!symbol || !Number.isFinite(price)) return
    const now = Date.now()
    const last = lastPersistRef.current[symbol] ?? 0
    if (now - last < 1200) return
    lastPersistRef.current[symbol] = now
    postOtcTick(symbol.replace('/', ''), Number(price), now).catch(err => {
      console.warn('postOtcTick error', err?.message ?? err)
    })
  }, [])
  const syncPositionFromOverview = useCallback((overview) => {
    if (!overview) return
    const balance = overview.balance || {}
    const available = Number(balance.available ?? 0)
    const locked = Number(balance.locked ?? 0)
    const total = Number(balance.total ?? available + locked)
    const safeAvailable = Number.isFinite(available) ? available : 0
    const safeLocked = Number.isFinite(locked) ? locked : 0
    const safeTotal = Number.isFinite(total) ? total : safeAvailable + safeLocked
    setAccountBalance({ available: safeAvailable, locked: safeLocked, total: safeTotal })
    const openPnl = Number(overview.openPnl ?? 0)
    setAccountOpenPnl(Number.isFinite(openPnl) ? openPnl : 0)
    const openTrades = Array.isArray(overview.openTrades) ? overview.openTrades : []
    const relevant = openTrades.filter(trade => (trade.symbol || '').toUpperCase() === normalizedOtcSymbol)
    if (!relevant.length) {
      const realized = (overview.recentTrades || [])
        .filter(t => t.status === 'closed' && (t.symbol || '').toUpperCase() === normalizedOtcSymbol)
        .reduce((sum, t) => sum + Number(t.pnl ?? 0), 0)
      setOtcPosition({ qty: 0, avgPrice: 0, realizedPnl: realized })
      setOpenTradesList(openTrades)
      return
    }
    let netQty = 0
    let weighted = 0
    relevant.forEach(trade => {
      const direction = trade.side === 'sell' ? -1 : 1
      const qty = Number(trade.qty ?? 0) * direction
      netQty += qty
      weighted += qty * Number(trade.price ?? 0)
    })
    const avgPrice = netQty !== 0 ? weighted / netQty : 0
    const realized = (overview.recentTrades || [])
      .filter(t => t.status === 'closed' && (t.symbol || '').toUpperCase() === normalizedOtcSymbol)
      .reduce((sum, t) => sum + Number(t.pnl ?? 0), 0)
    setOtcPosition({
      qty: netQty,
      avgPrice,
      realizedPnl: realized
    })
    setOpenTradesList(openTrades)
  }, [normalizedOtcSymbol])

  const refreshTradeOverview = useCallback(() => {
    if (!token) {
      setAccountBalance({ available: 0, locked: 0, total: 0 })
      setAccountOpenPnl(0)
      return
    }
    api(token).get('/api/trades/overview?limit=20')
      .then(res => syncPositionFromOverview(res.data))
      .catch(err => console.warn('overview error', err?.response?.data?.error || err?.message))
  }, [token, syncPositionFromOverview])
  useEffect(() => {
    if (!token) return
    const interval = setInterval(refreshTradeOverview, 5000)
    return () => clearInterval(interval)
  }, [token, refreshTradeOverview])
  const updateOtcPosition = useCallback((side, qty, price) => {
    setOtcPosition(prev => {
      const signedQty = side === 'buy' ? qty : -qty
      const prevQty = prev.qty
      let avg = prev.avgPrice
      let realized = prev.realizedPnl

      if (prevQty === 0 || Math.sign(prevQty) === Math.sign(signedQty)) {
        const newQty = +(prevQty + signedQty).toFixed(4)
        const newAvg = newQty === 0 ? 0 : ((prevQty * avg) + (signedQty * price)) / newQty
        return { qty: newQty, avgPrice: newAvg, realizedPnl: realized }
      }

      const closing = Math.min(Math.abs(prevQty), Math.abs(signedQty))
      if (prevQty > 0) {
        realized += closing * (price - avg)
      } else {
        realized += closing * (avg - price)
      }

      const residual = Math.abs(signedQty) - closing
      let newQty = prevQty + signedQty
      let newAvg = newQty === 0 ? 0 : avg
      if (residual > 0) {
        const direction = Math.sign(signedQty)
        newQty = +(direction * residual).toFixed(4)
        newAvg = price
      }

      return { qty: newQty, avgPrice: newAvg, realizedPnl: realized }
    })
  }, [])
  const handleOtcExecution = useCallback(async (side, overrideQty) => {
    const requestedAmount = overrideQty ?? otcQty
    const normalizedAmount = Math.max(MIN_TRADE_AMOUNT, Math.abs(Number(requestedAmount) || 0))
    const sanitizedAmount = Number(normalizedAmount.toFixed(2))
    setTicketSide(side)
    const fillPrice = side === 'buy' ? otcAsk : otcBid
    const qty = Number((sanitizedAmount / fillPrice).toFixed(6)) || sanitizedAmount
    const fill = {
      id: `OTC-${Date.now()}`,
      side,
      qty,
      price: fillPrice,
      time: new Date()
    }
    setOtcFills(prev => [fill, ...prev].slice(0, 4))
    setPairOverrides(prev => {
      const reference = prev[selectedOtcSymbol]?.price ?? selectedOtcPair?.price ?? fillPrice
      const impact = otcSpreadValue * 0.35 * (side === 'buy' ? 1 : -1)
      return {
        ...prev,
        [selectedOtcSymbol]: {
          ...(prev[selectedOtcSymbol] ?? {}),
          price: Number(Math.max(0.01, reference + impact).toFixed(3)),
          change: Number(((prev[selectedOtcSymbol]?.change ?? selectedOtcPair?.change ?? 0) + impact * 0.5).toFixed(2))
        }
      }
    })
    ensureSeriesForSymbol(selectedOtcSymbol, fillPrice, otcTimeframe)
    if (appendOtcSeriesPoint(selectedOtcSymbol, fillPrice, otcTimeframe)) {
      setOtcSeriesVersion(prev => prev + 1)
    }
    persistOtcTick(selectedOtcSymbol, fillPrice)
    updateOtcPosition(side, qty, fillPrice)
    const amountUsd = sanitizedAmount

    if (token) {
      try {
        const response = await api(token).post('/api/trades', {
          side,
          amount: amountUsd,
          symbol: normalizedOtcSymbol,
          price: fillPrice
        })
        setTradeSyncMsg(`${side === 'buy' ? 'Buy' : 'Sell'} synced: ${formatCurrency(amountUsd)} @ ${Number(response.data?.price ?? fillPrice).toFixed(3)}`)
        syncPositionFromOverview(response.data)
      } catch (err) {
        setTradeSyncMsg(err?.response?.data?.error || 'Failed to sync trade with account.')
      } finally {
        refreshTradeOverview()
      }
    } else {
      setTradeSyncMsg('Sign in to persist OTC trades to your account.')
    }
  }, [
    otcQty,
    otcAsk,
    otcBid,
    otcSpreadValue,
    selectedOtcSymbol,
    selectedOtcPair,
    otcTimeframe,
    ensureSeriesForSymbol,
    appendOtcSeriesPoint,
    persistOtcTick,
    updateOtcPosition,
    token,
    normalizedOtcSymbol,
    refreshTradeOverview,
    setTradeSyncMsg,
    syncPositionFromOverview
  ])
  const latestBar = chartSeries?.length ? chartSeries[chartSeries.length - 1] : null
  const barTimestamp = formatBarTime(latestBar)
  const chartExtremes = useMemo(() => {
    if (!chartSeries?.length) return { high: 0, low: 0 }
    return chartSeries.reduce(
      (acc, candle) => ({
        high: Math.max(acc.high, candle.high ?? candle.close ?? 0),
        low: acc.low === 0 ? (candle.low ?? candle.close ?? 0) : Math.min(acc.low, candle.low ?? candle.close ?? 0)
      }),
      { high: 0, low: 0 }
    )
  }, [chartSeries])
  const volumeSeries = useMemo(
    () => chartSeries?.map(candle => Math.abs(candle.close - candle.open)) ?? [],
    [chartSeries]
  )
  const volumeMax = volumeSeries.length ? Math.max(...volumeSeries) : 1
  const bookTotals = useMemo(() => {
    const buy = ORDER_BOOK_ROWS.reduce((sum, row) => sum + Number(row.bidAmount), 0)
    const sell = ORDER_BOOK_ROWS.reduce((sum, row) => sum + Number(row.askAmount), 0)
    return { buy, sell }
  }, [])
  const bookShare = bookTotals.buy + bookTotals.sell > 0
    ? (bookTotals.buy / (bookTotals.buy + bookTotals.sell)) * 100
    : 50
  const priceDecimals = isForexSymbol ? 5 : 2
  const rawPrice = Number(quote.ask ?? quote.bid ?? 0)
  const displayPrice = loadingQuote ? '—' : rawPrice.toFixed(priceDecimals)
  const absoluteDelta = !loadingQuote && quote.ask && quote.bid ? quote.ask - quote.bid : 0
  const deltaString = loadingQuote
    ? '—'
    : `${absoluteDelta >= 0 ? '+' : '-'}${Math.abs(absoluteDelta).toFixed(priceDecimals)}`
  const percentString = loadingQuote ? '—' : formatPercent(quote.change ?? 0)
  const changeColor = (quote.change ?? 0) >= 0 ? colors.success : colors.danger
  const chartHigh = chartExtremes.high || rawPrice
  const chartLow = chartExtremes.low || Number(quote.bid ?? rawPrice)
  const topOrderRow = ORDER_BOOK_ROWS[0] ?? { bidAmount: 0, askAmount: 0, price: rawPrice }
  const otcUnrealizedPnl = useMemo(() => {
    if (!otcPosition.qty) return 0
    const mark = otcPosition.qty >= 0 ? otcBid : otcAsk
    return otcPosition.qty >= 0
      ? otcPosition.qty * (mark - otcPosition.avgPrice)
      : Math.abs(otcPosition.qty) * (otcPosition.avgPrice - mark)
  }, [otcPosition, otcBid, otcAsk])
  const calculateLivePnl = useCallback((side, entryPrice, qty) => {
    const quantity = Number(qty ?? 0)
    const price = Number(entryPrice ?? 0)
    if (!quantity || !price) return 0
    const mark = side === 'buy' ? otcBid : otcAsk
    if (!Number.isFinite(mark)) return 0
    const direction = side === 'sell' ? -1 : 1
    return Number(((mark - price) * direction * quantity).toFixed(2))
  }, [otcAsk, otcBid])
  const formattedOtcPnl = useMemo(
    () => (token ? formatSignedCurrency(accountOpenPnl) : '—'),
    [token, accountOpenPnl]
  )
  const formattedOtcBalance = useMemo(
    () => (token ? formatCurrency(accountBalance.total ?? 0) : '—'),
    [token, accountBalance.total]
  )
  const handleSelectTimeframe = useCallback((frame) => {
    setOtcTimeframe(frame)
    setShowTimeframeDropdown(false)
  }, [])
  const handleSelectIndicator = useCallback((indicator) => {
    setSelectedIndicator(indicator)
    setShowIndicatorDropdown(false)
  }, [])

  const scrollToTicket = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(ticketAnchorRef.current - 24, 0), animated: true })
    }
  }
  const handleQuickTicketSide = (side) => {
    setTicketSide(side)
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(scrollToTicket)
    } else {
      scrollToTicket()
    }
  }

  const adjustOtcQty = (delta) => {
    setOtcQty(prev => {
      const next = Math.max(MIN_TRADE_AMOUNT, +(prev + delta).toFixed(2))
      setOtcQtyInput(next.toFixed(2))
      return next
    })
  }

  const handleQtyInput = (value) => {
    const sanitized = value.replace(/[^0-9.]/g, '')
    setOtcQtyInput(sanitized)
    const parsed = Number(sanitized)
    if (!Number.isFinite(parsed)) return
    const normalized = Math.max(MIN_TRADE_AMOUNT, Number(parsed.toFixed(2)))
    setOtcQty(normalized)
  }

  const handleSaveSlTp = useCallback(() => {
    setSlTpVisible(false)
    const parts = []
    const slNumeric = Number(slInput)
    const tpNumeric = Number(tpInput)
    if (Number.isFinite(slNumeric) && slNumeric > 0) {
      parts.push(`SL ${slNumeric}`)
      setSlLevel(slNumeric)
    }
    if (Number.isFinite(tpNumeric) && tpNumeric > 0) {
      parts.push(`TP ${tpNumeric}`)
      setTpLevel(tpNumeric)
    }
    if (pendingPrice && pendingAmount) {
      const amountNum = Math.max(MIN_TRADE_AMOUNT, Number(pendingAmount) || 0)
      parts.push(`Pending ${pendingSide.toUpperCase()} @ ${pendingPrice} for ${amountNum.toFixed(2)}`)
      const priceNum = Number(pendingPrice)
      if (Number.isFinite(priceNum) && amountNum) {
        setPendingOrders(prev => ([
          ...prev,
          {
            id: `PEND-${Date.now()}`,
            side: pendingSide,
            price: priceNum,
            amount: amountNum.toFixed(2),
            createdAt: new Date().toISOString()
          }
        ]))
      }
    }
    if (parts.length) {
      setTradeSyncMsg(parts.join(' • '))
    }
    setSlInput('')
    setTpInput('')
    setPendingPrice('')
    setPendingAmount(MIN_TRADE_AMOUNT.toFixed(2))
  }, [pendingAmount, pendingPrice, pendingSide, slInput, tpInput])

  const handleCloseTrade = useCallback(async (trade) => {
    if (!token || !trade?.id) {
      setTradeSyncMsg('Sign in to close trades.')
      return
    }
    setClosingTradeId(trade.id)
    try {
      const response = await api(token).post(`/api/trades/${trade.id}/close`)
      const pnl = Number(response.data?.realizedPnl ?? 0)
      setTradeSyncMsg(`${trade.side === 'buy' ? 'Buy' : 'Sell'} closed • ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`)
      syncPositionFromOverview(response.data)
      setOpenTradesList(prev => prev.filter(t => t.id !== trade.id))
    } catch (err) {
      setTradeSyncMsg(err?.response?.data?.error || 'Failed to close trade.')
    } finally {
      setClosingTradeId(null)
    }
  }, [token, syncPositionFromOverview])

  const handleCloseAllTrades = useCallback(async () => {
    if (!token || !openTradesList.length) return
    setClosingAllTrades(true)
    try {
      const response = await api(token).post('/api/trades/close-all')
      const pnl = Number(response.data?.realizedPnl ?? 0)
      setTradeSyncMsg(`Closed all • ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}`)
      syncPositionFromOverview(response.data)
      setOpenTradesList([])
    } catch (err) {
      setTradeSyncMsg(err?.response?.data?.error || 'Failed to close all trades.')
    } finally {
      setClosingAllTrades(false)
    }
  }, [token, openTradesList.length, syncPositionFromOverview])

  useEffect(() => {
    if (!pendingOrders.length) return
    const currentPrice = Number(selectedOtcPair?.price ?? 0)
    if (!Number.isFinite(currentPrice) || currentPrice <= 0) return
    let changed = false
    const remaining = []
    pendingOrders.forEach(order => {
      const shouldTrigger = order.side === 'buy'
        ? currentPrice <= order.price
        : currentPrice >= order.price
      if (shouldTrigger) {
        changed = true
        handleOtcExecution(order.side, Number(order.amount))
      } else {
        remaining.push(order)
      }
    })
    if (changed) {
      setPendingOrders(remaining)
    }
  }, [pendingOrders, selectedOtcPair, handleOtcExecution])

  const renderPlaceholder = (label = 'Forex') => (
    <View style={styles.blankOtc}>
      <Feather name="layers" size={40} color={BINANCE_THEME.muted} />
      <Text style={styles.blankOtcTitle}>{label} desk</Text>
      <Text style={styles.blankOtcSubtitle}>We&apos;re preparing a brand-new experience for this market.</Text>
    </View>
  )

  const renderOtcDesk = () => {
    const tradesToDisplay = token
      ? openTradesList.filter(trade => (trade.symbol || '').toUpperCase() === normalizedOtcSymbol)
      : otcFills
    const levelAnnotations = []
    tradesToDisplay.forEach(trade => {
      levelAnnotations.push({
        label: `${trade.side === 'buy' ? 'Buy' : 'Sell'} @ ${formatNumber(trade.price, 2)}`,
        tone: trade.side === 'buy' ? colors.success : colors.danger,
        price: Number(trade.price)
      })
    })
    if (Number.isFinite(slLevel) && slLevel > 0) {
      levelAnnotations.push({ label: `SL @ ${formatNumber(slLevel, 2)}`, tone: colors.danger, price: slLevel })
    }
    if (Number.isFinite(tpLevel) && tpLevel > 0) {
      levelAnnotations.push({ label: `TP @ ${formatNumber(tpLevel, 2)}`, tone: colors.success, price: tpLevel })
    }
    pendingOrders.forEach(order => {
      levelAnnotations.push({
        label: `Pending ${order.side === 'buy' ? 'Buy' : 'Sell'} @ ${formatNumber(order.price, 2)}`,
        tone: order.side === 'buy' ? colors.success : colors.danger,
        price: Number(order.price)
      })
    })
    let otcMin = Number.POSITIVE_INFINITY
    let otcMax = Number.NEGATIVE_INFINITY
    otcSeriesData.forEach(bar => {
      const vals = [bar.low, bar.high, bar.close, bar.open]
      vals.forEach(v => {
        const n = Number(v)
        if (Number.isFinite(n)) {
          otcMin = Math.min(otcMin, n)
          otcMax = Math.max(otcMax, n)
        }
      })
    })
    if (!otcSeriesData.length || !Number.isFinite(otcMin) || !Number.isFinite(otcMax) || otcMin === otcMax) {
      const fallback = otcMidPrice || 1
      otcMin = fallback * 0.98
      otcMax = fallback * 1.02
    }

    const priceToY = (price) => {
      if (!Number.isFinite(price) || !Number.isFinite(otcMin) || !Number.isFinite(otcMax)) return null
      const range = Math.max(otcMax - otcMin, 0.0001)
      const clamped = Math.min(Math.max(price, otcMin), otcMax)
      const pct = (otcMax - clamped) / range
      return pct * Math.max(chartHeight, 1)
    }
    return (
      <ScrollView
        contentContainerStyle={styles.otcShell}
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.otcCompositeCard}>
            <View style={styles.otcChartCard}>
              <View style={styles.otcChartHeader}>
                <View style={[styles.otcHeaderMetrics, { justifyContent: 'flex-start' }]}>
                  <View style={styles.otcHeaderChip}>
                    <Feather name="dollar-sign" size={12} color={BINANCE_THEME.muted} />
                    <View style={styles.otcHeaderChipText}>
                    <Text style={styles.otcMetricLabel}>Balance</Text>
                    <Text
                      style={styles.otcMetricValue}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {formattedOtcBalance}
                    </Text>
                  </View>
                </View>
                <View style={[styles.otcHeaderChip, accountOpenPnl < 0 && styles.otcHeaderChipNegative]}>
                  <Feather
                    name={accountOpenPnl >= 0 ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={accountOpenPnl >= 0 ? colors.success : colors.danger}
                  />
                  <View style={styles.otcHeaderChipText}>
                    <Text style={styles.otcMetricLabel}>PNL</Text>
                    <Text style={[
                      styles.otcMetricValue,
                      accountOpenPnl > 0 ? styles.pnlPositive : accountOpenPnl < 0 ? styles.pnlNegative : null
                    ]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {formattedOtcPnl}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity style={styles.slTpButton} onPress={() => setSlTpVisible(true)} activeOpacity={0.85}>
                <Feather name="target" size={14} color="#FFFFFF" />
                <Text style={styles.slTpButtonText}>SL / TP</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.otcDropdownRow}>
              <TouchableOpacity
                style={styles.otcDropdownPicker}
                onPress={() => setShowTimeframeDropdown(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.otcDropdownLabel}>Timeframe</Text>
                <View style={styles.otcDropdownValueRow}>
                  <Text style={styles.otcDropdownValue}>{otcTimeframe}</Text>
                  <Feather name="chevron-down" size={12} color={BINANCE_THEME.text} />
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.otcDropdownPicker}
                onPress={() => setOtcPickerVisible(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.otcDropdownLabel}>Pair</Text>
                <View style={styles.otcDropdownValueRow}>
                  <Text style={styles.otcDropdownValue}>{`${selectedOtcPair?.symbol || 'BTC/USDT'} ${otcTimeframe}`}</Text>
                  <Feather name="chevron-down" size={12} color={BINANCE_THEME.text} />
                </View>
              </TouchableOpacity>
            </View>

            <View
              style={styles.otcChartWrapper}
              onLayout={e => setChartHeight(e?.nativeEvent?.layout?.height ?? 320)}
            >
              <View style={styles.otcPriceOverlay}>
                <Text style={styles.otcPriceOverlayText}>{otcMidPrice.toFixed(3)}</Text>
                <Text style={styles.otcPriceOverlaySub}>{formatPercent(selectedOtcPair?.change ?? 0)}</Text>
              </View>
              <View style={styles.otcMetricOverlay} pointerEvents="box-none">
                <View style={styles.otcMetricChip}>
                  <Feather name="dollar-sign" size={12} color={BINANCE_THEME.muted} />
                  <View style={styles.otcMetricText}>
                    <Text style={styles.otcMetricLabel}>Balance</Text>
                    <Text style={styles.otcMetricValue}>{formattedOtcBalance}</Text>
                  </View>
                </View>
                <View style={[styles.otcMetricChip, accountOpenPnl < 0 && styles.otcMetricChipNegative]}>
                  <Feather
                    name={accountOpenPnl >= 0 ? 'trending-up' : 'trending-down'}
                    size={12}
                    color={accountOpenPnl >= 0 ? colors.success : colors.danger}
                  />
                  <View style={styles.otcMetricText}>
                    <Text style={styles.otcMetricLabel}>PNL</Text>
                    <Text style={[
                      styles.otcMetricValue,
                      accountOpenPnl > 0 ? styles.pnlPositive : accountOpenPnl < 0 ? styles.pnlNegative : null
                    ]}
                    >
                      {formattedOtcPnl}
                    </Text>
                  </View>
                </View>
                {levelAnnotations.length ? (
                  <View style={styles.levelLinesOverlay} pointerEvents="none">
                    {levelAnnotations.slice(0, 8).map((item, idx) => {
                      const y = priceToY(item.price)
                      if (y == null || !Number.isFinite(y)) return null
                      const clampedY = Math.max(0, Math.min(y, Math.max(chartHeight - 4, 0)))
                      return (
                        <View key={`${item.label}-${idx}`} style={[styles.levelLineAbs, { top: clampedY }]}>
                          <View style={[styles.levelLineStroke, { backgroundColor: `${item.tone}55` }]} />
                          <View style={[styles.levelLineMarker, { borderColor: `${item.tone}AA`, backgroundColor: '#FFFFFF' }]}>
                            <View style={[styles.levelLineDot, { backgroundColor: item.tone }]} />
                          </View>
                          <View style={[styles.levelLineTag, { borderColor: `${item.tone}AA`, backgroundColor: '#FFFFFFF2' }]}>
                            <Text style={[styles.levelLineText, { color: item.tone }]} numberOfLines={1} ellipsizeMode="tail">
                              {item.label}
                            </Text>
                          </View>
                        </View>
                      )
                    })}
                  </View>
                ) : null}
              </View>
              {loadingOtcHistory && (
                <View style={styles.chartLoader}>
                  <ActivityIndicator color={BINANCE_THEME.primary} />
                </View>
              )}
              <TradingViewWidget
                symbol={tradingViewSymbol}
                interval={tradingViewInterval}
                height={320}
                hideTopToolbar
                hideSideToolbar
                toolbarBg="#FFFFFF"
                backgroundColor="#FFFFFF"
              />
            </View>

            <View style={styles.otcChartActions}>
              <View style={styles.otcOrderControls}>
                <TouchableOpacity
                  style={[styles.otcSideButton, styles.otcBuyButton]}
                  onPress={() => handleOtcExecution('buy')}
                  activeOpacity={0.9}
                >
                  <Text style={styles.otcSideLabel}>BUY</Text>
                </TouchableOpacity>
                <View style={styles.otcQtyCenter}>
              <TouchableOpacity style={styles.otcQtyCircle} onPress={() => adjustOtcQty(-1)}>
                    <Feather name="minus" size={16} color="#0b0d1a" />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.otcQtyInputField}
                    value={otcQtyInput}
                    keyboardType="numeric"
                    onChangeText={handleQtyInput}
                    placeholder="0.01"
                    placeholderTextColor="#9CA3AF"
                    maxLength={9}
                    textAlign="center"
                  />
              <TouchableOpacity style={styles.otcQtyCircle} onPress={() => adjustOtcQty(1)}>
                    <Feather name="plus" size={16} color="#0b0d1a" />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={[styles.otcSideButton, styles.otcSellButton]}
                  onPress={() => handleOtcExecution('sell')}
                  activeOpacity={0.9}
                >
                  <Text style={styles.otcSideLabel}>SELL</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
          <View style={styles.otcTradesCard}>
            {tradesToDisplay.length ? (
              <View style={styles.otcFillStrip}>
              {tradesToDisplay.map(trade => {
                const pnlValue = calculateLivePnl(trade.side, trade.price, trade.qty)
                const pnlLabel = `${pnlValue >= 0 ? '+' : ''}${pnlValue.toFixed(2)}`
                const timestamp = trade.time ? new Date(trade.time) : new Date(trade.created_at ?? Date.now())
                const timeLabel = timestamp.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                const isClosing = closingTradeId === trade.id
                const canClose = Boolean(token && trade.id)
                const qtyDisplay = Number(trade.qty ?? 0).toFixed(2)
                const symbolDisplay = (trade.symbol || selectedOtcSymbol || 'BTC/USDT').toUpperCase().replace(/([A-Z]{3})([A-Z]{3})/, '$1/$2')
                return (
                  <View key={trade.id ?? `trade-${trade.side}-${trade.price}-${trade.time}`} style={styles.tradeListRow}>
                    <View style={styles.tradeRowContent}>
                      <View style={styles.tradeRowBadge}>
                        <Text style={[styles.otcFillSide, trade.side === 'buy' ? styles.pnlPositive : styles.pnlNegative]}>
                          {trade.side === 'buy' ? 'Buy' : 'Sell'}
                        </Text>
                        <Text style={styles.tradeListSymbol}>{symbolDisplay}</Text>
                      </View>
                      <Text style={styles.otcFillPrice}>{formatNumber(trade.price, 3)}</Text>
                      <Text style={styles.otcFillMetaSingle}>
                        {qtyDisplay}
                      </Text>
                      <Text style={styles.otcFillMetaSingle}>
                        · {timeLabel}
                      </Text>
                      <View style={styles.tradePnlWrapper}>
                        <Text style={[styles.otcFillPnl, pnlValue >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
                          {pnlLabel}
                        </Text>
                        <Text style={styles.tradePnlSub}>pips</Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.otcFillCloseButton,
                        !canClose && styles.otcFillCloseButtonDisabled
                      ]}
                      onPress={() => handleCloseTrade(trade)}
                      activeOpacity={0.85}
                      disabled={!canClose || isClosing}
                    >
                      <Text style={styles.otcFillCloseText}>{isClosing ? 'Closing…' : 'Close'}</Text>
                    </TouchableOpacity>
                  </View>
                )
              })}
              </View>
            ) : (
              <View style={styles.otcEmptyTrades}>
                <Text style={styles.otcEmptyTradesText}>No active OTC trades yet.</Text>
              </View>
            )}
          {token && tradesToDisplay.length ? (
            <TouchableOpacity
              style={[
                styles.otcCloseAllButton,
                closingAllTrades && styles.otcCloseAllButtonDisabled
              ]}
              onPress={handleCloseAllTrades}
              disabled={closingAllTrades}
              activeOpacity={0.85}
            >
              <Text style={styles.otcCloseAllText}>
                {closingAllTrades ? 'Closing…' : 'Close all'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <View style={styles.otcPositionStrip}>
            <View style={styles.otcPositionCol}>
              <Text style={styles.otcPositionLabel}>Net Qty</Text>
              <Text style={styles.otcPositionValue}>{otcPosition.qty.toFixed(2)}</Text>
            </View>
            <View style={styles.otcPositionCol}>
              <Text style={styles.otcPositionLabel}>Avg Price</Text>
              <Text style={styles.otcPositionValue}>{otcPosition.avgPrice ? otcPosition.avgPrice.toFixed(3) : '—'}</Text>
            </View>
            <View style={styles.otcPositionCol}>
              <Text style={styles.otcPositionLabel}>Realized PnL</Text>
              <Text style={[
                styles.otcPositionValue,
                otcPosition.realizedPnl >= 0 ? styles.pnlPositive : styles.pnlNegative
              ]}
              >
                {otcPosition.realizedPnl >= 0 ? '+' : ''}
                {otcPosition.realizedPnl.toFixed(2)}
              </Text>
            </View>
            <View style={styles.otcPositionCol}>
              <Text style={styles.otcPositionLabel}>Unrealized</Text>
              <Text style={[
                styles.otcPositionValue,
                otcUnrealizedPnl >= 0 ? styles.pnlPositive : styles.pnlNegative
              ]}
              >
                {otcUnrealizedPnl >= 0 ? '+' : ''}
                {otcUnrealizedPnl.toFixed(2)}
              </Text>
            </View>
          </View>
            {tradeSyncMsg ? <Text style={styles.tradeSyncMsg}>{tradeSyncMsg}</Text> : null}
          </View>
        </View>


        <View style={[styles.otcSection]}>
          <View style={styles.otcOrderTabsRow}>
            {OTC_ORDER_TABS.map((tab, index) => {
              const active = tab === otcOrderTab
              return (
                <TouchableOpacity
                  key={tab}
                  onPress={() => setOtcOrderTab(tab)}
                  style={[
                    styles.otcOrderTab,
                    active && styles.otcOrderTabActive,
                    index === OTC_ORDER_TABS.length - 1 && styles.otcOrderTabLast
                  ]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.otcOrderTabText, active && styles.otcOrderTabTextActive]}>{tab}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.otcOrderPanel}>
            {ORDER_BOOK_ROWS.slice(0, 4).map((row, idx) => (
              <View key={`${row.price}-${idx}`} style={styles.otcOrderRow}>
                <Text style={[styles.otcOrderCell, styles.pnlPositive]}>{row.bidAmount.toFixed(3)}</Text>
                <Text style={styles.otcOrderPrice}>{row.price.toFixed(2)}</Text>
                <Text style={[styles.otcOrderCell, styles.pnlNegative]}>{row.askAmount.toFixed(3)}</Text>
              </View>
            ))}
          </View>
        </View>
        <Modal
          visible={slTpVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSlTpVisible(false)}
        >
          <View style={styles.slTpModalBackdrop}>
            <View style={styles.slTpModal}>
              <View style={styles.slTpHeader}>
                <Text style={styles.slTpTitle}>Set SL / TP</Text>
                <Text style={styles.slTpSubtitle}>Protect your trade with clear exit levels.</Text>
              </View>
              <View style={styles.slTpInputRow}>
                <View style={styles.slTpInputBlock}>
                  <Text style={styles.slTpLabel}>Stop Loss</Text>
                  <TextInput
                    style={styles.slTpInput}
                    value={slInput}
                    onChangeText={setSlInput}
                    keyboardType="numeric"
                    placeholder="e.g. 92500"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
                <View style={styles.slTpInputBlock}>
                  <Text style={styles.slTpLabel}>Take Profit</Text>
                  <TextInput
                    style={styles.slTpInput}
                    value={tpInput}
                    onChangeText={setTpInput}
                    keyboardType="numeric"
                    placeholder="e.g. 98000"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>
              <View style={styles.pendingSection}>
                <View style={styles.pendingHeader}>
                  <Text style={styles.slTpTitle}>Pending order</Text>
                  <View style={styles.pendingSideToggle}>
                    <TouchableOpacity
                      style={[styles.pendingSideButton, pendingSide === 'buy' && styles.pendingSideButtonActive]}
                      onPress={() => setPendingSide('buy')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.pendingSideText, pendingSide === 'buy' && styles.pendingSideTextActive]}>Buy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pendingSideButton, pendingSide === 'sell' && styles.pendingSideButtonActive]}
                      onPress={() => setPendingSide('sell')}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.pendingSideText, pendingSide === 'sell' && styles.pendingSideTextActive]}>Sell</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.pendingInputs}>
                  <View style={styles.slTpInputBlock}>
                    <Text style={styles.slTpLabel}>Trigger price</Text>
                    <TextInput
                      style={styles.slTpInput}
                      value={pendingPrice}
                      onChangeText={setPendingPrice}
                      keyboardType="numeric"
                      placeholder={otcMidPrice.toFixed(2)}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                  <View style={styles.slTpInputBlock}>
                    <Text style={styles.slTpLabel}>Amount (USD)</Text>
                    <TextInput
                      style={styles.slTpInput}
                      value={pendingAmount}
                      onChangeText={setPendingAmount}
                      keyboardType="numeric"
                      placeholder={MIN_TRADE_AMOUNT.toFixed(2)}
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>
                </View>
                <Text style={styles.pendingHint}>We&apos;ll place a {pendingSide} order when your trigger price hits.</Text>
                {pendingOrders.length ? (
                  <View style={styles.pendingList}>
                    {pendingOrders.map(order => (
                      <View key={order.id} style={styles.pendingRow}>
                        <View style={styles.pendingRowLeft}>
                          <Text style={[
                            styles.pendingSideText,
                            order.side === 'buy' ? styles.pnlPositive : styles.pnlNegative
                          ]}
                          >
                            {order.side === 'buy' ? 'Buy' : 'Sell'}
                          </Text>
                          <Text style={styles.pendingMeta}>{formatNumber(order.price, 2)} · {formatNumber(order.amount, 2)}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setPendingOrders(prev => prev.filter(p => p.id !== order.id))}>
                          <Feather name="x" size={16} color={BINANCE_THEME.muted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
              <View style={styles.slTpActionRow}>
                <TouchableOpacity
                  style={styles.slTpGhostButton}
                  onPress={() => {
                    setSlTpVisible(false)
                    setSlInput('')
                    setTpInput('')
                    setPendingPrice('')
                    setPendingAmount(MIN_TRADE_AMOUNT.toFixed(2))
                  }}
                >
                  <Text style={styles.slTpGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.slTpPrimaryButton} onPress={handleSaveSlTp} activeOpacity={0.9}>
                  <Text style={styles.slTpPrimaryText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </ScrollView>
    )
  }

  return (
    <View style={[styles.safe, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 0) }]}>
      <View style={[styles.tradeChipRow, isCompact && styles.tradeChipRowCompact]}>
        {TRADE_SEGMENTS.map(option => {
          const selected = currentSegment === option.label
          return (
            <TouchableOpacity
                key={option.key}
                onPress={() => handleSegmentChange(option.label)}
              activeOpacity={0.85}
              style={[styles.tradeChip, selected && styles.tradeChipActive]}
            >
              <Feather
                name={option.icon}
                size={11}
                color={selected ? '#0764FF' : '#7B8794'}
              />
              <Text style={[styles.tradeChipLabel, selected && styles.tradeChipLabelActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {enableLegacyTradeExperience ? (
        isForexTab ? (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.forexScroll, isCompact && { paddingHorizontal: spacing.sm }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.appBar}>
            <View style={styles.appBarLeft}>
              <TouchableOpacity
                style={styles.appBarIcon}
                activeOpacity={0.8}
                onPress={() => navigation?.goBack?.()}
              >
                <Feather name="arrow-left" size={18} color={BINANCE_THEME.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.appBarPair} onPress={() => setSymbolPickerVisible(true)} activeOpacity={0.85}>
                <Text style={styles.appBarPairLabel}>{selectedSymbol.label}</Text>
                <Feather name="chevron-down" size={16} color={BINANCE_THEME.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.appBarActions}>
              <View style={styles.aiChip}>
                <Text style={styles.aiChipLabel}>Ai</Text>
              </View>
              <Feather name="star" size={18} color={BINANCE_THEME.text} />
              <Feather name="bell" size={18} color={BINANCE_THEME.text} />
              <Feather name="share-2" size={18} color={BINANCE_THEME.text} />
            </View>
          </View>

          <View style={styles.priceTabs}>
            {PRICE_TABS.map(tab => {
              const active = activePriceTab === tab
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.priceTab, active && styles.priceTabActive]}
                  onPress={() => setActivePriceTab(tab)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.priceTabLabel, active && styles.priceTabLabelActive]}>{tab}</Text>
                  {tab === 'Trade+' ? <View style={styles.newBadge}><Text style={styles.newBadgeLabel}>NEW</Text></View> : null}
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.priceSummaryCard}>
            <View style={styles.priceSummaryLeft}>
              <Text style={styles.priceSymbol}>{selectedSymbol.label}</Text>
              <Text style={styles.priceVenue}>{selectedSymbol.value} · Binance</Text>
              <Text style={styles.priceValueMain}>{displayPrice}</Text>
              <Text style={[styles.priceDelta, { color: changeColor }]}>
                {deltaString} ({percentString})
              </Text>
              <View style={styles.priceTagRow}>
                {['POW', 'Vol', 'Protection'].map(tag => (
                  <View key={tag} style={styles.priceTag}>
                    <Text style={styles.priceTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.priceStatsGrid}>
              <View style={styles.priceStat}>
                <Text style={styles.priceStatLabel}>24h High</Text>
                <Text style={styles.priceStatValue}>{formatNumber(chartHigh, priceDecimals)}</Text>
              </View>
              <View style={styles.priceStat}>
                <Text style={styles.priceStatLabel}>24h Low</Text>
                <Text style={styles.priceStatValue}>{formatNumber(chartLow, priceDecimals)}</Text>
              </View>
              <View style={styles.priceStat}>
                <Text style={styles.priceStatLabel}>24h Vol (base)</Text>
                <Text style={styles.priceStatValue}>{formatCompactNumber(bookTotals.buy)}</Text>
              </View>
              <View style={styles.priceStat}>
                <Text style={styles.priceStatLabel}>24h Vol (quote)</Text>
                <Text style={styles.priceStatValue}>{formatCompactNumber(bookTotals.sell * (rawPrice || 1))}</Text>
              </View>
            </View>
          </View>
          {quoteError ? <Text style={styles.infoText}>{quoteError}</Text> : null}

          <View style={styles.timeHeader}>
            <Text style={styles.timeHeaderLabel}>Time</Text>
            <View style={styles.timeHeaderActions}>
              <Feather name="refresh-cw" size={16} color={BINANCE_THEME.muted} />
              <Feather name="layout" size={16} color={BINANCE_THEME.muted} />
            </View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeframeScroller}>
            {FOREX_TIMEFRAMES.map(tf => {
              const selected = tf === timeframe
              return (
                <TouchableOpacity
                  key={tf}
                  onPress={() => setTimeframe(tf)}
                  style={[styles.timeframeChip, selected && styles.timeframeChipActive]}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.timeframeLabel, selected && styles.timeframeLabelActive]}>{tf}</Text>
                </TouchableOpacity>
              )
            })}
            <TouchableOpacity style={styles.timeframeChipGhost} activeOpacity={0.85}>
              <Text style={styles.timeframeGhostLabel}>More</Text>
              <Feather name="chevron-down" size={14} color={BINANCE_THEME.muted} />
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.chartComposite}>
            <View style={styles.chartRail}>
              {CHART_TOOL_ICONS.map(icon => (
                <TouchableOpacity key={icon} style={styles.chartRailButton} activeOpacity={0.85}>
                  <Feather name={icon} size={16} color={BINANCE_THEME.muted} />
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.chartBoard}>
              <View style={styles.chartTitleRow}>
                <View>
                  <Text style={styles.chartSymbol}>{selectedSymbol.label}</Text>
                  <Text style={styles.chartVenue}>{selectedSymbol.value} · Paper desk</Text>
                </View>
                <View style={[styles.changePill, { backgroundColor: `${changeColor}12` }]}>
                  <Feather name={quote.change >= 0 ? 'arrow-up-right' : 'arrow-down-right'} size={14} color={changeColor} />
                  <Text style={[styles.changeText, { color: changeColor }]}>{percentString}</Text>
                </View>
              </View>
              <View style={styles.chartInline}>
                <Text style={styles.chartInlinePrice}>{displayPrice}</Text>
                <Text style={[styles.chartInlineDelta, { color: changeColor }]}>{deltaString} ({percentString})</Text>
              </View>
              <View style={styles.chartBoardCanvas}>
                <View pointerEvents="none" style={styles.chartOverlay}>
                  <Text style={styles.chartOverlayPair}>{selectedSymbol.label} • {timeframe}</Text>
                  <View style={styles.chartOverlayRow}>
                  <Feather name="clock" size={12} color={BINANCE_THEME.muted} />
                    <Text style={styles.chartOverlayTime}>{barTimestamp}</Text>
                  </View>
                </View>
                {loadingChart ? (
                  <View style={styles.chartLoader}>
                    <ActivityIndicator color={BINANCE_THEME.primary} />
                  </View>
                ) : null}
                <TradingViewWidget
                  symbol={legacyTradingViewSymbol}
                  interval={legacyTradingViewInterval}
                  height={320}
                  hideTopToolbar={false}
                  hideSideToolbar
                  toolbarBg="#F8F9FB"
                  backgroundColor="#FFFFFF"
                />
              </View>
              <View style={styles.volumeHeader}>
                <Text style={styles.volumeLabel}>Volume SMA</Text>
                <Text style={styles.volumeValue}>{formatCompactNumber(volumeSeries.slice(-1)[0] ?? 0)}</Text>
              </View>
              <View style={styles.volumeBars}>
                {volumeSeries.slice(-12).map((vol, index) => (
                  <View
                    key={`${vol}-${index}`}
                    style={[
                      styles.volumeBar,
                      {
                        height: Math.max((vol / volumeMax) * 100, 6),
                        backgroundColor: index % 2 === 0 ? '#0ECB81' : '#F6465D'
                      }
                    ]}
                  />
                ))}
              </View>
            </View>
          </View>
          {chartError ? <Text style={styles.infoText}>{chartError}</Text> : null}

          <View style={styles.performanceStrip}>
            {PERFORMANCE_WINDOWS.map(window => (
              <View key={window.label} style={styles.performanceItem}>
                <Text style={styles.performanceLabel}>{window.label}</Text>
                <Text style={[
                  styles.performanceValue,
                  window.value >= 0 ? styles.pnlPositive : styles.pnlNegative
                ]}
                >
                  {formatPercent(window.value)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.orderTabs}>
            {ORDER_TABS.map(tab => {
              const active = orderSection === tab
              return (
                <TouchableOpacity
                  key={tab}
                  style={[styles.orderTab, active && styles.orderTabActive]}
                  onPress={() => setOrderSection(tab)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.orderTabLabel, active && styles.orderTabLabelActive]}>{tab}</Text>
                </TouchableOpacity>
              )
            })}
          </View>

          <View style={styles.orderBookCard}>
            {orderSection === 'Order Book' ? (
              <>
                <View style={styles.orderBookSplit}>
                  <Text style={[styles.orderBookShare, { color: colors.success }]}>{bookShare.toFixed(2)}%</Text>
                  <Text style={[styles.orderBookShare, { color: colors.danger }]}>{(100 - bookShare).toFixed(2)}%</Text>
                </View>
                <View style={styles.orderProgressTrack}>
                  <View style={[styles.orderProgressFill, { width: `${bookShare}%` }]} />
                </View>
                <View style={styles.orderBidAsk}>
                  <View>
                <Text style={styles.orderBidAskLabel}>Bid</Text>
                <View style={[styles.bidAskPill, styles.bidPill]}>
                  <Text style={styles.orderBidAskValue}>{topOrderRow.bidAmount.toFixed(5)}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.orderBidAskLabel}>Price</Text>
                <Text style={styles.orderBidAskValueCenter}>{displayPrice}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.orderBidAskLabel}>Ask</Text>
                <View style={[styles.bidAskPill, styles.askPill]}>
                  <Text style={styles.orderBidAskValue}>{topOrderRow.askAmount.toFixed(5)}</Text>
                </View>
              </View>
            </View>
                <View style={styles.orderDepthHeader}>
                  <Text style={styles.depthLabel}>Bid (Qty)</Text>
                  <Text style={styles.depthLabel}>Price</Text>
                  <Text style={[styles.depthLabel, { textAlign: 'right' }]}>Ask (Qty)</Text>
                </View>
                {ORDER_BOOK_ROWS.map((row, idx) => (
                  <View key={`${row.price}-${idx}`} style={styles.orderDepthRow}>
                    <Text style={styles.depthBid}>{row.bidAmount.toFixed(5)}</Text>
                    <Text style={styles.depthPrice}>{formatNumber(row.price, 2)}</Text>
                    <Text style={styles.depthAsk}>{row.askAmount.toFixed(5)}</Text>
                  </View>
                ))}
              </>
            ) : (
              <View style={styles.orderPlaceholder}>
                <Feather name="activity" size={18} color={BINANCE_THEME.muted} />
                <Text style={styles.orderPlaceholderText}>{orderSection} metrics are coming online shortly.</Text>
              </View>
            )}

          </View>

          <View style={styles.quickActionsRow}>
            {QUICK_ACTIONS.map(action => (
              <TouchableOpacity key={action.label} style={styles.quickAction} activeOpacity={0.85}>
                <View style={styles.quickActionCircle}>
                  <Feather name={action.icon} size={18} color={BINANCE_THEME.text} />
                </View>
                <Text style={styles.quickActionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.tradeButtons}>
            <TouchableOpacity
              style={[styles.tradeButton, styles.buyButton]}
              activeOpacity={0.9}
              onPress={() => handleQuickTicketSide('buy')}
            >
              <Text style={styles.tradeButtonLabel}>Buy</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tradeButton, styles.sellButton]}
              activeOpacity={0.9}
              onPress={() => handleQuickTicketSide('sell')}
            >
              <Text style={styles.tradeButtonLabel}>Sell</Text>
            </TouchableOpacity>
          </View>

          <View
            style={styles.ticketCard}
            onLayout={event => {
              ticketAnchorRef.current = event.nativeEvent.layout.y
            }}
          >
            <View style={styles.ticketHeaderRow}>
              <Text style={styles.ticketTitleLabel}>Advanced order ticket</Text>
              <Text style={styles.ticketSubtitleLabel}>
                {accountSummary ? `Equity ${formatCurrency(accountSummary.equity)}` : 'Alpaca execution'}
              </Text>
            </View>
            <ForexOrderTicket
              symbol={selectedSymbol.label}
              executionSymbol={selectedSymbol.value}
              assetType={selectedSymbol.type}
              bid={quote.bid}
              ask={quote.ask}
              timeframe={timeframe}
              defaultSide={ticketSide}
              onSubmit={() => {
                refreshPositions()
                refreshOrders()
                refreshAccount()
              }}
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Open positions</Text>
              <Text style={styles.sectionLink} onPress={refreshPositions}>Refresh</Text>
            </View>
            {loadingPositions ? (
              <ActivityIndicator color={BINANCE_THEME.primary} />
            ) : visiblePositions.length ? (
              visiblePositions.map(position => (
                <View key={position.id} style={styles.positionRow}>
                  <View style={styles.positionLeft}>
                    <View style={[
                      styles.positionBadge,
                      position.type === 'Buy' ? styles.positionBadgeBuy : styles.positionBadgeSell
                    ]}
                    >
                      <Text style={styles.positionBadgeLabel}>{position.type}</Text>
                    </View>
                    <View>
                      <Text style={styles.positionSymbol}>{formatSymbol(position.symbol)}</Text>
                      <Text style={styles.positionDetails}>
                        {Number(position.volume).toLocaleString()} {isForexSymbol ? 'units' : 'shares'} • #{position.id}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.positionRight}>
                    <Text style={styles.positionPrice}>{position.price.toFixed(5)}</Text>
                    <Text style={[
                      styles.positionPnl,
                      position.pnl >= 0 ? styles.pnlPositive : styles.pnlNegative
                    ]}
                    >
                      {position.pnl >= 0 ? '+' : '-'}${Math.abs(position.pnl).toFixed(2)}
                      {' '}
                      ({position.pnlPct.toFixed(2)}%)
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        setClosingPositionId(position.id)
                        closePosition(position.symbol.replace('/', ''))
                          .then(() => {
                            refreshPositions()
                            refreshAccount()
                          })
                          .catch(err => {
                            console.error('closePosition error', err)
                            setPositionsError('Failed to close position.')
                          })
                          .finally(() => setClosingPositionId(null))
                      }}
                      style={[
                        styles.closeButton,
                        closingPositionId === position.id && styles.closeButtonDisabled
                      ]}
                      activeOpacity={0.85}
                      disabled={closingPositionId === position.id}
                    >
                      <Text style={styles.closeButtonText}>
                        {closingPositionId === position.id ? 'Closing…' : 'Close'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.infoText}>No open positions.</Text>
            )}
            {positionsError ? <Text style={styles.infoText}>{positionsError}</Text> : null}
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent orders</Text>
              <Text style={styles.sectionLink} onPress={refreshOrders}>Refresh</Text>
            </View>
            {loadingOrders ? (
              <ActivityIndicator color={BINANCE_THEME.primary} />
            ) : visibleOrders.length ? (
              visibleOrders.map(order => (
                <View key={order.id} style={styles.orderRow}>
                  <View>
                    <Text style={styles.orderSymbol}>{formatSymbol(order.symbol)}</Text>
                    <Text style={styles.orderMeta}>
                      {order.type} {order.side} • {typeof order.volume === 'number'
                        ? (isForexSymbol ? order.volume.toFixed(2) : Number(order.volume).toFixed(0))
                        : order.volume}
                    </Text>
                  </View>
                  <View style={styles.orderRight}>
                    <Text style={styles.orderPrice}>{order.filledAvgPrice ? Number(order.filledAvgPrice).toFixed(priceDecimals) : '—'}</Text>
                    <Text style={styles.orderStatus}>{order.status}</Text>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.infoText}>No recent orders.</Text>
            )}
            {ordersError ? <Text style={styles.infoText}>{ordersError}</Text> : null}
          </View>

          <Text style={styles.forexBody}>
            This workspace connects to Alpaca&apos;s paper trading environment. Quotes and bars update in real time when available.
            Use the instrument switcher to move between FX majors, metals, and U.S. equities without leaving the trade desk.
          </Text>
        </ScrollView>
        ) : (
          renderPlaceholder('OTC')
        )
      ) : (
        currentSegment === 'OTC'
          ? renderOtcDesk()
          : renderPlaceholder(currentSegment)
      )}

      <Modal
        visible={symbolPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSymbolPickerVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPressOut={() => setSymbolPickerVisible(false)}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select instrument</Text>
            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {Object.entries(groupedSymbols).map(([group, items]) => (
                <View key={group}>
                  <Text style={styles.modalSectionTitle}>{group === 'forex' ? 'FX Majors' : 'Equities & ETFs'}</Text>
                  {items.map(item => {
                    const active = item.value === selectedSymbol.value
                    return (
                      <TouchableOpacity
                        key={item.value}
                        style={[styles.modalItem, active && styles.modalItemActive]}
                        onPress={() => {
                          setSelectedSymbol(item)
                          setSymbolPickerVisible(false)
                        }}
                      >
                        <View>
                          <Text style={[styles.modalItemLabel, active && styles.modalItemLabelActive]}>{item.label}</Text>
                          <Text style={styles.modalItemDescription}>{item.description}</Text>
                        </View>
                        {active ? <Feather name="check" size={18} color={BINANCE_THEME.primary} /> : null}
                      </TouchableOpacity>
                    )
                  })}
                </View>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal
        visible={otcPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOtcPickerVisible(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPressOut={() => setOtcPickerVisible(false)}>
          <View style={styles.otcModalSheet}>
            <Text style={styles.otcModalTitle}>Select OTC pair</Text>
            <View style={styles.otcSearchBar}>
              <Feather name="search" size={16} color={BINANCE_THEME.muted} />
              <TextInput
                style={styles.otcSearchInput}
                placeholder="Search symbol..."
                placeholderTextColor={BINANCE_THEME.muted}
                value={otcSearch}
                onChangeText={setOtcSearch}
              />
              {otcSearch ? (
                <TouchableOpacity onPress={() => setOtcSearch('')} hitSlop={8}>
                  <Feather name="x" size={16} color={BINANCE_THEME.muted} />
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.otcFilterRow}
            >
              {OTC_STATUS_FILTERS.map(filter => {
                const active = filter === otcStatusFilter
                return (
                  <TouchableOpacity
                    key={filter}
                    onPress={() => setOtcStatusFilter(filter)}
                    style={[styles.otcFilterChip, active && styles.otcFilterChipActive]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.otcFilterLabel, active && styles.otcFilterLabelActive]}>
                      {filter === 'all' ? 'All status' : OTC_STATUS_LABELS[filter]}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
            <ScrollView style={styles.otcModalList} showsVerticalScrollIndicator={false}>
              {otcFilteredPairs.map(pair => {
                const active = pair.symbol === selectedOtcSymbol
                return (
                  <TouchableOpacity
                    key={pair.id}
                    style={[styles.otcModalItem, active && styles.otcModalItemActive]}
                    onPress={() => {
                      setSelectedOtcSymbol(pair.symbol)
                      setOtcPickerVisible(false)
                    }}
                  >
                    <View>
                      <Text style={styles.otcModalSymbol}>{pair.symbol}</Text>
                      <Text style={styles.otcModalDetail}>{pair.base} • {pair.quote}</Text>
                    </View>
                    <View style={styles.otcModalRight}>
                      <Text style={styles.otcModalPrice}>{pair.price.toFixed(2)}</Text>
                      <Text style={[styles.otcModalChange, pair.change >= 0 ? styles.pnlPositive : styles.pnlNegative]}>
                        {pair.change >= 0 ? '+' : ''}
                        {pair.change.toFixed(2)}%
                      </Text>
                    </View>
                  </TouchableOpacity>
                )
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={showTimeframeDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTimeframeDropdown(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPressOut={() => setShowTimeframeDropdown(false)}>
          <View style={styles.otcDropdownModal}>
            {OTC_TIMEFRAMES.map(frame => (
              <TouchableOpacity
                key={frame}
                style={[styles.otcDropdownModalItem, frame === otcTimeframe && styles.otcDropdownModalItemActive]}
                onPress={() => handleSelectTimeframe(frame)}
              >
                <Text style={[
                  styles.otcDropdownModalItemText,
                  frame === otcTimeframe && styles.otcDropdownModalItemTextActive
                ]}
                >
                  {frame}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
      <Modal
        visible={showIndicatorDropdown}
        transparent
        animationType="fade"
        onRequestClose={() => setShowIndicatorDropdown(false)}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPressOut={() => setShowIndicatorDropdown(false)}>
          <View style={styles.otcDropdownModal}>
            {OTC_INDICATORS.map(indicator => (
              <TouchableOpacity
                key={indicator}
                style={[styles.otcDropdownModalItem, indicator === selectedIndicator && styles.otcDropdownModalItemActive]}
                onPress={() => handleSelectIndicator(indicator)}
              >
                <Text style={[
                  styles.otcDropdownModalItemText,
                  indicator === selectedIndicator && styles.otcDropdownModalItemTextActive
                ]}
                >
                  {indicator}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: BINANCE_THEME.background
  },
  tradeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.container,
    rowGap: spacing.xs,
    columnGap: spacing.xs,
    marginTop: spacing.sm,
    marginBottom: spacing.sm * 0.6
  },
  tradeChipRowCompact: {
    paddingHorizontal: spacing.sm,
    columnGap: spacing.xs * 0.8
  },
  tradeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs * 0.5,
    paddingVertical: spacing.xs * 0.35,
    paddingHorizontal: spacing.sm * 0.45,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#C9D7FF',
    backgroundColor: '#F4F7FF',
    flexGrow: 1
  },
  tradeChipActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#0764FF',
    shadowColor: '#0b5cf433',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 2
  },
  tradeChipLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#5B6475'
  },
  tradeChipLabelActive: {
    color: '#0764FF'
  },
  forexScroll: {
    paddingHorizontal: spacing.container,
    paddingBottom: spacing.md,
    gap: spacing.lg
  },
  blankOtc: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: BINANCE_THEME.background
  },
  blankOtcTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  blankOtcSubtitle: {
    fontSize: 14,
    color: BINANCE_THEME.muted,
    textAlign: 'center'
  },
  otcShell: {
    paddingHorizontal: spacing.container,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    backgroundColor: BINANCE_THEME.background
  },
  otcSection: {
    marginTop: spacing.md
  },
  otcIconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    alignItems: 'center',
    justifyContent: 'center'
  },
  otcScroll: {
    paddingHorizontal: spacing.container,
    paddingBottom: spacing.md,
    gap: spacing.md
  },
  otcTimeframesDark: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  otcTimeframeChipDark: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D8DEED'
  },
  otcTimeframeChipDarkActive: {
    borderColor: BINANCE_THEME.primary,
    backgroundColor: BINANCE_THEME.primarySoft
  },
  otcTimeframeChipText: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  otcTimeframeChipTextActive: {
    color: BINANCE_THEME.text
  },
  otcHeaderCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: 16,
    backgroundColor: BINANCE_THEME.surface,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    shadowColor: '#0f172a12',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
    alignItems: 'center'
  },
  otcHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcHeaderSubtitle: {
    marginTop: 4,
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  otcSyncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFD2FF',
    backgroundColor: '#EFF4FF'
  },
  otcSyncText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#0764FF'
  },
  otcInstrumentCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    backgroundColor: BINANCE_THEME.surface,
    padding: spacing.md,
    gap: spacing.xs,
    shadowColor: '#0f172a12',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3
  },
  otcInstrumentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  otcInstrumentSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcInstrumentDetails: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  otcPriceBoard: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  otcPriceColumn: {
    flex: 1,
    alignItems: 'flex-start'
  },
  otcBoardValue: {
    fontSize: 16,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcTimeframeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'space-between'
  },
  otcTimeframeChip: {
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    paddingVertical: spacing.xs * 0.4
  },
  otcTimeframeChipActive: {
    backgroundColor: '#0764FF10',
    borderColor: '#0764FF'
  },
  otcTimeframeLabel: {
    fontSize: 11,
    color: BINANCE_THEME.muted,
    fontWeight: '600'
  },
  otcTimeframeLabelActive: {
    color: '#0764FF'
  },
  otcIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm
  },
  otcIndicatorChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE1EF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs * 0.6,
    backgroundColor: '#F8FAFF'
  },
  otcIndicatorSpacer: {
    marginRight: spacing.sm
  },
  otcIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4C5566'
  },
  otcChartCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    backgroundColor: '#FFFFFF',
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: '#0f172a14',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4
  },
  otcCompositeCard: {
    borderRadius: 20,
    backgroundColor: '#ffffff',
    padding: 0,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0b0f1c',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 3,
    overflow: 'hidden'
  },
  otcPriceOverlay: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    backgroundColor: '#FFFFFFEE',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12
  },
  otcPriceOverlayText: {
    fontSize: 14,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcPriceOverlaySub: {
    fontSize: 11,
    color: BINANCE_THEME.muted
  },
  otcChartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  otcHeaderMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    flexShrink: 1
  },
  otcHeaderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm * 0.9,
    paddingVertical: spacing.xs * 0.45,
    borderRadius: 999,
    backgroundColor: '#F4F7FF',
    borderWidth: 1,
    borderColor: '#E5E9F0',
    flexShrink: 1
  },
  otcHeaderChipNegative: {
    backgroundColor: '#FFF5F5'
  },
  otcHeaderChipText: {
    gap: 2,
    flexShrink: 1,
    minWidth: 0
  },
  slTpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0B9EDB',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs * 0.5,
    borderRadius: 999
  },
  slTpButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12
  },
  otcChartSubtitle: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  otcChartSubtitleDrop: {
    marginTop: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs * 0.4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    backgroundColor: BINANCE_THEME.surface
  },
  otcDropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs
  },
  otcDropdownPicker: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs * 0.4
  },
  otcDropdownLabel: {
    fontSize: 11,
    color: BINANCE_THEME.muted,
    marginRight: spacing.xs
  },
  otcDropdownValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs * 0.3
  },
  otcDropdownValue: {
    fontSize: 13,
    fontWeight: '600',
    color: BINANCE_THEME.text
  },
  otcDropdownModal: {
    position: 'absolute',
    top: '25%',
    left: '8%',
    right: '8%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border
  },
  otcDropdownModalItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 14,
    marginBottom: spacing.xs * 0.5
  },
  otcDropdownModalItemActive: {
    backgroundColor: '#EFF4FF'
  },
  otcDropdownModalItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: BINANCE_THEME.text
  },
  otcDropdownModalItemTextActive: {
    color: '#0764FF'
  },
  otcChartSubtitleText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs * 0.4
  },
  otcChartSubtitlePair: {
    fontSize: 12,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcChartSubtitleFrame: {
    fontSize: 11,
    color: BINANCE_THEME.muted
  },
  otcChartMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  otcChartPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs * 0.4,
    borderRadius: 999,
    backgroundColor: '#F4F7FF'
  },
  otcMetricPill: {
    backgroundColor: '#F4F7FF'
  },
  otcMetricOverlay: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  otcMetricChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs * 0.6,
    backgroundColor: '#FFFFFFDD',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E9F0'
  },
  otcMetricChipNegative: {
    backgroundColor: '#FFF5F5'
  },
  otcMetricText: {
    gap: 2
  },
  otcMetricLabel: {
    fontSize: 10,
    color: BINANCE_THEME.muted
  },
  otcMetricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  slTpModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md
  },
  slTpModal: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  slTpHeader: {
    gap: 4
  },
  slTpTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  slTpSubtitle: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  slTpInputRow: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  slTpInputBlock: {
    flex: 1,
    gap: 6
  },
  slTpLabel: {
    fontSize: 12,
    color: BINANCE_THEME.muted,
    fontWeight: '600'
  },
  slTpInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 14,
    color: BINANCE_THEME.text
  },
  slTpActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm
  },
  slTpGhostButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs * 0.9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB'
  },
  slTpGhostText: {
    fontSize: 13,
    color: BINANCE_THEME.text,
    fontWeight: '600'
  },
  slTpPrimaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs * 0.9,
    borderRadius: 10,
    backgroundColor: '#0B9EDB'
  },
  slTpPrimaryText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  pendingSection: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 12,
    backgroundColor: '#F8FAFF',
    borderWidth: 1,
    borderColor: '#E5E7EB'
  },
  pendingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  pendingSideToggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    padding: 2
  },
  pendingSideButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs * 0.6,
    borderRadius: 999
  },
  pendingSideButtonActive: {
    backgroundColor: '#FFFFFF',
    elevation: 1
  },
  pendingSideText: {
    fontSize: 12,
    fontWeight: '700',
    color: BINANCE_THEME.muted
  },
  pendingSideTextActive: {
    color: BINANCE_THEME.text
  },
  pendingInputs: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  pendingHint: {
    fontSize: 11,
    color: BINANCE_THEME.muted
  },
  pendingList: {
    marginTop: spacing.xs,
    gap: spacing.xs
  },
  pendingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF'
  },
  pendingRowLeft: {
    gap: 4
  },
  pendingMeta: {
    fontSize: 11,
    color: BINANCE_THEME.muted
  },
  levelLinesOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5
  },
  levelLineAbs: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    gap: spacing.xs
  },
  levelLineStroke: {
    height: 1,
    flex: 1,
    borderRadius: 2,
    opacity: 0.7
  },
  levelLineMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  levelLineDot: {
    width: 8,
    height: 8,
    borderRadius: 4
  },
  levelLineTag: {
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs * 0.3,
    borderRadius: 8,
    borderWidth: 1
  },
  levelLineText: {
    fontSize: 11,
    fontWeight: '700'
  },
  otcChartWrapper: {
    borderRadius: 16,
    overflow: 'hidden'
  },
  otcOrderTabsRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    backgroundColor: BINANCE_THEME.surface,
    overflow: 'hidden'
  },
  otcOrderTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRightWidth: 1,
    borderRightColor: BINANCE_THEME.border
  },
  otcOrderTabLast: {
    borderRightWidth: 0
  },
  otcOrderTabActive: {
    backgroundColor: '#F0F4FF'
  },
  otcOrderTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.muted
  },
  otcOrderTabTextActive: {
    color: '#0764FF'
  },
  otcOrderPanel: {
    marginTop: spacing.sm,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    backgroundColor: BINANCE_THEME.surface,
    padding: spacing.md
  },
  otcOrderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7'
  },
  otcOrderCell: {
    fontSize: 13,
    fontWeight: '600'
  },
  otcOrderPrice: {
    fontSize: 13,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcAdminCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: '#FFFFFF'
  },
  otcAdminHeader: {
    gap: 4
  },
  otcAdminTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcAdminSubtitle: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  otcAdminRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  otcAdminChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs * 0.4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCE1EF'
  },
  otcAdminChipActive: {
    borderColor: '#0764FF',
    backgroundColor: '#0764FF12'
  },
  otcAdminChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#5C6373'
  },
  otcAdminChipTextActive: {
    color: '#0764FF'
  },
  otcChartActions: {
    marginTop: spacing.sm,
    borderRadius: 14,
    padding: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E8EDF5',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0
  },
  otcQtyHint: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  otcQtyDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm
  },
  otcQtyButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BINANCE_THEME.background
  },
  otcQtyValue: {
    fontSize: 18,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcQtyValueInput: {
    minWidth: 64,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    color: BINANCE_THEME.text
  },
  otcOrderControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 6,
    paddingHorizontal: spacing.sm * 0.4,
    paddingVertical: spacing.xs * 0.3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#00000005',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2
  },
  otcSideButton: {
    flex: 1,
    paddingVertical: spacing.xs * 0.35,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0,
    backgroundColor: '#ffffff'
  },
  otcSideLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 0.4
  },
  otcSellButton: {
    backgroundColor: '#ff4b5c',
    marginLeft: spacing.xs * 0.4,
    borderRadius: 8
  },
  otcBuyButton: {
    backgroundColor: '#11c37d',
    marginRight: spacing.xs * 0.4,
    borderRadius: 8
  },
  otcQtyCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm * 0.6,
    paddingHorizontal: spacing.sm * 0.6,
    paddingVertical: spacing.xs * 0.4,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    minWidth: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0'
  },
  otcQtyCircle: {
    width: 32,
    height: 32,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#d6dcea',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc'
  },
  otcQtyInputField: {
    minWidth: 50,
    maxWidth: 80,
    fontSize: 16,
    fontWeight: '700',
    color: '#0b0c17',
    textAlign: 'center'
  },
  otcFillStrip: {
    marginTop: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E4E8F2',
    backgroundColor: '#F9FBFF',
    padding: spacing.sm,
    gap: spacing.xs
  },
  otcTradesCard: {
    padding: spacing.sm,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E8EDF5',
    gap: spacing.sm
  },
  otcEmptyTrades: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm
  },
  otcEmptyTradesText: {
    fontSize: 13,
    color: BINANCE_THEME.muted
  },
  tradeListRow: {
    backgroundColor: BINANCE_THEME.surface,
    borderRadius: 14,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  tradeRowContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap'
  },
  tradeRowBadge: {
    minWidth: 80,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs * 0.6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs
  },
  tradeListSymbol: {
    fontSize: 11,
    color: BINANCE_THEME.muted,
    fontWeight: '600'
  },
  tradePnlWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs * 0.4
  },
  tradePnlSub: {
    fontSize: 10,
    color: BINANCE_THEME.muted
  },
  otcFillSide: {
    fontSize: 12,
    fontWeight: '700'
  },
  otcFillPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcFillMetaSingle: {
    fontSize: 11,
    color: BINANCE_THEME.muted
  },
  otcFillPnl: {
    fontSize: 12,
    fontWeight: '700'
  },
  otcFillCloseButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs * 0.7
  },
  otcFillCloseButtonDisabled: {
    opacity: 0.5
  },
  otcFillCloseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309'
  },
  otcCloseAllButton: {
    alignSelf: 'flex-end',
    marginTop: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FBBF24',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs * 0.8
  },
  otcCloseAllButtonDisabled: {
    opacity: 0.6
  },
  otcCloseAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b45309'
  },
  otcPositionStrip: {
    marginTop: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4E8F2',
    backgroundColor: '#FFFFFF',
    padding: spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm
  },
  otcPositionCol: {
    flexBasis: '48%'
  },
  otcPositionLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    color: BINANCE_THEME.muted,
    letterSpacing: 0.4
  },
  otcPositionValue: {
    fontSize: 14,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  tradeSyncMsg: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  otcSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DCE3F2',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  otcSearchInput: {
    flex: 1,
    fontSize: 14,
    color: BINANCE_THEME.text
  },
  otcFilterRow: {
    paddingVertical: spacing.xs,
    gap: spacing.xs
  },
  otcFilterChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DCE1EF'
  },
  otcFilterChipActive: {
    backgroundColor: '#0764FF10',
    borderColor: '#0764FF'
  },
  otcFilterLabel: {
    fontSize: 12,
    color: BINANCE_THEME.muted,
    fontWeight: '600'
  },
  otcFilterLabelActive: {
    color: '#0764FF'
  },
  otcStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: spacing.xs * 0.9,
    paddingVertical: spacing.xs * 0.2
  },
  otcStatusText: {
    fontSize: 11,
    fontWeight: '600',
    color: BINANCE_THEME.text
  },
  otcMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  otcMetaLabel: {
    fontSize: 11,
    color: BINANCE_THEME.muted
  },
  otcMetaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.text
  },
  spreadAdjustRow: {
    flexDirection: 'row',
    gap: 6
  },
  spreadAdjustButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#DCE1EF',
    alignItems: 'center',
    justifyContent: 'center'
  },
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm
  },
  appBarLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  appBarIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: BINANCE_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BINANCE_THEME.border
  },
  appBarPair: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: BINANCE_THEME.surface,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border
  },
  appBarPairLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  appBarActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  aiChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    backgroundColor: BINANCE_THEME.primarySoft,
    borderWidth: 1,
    borderColor: BINANCE_THEME.primary
  },
  aiChipLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  priceTabs: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: BINANCE_THEME.border
  },
  priceTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    gap: 4
  },
  priceTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: BINANCE_THEME.primary
  },
  priceTabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.muted
  },
  priceTabLabelActive: {
    color: BINANCE_THEME.text
  },
  newBadge: {
    backgroundColor: BINANCE_THEME.primary,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  newBadgeLabel: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '700'
  },
  priceSummaryCard: {
    backgroundColor: BINANCE_THEME.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border
  },
  priceSummaryLeft: {
    gap: 6
  },
  priceSymbol: {
    fontSize: 13,
    color: BINANCE_THEME.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  priceVenue: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  priceValueMain: {
    fontSize: 32,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  priceDelta: {
    fontSize: 14,
    fontWeight: '600'
  },
  priceTagRow: {
    flexDirection: 'row',
    gap: spacing.xs
  },
  priceTag: {
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: BINANCE_THEME.background
  },
  priceTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: BINANCE_THEME.muted
  },
  priceStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md
  },
  priceStat: {
    flexBasis: '48%',
    backgroundColor: BINANCE_THEME.background,
    borderRadius: 12,
    padding: spacing.md
  },
  priceStatLabel: {
    fontSize: 11,
    color: BINANCE_THEME.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5
  },
  priceStatValue: {
    marginTop: 4,
    fontSize: 16,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  timeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md
  },
  timeHeaderLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: BINANCE_THEME.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  timeHeaderActions: {
    flexDirection: 'row',
    gap: spacing.sm
  },
  timeframeScroller: {
    gap: spacing.sm,
    paddingVertical: spacing.sm
  },
  timeframeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    backgroundColor: BINANCE_THEME.surface
  },
  timeframeChipActive: {
    borderColor: BINANCE_THEME.primary,
    backgroundColor: BINANCE_THEME.primarySoft
  },
  timeframeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.muted
  },
  timeframeLabelActive: {
    color: BINANCE_THEME.text
  },
  timeframeChipGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    backgroundColor: BINANCE_THEME.background
  },
  timeframeGhostLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.muted
  },
  chartComposite: {
    flexDirection: 'row',
    backgroundColor: BINANCE_THEME.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    overflow: 'hidden'
  },
  chartRail: {
    width: 44,
    backgroundColor: BINANCE_THEME.background,
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.sm
  },
  chartRailButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BINANCE_THEME.surface
  },
  chartBoard: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.sm
  },
  chartTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  chartSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  chartVenue: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  chartInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  chartInlinePrice: {
    fontSize: 22,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  chartInlineDelta: {
    fontSize: 13,
    fontWeight: '600'
  },
  chartBoardCanvas: {
    marginTop: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    overflow: 'hidden',
    position: 'relative'
  },
  volumeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm
  },
  volumeLabel: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  volumeValue: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.text
  },
  volumeBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 100
  },
  volumeBar: {
    width: 10,
    borderRadius: 4,
    backgroundColor: BINANCE_THEME.primarySoft
  },
  performanceStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md
  },
  performanceItem: {
    flexBasis: '30%',
    flexGrow: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    padding: spacing.sm
  },
  performanceLabel: {
    fontSize: 11,
    color: BINANCE_THEME.muted
  },
  performanceValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700'
  },
  orderTabs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: BINANCE_THEME.border
  },
  orderTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm
  },
  orderTabActive: {
    borderBottomWidth: 2,
    borderBottomColor: BINANCE_THEME.primary
  },
  orderTabLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.muted
  },
  orderTabLabelActive: {
    color: BINANCE_THEME.text
  },
  orderBookCard: {
    backgroundColor: BINANCE_THEME.surface,
    borderRadius: 18,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border
  },
  orderBookSplit: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
  orderBookShare: {
    fontSize: 12,
    fontWeight: '700'
  },
  orderProgressTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: '#F0F2F7',
    overflow: 'hidden'
  },
  orderProgressFill: {
    height: '100%',
    backgroundColor: colors.success
  },
  orderBidAsk: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end'
  },
  orderBidAskLabel: {
    fontSize: 11,
    color: BINANCE_THEME.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  orderBidAskValue: {
    fontSize: 14,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  orderBidAskValueCenter: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  bidAskPill: {
    marginTop: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12
  },
  bidPill: {
    backgroundColor: 'rgba(14,203,129,0.15)'
  },
  askPill: {
    backgroundColor: 'rgba(246,70,93,0.15)'
  },
  orderDepthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs
  },
  depthLabel: {
    flex: 1,
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  orderDepthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: BINANCE_THEME.border
  },
  orderPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg
  },
  orderPlaceholderText: {
    fontSize: 13,
    color: BINANCE_THEME.muted,
    textAlign: 'center'
  },
  depthBid: {
    flex: 1,
    fontSize: 12,
    color: colors.success
  },
  depthPrice: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    textAlign: 'center'
  },
  depthAsk: {
    flex: 1,
    fontSize: 12,
    color: colors.danger,
    textAlign: 'right'
  },
  quickActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    gap: spacing.sm
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    gap: 8
  },
  quickActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    backgroundColor: BINANCE_THEME.surface,
    alignItems: 'center',
    justifyContent: 'center'
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.text
  },
  tradeButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm
  },
  tradeButton: {
    flex: 1,
    borderRadius: 24,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center'
  },
  buyButton: {
    backgroundColor: '#0ECB81'
  },
  sellButton: {
    backgroundColor: '#F6465D'
  },
  tradeButtonLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF'
  },
  ticketCard: {
    backgroundColor: BINANCE_THEME.surface,
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: BINANCE_THEME.border,
    gap: spacing.md
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  ticketTitleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  ticketSubtitleLabel: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999
  },
  changeText: {
    fontSize: 13,
    fontWeight: '700'
  },
  infoText: {
    marginTop: spacing.xs,
    fontSize: 11,
    color: BINANCE_THEME.muted
  },
  chartLoader: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 2
  },
  chartOverlay: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 12,
    backgroundColor: '#FFFFFFDD',
    gap: 4
  },
  chartOverlayPair: {
    fontSize: 12,
    fontWeight: '700',
    color: BINANCE_THEME.text,
    textTransform: 'uppercase',
    letterSpacing: 0.8
  },
  chartOverlayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  chartOverlayTime: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#E1E6F0',
    shadowColor: '#0f172a0a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary
  },
  sectionLink: {
    fontSize: 12,
    color: BINANCE_THEME.primary,
    fontWeight: '600'
  },
  positionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7'
  },
  positionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm
  },
  positionBadge: {
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs
  },
  positionBadgeBuy: {
    backgroundColor: '#E6FAF1'
  },
  positionBadgeSell: {
    backgroundColor: '#FEE2E2'
  },
  positionBadgeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary
  },
  positionSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary
  },
  positionDetails: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  positionRight: {
    alignItems: 'flex-end',
    gap: 4
  },
  positionPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  positionPnl: {
    fontSize: 13,
    fontWeight: '700'
  },
  pnlPositive: {
    color: colors.success
  },
  pnlNegative: {
    color: colors.danger
  },
  closeButton: {
    marginTop: 2,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CED5E3'
  },
  closeButtonDisabled: {
    opacity: 0.6
  },
  closeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: BINANCE_THEME.muted
  },
  orderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7'
  },
  orderSymbol: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  orderMeta: {
    fontSize: 12,
    color: BINANCE_THEME.muted,
    marginTop: 2
  },
  orderRight: {
    alignItems: 'flex-end',
    gap: 4
  },
  orderPrice: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary
  },
  orderStatus: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6
  },
  forexBody: {
    fontSize: 13,
    color: BINANCE_THEME.muted,
    lineHeight: 20
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md
  },
  containerCompact: {
    padding: 16,
    gap: 12
  },
  iconWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5
  },
  iconWrapperCompact: {
    width: 80,
    height: 80,
    borderRadius: 40
  },
  segmentTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BINANCE_THEME.muted,
    textTransform: 'uppercase',
    letterSpacing: 1
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center'
  },
  titleCompact: {
    fontSize: 22
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 22
  },
  subtitleCompact: {
    fontSize: 14,
    lineHeight: 20
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: '#00000055',
    justifyContent: 'flex-end'
  },
  modalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md
  },
  otcModalSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm
  },
  otcModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcModalList: {
    maxHeight: 400
  },
  otcModalItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7'
  },
  otcModalItemActive: {
    backgroundColor: '#F4F7FF'
  },
  otcModalSymbol: {
    fontSize: 14,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcModalDetail: {
    fontSize: 12,
    color: BINANCE_THEME.muted
  },
  otcModalRight: {
    alignItems: 'flex-end'
  },
  otcModalPrice: {
    fontSize: 14,
    fontWeight: '700',
    color: BINANCE_THEME.text
  },
  otcModalChange: {
    fontSize: 12
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary
  },
  modalList: {
    maxHeight: 400
  },
  modalSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: BINANCE_THEME.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
    marginBottom: spacing.xs
  },
  modalItem: {
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F7',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  modalItemActive: {
    backgroundColor: '#F3F7FF'
  },
  modalItemLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary
  },
  modalItemLabelActive: {
    color: BINANCE_THEME.primary
  },
  modalItemDescription: {
    fontSize: 12,
    color: BINANCE_THEME.muted,
    marginTop: 2
  }
})

export default ComingSoonScreen
