import { api } from './client'

export async function fetchVerificationStatus(token) {
  if (!token) {
    throw new Error('Authentication required')
  }
  const response = await api(token).get('/api/verifications/me')
  return response.data
}

export async function submitVerification(token, payload) {
  if (!token) {
    throw new Error('Authentication required')
  }
  const response = await api(token).post('/api/verifications', payload)
  return response.data
}
