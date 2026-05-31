'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push('/admin')
    } else {
      setError('Incorrect password. Please try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-charcoal-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Image src="/bild-logo-new.svg" alt="BILD" width={120} height={75} className="h-16 w-auto object-contain mx-auto mb-4 brightness-0 invert" />
          <h1 className="font-display text-2xl font-bold text-white">Admin Access</h1>
          <p className="text-gray-400 text-sm mt-1">BILD Business Directory</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-charcoal-800 rounded-2xl p-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-charcoal-700 border border-charcoal-600 text-white focus:outline-none focus:ring-2 focus:ring-gold-500 placeholder-gray-500"
              placeholder="Enter admin password"
              required
            />
          </div>

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gold-500 text-white py-3 rounded-xl font-semibold hover:bg-gold-600 transition-colors disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
