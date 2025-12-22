'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getPropAccounts, createPropAccount, PropFirmAccount } from '@/lib/firebase/propFirms'
import { createAccount } from '@/lib/firebase/firestore'
import { PropDashboard } from '@/components/prop-firms/PropDashboard'
import { PropAccountList } from '@/components/prop-firms/PropAccountList'
import { PropAccountModal } from '@/components/prop-firms/PropAccountModal'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Sidebar } from '@/components/Sidebar'
import { Plus, Loader2, Trophy } from 'lucide-react'

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
                <div className="p-8 max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
                                <Trophy className="w-8 h-8 text-primary" />
                                Prop Firm Manager
                            </h1>
                            <p className="text-dark-400 mt-1">Track your challenges, funded accounts, and payouts.</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <a
                                href="/prop-firms/discounts"
                                className="btn-secondary flex items-center gap-2 border-dashed border-profit/30 text-profit hover:bg-profit/10"
                            >
                                <Trophy className="w-4 h-4" />
                                View Discounts
                            </a>
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
