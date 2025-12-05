import axios from 'axios'
import Constants from 'expo-constants'
import { NativeModules, Platform } from 'react-native'
import { useAuth } from '../stores/authStore'

const extra = Constants.expoConfig?.extra ?? Constants.manifest?.extra ?? {}

function resolveLanHost() {
  // When running Expo Go / Metro, we can read the bundle script URL to recover the LAN IP.
  const scriptUrl = NativeModules.SourceCode?.scriptURL
  if (typeof scriptUrl === 'string') {
    try {
      const { hostname } = new URL(scriptUrl)
      if (
        hostname &&
        hostname !== 'localhost' &&
        hostname !== '127.0.0.1' &&
        hostname !== '10.0.2.2'
      ) {
        return hostname
      }
    } catch (_err) {
      // ignore parse errors and fall back to Expo constants
    }
  }

  const uri =
    Constants.expoConfig?.hostUri ??
    Constants.manifest?.debuggerHost ??
    Constants.manifest2?.extra?.expoClient?.hostUri ??
    ''

  const host = typeof uri === 'string' ? uri.split(':')[0] : null

  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null
  }

  return host
}

function safeParseUrl(url) {
  if (typeof url !== 'string') return null
  try {
    return new URL(url)
  } catch (_err) {
    return null
  }
}

function normalizePath(pathname) {
  if (!pathname || pathname === '/') return ''
  return pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
}

function composeBase({ protocol = 'http:', host, port, pathname = '' }) {
  if (!host) return null
  const normalizedProtocol = protocol.endsWith(':') ? protocol : `${protocol}:`
  const normalizedPath = normalizePath(pathname)
  const suffix = normalizedPath || ''
  const normalizedPort = port ? `:${port}` : ''
  return `${normalizedProtocol}//${host}${normalizedPort}${suffix}`
}

function fallbackBaseForPlatform({ protocol = 'http:', port = '4000', pathname = '' }) {
  const host = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
  return composeBase({ protocol, host, port: port || '4000', pathname })
}

let lastForcedLogoutAt = 0

function forceLogout(reason) {
  const authStore = typeof useAuth?.getState === 'function' ? useAuth.getState() : null
  if (!authStore?.token) return
  const now = Date.now()
  if (now - lastForcedLogoutAt < 1000) {
    return
  }
  lastForcedLogoutAt = now
  try {
    console.warn('Session invalidated:', reason || 'sign in again')
    authStore.logout?.()
  } catch (err) {
    console.error('Failed to clear auth state after unauthorized response', err)
  }
}

const defaultBaseUrl = (() => {
  if (process.env.EXPO_PUBLIC_API_BASE) return process.env.EXPO_PUBLIC_API_BASE
  const extraUrl = safeParseUrl(extra.apiBaseUrl)
  const urlParts = {
    protocol: extraUrl?.protocol ?? 'http:',
    port: extraUrl?.port || (extraUrl ? '' : '4000'),
    pathname: extraUrl?.pathname ?? ''
  }
  if (typeof extra.apiBaseUrl === 'string' && extra.apiBaseUrl.length > 0) {
    if (!extraUrl) {
      return extra.apiBaseUrl
    }
    const placeholderHosts = ['10.0.2.2', 'localhost', '127.0.0.1']
    const usesPlaceholder = placeholderHosts.includes(extraUrl.hostname)

    if (!usesPlaceholder) {
      return extra.apiBaseUrl
    }

    const lanHost = resolveLanHost()
    if (lanHost) {
      const composed = composeBase({
        protocol: urlParts.protocol,
        host: lanHost,
        port: urlParts.port || '4000',
        pathname: urlParts.pathname
      })
      if (composed) return composed
    }

    return fallbackBaseForPlatform(urlParts)
  }
  const lanHost = resolveLanHost()
  if (lanHost) {
    const composed = composeBase({
      protocol: urlParts.protocol,
      host: lanHost,
      port: urlParts.port || '4000',
      pathname: urlParts.pathname
    })
    if (composed) return composed
  }
  /**
   * When running on Android emulator, localhost needs to resolve to the host machine.
   * 10.0.2.2 points back to the development machine.
   */
  return fallbackBaseForPlatform(urlParts)
})()

export const API_BASE_URL = defaultBaseUrl

export function api(token) {
  const instance = axios.create({
    baseURL: API_BASE_URL,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  })

  if (token) {
    instance.interceptors.response.use(
      response => response,
      error => {
        const status = error?.response?.status
        if (status === 401 || status === 403) {
          const message = error?.response?.data?.error
          forceLogout(message)
        }
        return Promise.reject(error)
      }
    )
  }

  return instance
}
