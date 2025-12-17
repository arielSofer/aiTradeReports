'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User } from 'firebase/auth'
import {
  onAuthChange,
  signIn,
  signOut,
  registerUser,
  signInWithGoogle,
  signInAnonymously,
  resetPassword,
  getUserProfile,
  UserProfile
} from '@/lib/firebase/auth'

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName?: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signInAnonymously: () => Promise<void>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = onAuthChange(async (user) => {
      setUser(user)

      if (user) {
        // Fetch user profile from Firestore
        // Wrap in try-catch for guest users who may not have profile permissions
        try {
          const userProfile = await getUserProfile(user.uid)
          setProfile(userProfile)
        } catch (error) {
          console.warn('Could not fetch user profile:', error)
          // Create a minimal profile for guest users
          setProfile({
            uid: user.uid,
            email: user.email || '',
            displayName: user.isAnonymous ? 'Guest User' : user.displayName,
            photoURL: user.photoURL,
            createdAt: null,
            lastLogin: null,
            settings: {
              currency: 'USD',
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
              theme: 'dark'
            }
          })
        }
      } else {
        setProfile(null)
      }

      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  const handleSignIn = async (email: string, password: string) => {
    await signIn(email, password)
  }

  const handleSignUp = async (email: string, password: string, displayName?: string) => {
    await registerUser(email, password, displayName)
  }

  const handleSignInWithGoogle = async () => {
    await signInWithGoogle()
  }

  const handleSignOut = async () => {
    await signOut()
  }

  const handleResetPassword = async (email: string) => {
    await resetPassword(email)
  }

  const handleSignInAnonymously = async () => {
    await signInAnonymously()
  }

  const value = {
    user,
    profile,
    loading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    signInWithGoogle: handleSignInWithGoogle,
    signInAnonymously: handleSignInAnonymously,
    signOut: handleSignOut,
    resetPassword: handleResetPassword
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}





