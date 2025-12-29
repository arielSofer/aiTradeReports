'use client'

import { useState, useEffect } from 'react'
import {
    X,
    Loader2,
    Wallet,
    TrendingUp,
    BarChart3,
    Building2,
    Eye,
    LineChart
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
    getAccounts,
    getTrades,
    FirestoreAccount,
    FirestoreTrade
} from '@/lib/firebase/firestore'
import { Trade } from '@/lib/store'
import { TradeChartViewer } from './TradeChartViewer'
import { TradeDetailsModal } from './TradeDetailsModal'

interface FriendProfileModalProps {
    friendId: string
    friendUsername: string
    onClose: () => void
}

type Tab = 'overview' | 'accounts' | 'trades' | 'propfirms'

// Convert FirestoreTrade to Trade for chart viewer
function convertToTrade(ft: FirestoreTrade, accounts: FirestoreAccount[]): Trade {
    const account = accounts.find(a => a.id === ft.accountId)
    return {
        id: ft.id || '',
        userId: ft.userId,
        symbol: ft.symbol,
        direction: ft.direction as 'long' | 'short',
        entryPrice: ft.entryPrice,
        exitPrice: ft.exitPrice,
        quantity: ft.quantity,
        commission: 0,
        pnlNet: ft.pnlNet || 0,
        entryTime: ft.entryTime?.toDate?.()?.toISOString() || new Date().toISOString(),
        exitTime: ft.exitTime?.toDate?.()?.toISOString(),
        status: ft.status as 'open' | 'closed',
        accountId: ft.accountId,
        accountName: account?.nickname || account?.name,
        notes: ft.notes,
        tags: ft.tags || [],
        checklistCompleted: ft.checklistCompleted,
        manualSL: ft.manualSL,
        manualTP: ft.manualTP,
        riskRewardRatio: ft.riskRewardRatio,
    }
}

export function FriendProfileModal({ friendId, friendUsername, onClose }: FriendProfileModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
    const [trades, setTrades] = useState<FirestoreTrade[]>([])
    const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null)
    const [showChart, setShowChart] = useState(false)
    const [showDetails, setShowDetails] = useState(false)
    const [stats, setStats] = useState({
        totalPnl: 0,
        winRate: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0
    })

    useEffect(() => {
        loadFriendData()
    }, [friendId])

    const loadFriendData = async () => {
        setLoading(true)
        try {
            const [friendAccounts, friendTrades] = await Promise.all([
                getAccounts(friendId),
                getTrades(friendId, { limitCount: 500 })
            ])

            setAccounts(friendAccounts)
            setTrades(friendTrades)

            // Calculate detailed stats
            const wins = friendTrades.filter(t => (t.pnlNet || 0) > 0)
            const losses = friendTrades.filter(t => (t.pnlNet || 0) < 0)
            const totalPnl = friendTrades.reduce((sum, t) => sum + (t.pnlNet || 0), 0)
            const totalWins = wins.reduce((sum, t) => sum + (t.pnlNet || 0), 0)
            const totalLosses = Math.abs(losses.reduce((sum, t) => sum + (t.pnlNet || 0), 0))

            setStats({
                totalPnl,
                winRate: friendTrades.length > 0 ? (wins.length / friendTrades.length) * 100 : 0,
                totalTrades: friendTrades.length,
                winningTrades: wins.length,
                losingTrades: losses.length,
                avgWin: wins.length > 0 ? totalWins / wins.length : 0,
                avgLoss: losses.length > 0 ? totalLosses / losses.length : 0,
                profitFactor: totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? Infinity : 0
            })
        } catch (err) {
            console.error('Error loading friend data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleViewChart = (trade: FirestoreTrade) => {
        setSelectedTrade(convertToTrade(trade, accounts))
        setShowChart(true)
    }

    const handleViewDetails = (trade: FirestoreTrade) => {
        setSelectedTrade(convertToTrade(trade, accounts))
        setShowDetails(true)
    }

    const tabs = [
        { id: 'overview' as Tab, label: 'Overview', icon: BarChart3 },
        { id: 'accounts' as Tab, label: 'Accounts', icon: Wallet },
        { id: 'trades' as Tab, label: 'Trades', icon: TrendingUp },
        { id: 'propfirms' as Tab, label: 'Prop Firms', icon: Building2 }
    ]

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

                <div className="relative w-full max-w-6xl max-h-[90vh] bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-dark-800">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center">
                                <span className="text-primary-400 font-bold text-xl">
                                    {friendUsername.charAt(0).toUpperCase()}
                                </span>
                            </div>
                            <div>
                                <h2 className="text-xl font-display font-bold text-white">@{friendUsername}</h2>
                                <p className="text-sm text-dark-400">Friend's Trading Profile</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-dark-400" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 p-2 bg-dark-800/50 border-b border-dark-800">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                                    activeTab === tab.id
                                        ? 'bg-primary-500/20 text-primary-400'
                                        : 'text-dark-400 hover:text-white hover:bg-dark-700'
                                )}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                            </div>
                        ) : (
                            <>
                                {/* Overview Tab */}
                                {activeTab === 'overview' && (
                                    <div className="space-y-6">
                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <div className="p-4 bg-dark-800 rounded-xl">
                                                <p className="text-sm text-dark-500 mb-1">Total P&L</p>
                                                <p className={cn(
                                                    'text-2xl font-bold',
                                                    stats.totalPnl >= 0 ? 'text-profit' : 'text-loss'
                                                )}>
                                                    {stats.totalPnl >= 0 ? '+' : ''}{formatCurrency(stats.totalPnl)}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-dark-800 rounded-xl">
                                                <p className="text-sm text-dark-500 mb-1">Win Rate</p>
                                                <p className="text-2xl font-bold text-white">{stats.winRate.toFixed(1)}%</p>
                                            </div>
                                            <div className="p-4 bg-dark-800 rounded-xl">
                                                <p className="text-sm text-dark-500 mb-1">Total Trades</p>
                                                <p className="text-2xl font-bold text-white">{stats.totalTrades}</p>
                                            </div>
                                            <div className="p-4 bg-dark-800 rounded-xl">
                                                <p className="text-sm text-dark-500 mb-1">Win/Loss</p>
                                                <p className="text-2xl font-bold">
                                                    <span className="text-profit">{stats.winningTrades}</span>
                                                    <span className="text-dark-500 mx-1">/</span>
                                                    <span className="text-loss">{stats.losingTrades}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Additional Stats */}
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="p-4 bg-dark-800 rounded-xl">
                                                <p className="text-sm text-dark-500 mb-1">Avg Win</p>
                                                <p className="text-xl font-bold text-profit">+{formatCurrency(stats.avgWin)}</p>
                                            </div>
                                            <div className="p-4 bg-dark-800 rounded-xl">
                                                <p className="text-sm text-dark-500 mb-1">Avg Loss</p>
                                                <p className="text-xl font-bold text-loss">-{formatCurrency(stats.avgLoss)}</p>
                                            </div>
                                            <div className="p-4 bg-dark-800 rounded-xl">
                                                <p className="text-sm text-dark-500 mb-1">Profit Factor</p>
                                                <p className={cn(
                                                    'text-xl font-bold',
                                                    stats.profitFactor >= 1 ? 'text-profit' : 'text-loss'
                                                )}>
                                                    {stats.profitFactor === Infinity ? '∞' : stats.profitFactor.toFixed(2)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Recent Trades with Actions */}
                                        <div className="p-4 bg-dark-800 rounded-xl">
                                            <h3 className="font-medium text-white mb-3">Recent Trades</h3>
                                            {trades.slice(0, 10).length === 0 ? (
                                                <p className="text-dark-500 text-sm">No trades yet</p>
                                            ) : (
                                                <div className="space-y-2">
                                                    {trades.slice(0, 10).map((trade, i) => (
                                                        <div key={i} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                                                            <div className="flex items-center gap-3">
                                                                <span className={cn(
                                                                    'px-2 py-0.5 rounded text-xs font-medium',
                                                                    trade.direction === 'long' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                                                                )}>
                                                                    {trade.direction?.toUpperCase()}
                                                                </span>
                                                                <span className="text-white font-medium">{trade.symbol}</span>
                                                                <span className="text-dark-500 text-sm">
                                                                    {trade.entryTime?.toDate?.()?.toLocaleDateString()}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className={cn(
                                                                    'font-medium',
                                                                    (trade.pnlNet || 0) >= 0 ? 'text-profit' : 'text-loss'
                                                                )}>
                                                                    {(trade.pnlNet || 0) >= 0 ? '+' : ''}{formatCurrency(trade.pnlNet || 0)}
                                                                </span>
                                                                <button
                                                                    onClick={() => handleViewChart(trade)}
                                                                    className="p-1.5 bg-primary-500/20 text-primary-400 rounded hover:bg-primary-500/30"
                                                                    title="View Chart"
                                                                >
                                                                    <LineChart className="w-4 h-4" />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleViewDetails(trade)}
                                                                    className="p-1.5 bg-dark-700 text-dark-300 rounded hover:bg-dark-600"
                                                                    title="View Details"
                                                                >
                                                                    <Eye className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Accounts Tab */}
                                {activeTab === 'accounts' && (
                                    <div className="space-y-4">
                                        {accounts.length === 0 ? (
                                            <div className="text-center py-8 text-dark-500">
                                                <Wallet className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                <p>No accounts</p>
                                            </div>
                                        ) : (
                                            accounts.map((account) => {
                                                const accountTrades = trades.filter(t => t.accountId === account.id)
                                                const accountPnl = accountTrades.reduce((sum, t) => sum + (t.pnlNet || 0), 0)

                                                return (
                                                    <div key={account.id} className="p-4 bg-dark-800 rounded-xl">
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn(
                                                                    'w-10 h-10 rounded-lg flex items-center justify-center',
                                                                    account.isDemo ? 'bg-accent-purple/20' : 'bg-primary-500/20'
                                                                )}>
                                                                    <Wallet className={cn(
                                                                        'w-5 h-5',
                                                                        account.isDemo ? 'text-accent-purple' : 'text-primary-400'
                                                                    )} />
                                                                </div>
                                                                <div>
                                                                    <p className="text-white font-medium">{account.nickname || account.name}</p>
                                                                    <p className="text-sm text-dark-500">{account.broker}</p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-white font-medium">{formatCurrency(account.initialBalance || 0)}</p>
                                                                <p className={cn(
                                                                    'text-sm',
                                                                    accountPnl >= 0 ? 'text-profit' : 'text-loss'
                                                                )}>
                                                                    {accountPnl >= 0 ? '+' : ''}{formatCurrency(accountPnl)} P&L
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="mt-3 pt-3 border-t border-dark-700 grid grid-cols-3 gap-4 text-center">
                                                            <div>
                                                                <p className="text-dark-500 text-xs">Trades</p>
                                                                <p className="text-white font-medium">{accountTrades.length}</p>
                                                            </div>
                                                            <div>
                                                                <p className="text-dark-500 text-xs">Win Rate</p>
                                                                <p className="text-white font-medium">
                                                                    {accountTrades.length > 0
                                                                        ? ((accountTrades.filter(t => (t.pnlNet || 0) > 0).length / accountTrades.length) * 100).toFixed(1)
                                                                        : 0}%
                                                                </p>
                                                            </div>
                                                            <div>
                                                                <p className="text-dark-500 text-xs">Type</p>
                                                                <p className={account.isDemo ? 'text-accent-purple' : 'text-primary-400'}>
                                                                    {account.isDemo ? 'Demo' : 'Live'}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })
                                        )}
                                    </div>
                                )}

                                {/* Trades Tab - Full Table */}
                                {activeTab === 'trades' && (
                                    <div className="space-y-4">
                                        {trades.length === 0 ? (
                                            <div className="text-center py-8 text-dark-500">
                                                <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                <p>No trades</p>
                                            </div>
                                        ) : (
                                            <div className="overflow-x-auto">
                                                <table className="w-full">
                                                    <thead>
                                                        <tr className="text-left text-sm text-dark-500 border-b border-dark-700">
                                                            <th className="pb-3 pr-4">Date/Time</th>
                                                            <th className="pb-3 pr-4">Symbol</th>
                                                            <th className="pb-3 pr-4">Direction</th>
                                                            <th className="pb-3 pr-4 text-right">Entry</th>
                                                            <th className="pb-3 pr-4 text-right">Exit</th>
                                                            <th className="pb-3 pr-4 text-right">Qty</th>
                                                            <th className="pb-3 pr-4 text-right">P&L</th>
                                                            <th className="pb-3 text-center">Actions</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {trades.map((trade, i) => {
                                                            const account = accounts.find(a => a.id === trade.accountId)
                                                            return (
                                                                <tr key={i} className="border-b border-dark-800/50 last:border-0 hover:bg-dark-800/30">
                                                                    <td className="py-3 pr-4">
                                                                        <div className="text-xs text-dark-500">{account?.nickname || account?.name}</div>
                                                                        <div className="text-white text-sm">
                                                                            {trade.entryTime?.toDate?.()?.toLocaleDateString()}
                                                                        </div>
                                                                        <div className="text-xs text-dark-400">
                                                                            {trade.entryTime?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                        </div>
                                                                    </td>
                                                                    <td className="py-3 pr-4 text-white font-medium">{trade.symbol}</td>
                                                                    <td className="py-3 pr-4">
                                                                        <span className={cn(
                                                                            'px-2 py-0.5 rounded text-xs font-medium',
                                                                            trade.direction === 'long' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                                                                        )}>
                                                                            {trade.direction?.toUpperCase()}
                                                                        </span>
                                                                    </td>
                                                                    <td className="py-3 pr-4 text-right text-dark-300">{trade.entryPrice?.toFixed(2) || '-'}</td>
                                                                    <td className="py-3 pr-4 text-right text-dark-300">{trade.exitPrice?.toFixed(2) || '-'}</td>
                                                                    <td className="py-3 pr-4 text-right text-dark-300">{trade.quantity || 1}</td>
                                                                    <td className={cn(
                                                                        'py-3 pr-4 text-right font-medium',
                                                                        (trade.pnlNet || 0) >= 0 ? 'text-profit' : 'text-loss'
                                                                    )}>
                                                                        {(trade.pnlNet || 0) >= 0 ? '+' : ''}{formatCurrency(trade.pnlNet || 0)}
                                                                    </td>
                                                                    <td className="py-3 text-center">
                                                                        <div className="flex justify-center gap-1">
                                                                            <button
                                                                                onClick={() => handleViewChart(trade)}
                                                                                className="p-1.5 bg-primary-500/20 text-primary-400 rounded hover:bg-primary-500/30"
                                                                                title="View Chart"
                                                                            >
                                                                                <LineChart className="w-4 h-4" />
                                                                            </button>
                                                                            <button
                                                                                onClick={() => handleViewDetails(trade)}
                                                                                className="p-1.5 bg-dark-700 text-dark-300 rounded hover:bg-dark-600"
                                                                                title="View Details"
                                                                            >
                                                                                <Eye className="w-4 h-4" />
                                                                            </button>
                                                                        </div>
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Prop Firms Tab */}
                                {activeTab === 'propfirms' && (
                                    <div className="space-y-4">
                                        {accounts.filter(a => a.provider).length === 0 ? (
                                            <div className="text-center py-8 text-dark-500">
                                                <Building2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                                <p>No prop firm accounts</p>
                                            </div>
                                        ) : (
                                            accounts.filter(a => a.provider).map((account) => (
                                                <div key={account.id} className="p-4 bg-dark-800 rounded-xl">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="text-white font-medium">{account.provider}</p>
                                                            <p className="text-sm text-dark-500">{formatCurrency(account.size || 0)} Account</p>
                                                        </div>
                                                        <span className={cn(
                                                            'px-3 py-1 rounded-full text-sm font-medium',
                                                            account.status === 'funded' ? 'bg-profit/20 text-profit' :
                                                                account.status === 'failed' ? 'bg-loss/20 text-loss' :
                                                                    'bg-accent-orange/20 text-accent-orange'
                                                        )}>
                                                            {account.status || 'Active'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Chart Viewer Modal */}
            {showChart && selectedTrade && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/80" onClick={() => setShowChart(false)} />
                    <div className="relative w-full max-w-5xl bg-dark-900 rounded-2xl border border-dark-700 p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-white">
                                {selectedTrade.symbol} - {selectedTrade.direction?.toUpperCase()}
                            </h3>
                            <button
                                onClick={() => setShowChart(false)}
                                className="p-2 hover:bg-dark-800 rounded-lg"
                            >
                                <X className="w-5 h-5 text-dark-400" />
                            </button>
                        </div>
                        <TradeChartViewer trade={selectedTrade} />
                    </div>
                </div>
            )}

            {/* Trade Details Modal */}
            {showDetails && selectedTrade && (
                <TradeDetailsModal
                    trade={selectedTrade}
                    onClose={() => setShowDetails(false)}
                    onSave={() => { }} // Read-only for friends
                    readOnly={true}
                />
            )}
        </>
    )
}
