import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getAnalytics, isSupported } from 'firebase/analytics'

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1PbafwzFo_FS1XwjvNFfFWjUq7LWHNBY",
  authDomain: "trade-d720f.firebaseapp.com",
  projectId: "trade-d720f",
  storageBucket: "trade-d720f.firebasestorage.app",
  messagingSenderId: "386171861153",
  appId: "1:386171861153:web:be5ceb1a4f7e9de66098e0",
  measurementId: "G-GJHVBCSCDG"
}

// Initialize Firebase (prevent multiple initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

// Initialize services
export const auth = getAuth(app)
export const db = getFirestore(app)

// Initialize Analytics (only in browser)
export const initAnalytics = async () => {
  if (typeof window !== 'undefined' && await isSupported()) {
    return getAnalytics(app)
  }
  return null
}

export default app





