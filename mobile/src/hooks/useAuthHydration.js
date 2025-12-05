import { useEffect, useState } from 'react'
import { useAuth } from '../stores/authStore'

export function useAuthHydration() {
  const getHydrated = () => {
    const hasHydrated = useAuth.persist?.hasHydrated?.()
    if (typeof hasHydrated === 'boolean') {
      return hasHydrated
    }
    return true
  }

  const [hydrated, setHydrated] = useState(getHydrated)

  useEffect(() => {
    const unsubscribe = useAuth.persist?.onFinishHydration?.(() => {
      setHydrated(true)
    })

    if (!hydrated && useAuth.persist?.hasHydrated?.()) {
      setHydrated(true)
    }

    return () => {
      unsubscribe?.()
    }
  }, [hydrated])

  return hydrated
}
