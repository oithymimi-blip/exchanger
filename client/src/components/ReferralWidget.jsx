import { useEffect, useState } from 'react'
import { useAuth } from '../store'
import { api } from '../api'

export default function ReferralWidget() {
  const { token } = useAuth()
  const [ref, setRef] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!token) {
      setRef(null)
      return
    }
    let isMounted = true
    api(token).get('/api/referrals')
      .then(res => {
        if (isMounted) setRef(res.data)
      })
      .catch(err => {
        console.error('Failed to load referrals', err)
      })
    return () => { isMounted = false }
  }, [token])

  if (!ref) return null

  const link = typeof window !== 'undefined'
    ? `${window.location.origin}/signup?ref=${ref.referral_code}`
    : ref.referral_code

  const handleCopy = async () => {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy referral link', err)
    }
  }

  return (
    <div className="card space-y-3">
      <div>
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Referral</div>
        <div className="text-lg font-semibold">Share &amp; earn</div>
      </div>
      <p className="text-[12px] text-white/60">Invite friends and receive bonuses when they start trading.</p>
      <div className="rounded-xl border border-white/5 bg-black/15 px-3 py-2 text-[12px] font-mono break-all">
        {link}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
        <span className="text-white/60">Total referred: <span className="text-brand font-semibold">{ref.referred_count}</span></span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium hover:bg-white/10 transition"
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
    </div>
  )
}
