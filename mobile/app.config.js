import 'dotenv/config'

export default ({ config }) => {
  const extra = {
    apiBaseUrl: process.env.API_BASE_URL ?? config.extra?.apiBaseUrl ?? 'http://192.168.0.104:4000',
    webBaseUrl: process.env.WEB_BASE_URL ?? config.extra?.webBaseUrl ?? 'http://192.168.0.104:5173',
    alpacaKeyId: process.env.ALPACA_KEY_ID ?? '',
    alpacaSecretKey: process.env.ALPACA_SECRET_KEY ?? '',
    alpacaPaperTradingUrl: process.env.ALPACA_PAPER_TRADING_URL ?? 'https://paper-api.alpaca.markets',
    alpacaDataUrl: process.env.ALPACA_DATA_URL ?? 'https://data.alpaca.markets',
    alpacaTradingStreamUrl: process.env.ALPACA_TRADING_WS ?? 'wss://paper-api.alpaca.markets/stream',
    alpacaDataStreamUrl: process.env.ALPACA_DATA_WS ?? 'wss://stream.data.alpaca.markets/v2/sip'
  }

  return {
    ...config,
    plugins: [
      [
        'expo-camera',
        {
          cameraPermission: 'Allow the app to access your camera for secure face verification.'
        }
      ]
    ],
    android: {
      ...(config.android || {}),
      permissions: [
        ...(config.android?.permissions || []),
        'CAMERA'
      ]
    },
    extra
  }
}
