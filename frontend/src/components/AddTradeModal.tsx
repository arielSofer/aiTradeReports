'use client'

import { useState } from 'react'
import { X, Plus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TradeDetailsModal } from './TradeDetailsModal'
import { Trade } from '@/lib/store'

interface AddTradeModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (trade: TradeFormData) => Promise<void>
}

export interface TradeFormData {
  symbol: string
  direction: 'long' | 'short'
  status: 'open' | 'closed'
  assetType: string
  entryTime: string
  exitTime?: string
  entryPrice: number
  exitPrice?: number
  quantity: number
  commission: number
  stopLoss?: number
  takeProfit?: number
  tags: string
  notes: string
}

const initialFormData: TradeFormData = {
  symbol: '',
  direction: 'long',
  status: 'closed',
  assetType: 'stock',
  entryTime: new Date().toISOString().slice(0, 16),
  exitTime: '',
  entryPrice: 0,
  exitPrice: undefined,
  quantity: 1,
  commission: 0,
  stopLoss: undefined,
  takeProfit: undefined,
  tags: '',
  notes: '',
}

export function AddTradeModal({ isOpen, onClose, onSubmit }: AddTradeModalProps) {
  const [formData, setFormData] = useState<TradeFormData>(initialFormData)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value ? parseFloat(value) : undefined) : value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!formData.symbol) {
      setError('Symbol is required')
      return
    }
    if (!formData.entryPrice || formData.entryPrice <= 0) {
      setError('Entry price must be greater than 0')
      return
    }
    if (!formData.quantity || formData.quantity <= 0) {
      setError('Quantity must be greater than 0')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit(formData)
      setFormData(initialFormData)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to add trade')
    } finally {
      setIsSubmitting(false)
    }
  }

  const resetAndClose = () => {
    setFormData(initialFormData)
    setError(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={resetAndClose} />

      <div className="relative w-full max-w-2xl bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800 sticky top-0 bg-dark-900 z-10">
          <div>
            <h2 className="text-xl font-display font-bold text-white">Add New Trade</h2>
            <p className="text-sm text-dark-500">Enter trade details manually</p>
          </div>
          <button onClick={resetAndClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-loss/20 border border-loss/50 rounded-lg text-loss text-sm">
              {error}
            </div>
          )}

          {/* Type & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Asset Type</label>
              <select
                name="assetType"
                value={formData.assetType}
                onChange={handleChange}
                className="input w-full"
              >
                <option value="stock">Stock</option>
                <option value="option">Option</option>
                <option value="crypto">Crypto</option>
                <option value="future">Future</option>
                <option value="forex">Forex</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Status</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, status: 'closed' }))}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-lg border font-medium transition-all',
                    formData.status === 'closed'
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'
                  )}
                >
                  Closed
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, status: 'open' }))}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-lg border font-medium transition-all',
                    formData.status === 'open'
                      ? 'bg-primary/20 border-primary text-primary'
                      : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'
                  )}
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          {/* Symbol & Direction */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Symbol *</label>
              <input
                type="text"
                name="symbol"
                value={formData.symbol}
                onChange={handleChange}
                placeholder="AAPL, TSLA, BTCUSD..."
                className="input w-full uppercase"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Direction *</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, direction: 'long' }))}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-lg border font-medium transition-all',
                    formData.direction === 'long'
                      ? 'bg-profit/20 border-profit text-profit'
                      : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'
                  )}
                >
                  Long ↑
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, direction: 'short' }))}
                  className={cn(
                    'flex-1 py-2 px-4 rounded-lg border font-medium transition-all',
                    formData.direction === 'short'
                      ? 'bg-loss/20 border-loss text-loss'
                      : 'bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600'
                  )}
                >
                  Short ↓
                </button>
              </div>
            </div>
          </div>

          {/* Entry */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Entry Time *</label>
              <input
                type="datetime-local"
                name="entryTime"
                value={formData.entryTime}
                onChange={handleChange}
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Entry Price *</label>
              <input
                type="number"
                name="entryPrice"
                value={formData.entryPrice || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input w-full"
                required
              />
            </div>
          </div>

          {/* Exit (Optional) */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Exit Time</label>
              <input
                type="datetime-local"
                name="exitTime"
                value={formData.exitTime}
                onChange={handleChange}
                className="input w-full"
                disabled={formData.status === 'open'}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Exit Price</label>
              <input
                type="number"
                name="exitPrice"
                value={formData.exitPrice || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input w-full"
                disabled={formData.status === 'open'}
              />
            </div>
          </div>

          {/* Quantity & Commission */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Quantity *</label>
              <input
                type="number"
                name="quantity"
                value={formData.quantity || ''}
                onChange={handleChange}
                step="0.01"
                min="0.01"
                placeholder="100"
                className="input w-full"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Commission</label>
              <input
                type="number"
                name="commission"
                value={formData.commission || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input w-full"
              />
            </div>
          </div>

          {/* Stop Loss & Take Profit */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Stop Loss</label>
              <input
                type="number"
                name="stopLoss"
                value={formData.stopLoss || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">Take Profit</label>
              <input
                type="number"
                name="takeProfit"
                value={formData.takeProfit || ''}
                onChange={handleChange}
                step="0.01"
                min="0"
                placeholder="0.00"
                className="input w-full"
              />
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-dark-300">Tags</label>
            <div className="flex gap-2">
              <input
                type="text"
                name="tags"
                value={formData.tags}
                onChange={handleChange}
                placeholder="breakout, momentum, fomo (comma separated)"
                className="input w-full"
              />
              <button
                type="button"
                onClick={() => setIsDetailsOpen(true)}
                className="btn-secondary whitespace-nowrap"
              >
                Select Details
              </button>
            </div>

            <p className="text-xs text-dark-500">
              You can also select details from predefined categories.
            </p>
          </div>

          <TradeDetailsModal
            isOpen={isDetailsOpen}
            onClose={() => setIsDetailsOpen(false)}
            isNewTrade={true}
            // We need to pass a mock trade object or handle it differently
            // TradeDetailsModal expects a Trade object but we only have FormData
            // Let's create a temporary Trade-like object
            trade={{
              id: 0,
              ...initialFormData,
              ...formData,
              tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean)
            } as any}
            onSave={(updatedTrade) => {
              if (updatedTrade && updatedTrade.tags) {
                setFormData(prev => ({
                  ...prev,
                  tags: updatedTrade.tags.join(', ')
                }))
              }
              setIsDetailsOpen(false)
            }}
          />

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-dark-300 mb-2">Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              placeholder="Trade notes, strategy, lessons learned..."
              className="input w-full resize-none"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-800 sticky bottom-0 bg-dark-900">
          <button type="button" onClick={resetAndClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={cn('btn-primary flex items-center gap-2', isSubmitting && 'opacity-50 cursor-not-allowed')}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                Add Trade
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

