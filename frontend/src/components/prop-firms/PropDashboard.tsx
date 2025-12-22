'use client'

import { useState, useMemo } from 'react'
import { PropFirmAccount } from '@/lib/firebase/propFirms'
import { Wallet, TrendingUp, AlertTriangle, TrendingDown, Calendar, ArrowRight, Ban, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PropDashboardProps {
    accounts: PropFirmAccount[]
}

type DateRange = 'all' | '30d' | '90d' | 'ytd' | 'custom'

// Helper to safely convert Firestore Timestamp or string to Date
function toDate(date: any): Date {
    if (!date) return new Date()
    if (date instanceof Date) return date
    // Firestore Timestamp
    if (typeof date.toDate === 'function') return date.toDate()
    // String or Number
    return new Date(date)
}

export function PropDashboard({ accounts }: PropDashboardProps) {
    const [dateRange, setDateRange] = useState<DateRange>('all')
    const [customStart, setCustomStart] = useState<string>('')
    const [customEnd, setCustomEnd] = useState<string>('')

    // Calculate stats based on filter
    const stats = useMemo(() => {
        const now = new Date()
        let startDate: Date | null = null
        let endDate: Date | null = null

        if (dateRange === '30d') {
            startDate = new Date(now.setDate(now.getDate() - 30))
        } else if (dateRange === '90d') {
            startDate = new Date(now.setDate(now.getDate() - 90))
        } else if (dateRange === 'ytd') {
            startDate = new Date(new Date().getFullYear(), 0, 1)
        } else if (dateRange === 'custom' && customStart) {
            startDate = new Date(customStart)
            if (customEnd) endDate = new Date(customEnd)
        }

        // Filter accounts purchased in range
        const filteredAccounts = accounts.filter(acc => {
            if (!startDate) return true
            const purchaseDate = toDate(acc.purchaseDate)
            if (purchaseDate < startDate) return false
            if (endDate && purchaseDate > endDate) return false
            return true
        })

        // Calculate withdrawals in range
        // We need to look at withdrawal history for this
        let totalWithdrawals = 0
        let withdrawalCount = 0

        accounts.forEach(acc => {
            if (acc.withdrawalHistory) {
                acc.withdrawalHistory.forEach(w => {
                    const wDate = toDate(w.date)
                    if ((!startDate || wDate >= startDate) && (!endDate || wDate <= endDate)) {
                        totalWithdrawals += w.amount
                        withdrawalCount++
                    }
                })
            } else {
                // Fallback for no history accounts but total exists (migration case)
                // If "all time" include the total. If time filtered, we can't be sure, so ignore or include if account in range?
                // Let's assume for now valid history exists for accurate calc. 
                // If range is ALL, use totalWithdrawals field for robustness
                if (dateRange === 'all') {
                    // But this would double count if we iterated history above. 
                    // Since we are iterating ALL accounts (not filteredAccounts) for withdrawals (because an old account can have new withdrawal),
                    // we must be careful.
                    // Actually, the user asked "How much I paid for the portfolios (filtered by date? likely purchased date)" 
                    // and "How many withdrawals I made (filtered by date)".
                }
            }
        })

        // For 'all' range, we can just sum the totalWithdrawals property if history is missing, 
        // but to be consistent let's rely on history if available, or property if all.
        if (dateRange === 'all') {
            const total = accounts.reduce((sum, acc) => sum + (acc.totalWithdrawals || 0), 0)
            // Count is harder without history, but amount is available.
            totalWithdrawals = total
        }

        const totalCost = filteredAccounts.reduce((sum, acc) => sum + (acc.cost || 0), 0)
        const netPnl = totalWithdrawals - totalCost

        // Status counts (from filtered purchased accounts)
        const fundedCount = filteredAccounts.filter(a => a.isFunded).length
        const failedCount = filteredAccounts.filter(a => a.status.includes('failed') || a.status.includes('blown')).length
        const activeChallengeCount = filteredAccounts.filter(a => a.status === 'challenge_active').length

        const investmentReturn = totalCost > 0 ? (netPnl / totalCost) * 100 : 0

        return {
            filteredCount: filteredAccounts.length,
            totalCost,
            totalWithdrawals,
            netPnl,
            fundedCount,
            failedCount,
            activeChallengeCount,
            investmentReturn
        }
    }, [accounts, dateRange, customStart, customEnd])

    return (
        <div className="space-y-6">
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 p-1 bg-dark-900 rounded-lg border border-dark-800 w-fit">
                {(['all', '30d', '90d', 'ytd'] as const).map((r) => (
                    <button
                        key={r}
                        onClick={() => setDateRange(r)}
                        className={cn(
                            "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                            dateRange === r
                                ? "bg-dark-700 text-white shadow-sm"
                                : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
                        )}
                    >
                        {r === 'all' ? 'All Time' : r.toUpperCase()}
                    </button>
                ))}
                <button
                    onClick={() => setDateRange('custom')}
                    className={cn(
                        "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2",
                        dateRange === 'custom'
                            ? "bg-dark-700 text-white shadow-sm"
                            : "text-dark-400 hover:text-dark-200 hover:bg-dark-800"
                    )}
                >
                    <Calendar className="w-4 h-4" />
                    Custom
                </button>
            </div>

            {dateRange === 'custom' && (
                <div className="flex items-center gap-2 text-sm">
                    <input
                        type="date"
                        value={customStart}
                        onChange={e => setCustomStart(e.target.value)}
                        className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white"
                    />
                    <span className="text-dark-400">to</span>
                    <input
                        type="date"
                        value={customEnd}
                        onChange={e => setCustomEnd(e.target.value)}
                        className="bg-dark-900 border border-dark-700 rounded px-2 py-1 text-white"
                    />
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Total Cost */}
                <div className="bg-dark-900 p-4 rounded-xl border border-dark-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-dark-400 text-xs font-medium uppercase tracking-wider">Total Spent</span>
                        <Wallet className="w-4 h-4 text-dark-500" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-white">
                        ${stats.totalCost.toLocaleString()}
                    </div>
                    <div className="text-xs text-dark-500 mt-1">
                        {stats.filteredCount} accounts purchased
                    </div>
                </div>

                {/* Withdrawals */}
                <div className="bg-dark-900 p-4 rounded-xl border border-dark-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-dark-400 text-xs font-medium uppercase tracking-wider">Withdrawn</span>
                        <Award className="w-4 h-4 text-profit" />
                    </div>
                    <div className="text-2xl font-mono font-bold text-profit">
                        ${stats.totalWithdrawals.toLocaleString()}
                    </div>
                    <div className="text-xs text-dark-500 mt-1">
                        Gross profit stored
                    </div>
                </div>

                {/* Net P&L */}
                <div className="bg-dark-900 p-4 rounded-xl border border-dark-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-dark-400 text-xs font-medium uppercase tracking-wider">Net P&L</span>
                        <TrendingUp className={cn("w-4 h-4", stats.netPnl >= 0 ? "text-profit" : "text-loss")} />
                    </div>
                    <div className={cn("text-2xl font-mono font-bold", stats.netPnl >= 0 ? "text-profit" : "text-loss")}>
                        {stats.netPnl >= 0 ? '+' : ''}${stats.netPnl.toLocaleString()}
                    </div>
                    <div className={cn("text-xs mt-1 font-medium", stats.investmentReturn >= 0 ? "text-profit" : "text-loss")}>
                        {stats.investmentReturn.toFixed(1)}% ROI
                    </div>
                </div>

                {/* Status Breakdown */}
                <div className="bg-dark-900 p-4 rounded-xl border border-dark-700">
                    <div className="flex justify-between items-start mb-2">
                        <span className="text-dark-400 text-xs font-medium uppercase tracking-wider">Outcome</span>
                        <ArrowRight className="w-4 h-4 text-dark-500" />
                    </div>
                    <div className="flex flex-col gap-1.5 mt-1">
                        <div className="flex justify-between text-sm">
                            <span className="text-dark-300">Funded</span>
                            <span className="text-white font-mono">{stats.fundedCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-dark-300">Burned</span>
                            <span className="text-loss font-mono">{stats.failedCount}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-dark-300">Active</span>
                            <span className="text-blue-400 font-mono">{stats.activeChallengeCount}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
