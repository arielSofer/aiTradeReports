'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import {
  Plus,
  Wallet,
  Settings,
  Trash2,
  RefreshCw,
  ExternalLink,
  MoreVertical,
  TrendingUp,
  CheckCircle,
  XCircle,
  Edit2,
  Check,
  X
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  getAccounts,
  createAccount,
  updateAccount,
  deleteAccount as deleteFirestoreAccount,
  getTrades,
  FirestoreAccount
} from '@/lib/firebase/firestore'
import { useStore } from '@/lib/store'

const brokers = [
  { id: 'interactive_brokers', name: 'Interactive Brokers', icon: '🏦' },
  { id: 'topstepx', name: 'TopstepX', icon: '🏆' },
  { id: 'ninja_trader', name: 'NinjaTrader 8', icon: '🥷' },
  { id: 'tradovate', name: 'Tradovate', icon: '📈' },
  { id: 'metatrader4', name: 'MetaTrader 4/5', icon: '📊' },
  { id: 'binance', name: 'Binance', icon: '🪙' },
  { id: 'generic', name: 'Manual/CSV', icon: '📁' },
]

function AccountsContent() {
  const { user } = useAuth()
  const { isSidebarCollapsed } = useStore()
  const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [totalPnL, setTotalPnL] = useState(0)
  const [accountStats, setAccountStats] = useState<Record<string, { pnl: number; trades: number }>>({})
  const [editingNickname, setEditingNickname] = useState<string | null>(null)
  const [nicknameValue, setNicknameValue] = useState('')
  const [newAccount, setNewAccount] = useState({
    name: '',
    broker: '',
    currency: 'USD',
    isDemo: false
  })

  // Load accounts from Firebase
  useEffect(() => {
    if (user) {
      loadAccounts()
    } else {
      setAccounts([])
      setLoading(false)
    }
  }, [user])

  const loadAccounts = async () => {
    if (!user) return
    setLoading(true)
    try {
      const userAccounts = await getAccounts(user.uid)
      setAccounts(userAccounts)

      // Calculate stats for each account from trades
      const allTrades = await getTrades(user.uid)
      const stats: Record<string, { pnl: number; trades: number }> = {}

      // Initialize stats for all accounts
      userAccounts.forEach(account => {
        if (account.id) {
          stats[account.id] = { pnl: 0, trades: 0 }
        }
      })

      // Calculate stats from trades
      allTrades.forEach(trade => {
        if (trade.accountId && stats[trade.accountId]) {
          stats[trade.accountId].trades += 1
          stats[trade.accountId].pnl += (trade.pnlNet || 0)
        }
      })

      setAccountStats(stats)

      // Calculate total P&L from all trades
      const totalPnl = allTrades.reduce((sum, trade) => sum + (trade.pnlNet || 0), 0)
      setTotalPnL(totalPnl)
    } catch (error) {
      console.error('Error loading accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalBalance = accounts.reduce((sum, a) => sum + (a.initialBalance || 0), 0)

  const handleAddAccount = async () => {
    if (!user) {
      console.error('No user logged in')
      alert('Please log in first')
      return
    }

    if (!newAccount.name) {
      alert('Please enter an account name')
      return
    }

    if (!newAccount.broker) {
      alert('Please select a broker')
      return
    }

    setSaving(true)
    try {
      const brokerName = brokers.find(b => b.id === newAccount.broker)?.name || newAccount.broker

      console.log('Creating account:', {
        userId: user.uid,
        name: newAccount.name,
        broker: brokerName,
        currency: newAccount.currency,
        isDemo: newAccount.isDemo
      })

      const accountId = await createAccount(user.uid, {
        name: newAccount.name,
        broker: brokerName,
        currency: newAccount.currency,
        initialBalance: 0,
        isDemo: newAccount.isDemo,
        isActive: true
      })

      console.log('Account created with ID:', accountId)

      // Reload accounts
      await loadAccounts()

      setShowAddModal(false)
      setNewAccount({ name: '', broker: '', currency: 'USD', isDemo: false })
    } catch (error: any) {
      console.error('Error creating account:', error)
      console.error('Error details:', error?.message, error?.code)
      alert(`Failed to create account: ${error?.message || 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async (id: string) => {
    if (!user) return
    if (confirm('Are you sure you want to delete this account? All trades will be lost.')) {
      try {
        await deleteFirestoreAccount(id)
        setAccounts(accounts.filter(a => a.id !== id))
      } catch (error) {
        console.error('Error deleting account:', error)
        alert('Failed to delete account.')
      }
    }
  }

  const handleSaveNickname = async (accountId: string) => {
    if (!user) return
    try {
      await updateAccount(accountId, { nickname: nicknameValue || undefined })
      setAccounts(accounts.map(a =>
        a.id === accountId ? { ...a, nickname: nicknameValue || undefined } : a
      ))
      setEditingNickname(null)
    } catch (error) {
      console.error('Error saving nickname:', error)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className={cn(
        "flex-1 transition-all duration-300",
        isSidebarCollapsed ? "ml-28" : "ml-72"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Trading Accounts</h2>
              <p className="text-sm text-dark-500">Manage your connected trading accounts</p>
            </div>
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Add Account
            </button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card">
              <p className="text-dark-500 text-sm mb-1">Total Balance</p>
              <p className="text-2xl font-bold text-white">{formatCurrency(totalBalance)}</p>
            </div>
            <div className="stat-card">
              <p className="text-dark-500 text-sm mb-1">Total P&L</p>
              <p className={cn(
                'text-2xl font-bold',
                totalPnL >= 0 ? 'text-profit' : 'text-loss'
              )}>
                {totalPnL >= 0 ? '+' : ''}{formatCurrency(totalPnL)}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-dark-500 text-sm mb-1">Active Accounts</p>
              <p className="text-2xl font-bold text-white">{accounts.filter(a => a.isActive).length}</p>
            </div>
          </div>

          {/* Accounts List */}
          <div className="space-y-4">
            {loading ? (
              <div className="chart-container p-12 text-center">
                <RefreshCw className="w-8 h-8 text-primary-500 mx-auto mb-4 animate-spin" />
                <p className="text-dark-400">Loading accounts...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="chart-container p-12 text-center">
                <Wallet className="w-12 h-12 text-dark-600 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-white mb-2">No Accounts Yet</h3>
                <p className="text-dark-400 mb-4">Add your first trading account to get started</p>
                <button onClick={() => setShowAddModal(true)} className="btn-primary">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Account
                </button>
              </div>
            ) : (
              accounts.map(account => (
                <div key={account.id} className="chart-container p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        account.isDemo ? 'bg-accent-purple/20' : 'bg-primary-500/20'
                      )}>
                        <Wallet className={cn(
                          'w-6 h-6',
                          account.isDemo ? 'text-accent-purple' : 'text-primary-400'
                        )} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-white">{account.nickname || account.name}</h3>
                          {account.isDemo && (
                            <span className="px-2 py-0.5 bg-accent-purple/20 text-accent-purple text-xs rounded">
                              Demo
                            </span>
                          )}
                          {account.isActive ? (
                            <CheckCircle className="w-4 h-4 text-profit" />
                          ) : (
                            <XCircle className="w-4 h-4 text-dark-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-dark-500">{account.broker}</p>
                          {account.nickname && (
                            <span className="text-xs text-dark-600">({account.name})</span>
                          )}
                        </div>
                        {/* Nickname Editor */}
                        {editingNickname === account.id ? (
                          <div className="flex items-center gap-2 mt-2">
                            <input
                              type="text"
                              value={nicknameValue}
                              onChange={(e) => setNicknameValue(e.target.value)}
                              placeholder="כינוי..."
                              className="px-2 py-1 bg-dark-700 border border-dark-600 rounded text-sm text-white w-32"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveNickname(account.id!)
                                if (e.key === 'Escape') setEditingNickname(null)
                              }}
                            />
                            <button
                              onClick={() => handleSaveNickname(account.id!)}
                              className="p-1 bg-profit/20 text-profit rounded hover:bg-profit/30"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingNickname(null)}
                              className="p-1 bg-loss/20 text-loss rounded hover:bg-loss/30"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingNickname(account.id!)
                              setNicknameValue(account.nickname || '')
                            }}
                            className="text-xs text-dark-500 hover:text-primary-400 mt-1 flex items-center gap-1"
                          >
                            <Edit2 className="w-3 h-3" />
                            {account.nickname ? 'ערוך כינוי' : 'הוסף כינוי'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">
                        {formatCurrency(account.initialBalance || 0)}
                      </p>
                      <p className={cn(
                        'text-sm',
                        (accountStats[account.id || '']?.pnl || 0) >= 0 ? 'text-profit' : 'text-loss'
                      )}>
                        {(accountStats[account.id || '']?.pnl || 0) >= 0 ? '+' : ''}{formatCurrency(accountStats[account.id || '']?.pnl || 0)} P&L
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{accountStats[account.id || '']?.trades || 0}</p>
                      <p className="text-sm text-dark-500">Trades</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={loadAccounts}
                        className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
                        title="Refresh"
                      >
                        <RefreshCw className="w-4 h-4 text-dark-400" />
                      </button>
                      <button className="p-2 hover:bg-dark-800 rounded-lg transition-colors" title="Settings">
                        <Settings className="w-4 h-4 text-dark-400" />
                      </button>
                      <button
                        onClick={() => account.id && handleDeleteAccount(account.id)}
                        className="p-2 hover:bg-dark-800 rounded-lg transition-colors text-loss/50 hover:text-loss"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />

          <div className="relative w-full max-w-lg bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl">
            <div className="p-6 border-b border-dark-800">
              <h2 className="text-xl font-display font-bold text-white">Add Trading Account</h2>
              <p className="text-sm text-dark-500">Connect a new trading account</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Account Name</label>
                <input
                  type="text"
                  value={newAccount.name}
                  onChange={(e) => setNewAccount({ ...newAccount, name: e.target.value })}
                  placeholder="My Trading Account"
                  className="input w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Broker</label>
                <div className="grid grid-cols-2 gap-2">
                  {brokers.map(broker => (
                    <button
                      key={broker.id}
                      onClick={() => setNewAccount({ ...newAccount, broker: broker.id })}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all',
                        newAccount.broker === broker.id
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-dark-700 hover:border-dark-600 bg-dark-800/50'
                      )}
                    >
                      <span className="text-lg mr-2">{broker.icon}</span>
                      <span className="text-sm text-white">{broker.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isDemo"
                  checked={newAccount.isDemo}
                  onChange={(e) => setNewAccount({ ...newAccount, isDemo: e.target.checked })}
                  className="w-4 h-4 rounded bg-dark-800 border-dark-600"
                />
                <label htmlFor="isDemo" className="text-sm text-dark-300">
                  This is a demo/paper trading account
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-dark-800">
              <button onClick={() => setShowAddModal(false)} className="btn-secondary" disabled={saving}>
                Cancel
              </button>
              <button
                onClick={handleAddAccount}
                className="btn-primary flex items-center gap-2"
                disabled={saving || !newAccount.name || !newAccount.broker}
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Add Account'
                )}
              </button>
            </div>
          </div>
        </div>
      )
      }
    </div >
  )
}

export default function AccountsPage() {
  return (
    <ProtectedRoute>
      <AccountsContent />
    </ProtectedRoute>
  )
}

