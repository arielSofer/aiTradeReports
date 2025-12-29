'use client'

import { useState, useEffect } from 'react'
import {
    X,
    Loader2,
    Wallet,
    TrendingUp,
    TrendingDown,
    BarChart3,
    Building2,
    AlertCircle
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import {
    getAccounts,
    getTrades,
    FirestoreAccount,
    FirestoreTrade
} from '@/lib/firebase/firestore'

interface FriendProfileModalProps {
    friendId: string
    friendUsername: string
    onClose: () => void
}

type Tab = 'overview' | 'accounts' | 'trades' | 'propfirms'

export function FriendProfileModal({ friendId, friendUsername, onClose }: FriendProfileModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('overview')
    const [loading, setLoading] = useState(true)
    const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
    const [trades, setTrades] = useState<FirestoreTrade[]>([])
    const [stats, setStats] = useState({
        totalPnl: 0,
        winRate: 0,
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0
    })

    useEffect(() => {
        loadFriendData()
    }, [friendId])

    const loadFriendData = async () => {
        setLoading(true)
        try {
            const [friendAccounts, friendTrades] = await Promise.all([
                getAccounts(friendId),
                getTrades(friendId, { limitCount: 100 })
            ])

            setAccounts(friendAccounts)
            setTrades(friendTrades)

            // Calculate stats
            const wins = friendTrades.filter(t => (t.pnlNet || 0) > 0).length
            const losses = friendTrades.filter(t => (t.pnlNet || 0) < 0).length
            const totalPnl = friendTrades.reduce((sum, t) => sum + (t.pnlNet || 0), 0)

            setStats({
                totalPnl,
                winRate: friendTrades.length > 0 ? (wins / friendTrades.length) * 100 : 0,
                totalTrades: friendTrades.length,
                winningTrades: wins,
                losingTrades: losses
            })
        } catch (err) {
            console.error('Error loading friend data:', err)
        } finally {
            setLoading(false)
        }
    }

    const tabs = [
        { id: 'overview' as Tab, label: 'Overview', icon: BarChart3 },
        { id: 'accounts' as Tab, label: 'Accounts', icon: Wallet },
        { id: 'trades' as Tab, label: 'Trades', icon: TrendingUp },
        { id: 'propfirms' as Tab, label: 'Prop Firms', icon: Building2 }
    ]

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-4xl max-h-[85vh] bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl flex flex-col">
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

                                    <div className="p-4 bg-dark-800 rounded-xl">
                                        <h3 className="font-medium text-white mb-3">Recent Trades</h3>
                                        {trades.slice(0, 5).length === 0 ? (
                                            <p className="text-dark-500 text-sm">No trades yet</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {trades.slice(0, 5).map((trade, i) => (
                                                    <div key={i} className="flex items-center justify-between py-2 border-b border-dark-700 last:border-0">
                                                        <div className="flex items-center gap-3">
                                                            <span className={cn(
                                                                'px-2 py-0.5 rounded text-xs font-medium',
                                                                trade.direction === 'long' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                                                            )}>
                                                                {trade.direction?.toUpperCase()}
                                                            </span>
                                                            <span className="text-white font-medium">{trade.symbol}</span>
                                                        </div>
                                                        <span className={cn(
                                                            'font-medium',
                                                            (trade.pnlNet || 0) >= 0 ? 'text-profit' : 'text-loss'
                                                        )}>
                                                            {(trade.pnlNet || 0) >= 0 ? '+' : ''}{formatCurrency(trade.pnlNet || 0)}
                                                        </span>
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
                                        accounts.map((account) => (
                                            <div key={account.id} className="p-4 bg-dark-800 rounded-xl flex items-center justify-between">
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
                                                    {account.isDemo && (
                                                        <span className="text-xs text-accent-purple">Demo</span>
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Trades Tab */}
                            {activeTab === 'trades' && (
                                <div className="space-y-2">
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
                                                        <th className="pb-3">Symbol</th>
                                                        <th className="pb-3">Direction</th>
                                                        <th className="pb-3 text-right">Entry</th>
                                                        <th className="pb-3 text-right">Exit</th>
                                                        <th className="pb-3 text-right">P&L</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {trades.map((trade, i) => (
                                                        <tr key={i} className="border-b border-dark-800/50 last:border-0">
                                                            <td className="py-3 text-white font-medium">{trade.symbol}</td>
                                                            <td className="py-3">
                                                                <span className={cn(
                                                                    'px-2 py-0.5 rounded text-xs font-medium',
                                                                    trade.direction === 'long' ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                                                                )}>
                                                                    {trade.direction?.toUpperCase()}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 text-right text-dark-300">{trade.entryPrice?.toFixed(2) || '-'}</td>
                                                            <td className="py-3 text-right text-dark-300">{trade.exitPrice?.toFixed(2) || '-'}</td>
                                                            <td className={cn(
                                                                'py-3 text-right font-medium',
                                                                (trade.pnlNet || 0) >= 0 ? 'text-profit' : 'text-loss'
                                                            )}>
                                                                {(trade.pnlNet || 0) >= 0 ? '+' : ''}{formatCurrency(trade.pnlNet || 0)}
                                                            </td>
                                                        </tr>
                                                    ))}
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
    )
}
