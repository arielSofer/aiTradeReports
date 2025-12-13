import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  User,
  UserCredential
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from './config'

// User profile in Firestore
export interface UserProfile {
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  createdAt: any
  lastLogin: any
  settings: {
    currency: string
    timezone: string
    theme: string
  }
}

// Register new user
export async function registerUser(
  email: string, 
  password: string, 
  displayName?: string
): Promise<UserCredential> {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password)
  
  // Update profile
  if (displayName) {
    await updateProfile(userCredential.user, { displayName })
  }
  
  // Create user document in Firestore
  await createUserProfile(userCredential.user, displayName)
  
  return userCredential
}

// Sign in
export async function signIn(email: string, password: string): Promise<UserCredential> {
  const userCredential = await signInWithEmailAndPassword(auth, email, password)
  
  // Update last login
  await updateLastLogin(userCredential.user.uid)
  
  return userCredential
}

// Sign in with Google
export async function signInWithGoogle(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider()
  provider.addScope('email')
  provider.addScope('profile')
  
  const userCredential = await signInWithPopup(auth, provider)
  
  // Create or update user profile
  const profileExists = await checkUserProfile(userCredential.user.uid)
  if (!profileExists) {
    await createUserProfile(userCredential.user)
  } else {
    await updateLastLogin(userCredential.user.uid)
  }
  
  return userCredential
}

// Sign out
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth)
}

// Send password reset email
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email)
}

// Create user profile in Firestore
async function createUserProfile(user: User, displayName?: string): Promise<void> {
  const userRef = doc(db, 'users', user.uid)
  
  const profile: UserProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: displayName || user.displayName,
    photoURL: user.photoURL,
    createdAt: serverTimestamp(),
    lastLogin: serverTimestamp(),
    settings: {
      currency: 'USD',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      theme: 'dark'
    }
  }
  
  await setDoc(userRef, profile)
}

// Check if user profile exists
async function checkUserProfile(uid: string): Promise<boolean> {
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  return userSnap.exists()
}

// Update last login
async function updateLastLogin(uid: string): Promise<void> {
  const userRef = doc(db, 'users', uid)
  await setDoc(userRef, { lastLogin: serverTimestamp() }, { merge: true })
}

// Get user profile
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', uid)
  const userSnap = await getDoc(userRef)
  
  if (userSnap.exists()) {
    return userSnap.data() as UserProfile
  }
  return null
}

// Update user profile
export async function updateUserProfile(
  uid: string, 
  data: Partial<UserProfile>
): Promise<void> {
  const userRef = doc(db, 'users', uid)
  await setDoc(userRef, data, { merge: true })
}

// Auth state observer
export function onAuthChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback)
}

// Get current user
export function getCurrentUser(): User | null {
  return auth.currentUser
}





