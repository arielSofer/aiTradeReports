'use client'

import { useStore } from '@/lib/store'
import { formatCurrency, cn } from '@/lib/utils'

export function HourlyHeatmap() {
  const { hourlyStats } = useStore()

  // Create full 24-hour grid
  const hours = Array.from({ length: 24 }, (_, i) => {
    const stat = hourlyStats.find(s => s.hour === i)
    return {
      hour: i,
      trades: stat?.trades || 0,
      wins: stat?.wins || 0,
      pnl: stat?.pnl || 0,
      winRate: stat?.winRate || 0,
    }
  })

  // Show standard trading hours (9-16) AND any other hours with activity
  const tradingHours = hours.filter(h => (h.hour >= 9 && h.hour <= 16) || h.trades > 0)

  // Calculate max P&L for color intensity
  const maxPnl = Math.max(...tradingHours.map(h => Math.abs(h.pnl)))

  const getColor = (pnl: number) => {
    if (pnl === 0) return 'bg-dark-800/50'
    const intensity = Math.min(Math.abs(pnl) / maxPnl, 1)
    if (pnl > 0) {
      return `bg-profit/${Math.round(20 + intensity * 30)}`
    }
    return `bg-loss/${Math.round(20 + intensity * 30)}`
  }

  const formatHour = (hour: number) => {
    if (hour === 0) return '12am'
    if (hour === 12) return '12pm'
    if (hour < 12) return `${hour}am`
    return `${hour - 12}pm`
  }

  return (
    <div className="chart-container h-full flex flex-col">
      <div className="p-4 border-b border-dark-800/50">
        <h3 className="text-lg font-display font-semibold text-white">Hourly Performance</h3>
        <p className="text-sm text-dark-500">P&L by time of day</p>
      </div>

      <div className="p-4 space-y-2 flex-1 overflow-y-auto">
        {tradingHours.map((hour) => (
          <div
            key={hour.hour}
            className="flex items-center gap-3 group"
          >
            {/* Hour label */}
            <span className="w-12 text-xs text-dark-500 font-mono">
              {formatHour(hour.hour)}
            </span>

            {/* Bar */}
            <div className="flex-1 h-8 rounded-md overflow-hidden bg-dark-800/30">
              {hour.trades > 0 && (
                <div
                  className={cn(
                    'h-full flex items-center px-2 transition-all duration-300',
                    hour.pnl >= 0 ? 'bg-profit/30' : 'bg-loss/30',
                    'group-hover:bg-opacity-50'
                  )}
                  style={{
                    width: `${Math.max((Math.abs(hour.pnl) / maxPnl) * 100, 20)}%`
                  }}
                >
                  <span className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    hour.pnl >= 0 ? 'text-profit' : 'text-loss'
                  )}>
                    {formatCurrency(hour.pnl)}
                  </span>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="w-24 text-right">
              {hour.trades > 0 ? (
                <div className="text-xs">
                  <span className="text-dark-400">{hour.trades}T</span>
                  <span className="text-dark-600 mx-1">·</span>
                  <span className={hour.winRate >= 50 ? 'text-profit' : 'text-loss'}>
                    {hour.winRate.toFixed(0)}%
                  </span>
                </div>
              ) : (
                <span className="text-xs text-dark-600">—</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="p-4 border-t border-dark-800/50">
        <div className="flex items-center justify-between text-xs text-dark-500">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-profit/40" />
            <span>Profitable</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-loss/40" />
            <span>Losing</span>
          </div>
        </div>
      </div>
    </div>
  )
}





