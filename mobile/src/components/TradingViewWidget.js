import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { WebView } from 'react-native-webview'

const buildHtml = ({
  symbol,
  interval,
  theme,
  hideSideToolbar,
  hideTopToolbar,
  toolbarBg,
  backgroundColor,
  containerId
}) => {
  const cleanSymbol = JSON.stringify(symbol ?? 'BINANCE:BTCUSDT')
  const cleanInterval = JSON.stringify(interval ?? '15')
  const cleanTheme = JSON.stringify(theme ?? 'light')
  const hideTop = hideTopToolbar ? 'true' : 'false'
  const hideSide = hideSideToolbar ? 'true' : 'false'
  const toolbarColor = JSON.stringify(toolbarBg ?? '#f4f5f7')
  const bgColor = JSON.stringify(backgroundColor ?? '#FFFFFF')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    html, body {
      margin: 0;
      padding: 0;
      background: ${bgColor};
      height: 100%;
      width: 100%;
      overflow: hidden;
    }
    #${containerId} {
      width: 100%;
      height: 100%;
    }
  </style>
</head>
<body>
  <div id="${containerId}"></div>
  <script>
    (function () {
      const createWidget = () => {
        const container = document.getElementById('${containerId}')
        if (!container || container.dataset.initialized === 'true') {
          return
        }
        new TradingView.widget({
          autosize: true,
          symbol: ${cleanSymbol},
          interval: ${cleanInterval},
          timezone: 'Etc/UTC',
          theme: ${cleanTheme},
          style: 1,
          toolbar_bg: ${toolbarColor},
          hide_side_toolbar: ${hideSide},
          hide_top_toolbar: ${hideTop},
          enable_publishing: false,
          allow_symbol_change: true,
          withdateranges: true,
          container_id: '${containerId}'
        })
        container.dataset.initialized = 'true'
      }

      const loadScript = () => {
        if (typeof TradingView !== 'undefined') {
          createWidget()
          return
        }
        const existing = document.querySelector('script[src="https://s3.tradingview.com/tv.js"]')
        if (existing) {
          existing.addEventListener('load', createWidget)
          return
        }
        const script = document.createElement('script')
        script.src = 'https://s3.tradingview.com/tv.js'
        script.onload = createWidget
        script.onerror = () => setTimeout(loadScript, 200)
        document.head.appendChild(script)
      }

      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        loadScript()
      } else {
        window.addEventListener('DOMContentLoaded', loadScript)
      }
    })()
  </script>
</body>
</html>`
}

export function TradingViewWidget({
  symbol = 'BINANCE:BTCUSDT',
  interval = '15',
  height = 320,
  theme = 'light',
  hideTopToolbar = true,
  hideSideToolbar = true,
  toolbarBg = '#F7F9FB',
  backgroundColor = '#FFFFFF'
}) {
  const containerId = useMemo(() => `tradingview-${Math.random().toString(36).slice(2, 9)}`, [])
  const html = useMemo(
    () => buildHtml({
      symbol,
      interval,
      theme,
      hideTopToolbar,
      hideSideToolbar,
      toolbarBg,
      backgroundColor,
      containerId
    }),
    [symbol, interval, theme, hideTopToolbar, hideSideToolbar, toolbarBg, backgroundColor, containerId]
  )

  return (
    <View style={[styles.wrapper, { height, backgroundColor }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        automaticallyAdjustContentInsets={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E9F0'
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent'
  }
})
