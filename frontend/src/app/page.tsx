'use client'
// Trigger Vercel Redeploy - Update 2

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { StatsOverview } from '@/components/StatsOverview'
import { EquityCurve } from '@/components/EquityCurve'
import { TradesTable } from '@/components/TradesTable'
import { HourlyHeatmap } from '@/components/HourlyHeatmap'
import { TradingCalendar } from '@/components/TradingCalendar'
import { EconomicCalendar } from '@/components/EconomicCalendar'
import { AddTradeModal, TradeFormData } from '@/components/AddTradeModal'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AccountSelector } from '@/components/AccountSelector'
import { TagFilter } from '@/components/TagFilter'
import { useStore } from '@/lib/store'
import { useAuth } from '@/contexts/AuthContext'
import { getTrades, calculateStats, createTrade, getAccounts, FirestoreAccount } from '@/lib/firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { ChevronDown, Wallet } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { cn, getLocalDateKey } from '@/lib/utils'

function DashboardContent() {
  const router = useRouter()
  const [showAddTrade, setShowAddTrade] = useState(false)
  const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | 'all'>('all')
  const [debouncedAccountId, setDebouncedAccountId] = useState<string | 'all'>('all')
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  // Search state
  const [searchQuery, setSearchQuery] = useState('')

  const { user } = useAuth()
  const { trades, stats, setTrades, setStats, setDailyPnL, setHourlyStats, isSidebarCollapsed, selectedTags, setSelectedTags } = useStore()

  const refreshData = useCallback(() => setRefreshKey(prev => prev + 1), [])

  // Debounce account selection for better performance
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAccountId(selectedAccountId)
    }, 300)
    return () => clearTimeout(timer)
  }, [selectedAccountId])

  // Load accounts on mount
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

  useEffect(() => {
    // Load data from Firebase - start empty for new users
    const loadData = async () => {
      if (user) {
        setIsLoading(true)
        try {
          // Load from Firebase - filter by account if selected
          // Limit to last 1000 trades for performance
          const accountIdFilter = debouncedAccountId === 'all' ? undefined : debouncedAccountId
          const firestoreTrades = await getTrades(user.uid, {
            accountId: accountIdFilter,
            limitCount: 1000 // Limit for performance
          })

          // Convert Firestore trades to our format
          const convertedTrades = firestoreTrades.map(t => {
            const account = accounts.find(a => a.id === t.accountId)
            return {
              id: t.id || 'temp-' + Math.random(),
              userId: t.userId,
              accountId: t.accountId,
              accountName: account?.name || '',
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
              durationMinutes: undefined,
              tags: t.tags || [],
              notes: t.notes,
              // New fields
              checklistCompleted: t.checklistCompleted,
              manualSL: t.manualSL,
              manualTP: t.manualTP,
              riskRewardRatio: t.riskRewardRatio,
            }
          })

          setTrades(convertedTrades)

          // Calculate stats from trades - filter by account if selected
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

          // Generate daily P&L from trades
          const dailyPnLMap: Record<string, { pnl: number; trades: number; winners: number; losers: number }> = {}
          convertedTrades.forEach(trade => {
            if (trade.pnlNet !== undefined && trade.entryTime) {
              const date = getLocalDateKey(trade.entryTime)
              if (!dailyPnLMap[date]) {
                dailyPnLMap[date] = { pnl: 0, trades: 0, winners: 0, losers: 0 }
              }
              dailyPnLMap[date].pnl += trade.pnlNet
              dailyPnLMap[date].trades += 1
              if (trade.pnlNet > 0) dailyPnLMap[date].winners += 1
              else if (trade.pnlNet < 0) dailyPnLMap[date].losers += 1
            }
          })

          const sortedDates = Object.keys(dailyPnLMap).sort()
          let cumulative = 0
          const dailyPnLData = sortedDates.map(date => {
            const dayData = dailyPnLMap[date]
            cumulative += dayData.pnl
            return {
              date,
              pnl: dayData.pnl,
              cumulativePnl: cumulative,
              tradesCount: dayData.trades,
              winners: dayData.winners,
              losers: dayData.losers
            }
          })
          setDailyPnL(dailyPnLData)

          // Generate hourly stats from trades
          const hourlyMap: Record<number, { pnl: number; trades: number; wins: number }> = {}
          for (let h = 0; h < 24; h++) {
            hourlyMap[h] = { pnl: 0, trades: 0, wins: 0 }
          }
          convertedTrades.forEach(trade => {
            if (trade.entryTime && trade.pnlNet !== undefined) {
              const hour = new Date(trade.entryTime).getHours()
              hourlyMap[hour].pnl += trade.pnlNet
              hourlyMap[hour].trades += 1
              if (trade.pnlNet > 0) hourlyMap[hour].wins += 1
            }
          })

          const hourlyStatsData = Object.entries(hourlyMap).map(([hour, data]) => ({
            hour: parseInt(hour),
            pnl: data.pnl,
            trades: data.trades,
            wins: data.wins,
            winRate: data.trades > 0 ? (data.wins / data.trades) * 100 : 0
          }))
          setHourlyStats(hourlyStatsData)

        } catch (error) {
          console.error('Error loading data:', error)
          // Start with empty data on error
          setTrades([])
          setStats({
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
          setDailyPnL([])
          setHourlyStats([])
        } finally {
          setIsLoading(false)
        }
      } else {
        // No user - start with empty data
        setTrades([])
        setStats({
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
        setDailyPnL([])
        setHourlyStats([])
        setIsLoading(false)
      }
    }

    loadData()
  }, [user, debouncedAccountId, refreshKey, setTrades, setStats, setDailyPnL, setHourlyStats])

  const handleAddTrade = async (data: TradeFormData) => {
    if (!user) return

    try {
      // Save to Firebase
      const newTradeId = await createTrade(user.uid, 'default', {
        symbol: data.symbol.toUpperCase(),
        direction: data.direction,
        status: data.exitPrice ? 'closed' : 'open',
        assetType: 'stock',
        entryTime: Timestamp.fromDate(new Date(data.entryTime)),
        exitTime: data.exitTime ? Timestamp.fromDate(new Date(data.exitTime)) : undefined,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice,
        quantity: data.quantity,
        commission: data.commission,
        stopLoss: data.stopLoss,
        takeProfit: data.takeProfit,
        tags: data.tags || [],
        notes: data.notes || undefined,
      })

      // Add to local state
      const newTrade = {
        id: newTradeId,
        userId: user.uid,
        symbol: data.symbol.toUpperCase(),
        direction: data.direction,
        status: data.exitPrice ? 'closed' as const : 'open' as const,
        entryTime: data.entryTime,
        exitTime: data.exitTime || undefined,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice,
        quantity: data.quantity,
        commission: data.commission,
        pnlNet: data.exitPrice
          ? (data.direction === 'long'
            ? (data.exitPrice - data.entryPrice) * data.quantity - data.commission
            : (data.entryPrice - data.exitPrice) * data.quantity - data.commission)
          : undefined,
        pnlPercent: data.exitPrice
          ? ((data.direction === 'long'
            ? (data.exitPrice - data.entryPrice)
            : (data.entryPrice - data.exitPrice)) / data.entryPrice) * 100
          : undefined,
        isWinner: data.exitPrice
          ? (data.direction === 'long'
            ? data.exitPrice > data.entryPrice
            : data.exitPrice < data.entryPrice)
          : undefined,
        durationMinutes: data.exitTime && data.entryTime
          ? Math.round((new Date(data.exitTime).getTime() - new Date(data.entryTime).getTime()) / 60000)
          : undefined,
        tags: data.tags || [],
        notes: data.notes || undefined,
      }

      setTrades([newTrade, ...trades])
    } catch (error) {
      console.error('Error adding trade:', error)
      throw error
    }
  }

  // Filter trades based on search query
  const filteredTrades = useMemo(() => {
    if (!searchQuery.trim()) return trades
    const query = searchQuery.toLowerCase()
    return trades.filter(t =>
      t.symbol.toLowerCase().includes(query) ||
      t.notes?.toLowerCase().includes(query) ||
      t.tags?.some(tag => tag.toLowerCase().includes(query))
    )
  }, [trades, searchQuery])

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className={cn(
        "flex-1 transition-all duration-300 ease-in-out",
        "ml-0", // Mobile default
        isSidebarCollapsed ? "md:ml-28" : "md:ml-72"
      )}>
        <Header
          onAddTradeClick={() => document.getElementById('add-trade-trigger')?.click()}
          onSearch={setSearchQuery}
        />

        <div className="p-6 space-y-6">
          {/* Account Selector */}
          <div className="flex items-center justify-between">
            <AccountSelector
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              onChange={(id) => setSelectedAccountId(id)}
              label="Showing statistics for"
            />
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                <p className="text-dark-500">Loading data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Stats Overview */}
              <StatsOverview stats={stats} />

              {/* Calendar and Equity Curve Row */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Trading Calendar */}
                <TradingCalendar />

                {/* Equity Curve */}
                <EquityCurve />
              </div>

              {/* Economic Calendar and Hourly Heatmap */}
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {/* Economic Calendar */}
                <EconomicCalendar />

                {/* Hourly Heatmap */}
                <HourlyHeatmap />
              </div>

              {/* Trades Table - Limit to 100 most recent for performance */}
              <TradesTable trades={filteredTrades.slice(0, 100)} onTradeDeleted={refreshData} />
            </>
          )}
        </div>
      </main>

      {/* Add Trade Modal */}
      <AddTradeModal
        isOpen={showAddTrade}
        onClose={() => setShowAddTrade(false)}
        onSubmit={handleAddTrade}
      />
    </div>
  )
}

export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}
