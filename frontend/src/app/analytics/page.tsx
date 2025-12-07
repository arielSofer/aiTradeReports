'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock,
  BarChart2,
  PieChart,
  Activity,
  Wallet,
  ChevronDown
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { getTrades, getAccounts, FirestoreAccount, calculateStats } from '@/lib/firebase/firestore'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPie,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts'

const COLORS = ['#22c55e', '#ef4444', '#3b82f6', '#f97316', '#8b5cf6']

interface Trade {
  id: number
  symbol: string
  direction: 'long' | 'short'
  status: 'open' | 'closed'
  entryTime: string
  exitTime?: string
  entryPrice: number
  exitPrice?: number
  quantity: number
  commission: number
  pnlNet?: number
  pnlPercent?: number
  isWinner?: boolean
  tags: string[]
  notes?: string
}

function AnalyticsContent() {
  const { user } = useAuth()
  const [trades, setTrades] = useState<Trade[]>([])
  const [stats, setStats] = useState({
    totalTrades: 0,
    winningTrades: 0,
    losingTrades: 0,
    openTrades: 0,
    totalPnl: 0,
    winRate: 0,
    profitFactor: 0,
    avgWinner: 0,
    avgLoser: 0,
    largestWinner: 0,
    largestLoser: 0,
    totalCommission: 0,
    currentStreak: 0,
    bestStreak: 0,
    worstStreak: 0,
  })
  const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (user) {
        try {
          const userAccounts = await getAccounts(user.uid)
          setAccounts(userAccounts)
        } catch (error) {
          console.error('Error loading accounts:', error)
        }
      }
    }
    loadAccounts()
  }, [user])

  // Load trades and stats from Firebase
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setLoading(true)
        try {
          const accountIdFilter = selectedAccountId === 'all' ? undefined : selectedAccountId
          const firestoreTrades = await getTrades(user.uid, { accountId: accountIdFilter })
          
          const convertedTrades: Trade[] = firestoreTrades.map(t => ({
            id: parseInt(t.id || '0'),
            symbol: t.symbol,
            direction: t.direction,
            status: t.status,
            entryTime: t.entryTime?.toDate?.()?.toISOString() || new Date().toISOString(),
            exitTime: t.exitTime?.toDate?.()?.toISOString(),
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            quantity: t.quantity,
            commission: t.commission,
            pnlNet: t.pnlNet,
            pnlPercent: t.pnlPercent,
            isWinner: t.pnlNet ? t.pnlNet > 0 : undefined,
            tags: t.tags || [],
            notes: t.notes,
          }))
          
          setTrades(convertedTrades)
          
          // Calculate stats
          const firebaseStats = await calculateStats(user.uid, accountIdFilter)
          setStats({
            totalTrades: firebaseStats.totalTrades,
            winningTrades: firebaseStats.winningTrades,
            losingTrades: firebaseStats.losingTrades,
            openTrades: firebaseStats.openTrades,
            totalPnl: firebaseStats.totalPnl,
            winRate: firebaseStats.winRate,
            profitFactor: firebaseStats.profitFactor === Infinity ? 999 : firebaseStats.profitFactor,
            avgWinner: firebaseStats.avgWinner,
            avgLoser: firebaseStats.avgLoser,
            largestWinner: firebaseStats.largestWinner,
            largestLoser: firebaseStats.largestLoser,
            totalCommission: firebaseStats.totalCommission,
            currentStreak: 0,
            bestStreak: 0,
            worstStreak: 0,
          })
        } catch (error) {
          console.error('Error loading data:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    loadData()
  }, [user, selectedAccountId])

  // Prepare data for charts
  const winLossData = [
    { name: 'Wins', value: stats.winningTrades, color: '#22c55e' },
    { name: 'Losses', value: stats.losingTrades, color: '#ef4444' },
  ]

  const symbolStats = trades.reduce((acc, trade) => {
    if (!acc[trade.symbol]) {
      acc[trade.symbol] = { symbol: trade.symbol, trades: 0, pnl: 0, wins: 0 }
    }
    acc[trade.symbol].trades++
    acc[trade.symbol].pnl += trade.pnlNet || 0
    if (trade.isWinner) acc[trade.symbol].wins++
    return acc
  }, {} as Record<string, { symbol: string; trades: number; pnl: number; wins: number }>)

  const symbolData = Object.values(symbolStats)
    .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
    .slice(0, 10)

  const directionStats = [
    { 
      direction: 'Long', 
      trades: trades.filter(t => t.direction === 'long').length,
      pnl: trades.filter(t => t.direction === 'long').reduce((sum, t) => sum + (t.pnlNet || 0), 0),
      winRate: trades.filter(t => t.direction === 'long').length > 0
        ? Math.round(
            (trades.filter(t => t.direction === 'long' && t.isWinner).length / 
             trades.filter(t => t.direction === 'long').length) * 100
          )
        : 0
    },
    { 
      direction: 'Short', 
      trades: trades.filter(t => t.direction === 'short').length,
      pnl: trades.filter(t => t.direction === 'short').reduce((sum, t) => sum + (t.pnlNet || 0), 0),
      winRate: trades.filter(t => t.direction === 'short').length > 0
        ? Math.round(
            (trades.filter(t => t.direction === 'short' && t.isWinner).length / 
             trades.filter(t => t.direction === 'short').length) * 100
          )
        : 0
    },
  ]

  // Calculate hourly stats
  const hourlyMap: Record<number, { pnl: number; trades: number; wins: number }> = {}
  for (let i = 0; i < 24; i++) {
    hourlyMap[i] = { pnl: 0, trades: 0, wins: 0 }
  }
  
  trades.forEach(trade => {
    if (trade.entryTime && trade.pnlNet !== undefined) {
      const hour = new Date(trade.entryTime).getHours()
      hourlyMap[hour].pnl += trade.pnlNet
      hourlyMap[hour].trades += 1
      if (trade.pnlNet > 0) hourlyMap[hour].wins += 1
    }
  })
  
  const hourlyStats = Object.entries(hourlyMap).map(([hour, data]) => ({
    hour: parseInt(hour),
    pnl: data.pnl,
    trades: data.trades,
    wins: data.wins,
    winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
  }))

  const selectedAccount = selectedAccountId === 'all' 
    ? null 
    : accounts.find(a => a.id === selectedAccountId)

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      
      <main className="flex-1 ml-64">
        <Header 
          onUploadClick={() => window.location.href = '/import'}
          onAddTradeClick={() => window.location.href = '/'}
        />
        
        {/* Header */}
        <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Analytics</h2>
              <p className="text-sm text-dark-500">Deep dive into your trading performance</p>
            </div>
            <div className="flex items-center gap-3">
              {/* Account Selector */}
              <div className="relative">
                <button
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Wallet className="w-4 h-4" />
                  {selectedAccount ? selectedAccount.name : 'All Accounts'}
                  <ChevronDown className="w-4 h-4" />
                </button>
                
                {showAccountDropdown && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowAccountDropdown(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-dark-900 border border-dark-700 rounded-xl shadow-xl z-20">
                      <div className="p-2">
                        <button
                          onClick={() => {
                            setSelectedAccountId('all')
                            setShowAccountDropdown(false)
                          }}
                          className={cn(
                            'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                            selectedAccountId === 'all'
                              ? 'bg-primary/20 text-primary'
                              : 'text-dark-300 hover:bg-dark-800'
                          )}
                        >
                          All Accounts
                        </button>
                        {accounts.map(account => (
                          <button
                            key={account.id}
                            onClick={() => {
                              setSelectedAccountId(account.id!)
                              setShowAccountDropdown(false)
                            }}
                            className={cn(
                              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                              selectedAccountId === account.id
                                ? 'bg-primary/20 text-primary'
                                : 'text-dark-300 hover:bg-dark-800'
                            )}
                          >
                            {account.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <p className="text-dark-500 mt-4">טוען נתונים...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* Top Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-5 h-5 text-primary-400" />
                  <span className="text-dark-500 text-sm">Win Rate</span>
                </div>
                <p className={cn(
                  'text-3xl font-bold',
                  stats.winRate >= 50 ? 'text-profit' : 'text-loss'
                )}>
                  {stats.winRate.toFixed(1)}%
                </p>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="w-5 h-5 text-accent-blue" />
                  <span className="text-dark-500 text-sm">Profit Factor</span>
                </div>
                <p className={cn(
                  'text-3xl font-bold',
                  stats.profitFactor >= 1.5 ? 'text-profit' : 'text-loss'
                )}>
                  {stats.profitFactor.toFixed(2)}
                </p>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-5 h-5 text-profit" />
                  <span className="text-dark-500 text-sm">Avg Winner</span>
                </div>
                <p className="text-3xl font-bold text-profit">
                  {formatCurrency(stats.avgWinner)}
                </p>
              </div>

              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-5 h-5 text-loss" />
                  <span className="text-dark-500 text-sm">Avg Loser</span>
                </div>
                <p className="text-3xl font-bold text-loss">
                  {formatCurrency(stats.avgLoser)}
                </p>
              </div>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-2 gap-6">
              {/* Win/Loss Distribution */}
              <div className="chart-container p-6">
                <h3 className="text-lg font-display font-semibold text-white mb-4">Win/Loss Distribution</h3>
                {winLossData[0].value + winLossData[1].value === 0 ? (
                  <div className="h-64 flex items-center justify-center text-dark-500">
                    No trades data
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPie>
                        <Pie
                          data={winLossData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {winLossData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px'
                          }}
                        />
                      </RechartsPie>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-profit" />
                    <span className="text-sm text-dark-400">Wins ({stats.winningTrades})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-loss" />
                    <span className="text-sm text-dark-400">Losses ({stats.losingTrades})</span>
                  </div>
                </div>
              </div>

              {/* Long vs Short */}
              <div className="chart-container p-6">
                <h3 className="text-lg font-display font-semibold text-white mb-4">Long vs Short Performance</h3>
                <div className="space-y-4">
                  {directionStats.map(stat => (
                    <div key={stat.direction} className="p-4 bg-dark-800/50 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {stat.direction === 'Long' ? (
                            <TrendingUp className="w-5 h-5 text-accent-blue" />
                          ) : (
                            <TrendingDown className="w-5 h-5 text-accent-orange" />
                          )}
                          <span className="font-medium text-white">{stat.direction}</span>
                        </div>
                        <span className={cn(
                          'font-bold',
                          stat.pnl >= 0 ? 'text-profit' : 'text-loss'
                        )}>
                          {formatCurrency(stat.pnl)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm text-dark-400">
                        <span>{stat.trades} trades</span>
                        <span className={stat.winRate >= 50 ? 'text-profit' : 'text-loss'}>
                          {stat.winRate}% win rate
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-2 gap-6">
              {/* P&L by Symbol */}
              <div className="chart-container p-6">
                <h3 className="text-lg font-display font-semibold text-white mb-4">P&L by Symbol</h3>
                {symbolData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-dark-500">
                    No trades data
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={symbolData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis type="number" stroke="#64748b" />
                        <YAxis 
                          type="category" 
                          dataKey="symbol" 
                          stroke="#64748b"
                          width={60}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Bar 
                          dataKey="pnl" 
                          fill="#22c55e"
                          radius={[0, 4, 4, 0]}
                        >
                          {symbolData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={entry.pnl >= 0 ? '#22c55e' : '#ef4444'} 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Hourly Performance */}
              <div className="chart-container p-6">
                <h3 className="text-lg font-display font-semibold text-white mb-4">Hourly Performance</h3>
                {hourlyStats.every(h => h.trades === 0) ? (
                  <div className="h-64 flex items-center justify-center text-dark-500">
                    No trades data
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                        <XAxis 
                          dataKey="hour" 
                          stroke="#64748b"
                          tickFormatter={(h) => `${h}:00`}
                        />
                        <YAxis stroke="#64748b" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1e293b', 
                            border: '1px solid #334155',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => formatCurrency(value)}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="pnl" 
                          stroke="#22c55e" 
                          fill="rgba(34, 197, 94, 0.2)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="chart-container p-6">
              <h3 className="text-lg font-display font-semibold text-white mb-4">Detailed Statistics</h3>
              <div className="grid grid-cols-4 gap-6">
                <div>
                  <p className="text-dark-500 text-sm mb-1">Total Trades</p>
                  <p className="text-2xl font-bold text-white">{stats.totalTrades}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-sm mb-1">Largest Win</p>
                  <p className="text-2xl font-bold text-profit">{formatCurrency(stats.largestWinner)}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-sm mb-1">Largest Loss</p>
                  <p className="text-2xl font-bold text-loss">{formatCurrency(stats.largestLoser)}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-sm mb-1">Total Commission</p>
                  <p className="text-2xl font-bold text-dark-300">{formatCurrency(stats.totalCommission)}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-sm mb-1">Best Streak</p>
                  <p className="text-2xl font-bold text-profit">+{stats.bestStreak}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-sm mb-1">Worst Streak</p>
                  <p className="text-2xl font-bold text-loss">-{stats.worstStreak}</p>
                </div>
                <div>
                  <p className="text-dark-500 text-sm mb-1">Current Streak</p>
                  <p className={cn(
                    'text-2xl font-bold',
                    stats.currentStreak >= 0 ? 'text-profit' : 'text-loss'
                  )}>
                    {stats.currentStreak >= 0 ? '+' : ''}{stats.currentStreak}
                  </p>
                </div>
                <div>
                  <p className="text-dark-500 text-sm mb-1">Risk/Reward</p>
                  <p className="text-2xl font-bold text-white">
                    {stats.avgLoser !== 0 
                      ? `1:${(stats.avgWinner / Math.abs(stats.avgLoser)).toFixed(1)}`
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <AnalyticsContent />
    </ProtectedRoute>
  )
}
