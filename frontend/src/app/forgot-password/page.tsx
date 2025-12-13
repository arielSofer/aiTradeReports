'use client'

import { useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Mail, Loader2, ArrowLeft, CheckCircle } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth()
  
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (err: any) {
      console.error(err)
      if (err.code === 'auth/user-not-found') {
        setError('No account found with this email')
      } else {
        setError('Failed to send reset email. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-dark-950">
      <div className="gradient-mesh fixed inset-0 pointer-events-none" />
      
      <div className="w-full max-w-md space-y-8 relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <TrendingUp className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl text-white">TradeTracker</h1>
          </div>
        </div>

        {success ? (
          <div className="bg-dark-900/80 backdrop-blur-xl border border-dark-700 rounded-2xl p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-profit/20 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-profit" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">Check your email</h2>
              <p className="text-dark-400">
                We've sent a password reset link to<br />
                <span className="text-white font-medium">{email}</span>
              </p>
            </div>
            <Link 
              href="/login" 
              className="btn-primary inline-flex items-center gap-2 px-6 py-3"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </Link>
          </div>
        ) : (
          <div className="bg-dark-900/80 backdrop-blur-xl border border-dark-700 rounded-2xl p-8 space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-display font-bold text-white">Reset password</h2>
              <p className="text-dark-400 mt-2">
                Enter your email and we'll send you a reset link
              </p>
            </div>

            {error && (
              <div className="p-4 bg-loss/20 border border-loss/50 rounded-lg text-loss text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input w-full pl-11"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  'w-full btn-primary py-3 text-lg flex items-center justify-center gap-2',
                  loading && 'opacity-50 cursor-not-allowed'
                )}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>

            <div className="text-center">
              <Link 
                href="/login" 
                className="inline-flex items-center gap-2 text-dark-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}





