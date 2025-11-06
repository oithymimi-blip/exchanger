import { useEffect, useState } from 'react'
import { useAuth } from '../store'
import ProfileForm from '../components/ProfileForm'

export default function Profile() {
  const { user } = useAuth()
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <ProfileForm />
      <div className="card">
        <div className="font-bold mb-2">Your account</div>
        <div className="text-sm space-y-1">
          <div>Email: <span className="text-white/70">{user?.email}</span></div>
          <div>Role: <span className="text-white/70">{user?.role}</span></div>
          <div>Referral code: <span className="text-brand">{user?.referral_code}</span></div>
        </div>
      </div>
    </div>
  )
}
