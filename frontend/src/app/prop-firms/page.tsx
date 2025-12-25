'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getPropAccounts, createPropAccount, PropFirmAccount, addWithdrawal } from '@/lib/firebase/propFirms'
import { createAccount } from '@/lib/firebase/firestore'
import { PropDashboard } from '@/components/prop-firms/PropDashboard'
import { PropAccountList } from '@/components/prop-firms/PropAccountList'
import { PropAccountModal } from '@/components/prop-firms/PropAccountModal'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Sidebar } from '@/components/Sidebar'
import { Plus, Loader2, Trophy } from 'lucide-react'
import Link from 'next/link'
import { Header } from '@/components/Header'

import { GmailImportButton, FoundAccount } from '@/components/prop-firms/GmailImportButton'
import { PROP_FIRMS } from '@/lib/data/propFirmsData'

export default function PropFirmsPage() {
    return (
        <ProtectedRoute>
            <PropFirmsContent />
        </ProtectedRoute>
    )
}

function PropFirmsContent() {
    const { user } = useAuth()
    const [accounts, setAccounts] = useState<PropFirmAccount[]>([])
    const [loading, setLoading] = useState(true)
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)

    const fetchAccounts = async () => {
        if (!user) return
        try {
            const data = await getPropAccounts(user.uid)
            setAccounts(data)
        } catch (error) {
            console.error('Failed to fetch prop accounts:', error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAccounts()
    }, [user])

    const handleCreateAccount = async (data: Partial<PropFirmAccount>) => {
        if (!user) return

        try {
            // 1. Create Linked Standard Account first
            const accountId = await createAccount(user.uid, {
                name: data.name || 'New Prop Account',
                broker: data.provider || 'Prop Firm',
                currency: 'USD',
                initialBalance: data.size || 0,
                isDemo: true, // Prop accounts are technically demos
                isActive: true
            })

            // 2. Create Prop Account with link
            // @ts-ignore
            await createPropAccount(user.uid, {
                ...data,
                linkedAccountId: accountId
            })

            await fetchAccounts()
        } catch (error) {
            console.error('Error creating account:', error)
        }
    }

    const handleGmailImport = async (found: FoundAccount[]) => {
        if (!user) return

        let importedCount = 0
        let skippedCount = 0

        // Fetch latest accounts to check for duplicates
        // We can rely on 'accounts' state if it's fresh, but getting straight from DB is safer for async sequences
        const currentAccounts = await getPropAccounts(user.uid)

        // 1. Process New Accounts First
        const accountItems = found.filter(i => i.type === 'Trading Combine')
        for (const acc of accountItems) {
            // Check if already exists?
            // "Topstep 50K - LOGIN"
            // or notes "Imported from Gmail. Login: LOGIN"
            const exists = currentAccounts.some(a =>
                (a.notes && a.notes.includes(acc.login)) ||
                (a.name.includes(acc.login))
            )

            if (exists) {
                console.log(`Skipping existing account: ${acc.login}`)
                skippedCount++
                continue
            }

            // Find price
            // Mapping provider name "Topstep" to data
            const firm = PROP_FIRMS.find(f => f.name.toLowerCase().includes(acc.provider.toLowerCase()))
            const tier = firm?.accounts.find(a => a.size === acc.size)
            const price = tier?.price || 0

            await handleCreateAccount({
                name: `${acc.provider} ${(acc.size / 1000).toFixed(0)}K - ${acc.login}`,
                provider: acc.provider,
                size: acc.size,
                cost: price,
                purchaseDate: acc.date,
                status: 'challenge_active',
                isFunded: false,
                notes: `Imported from Gmail. Login: ${acc.login}`,
                profitSplit: 100,
                color: firm?.logoColor || 'bg-blue-500' // Default blue
            })
            importedCount++
        }

        // Refresh list if we added accounts, so payouts can find them
        let updatedAccounts = currentAccounts
        if (importedCount > 0) {
            updatedAccounts = await getPropAccounts(user.uid)
        }

        // 2. Process Payouts
        const payoutItems = found.filter(i => i.type === 'Payout')
        for (const pay of payoutItems) {
            // Find account by login in name or notes
            const targetAccount = updatedAccounts.find(a => a.name.includes(pay.login) || a.notes?.includes(pay.login))

            if (targetAccount && targetAccount.id) {

                // Check if duplicate payout
                // Same Amount + Same Date (approx)
                const isDuplicate = targetAccount.withdrawalHistory?.some(w => {
                    // Check date within 24 hours to allow purely matching "same day" events
                    // Handle Date or Timestamp (from Firestore)
                    // If it's a Timestamp, it has toDate(). If Date, it doesn't.
                    // The interface says Date | Timestamp.
                    const wDate = w.date instanceof Date ? w.date : (w.date as any).toDate()

                    const timeDiff = Math.abs(wDate.getTime() - pay.date.getTime())
                    const isSameAmount = w.amount === pay.amount
                    return isSameAmount && timeDiff < 1000 * 60 * 60 * 24
                })

                if (isDuplicate) {
                    console.log(`Skipping duplicate payout: ${pay.amount} for ${pay.login}`)
                    skippedCount++
                    continue
                }

                await addWithdrawal(
                    targetAccount.id,
                    pay.amount || 0,
                    targetAccount.profitSplit || 100,
                    pay.date,
                    'Imported Payout from Gmail'
                )
                importedCount++
            } else {
                console.warn(`Could not find account for payout login: ${pay.login}`)
                // Maybe notify?
            }
        }

        if (importedCount > 0) {
            await fetchAccounts()
            // Optionally show toast success
            alert(`Successfully imported ${importedCount} items. Skipped ${skippedCount} duplicates.`)
        } else if (skippedCount > 0) {
            alert(`No new items imported. Skipped ${skippedCount} duplicates.`)
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen bg-dark-950">
                <Sidebar />
                <main className="flex-1 p-8 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </main>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-dark-950 overflow-hidden">
            <Sidebar />

            <main className="flex-1 overflow-y-auto">
                <Header
                    onAddTradeClick={() => setIsAddModalOpen(true)}
                />

                <div className="p-8 max-w-7xl mx-auto space-y-8">

                    {/* Page Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
                                <Trophy className="w-8 h-8 text-primary" />
                                Prop Firm Manager
                            </h1>
                            <p className="text-dark-400 mt-1">Track your challenges, funded accounts, and payouts.</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <GmailImportButton onImport={handleGmailImport} />

                            <Link
                                href="/prop-firms/discounts"
                                className="btn-secondary flex items-center gap-2 border-dashed border-profit/30 text-profit hover:bg-profit/10"
                            >
                                <Trophy className="w-4 h-4" />
                                View Discounts
                            </Link>
                            <button
                                onClick={() => setIsAddModalOpen(true)}
                                className="btn-primary flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add Account
                            </button>
                        </div>
                    </div>

                    {/* Dashboard Stats */}
                    <PropDashboard accounts={accounts} />

                    {/* Accounts List */}
                    <div className="space-y-4">
                        <h2 className="text-xl font-display font-bold text-white">Your Accounts</h2>
                        <PropAccountList accounts={accounts} onUpdate={fetchAccounts} />
                    </div>

                </div>
            </main>

            <PropAccountModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                onSubmit={handleCreateAccount}
            />
        </div>
    )
}
