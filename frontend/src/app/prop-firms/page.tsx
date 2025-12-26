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
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
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
    const { isSidebarCollapsed } = useStore() // Get sidebar state
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
        for (const item of found) {
            // Case 1: Payout Import
            if (item.type === 'Payout') {
                if (item.targetAccountId && item.amount) {
                    // Find the account to get split details if needed, or default
                    const targetAccount = accounts.find(a => a.id === item.targetAccountId)
                    const split = targetAccount?.profitSplit || 100 // Default to 100 if unknown, usually 90 or 100

                    await addWithdrawal(
                        item.targetAccountId,
                        item.amount,
                        split,
                        item.date,
                        `Imported Payout. Original Date: ${item.date.toLocaleDateString()}`
                    )
                    importedCount++
                }
            }
            // Case 2: Account Import
            else {
                // Find price - use item.cost if available, otherwise lookup from PROP_FIRMS
                const firm = PROP_FIRMS.find(f => f.name.toLowerCase().includes(item.provider.toLowerCase()))
                const tier = firm?.accounts.find(a => a.size === item.size)
                const price = item.cost || tier?.price || 0

                await handleCreateAccount({
                    name: `${item.provider} ${(item.size / 1000).toFixed(0)}K - ${item.login}`,
                    provider: item.provider,
                    size: item.size,
                    cost: price,
                    purchaseDate: item.date,
                    status: 'challenge_active',
                    isFunded: false,
                    notes: `Imported from Gmail. Login: ${item.login}`,
                    profitSplit: 100,
                    color: firm?.logoColor || 'bg-blue-500'
                })
                importedCount++
            }
        }

        if (importedCount > 0) {
            await fetchAccounts()
            // Optionally show toast success
        }
    }

    if (loading) {
        return (
            <div className="flex h-screen bg-dark-950">
                <Sidebar />
                <main className={cn(
                    "flex-1 p-8 flex items-center justify-center transition-all duration-300",
                    isSidebarCollapsed ? "ml-28" : "ml-72"
                )}>
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </main>
            </div>
        )
    }

    return (
        <div className="flex h-screen bg-dark-950 overflow-hidden">
            <Sidebar />

            <main className={cn(
                "flex-1 overflow-y-auto transition-all duration-300",
                isSidebarCollapsed ? "ml-28" : "ml-72"
            )}>
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
                            <GmailImportButton onImport={handleGmailImport} existingAccounts={accounts} />

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
