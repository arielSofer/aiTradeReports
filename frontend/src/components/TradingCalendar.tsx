'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useStore } from '@/lib/store'
import { formatCurrency, cn } from '@/lib/utils'

interface DayData {
  date: Date
  pnl: number
  tradesCount: number
  isCurrentMonth: boolean
  isToday: boolean
}

export function TradingCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const { trades } = useStore()

  // Group trades by date and calculate daily P&L
  const tradesByDate = useMemo(() => {
    const grouped: Record<string, { pnl: number; count: number }> = {}
    
    trades.forEach(trade => {
      if (trade.entryTime && trade.pnlNet !== undefined) {
        const dateKey = trade.entryTime.split('T')[0]
        if (!grouped[dateKey]) {
          grouped[dateKey] = { pnl: 0, count: 0 }
        }
        grouped[dateKey].pnl += trade.pnlNet
        grouped[dateKey].count += 1
      }
    })
    
    return grouped
  }, [trades])

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    const firstDayOfMonth = new Date(year, month, 1)
    const lastDayOfMonth = new Date(year, month + 1, 0)
    
    const startDay = firstDayOfMonth.getDay()
    const daysInMonth = lastDayOfMonth.getDate()
    
    const days: DayData[] = []
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Previous month days
    const prevMonth = new Date(year, month, 0)
    const prevMonthDays = prevMonth.getDate()
    
    for (let i = startDay - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthDays - i)
      const dateKey = date.toISOString().split('T')[0]
      const dayData = tradesByDate[dateKey]
      
      days.push({
        date,
        pnl: dayData?.pnl || 0,
        tradesCount: dayData?.count || 0,
        isCurrentMonth: false,
        isToday: false
      })
    }
    
    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day)
      const dateKey = date.toISOString().split('T')[0]
      const dayData = tradesByDate[dateKey]
      
      days.push({
        date,
        pnl: dayData?.pnl || 0,
        tradesCount: dayData?.count || 0,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime()
      })
    }
    
    // Next month days (fill to complete 6 rows = 42 days)
    const remainingDays = 42 - days.length
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day)
      const dateKey = date.toISOString().split('T')[0]
      const dayData = tradesByDate[dateKey]
      
      days.push({
        date,
        pnl: dayData?.pnl || 0,
        tradesCount: dayData?.count || 0,
        isCurrentMonth: false,
        isToday: false
      })
    }
    
    return days
  }, [currentDate, tradesByDate])

  // Monthly stats
  const monthlyStats = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    
    let totalPnl = 0
    let tradingDays = 0
    let winningDays = 0
    let losingDays = 0
    
    calendarDays.forEach(day => {
      if (day.isCurrentMonth && day.tradesCount > 0) {
        totalPnl += day.pnl
        tradingDays++
        if (day.pnl > 0) winningDays++
        else if (day.pnl < 0) losingDays++
      }
    })
    
    return { totalPnl, tradingDays, winningDays, losingDays }
  }, [calendarDays, currentDate])

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  const monthName = currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })

  const getDayBgColor = (day: DayData) => {
    if (!day.isCurrentMonth) return 'bg-dark-900/30'
    if (day.tradesCount === 0) return 'bg-dark-800/50 hover:bg-dark-800'
    if (day.pnl > 0) return 'bg-profit/20 hover:bg-profit/30'
    if (day.pnl < 0) return 'bg-loss/20 hover:bg-loss/30'
    return 'bg-dark-700/50 hover:bg-dark-700'
  }

  const getPnlTextColor = (pnl: number) => {
    if (pnl > 0) return 'text-profit'
    if (pnl < 0) return 'text-loss'
    return 'text-dark-500'
  }

  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800/50">
        <div>
          <h3 className="text-lg font-display font-semibold text-white">Trading Calendar</h3>
          <p className="text-sm text-dark-500">Daily P&L overview</p>
        </div>
        
        {/* Monthly Stats */}
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className={cn('font-bold', getPnlTextColor(monthlyStats.totalPnl))}>
              {monthlyStats.totalPnl >= 0 ? '+' : ''}{formatCurrency(monthlyStats.totalPnl)}
            </p>
            <p className="text-xs text-dark-500">Month P&L</p>
          </div>
          <div className="h-8 w-px bg-dark-700" />
          <div className="flex gap-3 text-xs">
            <span className="text-profit">{monthlyStats.winningDays}W</span>
            <span className="text-loss">{monthlyStats.losingDays}L</span>
            <span className="text-dark-400">{monthlyStats.tradingDays}D</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-800/50">
        <button 
          onClick={prevMonth}
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ChevronLeft className="w-5 h-5 text-dark-400" />
        </button>
        
        <div className="flex items-center gap-3">
          <h4 className="text-lg font-semibold text-white">{monthName}</h4>
          <button 
            onClick={goToToday}
            className="px-2 py-1 text-xs bg-dark-800 hover:bg-dark-700 text-dark-300 rounded transition-colors"
          >
            Today
          </button>
        </div>
        
        <button 
          onClick={nextMonth}
          className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
        >
          <ChevronRight className="w-5 h-5 text-dark-400" />
        </button>
      </div>

      {/* Days of Week */}
      <div className="grid grid-cols-7 border-b border-dark-800/50">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
          <div 
            key={day} 
            className="py-2 text-center text-xs font-medium text-dark-500 uppercase tracking-wider"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((day, idx) => (
          <div
            key={idx}
            className={cn(
              'min-h-[80px] p-2 border-b border-r border-dark-800/30 transition-colors cursor-pointer',
              getDayBgColor(day),
              day.isToday && 'ring-2 ring-primary-500 ring-inset',
              !day.isCurrentMonth && 'opacity-40'
            )}
          >
            {/* Day Number */}
            <div className="flex items-center justify-between mb-1">
              <span className={cn(
                'text-sm font-medium',
                day.isToday ? 'text-primary-400' : day.isCurrentMonth ? 'text-dark-300' : 'text-dark-600'
              )}>
                {day.date.getDate()}
              </span>
              {day.tradesCount > 0 && (
                <span className="text-xs text-dark-500">
                  {day.tradesCount}T
                </span>
              )}
            </div>
            
            {/* P&L Display */}
            {day.tradesCount > 0 && (
              <div className={cn(
                'text-sm font-bold',
                getPnlTextColor(day.pnl)
              )}>
                {day.pnl >= 0 ? '+' : ''}{formatCurrency(day.pnl)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 p-3 border-t border-dark-800/50 text-xs text-dark-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-profit/30" />
          <span>Profit Day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-loss/30" />
          <span>Loss Day</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-dark-700" />
          <span>No Trades</span>
        </div>
      </div>
    </div>
  )
}





