'use client'

import { useState, useEffect, useMemo } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { Header } from '@/components/Header'
import { generatePerformanceReview } from '@/lib/openrouter'
import {
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  BarChart2,
  PieChart,
  Activity,
  Wallet,
  ChevronDown,
  Calendar,
  Zap,
  Award,
  AlertTriangle,
  Sparkles,
  Loader2,
  Brain
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { getTrades, getAccounts, FirestoreAccount } from '@/lib/firebase/firestore'
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
  Area,
  AreaChart,
} from 'recharts'

const COLORS = {
  profit: '#22c55e',
  loss: '#ef4444',
  primary: '#3b82f6',
  warning: '#f97316',
  purple: '#8b5cf6',
  dark: '#1e293b',
  grid: '#334155',
  text: '#94a3b8'
}

interface Trade {
  id: string
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
  const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [loading, setLoading] = useState(true)
  const [aiReview, setAiReview] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Load accounts
  useEffect(() => {
    const loadAccounts = async () => {
      if (user) {
        try {
          const userAccounts = await getAccounts(user.uid)
          setAccounts(userAccounts)
        } catch (error) {
          console.error('Error loading accounts:', error)
          // setAccounts([]) // safe fallback
        }
      }
    }
    loadAccounts()
  }, [user])

  // Load trades
  useEffect(() => {
    const loadData = async () => {
      if (user) {
        setLoading(true)
        try {
          const accountIdFilter = selectedAccountId === 'all' ? undefined : selectedAccountId
          const firestoreTrades = await getTrades(user.uid, { accountId: accountIdFilter })

          const convertedTrades: Trade[] = firestoreTrades.map(t => ({
            id: t.id || Math.random().toString(),
            symbol: t.symbol,
            direction: t.direction,
            status: t.status,
            entryTime: t.entryTime?.toDate?.()?.toISOString() || new Date().toISOString(),
            exitTime: t.exitTime?.toDate?.()?.toISOString(),
            entryPrice: t.entryPrice,
            exitPrice: t.exitPrice,
            quantity: t.quantity,
            commission: t.commission || 0,
            pnlNet: t.pnlNet,
            pnlPercent: t.pnlPercent,
            isWinner: t.pnlNet ? t.pnlNet > 0 : undefined,
            tags: t.tags || [],
            notes: t.notes,
          }))

          // Sort by date ascending for charts
          convertedTrades.sort((a, b) => new Date(a.entryTime).getTime() - new Date(b.entryTime).getTime())

          setTrades(convertedTrades)
        } catch (error) {
          console.error('Error loading data:', error)
          setTrades([])
        } finally {
          setLoading(false)
        }
      }
    }
    loadData()
  }, [user, selectedAccountId])

  // Advanced Statistics Calculation
  const stats = useMemo(() => {
    const closedTrades = trades.filter(t => t.status === 'closed' && t.pnlNet !== undefined)
    const winningTrades = closedTrades.filter(t => t.pnlNet! > 0)
    const losingTrades = closedTrades.filter(t => t.pnlNet! <= 0)

    const totalTrades = closedTrades.length
    const winRate = totalTrades > 0 ? (winningTrades.length / totalTrades) * 100 : 0

    // Holding Time Calculation
    let totalHoldingTime = 0
    closedTrades.forEach(t => {
      if (t.entryTime && t.exitTime) {
        const start = new Date(t.entryTime).getTime()
        const end = new Date(t.exitTime).getTime()
        if (!isNaN(start) && !isNaN(end)) {
          totalHoldingTime += end - start
        }
      }
    })
    const avgHoldingTimeMs = totalTrades > 0 ? totalHoldingTime / totalTrades : 0
    const avgHoldingTimeMinutes = Math.round(avgHoldingTimeMs / (1000 * 60))

    const grossProfit = winningTrades.reduce((sum, t) => sum + t.pnlNet!, 0)
    const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.pnlNet!, 0))
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 999 : 0
    const totalPnl = grossProfit - grossLoss

    const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0
    const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0
    const riskRewardRatio = avgLoss > 0 ? avgWin / avgLoss : 0

    // Expectancy = (WinRate * AvgWin) - (LossRate * AvgLoss)
    const expectancy = (winRate / 100 * avgWin) - ((1 - winRate / 100) * avgLoss)

    // Max Drawdown Calculation
    let peak = -Infinity
    let maxDrawdown = 0
    let currentEquity = 0
    let equityCurve = [{ date: closedTrades[0]?.entryTime, equity: 0 }]

    if (closedTrades.length > 0) peak = 0

    closedTrades.forEach(trade => {
      currentEquity += trade.pnlNet!
      if (currentEquity > peak) peak = currentEquity
      const drawdown = peak - currentEquity
      if (drawdown > maxDrawdown) maxDrawdown = drawdown

      equityCurve.push({
        date: trade.entryTime,
        equity: currentEquity
      })
    })

    // Streaks
    let currentStreak = 0
    let bestStreak = 0
    let worstStreak = 0

    closedTrades.forEach(t => {
      if (t.pnlNet! > 0) {
        if (currentStreak < 0) currentStreak = 0
        currentStreak++
        if (currentStreak > bestStreak) bestStreak = currentStreak
      } else {
        if (currentStreak > 0) currentStreak = 0
        currentStreak--
        if (currentStreak < worstStreak) worstStreak = currentStreak
      }
    })

    return {
      totalTrades,
      winRate,
      profitFactor,
      totalPnl,
      avgWin,
      avgLoss,
      riskRewardRatio,
      expectancy,
      maxDrawdown,
      bestStreak,
      worstStreak: Math.abs(worstStreak),
      equityCurve,
      avgHoldingTimeMinutes
    }
  }, [trades])

  // Charts Data Preparation
  const chartData = useMemo(() => {
    // 1. P&L by Day of Week
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayStats: any = {}
    daysOfWeek.forEach(day => dayStats[day] = { pnl: 0, trades: 0, wins: 0 })

    trades.forEach(t => {
      if (t.entryTime && t.pnlNet) {
        const date = new Date(t.entryTime)
        if (!isNaN(date.getTime())) {
          const day = daysOfWeek[date.getDay()]
          if (dayStats[day]) {
            dayStats[day].pnl += t.pnlNet
            dayStats[day].trades += 1
            if (t.pnlNet > 0) dayStats[day].wins += 1
          }
        }
      }
    })

    const dayChartData = daysOfWeek
      .filter(d => dayStats[d].trades > 0)
      .map(day => ({
        name: day.slice(0, 3),
        pnl: dayStats[day].pnl,
        winRate: (dayStats[day].wins / dayStats[day].trades) * 100
      }))

    // 2. Hourly Performance
    const hourlyMap: Record<number, { pnl: number; trades: number }> = {}
    for (let i = 0; i < 24; i++) hourlyMap[i] = { pnl: 0, trades: 0 }

    trades.forEach(t => {
      if (t.entryTime && t.pnlNet) {
        const date = new Date(t.entryTime)
        if (!isNaN(date.getTime())) {
          const hour = date.getHours()
          if (hourlyMap[hour]) {
            hourlyMap[hour].pnl += t.pnlNet
            hourlyMap[hour].trades += 1
          }
        }
      }
    })

    const hourlyChartData = Object.entries(hourlyMap)
      .filter(([_, data]) => data.trades > 0)
      .map(([hour, data]) => ({
        hour: `${hour}:00`,
        pnl: data.pnl
      }))

    // 3. Asset Performance (Pie)
    const assetMap: Record<string, number> = {}

    trades.forEach(t => {
      if (t.pnlNet && t.pnlNet > 0) {
        assetMap[t.symbol] = (assetMap[t.symbol] || 0) + t.pnlNet
      }
    })

    const assetPieData = Object.entries(assetMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5) // Top 5

    return {
      dayChartData,
      hourlyChartData,
      assetPieData
    }
  }, [trades])

  const selectedAccount = selectedAccountId === 'all'
    ? null
    : accounts.find(a => a.id === selectedAccountId)


  const handleAiAnalysis = async () => {
    setAiLoading(true)
    setAiReview(null)
    try {
      const result = await generatePerformanceReview({
        stats: {
          winRate: stats.winRate,
          profitFactor: stats.profitFactor,
          totalPnl: stats.totalPnl,
          avgWin: stats.avgWin,
          avgLoss: stats.avgLoss,
          maxDrawdown: stats.maxDrawdown,
          expectancy: stats.expectancy
        },
        dailyStats: chartData.dayChartData.map(d => ({
          day: d.name,
          pnl: d.pnl,
          winRate: d.winRate
        })),
        hourlyStats: chartData.hourlyChartData.map(h => ({
          hour: h.hour,
          pnl: h.pnl
        })),
        topAssets: chartData.assetPieData
      })
      setAiReview(result.review)
    } catch (error) {
      console.error('AI Analysis failed', error)
      alert('Failed to generate AI analysis. Please check your API key or try again later.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64">
        <Header
          onAddTradeClick={() => window.location.href = '/'}
        />

        {/* Analytics Header */}
        <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Advanced Analytics</h2>
              <p className="text-sm text-dark-500">Comprehensive performance analysis</p>
            </div>
            <div className="flex items-center gap-3">
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
                    <div className="fixed inset-0 z-10" onClick={() => setShowAccountDropdown(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-dark-900 border border-dark-700 rounded-xl shadow-xl z-20">
                      <div className="p-2">
                        <button
                          onClick={() => { setSelectedAccountId('all'); setShowAccountDropdown(false) }}
                          className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', selectedAccountId === 'all' ? 'bg-primary/20 text-primary' : 'text-dark-300 hover:bg-dark-800')}
                        >
                          All Accounts
                        </button>
                        {accounts.map(account => (
                          <button
                            key={account.id}
                            onClick={() => { setSelectedAccountId(account.id!); setShowAccountDropdown(false) }}
                            className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', selectedAccountId === account.id ? 'bg-primary/20 text-primary' : 'text-dark-300 hover:bg-dark-800')}
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
          <div className="flex h-[calc(100vh-100px)] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-dark-500">Crunching numbers...</p>
            </div>
          </div>
        ) : (
          <div className="p-8 space-y-8 max-w-[1600px] mx-auto">

            {/* AI Insights Section (New) */}
            <div className="bg-gradient-to-br from-primary-900/20 to-purple-900/10 rounded-2xl border border-primary-500/20 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-display font-semibold text-white flex items-center gap-2">
                    <Brain className="w-5 h-5 text-primary-400" />
                    AI Performance Coach
                  </h3>
                  <p className="text-sm text-dark-400 mt-1 max-w-2xl">
                    Get personalized insights based on your trade history, win rates, and habits.
                    The AI analyzes your best intervals, assets, and risk metrics to suggest improvements.
                  </p>
                </div>
                <button
                  onClick={handleAiAnalysis}
                  disabled={aiLoading || stats.totalTrades < 5}
                  className="btn-primary flex items-center gap-2"
                >
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {aiLoading ? 'Analyzing...' : 'Get AI Insights'}
                </button>
              </div>

              {stats.totalTrades < 5 && !aiReview && (
                <p className="text-xs text-warning mt-2">Need at least 5 closed trades to generate valid insights.</p>
              )}

              {aiReview && (
                <div className="mt-6 p-4 bg-dark-800/80 rounded-xl border border-primary-500/20 animate-in fade-in slide-in-from-top-4">
                  <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap font-sans">
                    {aiReview}
                  </div>
                </div>
              )}
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Net P&L */}
              <div className={cn("stat-card relative overflow-hidden", stats.totalPnl >= 0 ? "border-profit/20" : "border-loss/20")}>
                <div className="absolute right-0 top-0 p-4 opacity-10">
                  <Activity className="w-24 h-24" />
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="w-4 h-4 text-dark-400" />
                  <span className="text-dark-400 text-sm font-medium">Net P&L</span>
                </div>
                <div className={cn("text-3xl font-display font-bold", stats.totalPnl >= 0 ? "text-profit" : "text-loss")}>
                  {formatCurrency(stats.totalPnl)}
                </div>
                <div className="text-xs text-dark-500 mt-1">
                  from {stats.totalTrades} trades
                </div>
              </div>

              {/* Expectancy */}
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-primary-400" />
                  <span className="text-dark-400 text-sm font-medium">Expectancy</span>
                </div>
                <div className={cn("text-3xl font-display font-bold", stats.expectancy >= 0 ? "text-profit" : "text-loss")}>
                  {formatCurrency(stats.expectancy)}
                </div>
                <div className="text-xs text-dark-500 mt-1">
                  average value per trade
                </div>
              </div>

              {/* Profit Factor */}
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-accent-blue" />
                  <span className="text-dark-400 text-sm font-medium">Profit Factor</span>
                </div>
                <div className={cn("text-3xl font-display font-bold", stats.profitFactor >= 1.5 ? "text-profit" : stats.profitFactor >= 1 ? "text-warning" : "text-loss")}>
                  {stats.profitFactor.toFixed(2)}
                </div>
                <div className="text-xs text-dark-500 mt-1">
                  gross profit / gross loss
                </div>
              </div>

              {/* Max Drawdown */}
              <div className="stat-card">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-loss" />
                  <span className="text-dark-400 text-sm font-medium">Max Drawdown</span>
                </div>
                <div className="text-3xl font-display font-bold text-loss">
                  -{formatCurrency(stats.maxDrawdown)}
                </div>
                <div className="text-xs text-dark-500 mt-1">
                  peak-to-valley decline
                </div>
              </div>
            </div>

            {/* Secondary KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
                <p className="text-xs text-dark-500 mb-1">Win Rate</p>
                <p className={cn("text-xl font-bold", stats.winRate >= 50 ? "text-profit" : "text-loss")}>
                  {stats.winRate.toFixed(1)}%
                </p>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
                <p className="text-xs text-dark-500 mb-1">Avg Win</p>
                <p className="text-xl font-bold text-profit">{formatCurrency(stats.avgWin)}</p>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
                <p className="text-xs text-dark-500 mb-1">Avg Loss</p>
                <p className="text-xl font-bold text-loss">{formatCurrency(stats.avgLoss)}</p>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
                <p className="text-xs text-dark-500 mb-1">Best Streak</p>
                <p className="text-xl font-bold text-profit">+{stats.bestStreak}</p>
              </div>
              <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
                <p className="text-xs text-dark-500 mb-1">Worst Streak</p>
                <p className="text-xl font-bold text-loss">-{stats.worstStreak}</p>
              </div>
              {/* New Stat: Avg Holding Time */}
              <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700/50">
                <p className="text-xs text-dark-500 mb-1">Avg Holding Time</p>
                <p className="text-xl font-bold text-white">{stats.avgHoldingTimeMinutes}m</p>
              </div>
            </div>

            {/* Main Charts Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* Equity Curve (2/3 width) */}
              <div className="lg:col-span-2 chart-container p-6 min-h-[400px]">
                <h3 className="text-lg font-display font-semibold text-white mb-6 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary-400" />
                  Equity Curve
                </h3>
                {stats.equityCurve.length > 1 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={stats.equityCurve}>
                      <defs>
                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={COLORS.profit} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={COLORS.profit} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                      <XAxis
                        dataKey="date"
                        stroke={COLORS.text}
                        tickFormatter={(str) => {
                          try { return new Date(str).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) } catch (e) { return '' }
                        }}
                        minTickGap={30}
                      />
                      <YAxis stroke={COLORS.text} tickFormatter={(val) => `$${val}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: COLORS.dark, borderColor: COLORS.grid }}
                        labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        formatter={(value: number) => [formatCurrency(value), 'Equity']}
                      />
                      <Area
                        type="monotone"
                        dataKey="equity"
                        stroke={COLORS.profit}
                        fillOpacity={1}
                        fill="url(#colorEquity)"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-dark-500">
                    Not enough trades to display equity curve
                  </div>
                )}
              </div>

              {/* Profit Distribution (1/3 width) */}
              <div className="chart-container p-6 min-h-[400px]">
                <h3 className="text-lg font-display font-semibold text-white mb-6 flex items-center gap-2">
                  <PieChart className="w-5 h-5 text-accent-purple" />
                  Top Assets (Profits)
                </h3>
                {chartData.assetPieData.length > 0 ? (
                  <>
                    <div className="h-[200px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RechartsPie>
                          <Pie
                            data={chartData.assetPieData}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {chartData.assetPieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={[COLORS.profit, COLORS.primary, COLORS.purple, COLORS.warning][index % 4]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ backgroundColor: COLORS.dark, borderColor: COLORS.grid }}
                            formatter={(value: number) => formatCurrency(value)}
                          />
                        </RechartsPie>
                      </ResponsiveContainer>
                    </div>
                    {/* Legend */}
                    <div className="mt-4 space-y-3">
                      {chartData.assetPieData.map((entry, index) => (
                        <div key={entry.name} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: [COLORS.profit, COLORS.primary, COLORS.purple, COLORS.warning][index % 4] }} />
                            <span className="text-dark-300">{entry.name}</span>
                          </div>
                          <span className="text-white font-medium">{formatCurrency(entry.value)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-dark-500">
                    No profitable trades yet
                  </div>
                )}
              </div>
            </div>

            {/* Row 3: Daily & Hourly Analysis */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Daily Performance */}
              <div className="chart-container p-6">
                <h3 className="text-lg font-display font-semibold text-white mb-6 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent-blue" />
                  Performance by Day
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.dayChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                      <XAxis dataKey="name" stroke={COLORS.text} />
                      <YAxis stroke={COLORS.text} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: COLORS.dark, borderColor: COLORS.grid }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {chartData.dayChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? COLORS.profit : COLORS.loss} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Hourly Performance */}
              <div className="chart-container p-6">
                <h3 className="text-lg font-display font-semibold text-white mb-6 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-warning" />
                  Performance by Hour
                </h3>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.hourlyChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
                      <XAxis dataKey="hour" stroke={COLORS.text} />
                      <YAxis stroke={COLORS.text} />
                      <Tooltip
                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                        contentStyle={{ backgroundColor: COLORS.dark, borderColor: COLORS.grid }}
                        formatter={(value: number) => formatCurrency(value)}
                      />
                      <Bar dataKey="pnl" fill={COLORS.purple} radius={[4, 4, 0, 0]}>
                        {chartData.hourlyChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.pnl >= 0 ? COLORS.purple : COLORS.loss} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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
