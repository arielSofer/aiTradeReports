import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  limit,
  serverTimestamp,
  Timestamp,
  QueryConstraint,
  writeBatch
} from 'firebase/firestore'
import { db } from './config'

// ==================== ACCOUNTS ====================

export interface FirestoreAccount {
  id?: string
  userId: string
  name: string
  nickname?: string // User-friendly display name
  broker: string
  currency: string
  initialBalance: number
  isDemo: boolean
  isActive: boolean
  createdAt: any
  updatedAt: any
  // Prop Firm specific fields
  status?: string
  provider?: string
  size?: number
}

export async function createAccount(
  userId: string,
  data: Omit<FirestoreAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const accountsRef = collection(db, 'accounts')

  const docRef = await addDoc(accountsRef, {
    ...data,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  return docRef.id
}

export async function getAccounts(userId: string): Promise<FirestoreAccount[]> {
  const accountsRef = collection(db, 'accounts')
  const q = query(
    accountsRef,
    where('userId', '==', userId)
  )

  const snapshot = await getDocs(q)
  const accounts = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as FirestoreAccount))

  // Sort client-side by createdAt descending
  return accounts.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0
    const bTime = b.createdAt?.toMillis?.() || 0
    return bTime - aTime
  })
}

export async function getAccount(accountId: string): Promise<FirestoreAccount | null> {
  const accountRef = doc(db, 'accounts', accountId)
  const snapshot = await getDoc(accountRef)

  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as FirestoreAccount
  }
  return null
}

export async function updateAccount(
  accountId: string,
  data: Partial<FirestoreAccount>
): Promise<void> {
  const accountRef = doc(db, 'accounts', accountId)
  await updateDoc(accountRef, {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteAccount(accountId: string): Promise<void> {
  // Delete all trades for this account first
  const tradesRef = collection(db, 'trades')
  const q = query(tradesRef, where('accountId', '==', accountId))
  const snapshot = await getDocs(q)

  const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref))
  await Promise.all(deletePromises)

  // Delete account
  const accountRef = doc(db, 'accounts', accountId)
  await deleteDoc(accountRef)
}

// ==================== TRADES ====================

export interface FirestoreTrade {
  id?: string
  userId: string
  accountId: string
  symbol: string
  direction: 'long' | 'short'
  status: 'open' | 'closed'
  assetType: string
  entryTime: Timestamp
  exitTime?: Timestamp
  entryPrice: number
  exitPrice?: number
  quantity: number
  commission: number
  pnlGross?: number
  pnlNet?: number
  pnlPercent?: number
  stopLoss?: number
  takeProfit?: number
  tags: string[]
  notes?: string
  createdAt: any
  updatedAt: any
}

export async function createTrade(
  userId: string,
  accountId: string,
  data: Omit<FirestoreTrade, 'id' | 'userId' | 'accountId' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const tradesRef = collection(db, 'trades')

  // Calculate P&L if closed
  let pnlGross: number = 0
  let pnlNet: number = 0
  let pnlPercent: number = 0

  if (data.exitPrice && data.status === 'closed') {
    if (data.direction === 'long') {
      pnlGross = (data.exitPrice - data.entryPrice) * data.quantity
    } else {
      pnlGross = (data.entryPrice - data.exitPrice) * data.quantity
    }
    pnlNet = pnlGross - (data.commission || 0)
    pnlPercent = data.entryPrice > 0
      ? (pnlGross / (data.entryPrice * data.quantity)) * 100
      : 0
  }

  // Use provided pnl values if they exist in data
  const finalPnlGross = data.pnlGross !== undefined ? data.pnlGross : pnlGross
  const finalPnlNet = data.pnlNet !== undefined ? data.pnlNet : pnlNet
  const finalPnlPercent = data.pnlPercent !== undefined ? data.pnlPercent : pnlPercent

  // Remove undefined values from data before saving
  const cleanData = Object.fromEntries(
    Object.entries(data).filter(([_, v]) => v !== undefined)
  )

  const docRef = await addDoc(tradesRef, {
    ...cleanData,
    userId,
    accountId,
    pnlGross: finalPnlGross,
    pnlNet: finalPnlNet,
    pnlPercent: finalPnlPercent,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  return docRef.id
}

export async function batchCreateTrades(
  userId: string,
  accountId: string,
  trades: Omit<FirestoreTrade, 'id' | 'userId' | 'accountId' | 'createdAt' | 'updatedAt'>[]
): Promise<number> {
  // Firestore batch limit is 500 operations
  const BATCH_SIZE = 450
  const chunks = []

  for (let i = 0; i < trades.length; i += BATCH_SIZE) {
    chunks.push(trades.slice(i, i + BATCH_SIZE))
  }

  let totalCreated = 0

  for (const chunk of chunks) {
    const batch = writeBatch(db)
    const tradesRef = collection(db, 'trades')

    for (const data of chunk) {
      const docRef = doc(tradesRef)

      // Calculate P&L logic (simplified duplication for batch)
      let pnlGross: number = 0
      let pnlNet: number = 0
      let pnlPercent: number = 0

      if (data.exitPrice && data.status === 'closed') {
        if (data.direction === 'long') {
          pnlGross = (data.exitPrice - data.entryPrice) * data.quantity
        } else {
          pnlGross = (data.entryPrice - data.exitPrice) * data.quantity
        }
        pnlNet = pnlGross - (data.commission || 0)
        pnlPercent = data.entryPrice > 0
          ? (pnlGross / (data.entryPrice * data.quantity)) * 100
          : 0
      }

      const finalPnlGross = data.pnlGross !== undefined ? data.pnlGross : pnlGross
      const finalPnlNet = data.pnlNet !== undefined ? data.pnlNet : pnlNet
      const finalPnlPercent = data.pnlPercent !== undefined ? data.pnlPercent : pnlPercent

      const cleanData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== undefined)
      )

      batch.set(docRef, {
        ...cleanData,
        userId,
        accountId,
        pnlGross: finalPnlGross,
        pnlNet: finalPnlNet,
        pnlPercent: finalPnlPercent,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      })
    }

    await batch.commit()
    totalCreated += chunk.length
  }

  return totalCreated
}

export async function getTrades(
  userId: string,
  options?: {
    accountId?: string
    symbol?: string
    status?: 'open' | 'closed'
    limitCount?: number
  }
): Promise<FirestoreTrade[]> {
  const tradesRef = collection(db, 'trades')

  // Simple query with just userId filter - no orderBy to avoid index requirement
  const constraints: QueryConstraint[] = [
    where('userId', '==', userId)
  ]

  if (options?.limitCount) {
    constraints.push(limit(options.limitCount))
  }

  const q = query(tradesRef, ...constraints)
  const snapshot = await getDocs(q)

  let trades = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    entryPrice: Number(doc.data().entryPrice),
    exitPrice: doc.data().exitPrice ? Number(doc.data().exitPrice) : undefined,
    quantity: Number(doc.data().quantity),
    commission: Number(doc.data().commission),
    pnlNet: doc.data().pnlNet ? Number(doc.data().pnlNet) : undefined,
    pnlPercent: doc.data().pnlPercent ? Number(doc.data().pnlPercent) : undefined,
  } as FirestoreTrade))

  // Filter client-side for additional options
  if (options?.accountId) {
    trades = trades.filter(t => t.accountId === options.accountId)
  }

  if (options?.status) {
    trades = trades.filter(t => t.status === options.status)
  }

  // Sort client-side by entryTime descending
  return trades.sort((a, b) => {
    const aTime = a.entryTime?.toMillis?.() || 0
    const bTime = b.entryTime?.toMillis?.() || 0
    return bTime - aTime
  })
}

export async function getTrade(tradeId: string): Promise<FirestoreTrade | null> {
  const tradeRef = doc(db, 'trades', tradeId)
  const snapshot = await getDoc(tradeRef)

  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as FirestoreTrade
  }
  return null
}

export async function updateTrade(
  tradeId: string,
  data: Partial<FirestoreTrade>
): Promise<void> {
  const tradeRef = doc(db, 'trades', tradeId)

  // Recalculate P&L if prices changed
  if (data.exitPrice || data.entryPrice) {
    const trade = await getTrade(tradeId)
    if (trade) {
      const entryPrice = data.entryPrice || trade.entryPrice
      const exitPrice = data.exitPrice || trade.exitPrice
      const quantity = data.quantity || trade.quantity
      const commission = data.commission || trade.commission
      const direction = data.direction || trade.direction

      if (exitPrice) {
        let pnlGross: number
        if (direction === 'long') {
          pnlGross = (exitPrice - entryPrice) * quantity
        } else {
          pnlGross = (entryPrice - exitPrice) * quantity
        }
        data.pnlGross = pnlGross
        data.pnlNet = pnlGross - commission
        data.pnlPercent = (pnlGross / (entryPrice * quantity)) * 100
      }
    }
  }

  await updateDoc(tradeRef, {
    ...data,
    updatedAt: serverTimestamp()
  })
}

export async function deleteTrade(tradeId: string): Promise<void> {
  const tradeRef = doc(db, 'trades', tradeId)
  await deleteDoc(tradeRef)
}

// ==================== STATISTICS ====================

export interface TradeStats {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  openTrades: number
  totalPnl: number
  totalCommission: number
  winRate: number
  profitFactor: number
  avgWinner: number
  avgLoser: number
  largestWinner: number
  largestLoser: number
}

export async function calculateStats(userId: string, accountId?: string): Promise<TradeStats> {
  const trades = await getTrades(userId, { accountId })

  const closedTrades = trades.filter(t => t.status === 'closed')
  const openTrades = trades.filter(t => t.status === 'open')

  const winners = closedTrades.filter(t => t.pnlNet && t.pnlNet > 0)
  const losers = closedTrades.filter(t => t.pnlNet && t.pnlNet < 0)

  const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnlNet || 0), 0)
  const totalCommission = trades.reduce((sum, t) => sum + t.commission, 0)

  const grossProfit = winners.reduce((sum, t) => sum + (t.pnlNet || 0), 0)
  const grossLoss = Math.abs(losers.reduce((sum, t) => sum + (t.pnlNet || 0), 0))

  return {
    totalTrades: trades.length,
    winningTrades: winners.length,
    losingTrades: losers.length,
    openTrades: openTrades.length,
    totalPnl,
    totalCommission,
    winRate: closedTrades.length > 0 ? (winners.length / closedTrades.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    avgWinner: winners.length > 0 ? grossProfit / winners.length : 0,
    avgLoser: losers.length > 0 ? grossLoss / losers.length : 0,
    largestWinner: winners.length > 0 ? Math.max(...winners.map(t => t.pnlNet || 0)) : 0,
    largestLoser: losers.length > 0 ? Math.abs(Math.min(...losers.map(t => t.pnlNet || 0))) : 0
  }
}

// ==================== IMPORT HISTORY ====================

export interface ImportRecord {
  id?: string
  userId: string
  accountId: string
  fileName: string
  broker: string
  tradesImported: number
  totalPnl: number
  dateRange: {
    start: Timestamp
    end: Timestamp
  }
  createdAt: any
}

export async function createImportRecord(
  userId: string,
  data: Omit<ImportRecord, 'id' | 'userId' | 'createdAt'>
): Promise<string> {
  const importsRef = collection(db, 'imports')

  const docRef = await addDoc(importsRef, {
    ...data,
    userId,
    createdAt: serverTimestamp()
  })

  return docRef.id
}

export async function getImportHistory(userId: string): Promise<ImportRecord[]> {
  const importsRef = collection(db, 'imports')
  const q = query(
    importsRef,
    where('userId', '==', userId)
  )

  const snapshot = await getDocs(q)
  const records = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  } as ImportRecord))

  // Sort client-side by createdAt descending
  return records.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.() || 0
    const bTime = b.createdAt?.toMillis?.() || 0
    return bTime - aTime
  }).slice(0, 50)
}
