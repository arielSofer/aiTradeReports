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
    serverTimestamp,
    Timestamp,
    writeBatch
} from 'firebase/firestore'
import { db } from './config'

export type PropAccountStatus = 'challenge_active' | 'challenge_failed' | 'challenge_passed' | 'funded_active' | 'funded_blown'

export interface PropFirmAccount {
    id?: string
    userId: string
    name: string // e.g., "Topstep 50k"
    provider: string // e.g., "Topstep", "Apex"
    size: number // e.g. 50000
    cost: number // e.g. 49
    status: PropAccountStatus
    purchaseDate: Timestamp | Date
    notes?: string
    profitSplit?: number // e.g. 90 for 90/10 split
    isFunded: boolean

    // For funded accounts
    totalWithdrawals: number
    withdrawalHistory: WithdrawalRecord[]

    // Customization
    color?: string

    // Linking
    linkedAccountId?: string

    createdAt: any
    updatedAt: any
}

export interface WithdrawalRecord {
    id: string
    amount: number // Gross amount
    netAmount: number // User's share
    splitPercentage: number // The split used for this withdrawal
    date: Timestamp | Date
    note?: string
}

const COLLECTION_NAME = 'prop_accounts'

export async function createPropAccount(
    userId: string,
    data: Omit<PropFirmAccount, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'withdrawalHistory' | 'totalWithdrawals'>
): Promise<string> {
    const collectionRef = collection(db, COLLECTION_NAME)

    const docRef = await addDoc(collectionRef, {
        ...data,
        userId,
        profitSplit: data.profitSplit || 100,
        totalWithdrawals: 0,
        withdrawalHistory: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    })

    return docRef.id
}

export async function getPropAccounts(userId: string): Promise<PropFirmAccount[]> {
    const collectionRef = collection(db, COLLECTION_NAME)
    const q = query(
        collectionRef,
        where('userId', '==', userId)
    )

    const snapshot = await getDocs(q)
    const accounts = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
            id: doc.id,
            ...data,
            profitSplit: data.profitSplit || 100,
            purchaseDate: data.purchaseDate?.toDate() || new Date(),
            withdrawalHistory: (data.withdrawalHistory || []).map((w: any) => ({
                ...w,
                date: w.date?.toDate() || new Date()
            }))
        } as PropFirmAccount
    })

    // Sort client-side by purchaseDate descending (newest first)
    return accounts.sort((a, b) => {
        const aTime = (a.purchaseDate as Date).getTime()
        const bTime = (b.purchaseDate as Date).getTime()
        return bTime - aTime
    })
}

export async function updatePropAccount(
    accountId: string,
    data: Partial<PropFirmAccount>
): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, accountId)

    // If we're updating purchaseDate, ensure it's a Date object if it's not already
    const updateData: any = { ...data }
    if (data.purchaseDate && data.purchaseDate instanceof Date) {
        updateData.purchaseDate = Timestamp.fromDate(data.purchaseDate)
    }

    await updateDoc(docRef, {
        ...updateData,
        updatedAt: serverTimestamp()
    })
}

export async function addWithdrawal(
    accountId: string,
    amount: number,
    splitPercentage: number,
    date: Date,
    note?: string
): Promise<void> {
    const accountRef = doc(db, COLLECTION_NAME, accountId)
    const accountSnap = await getDoc(accountRef)

    if (!accountSnap.exists()) {
        throw new Error('Account not found')
    }

    const account = accountSnap.data() as PropFirmAccount

    const netAmount = amount * (splitPercentage / 100)

    const newWithdrawal: WithdrawalRecord = {
        id: crypto.randomUUID(),
        amount,
        netAmount,
        splitPercentage,
        date: Timestamp.fromDate(date),
        note
    }

    const newTotal = (account.totalWithdrawals || 0) + amount // Track gross withdrawals in total
    const newHistory = [...(account.withdrawalHistory || []), newWithdrawal]

    await updateDoc(accountRef, {
        totalWithdrawals: newTotal,
        withdrawalHistory: newHistory,
        updatedAt: serverTimestamp()
    })
}

export async function deletePropAccount(accountId: string): Promise<void> {
    const docRef = doc(db, COLLECTION_NAME, accountId)
    await deleteDoc(docRef)
}
