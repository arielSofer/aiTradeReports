'use client'

import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Activity,
  Zap,
  BarChart2,
  DollarSign,
  Percent
} from 'lucide-react'
import { formatCurrency, formatPercent, cn } from '@/lib/utils'
import { Stats } from '@/lib/store'

interface StatsOverviewProps {
  stats: Stats | null
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  if (!stats) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card animate-pulse">
            <div className="h-4 bg-dark-700 rounded w-24 mb-2" />
            <div className="h-8 bg-dark-700 rounded w-32" />
          </div>
        ))}
      </div>
    )
  }

  const cards = [
    {
      label: 'Total P&L',
      value: formatCurrency(stats.totalPnl),
      change: formatPercent((stats.totalPnl / 10000) * 100),
      positive: stats.totalPnl >= 0,
      icon: DollarSign,
      color: stats.totalPnl >= 0 ? 'text-profit' : 'text-loss',
      bgColor: stats.totalPnl >= 0 ? 'bg-profit/10' : 'bg-loss/10',
    },
    {
      label: 'Win Rate',
      value: `${stats.winRate.toFixed(1)}%`,
      subValue: `${stats.winningTrades}W / ${stats.losingTrades}L`,
      icon: Target,
      color: stats.winRate >= 50 ? 'text-profit' : 'text-loss',
      bgColor: stats.winRate >= 50 ? 'bg-profit/10' : 'bg-loss/10',
    },
    {
      label: 'Profit Factor',
      value: stats.profitFactor.toFixed(2),
      subValue: stats.profitFactor >= 2 ? 'Excellent' : stats.profitFactor >= 1.5 ? 'Good' : 'Needs work',
      icon: Activity,
      color: stats.profitFactor >= 1.5 ? 'text-profit' : 'text-loss',
      bgColor: stats.profitFactor >= 1.5 ? 'bg-profit/10' : 'bg-loss/10',
    },
    {
      label: 'Current Streak',
      value: `${stats.currentStreak > 0 ? '+' : ''}${stats.currentStreak}`,
      subValue: `Best: ${stats.bestStreak} | Worst: ${stats.worstStreak}`,
      icon: Zap,
      color: stats.currentStreak > 0 ? 'text-profit' : stats.currentStreak < 0 ? 'text-loss' : 'text-dark-400',
      bgColor: stats.currentStreak > 0 ? 'bg-profit/10' : stats.currentStreak < 0 ? 'bg-loss/10' : 'bg-dark-700',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <div 
            key={card.label}
            className="stat-card animate-slide-up"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn('p-2 rounded-lg', card.bgColor)}>
                <Icon className={cn('w-5 h-5', card.color)} />
              </div>
              {card.change && (
                <div className={cn(
                  'flex items-center gap-1 text-xs font-medium',
                  card.positive ? 'text-profit' : 'text-loss'
                )}>
                  {card.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {card.change}
                </div>
              )}
            </div>
            
            <p className="text-dark-500 text-sm mb-1">{card.label}</p>
            <p className={cn('text-2xl font-bold', card.color)}>{card.value}</p>
            
            {card.subValue && (
              <p className="text-xs text-dark-500 mt-1">{card.subValue}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Additional mini stats
export function MiniStats({ stats }: StatsOverviewProps) {
  if (!stats) return null

  const items = [
    { label: 'Total Trades', value: stats.totalTrades },
    { label: 'Avg Winner', value: formatCurrency(stats.avgWinner), color: 'text-profit' },
    { label: 'Avg Loser', value: formatCurrency(stats.avgLoser), color: 'text-loss' },
    { label: 'Largest Win', value: formatCurrency(stats.largestWinner), color: 'text-profit' },
    { label: 'Largest Loss', value: formatCurrency(stats.largestLoser), color: 'text-loss' },
    { label: 'Commission', value: formatCurrency(stats.totalCommission) },
  ]

  return (
    <div className="flex flex-wrap gap-6 p-4 bg-dark-900/30 rounded-lg border border-dark-800/50">
      {items.map((item) => (
        <div key={item.label} className="text-center">
          <p className="text-xs text-dark-500 mb-1">{item.label}</p>
          <p className={cn('text-sm font-medium', item.color || 'text-dark-200')}>{item.value}</p>
        </div>
      ))}
    </div>
  )
}





