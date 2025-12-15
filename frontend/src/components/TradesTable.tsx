'use client'

import { useState } from 'react'
import {
  ArrowUpRight,
  ArrowDownRight,
  ChevronUp,
  ChevronDown,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  BarChart3,
  X,
  Loader2,
  AlertTriangle,
  Sparkles
} from 'lucide-react'
import { Trade } from '@/lib/store'
import { formatCurrency, formatDateTime, formatDuration, cn } from '@/lib/utils'
import { TradeChartViewer } from './TradeChartViewer'
import { deleteTrade } from '@/lib/firebase/firestore'
import { AITradeReviewModal } from './AITradeReviewModal'
import { TradeDetailsModal } from './TradeDetailsModal'

interface TradesTableProps {
  trades: Trade[]
  onTradeDeleted?: () => void
}

type SortField = 'entryTime' | 'symbol' | 'pnlNet' | 'pnlPercent'
type SortDirection = 'asc' | 'desc'

export function TradesTable({ trades, onTradeDeleted }: TradesTableProps) {
  const [sortField, setSortField] = useState<SortField>('entryTime')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedTrade, setSelectedTrade] = useState<string | null>(null)
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null)
  const [isChartFullScreen, setIsChartFullScreen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [aiReviewTrade, setAiReviewTrade] = useState<Trade | null>(null)
  const [detailsTrade, setDetailsTrade] = useState<Trade | null>(null)

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const handleDelete = async (tradeId: string) => {
    setIsDeleting(true)
    try {
      await deleteTrade(tradeId)
      setDeleteConfirm(null)
      if (onTradeDeleted) {
        onTradeDeleted()
      }
    } catch (error) {
      console.error('Error deleting trade:', error)
      alert('שגיאה במחיקת העסקה')
    } finally {
      setIsDeleting(false)
    }
  }

  const sortedTrades = [...trades].sort((a, b) => {
    let aVal = a[sortField]
    let bVal = b[sortField]

    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase()
      bVal = (bVal as string).toLowerCase()
    }

    if (sortDirection === 'asc') {
      return aVal! > bVal! ? 1 : -1
    }
    return aVal! < bVal! ? 1 : -1
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ?
      <ChevronUp className="w-3 h-3" /> :
      <ChevronDown className="w-3 h-3" />
  }

  return (
    <div className="space-y-4">
      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-md bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-loss/20 rounded-full">
                <AlertTriangle className="w-6 h-6 text-loss" />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-white">מחיקת עסקה</h3>
                <p className="text-sm text-dark-400">האם אתה בטוח שברצונך למחוק עסקה זו?</p>
              </div>
            </div>
            <p className="text-dark-300 mb-6">פעולה זו לא ניתנת לביטול.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="btn-secondary"
                disabled={isDeleting}
              >
                ביטול
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="px-4 py-2 bg-loss text-white rounded-lg hover:bg-loss/80 transition-colors flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    מוחק...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    מחק
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Full Screen Chart Modal */}
      {isChartFullScreen && expandedTradeId && (
        <div className="fixed inset-0 z-50 bg-black/80 p-4">
          <TradeChartViewer
            trade={trades.find(t => t.id === expandedTradeId)!}
            onClose={() => setIsChartFullScreen(false)}
            isFullScreen={true}
            onToggleFullScreen={() => setIsChartFullScreen(false)}
          />
        </div>
      )}

      <div className="chart-container">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-800/50">
          <div>
            <h3 className="text-lg font-display font-semibold text-white">Recent Trades</h3>
            <p className="text-sm text-dark-500">{trades.length} trades</p>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 
                             text-dark-300 rounded-lg text-sm border border-dark-700 transition-colors">
              <Filter className="w-4 h-4" />
              Filter
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-dark-800/50 text-left">
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('entryTime')}
                    className="flex items-center gap-1 hover:text-dark-300 transition-colors"
                  >
                    Date/Time
                    <SortIcon field="entryTime" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('symbol')}
                    className="flex items-center gap-1 hover:text-dark-300 transition-colors"
                  >
                    Symbol
                    <SortIcon field="symbol" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  Direction
                </th>
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  Entry / Exit
                </th>
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  <button
                    onClick={() => handleSort('pnlNet')}
                    className="flex items-center gap-1 hover:text-dark-300 transition-colors"
                  >
                    P&L
                    <SortIcon field="pnlNet" />
                  </button>
                </th>
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  Duration
                </th>
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  Tags
                </th>
                <th className="px-4 py-3 text-xs font-medium text-dark-500 uppercase tracking-wider">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTrades.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center">
                        <Filter className="w-8 h-8 text-dark-600" />
                      </div>
                      <div>
                        <p className="text-dark-400 font-medium">No trades yet</p>
                        <p className="text-sm text-dark-500">Add your first trade or import from your broker</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : sortedTrades.map((trade, index) => {
                const isExpanded = expandedTradeId === trade.id;

                return (
                  <>
                    <tr
                      key={trade.id}
                      className={cn(
                        'table-row cursor-pointer transition-colors',
                        (selectedTrade === trade.id || isExpanded) ? 'bg-dark-800/50' : 'hover:bg-dark-800/30',
                        isExpanded && 'border-b-0'
                      )}
                      onClick={() => setSelectedTrade(trade.id)}
                    >
                      {/* Date/Time */}
                      <td className="px-4 py-3">
                        <div className="text-sm text-dark-200">{formatDateTime(trade.entryTime)}</div>
                      </td>

                      {/* Symbol */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold',
                            trade.isWinner ? 'bg-profit/20 text-profit' : 'bg-loss/20 text-loss'
                          )}>
                            {trade.symbol.slice(0, 2)}
                          </div>
                          <span className="font-medium text-white">{trade.symbol}</span>
                        </div>
                      </td>

                      {/* Direction */}
                      <td className="px-4 py-3">
                        <div className={cn(
                          'inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium',
                          trade.direction === 'long'
                            ? 'bg-accent-blue/20 text-accent-blue'
                            : 'bg-accent-orange/20 text-accent-orange'
                        )}>
                          {trade.direction === 'long' ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {trade.direction.toUpperCase()}
                        </div>
                      </td>

                      {/* Entry / Exit */}
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          {trade.entryPrice > 0 ? (
                            <>
                              <div className="text-dark-300">
                                ${trade.entryPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </div>
                              {trade.exitPrice && trade.exitPrice > 0 && (
                                <div className="text-dark-500">
                                  → ${trade.exitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              )}
                            </>
                          ) : (
                            <span className="text-dark-500 italic">N/A</span>
                          )}
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-dark-300">{trade.quantity}</span>
                      </td>

                      {/* P&L */}
                      <td className="px-4 py-3">
                        {trade.pnlNet !== undefined && (
                          <div>
                            <div className={cn(
                              'text-sm font-medium',
                              trade.pnlNet >= 0 ? 'text-profit' : 'text-loss'
                            )}>
                              {trade.pnlNet >= 0 ? '+' : ''}{formatCurrency(trade.pnlNet)}
                            </div>
                            {trade.pnlPercent !== undefined && trade.pnlPercent !== 0 && (
                              <div className={cn(
                                'text-xs',
                                trade.pnlPercent >= 0 ? 'text-profit/70' : 'text-loss/70'
                              )}>
                                {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-dark-400">
                          {trade.durationMinutes ? formatDuration(trade.durationMinutes) : '—'}
                        </span>
                      </td>

                      {/* Tags */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {trade.tags.slice(0, 2).map(tag => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-dark-700 text-dark-300 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                          {trade.tags.length > 2 && (
                            <span className="px-2 py-0.5 bg-dark-700 text-dark-400 rounded text-xs">
                              +{trade.tags.length - 2}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedTradeId(isExpanded ? null : trade.id)
                            }}
                            className={cn(
                              "p-1.5 rounded transition-colors group/btn",
                              isExpanded ? "bg-primary/20" : "hover:bg-primary/20"
                            )}
                            title="הצג על גרף"
                          >
                            <BarChart3 className={cn(
                              "w-4 h-4 group-hover/btn:text-primary",
                              isExpanded ? "text-primary" : "text-dark-400"
                            )} />
                          </button>
                          {trade.status === 'closed' && trade.exitTime && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setAiReviewTrade(trade)
                              }}
                              className="p-1.5 hover:bg-purple-500/20 rounded transition-colors group/ai"
                              title="סקירת AI"
                            >
                              <Sparkles className="w-4 h-4 text-dark-400 group-hover/ai:text-purple-400" />
                            </button>
                          )}
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 hover:bg-dark-700 rounded transition-colors"
                            title="צפה"
                          >
                            <Eye className="w-4 h-4 text-dark-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDetailsTrade(trade)
                            }}
                            className="p-1.5 hover:bg-dark-700 rounded transition-colors"
                            title="ערוך"
                          >
                            <Edit className="w-4 h-4 text-dark-400" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteConfirm(String(trade.id))
                            }}
                            className="p-1.5 hover:bg-loss/20 rounded transition-colors group/del"
                            title="מחק"
                          >
                            <Trash2 className="w-4 h-4 text-dark-400 group-hover/del:text-loss" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-dark-800/30">
                        <td colSpan={9} className="p-4 border-t border-dark-700/50">
                          <TradeChartViewer
                            trade={trade}
                            onClose={() => setExpandedTradeId(null)}
                            isFullScreen={false}
                            onToggleFullScreen={() => setIsChartFullScreen(true)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-dark-800/50 text-sm text-dark-500">
          <div>Showing {trades.length} trades</div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1 hover:bg-dark-800 rounded transition-colors">Previous</button>
            <button className="px-3 py-1 hover:bg-dark-800 rounded transition-colors">Next</button>
          </div>
        </div>
      </div>

      {/* AI Review Modal */}
      {aiReviewTrade && (
        <AITradeReviewModal
          isOpen={!!aiReviewTrade}
          onClose={() => setAiReviewTrade(null)}
          trade={aiReviewTrade}
        />
      )}

      {/* Trade Details Modal */}
      {detailsTrade && (
        <TradeDetailsModal
          isOpen={!!detailsTrade}
          onClose={() => setDetailsTrade(null)}
          trade={detailsTrade}
          onSave={(updatedTrade) => {
            setDetailsTrade(null)
            if (onTradeDeleted) {
              onTradeDeleted()
            }
          }}
        />
      )}
    </div>
  )
}
