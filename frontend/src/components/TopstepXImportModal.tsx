'use client'

import { useState, useEffect } from 'react'
import { 
  X, 
  Loader2, 
  Link as LinkIcon, 
  Check, 
  AlertCircle,
  ChevronRight,
  Wallet,
  Zap,
  Hash,
  Code,
  AlertTriangle
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { 
  getAccounts, 
  createTrade, 
  getTrades,
  FirestoreAccount 
} from '@/lib/firebase/firestore'
import { Timestamp } from 'firebase/firestore'
import { parseTopstepXHtml } from '@/lib/topstepxParser'

interface TopstepXImportModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

interface TopstepXTrade {
  id: string
  symbol: string
  quantity: number
  entryTime: string
  exitTime: string
  duration: string
  entryPrice: number
  exitPrice: number
  pnl: number
  commission: number
  fees: number
  direction: 'long' | 'short'
  hasPrices?: boolean
}

type Step = 'input' | 'preview' | 'account' | 'importing' | 'success'
type InputMethod = 'api' | 'html'

export function TopstepXImportModal({ isOpen, onClose, onSuccess }: TopstepXImportModalProps) {
  const { user } = useAuth()
  const [step, setStep] = useState<Step>('input')
  const [inputMethod, setInputMethod] = useState<InputMethod>('html') // Default to HTML for prices
  const [shareId, setShareId] = useState('')
  const [htmlContent, setHtmlContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [trades, setTrades] = useState<TopstepXTrade[]>([])
  const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [existingTradeIds, setExistingTradeIds] = useState<Set<string>>(new Set())
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [importedCount, setImportedCount] = useState(0)
  const [importProgress, setImportProgress] = useState(0)
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false)

  // Load accounts when modal opens
  useEffect(() => {
    if (isOpen && user) {
      loadAccounts()
    }
  }, [isOpen, user])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setStep('input')
      setShareId('')
      setHtmlContent('')
      setError('')
      setTrades([])
      setSelectedAccount('')
      setDuplicateCount(0)
      setImportedCount(0)
      setImportProgress(0)
    }
  }, [isOpen])

  const loadAccounts = async () => {
    if (!user) return
    try {
      const userAccounts = await getAccounts(user.uid)
      setAccounts(userAccounts)
      
      // Also load existing trades to check for duplicates
      const existingTrades = await getTrades(user.uid)
      
      const ids = new Set(
        existingTrades
          .filter(t => t.notes?.includes('TopstepX Trade ID:'))
          .map(t => {
            const match = t.notes?.match(/TopstepX Trade ID: ([^\n]+)/)
            return match?.[1]
          })
          .filter(Boolean) as string[]
      )
      setExistingTradeIds(ids)
    } catch (error) {
      console.error('Error loading accounts:', error)
    }
  }

  /**
   * Extract share ID from URL or return as-is if it's just a number
   */
  const extractShareId = (input: string): string | null => {
    const trimmed = input.trim()
    
    // If it's just a number, return it
    if (/^\d+$/.test(trimmed)) {
      return trimmed
    }
    
    // Try to extract from URL
    try {
      const urlObj = new URL(trimmed)
      return urlObj.searchParams.get('share')
    } catch {
      // Try regex fallback
      const match = trimmed.match(/share=(\d+)/)
      return match ? match[1] : null
    }
  }

  /**
   * Fetch trades from API (no prices)
   */
  const handleFetchFromApi = async () => {
    if (!shareId.trim()) {
      setError('Please enter share ID or link')
      return
    }

    const extractedId = extractShareId(shareId)
    if (!extractedId) {
      setError('Invalid ID. Enter a number or link in format: https://topstepx.com/share/stats?share=XXXXXXX')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch(`/api/topstepx/trades?share=${extractedId}`)
      
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Error fetching data from TopstepX')
      }

      const data = await response.json()
      
      if (!data.trades || data.trades.length === 0) {
        throw new Error('No trades found for this ID')
      }

      // Check for duplicates
      const newTrades = data.trades.filter((t: TopstepXTrade) => {
        const key = `topstepx-${t.id}`
        return !existingTradeIds.has(key)
      })
      const dupes = data.trades.length - newTrades.length
      
      setTrades(data.trades)
      setDuplicateCount(dupes)
      setStep('preview')
    } catch (error: any) {
      console.error('Error fetching trades:', error)
      setError(error.message || 'Error fetching data from TopstepX')
    } finally {
      setLoading(false)
    }
  }

  /**
   * Parse trades from pasted HTML (with prices)
   */
  const handleParseHtml = async () => {
    if (!htmlContent.trim()) {
      setError('Please paste HTML from TopstepX page')
      return
    }

    setLoading(true)
    setError('')

    try {
      const parsedTrades = parseTopstepXHtml(htmlContent)
      
      if (parsedTrades.length === 0) {
        throw new Error('No trades found in HTML. Make sure you copied the entire table.')
      }

      // Mark that these trades have prices
      const tradesWithPrices = parsedTrades.map(t => ({
        ...t,
        hasPrices: t.entryPrice > 0
      }))

      // Check for duplicates
      const newTrades = tradesWithPrices.filter((t) => {
        const key = `topstepx-${t.id}`
        return !existingTradeIds.has(key)
      })
      const dupes = tradesWithPrices.length - newTrades.length

      setTrades(tradesWithPrices)
      setDuplicateCount(dupes)
      setStep('preview')
    } catch (error: any) {
      console.error('Error parsing HTML:', error)
      setError(error.message || 'Error analyzing HTML')
    } finally {
      setLoading(false)
    }
  }

  const handleSelectAccount = () => {
    if (!selectedAccount) {
      setError('Please select an account')
      return
    }
    setError('')
    setStep('importing')
    importTrades()
  }

  const importTrades = async () => {
    if (!user || !selectedAccount) return

    // If skipping duplicate check, import all trades
    const newTrades = skipDuplicateCheck 
      ? trades 
      : trades.filter(t => !existingTradeIds.has(`topstepx-${t.id}`))
    
    let imported = 0

    for (const trade of newTrades) {
      try {
        // TopstepX provides gross PnL directly - fees are separate
        const grossPnl = trade.pnl || 0
        const fees = trade.fees || 0
        const netPnl = grossPnl - fees
        
        await createTrade(user.uid, selectedAccount, {
          symbol: trade.symbol,
          direction: trade.direction,
          status: 'closed',
          assetType: 'futures',
          entryTime: Timestamp.fromDate(new Date(trade.entryTime)),
          exitTime: trade.exitTime ? Timestamp.fromDate(new Date(trade.exitTime)) : Timestamp.fromDate(new Date(trade.entryTime)),
          entryPrice: trade.entryPrice || 0,
          exitPrice: trade.exitPrice || trade.entryPrice || 0,
          quantity: trade.quantity || 1,
          commission: fees,
          pnlGross: grossPnl,
          pnlNet: netPnl,
          tags: ['TopstepX', 'Imported'],
          notes: `TopstepX Trade ID: topstepx-${trade.id}\nGross P&L: $${grossPnl.toFixed(2)}\nFees: $${fees.toFixed(2)}\nNet P&L: $${netPnl.toFixed(2)}${trade.duration ? `\nDuration: ${trade.duration}` : ''}`,
        })
        
        imported++
        setImportProgress(Math.round((imported / newTrades.length) * 100))
      } catch (error) {
        console.error('Error importing trade:', trade.id, error)
      }
    }

    setImportedCount(imported)
    setStep('success')
  }

  const handleClose = () => {
    if (step === 'success') {
      onSuccess()
    }
    onClose()
  }

  if (!isOpen) return null

  const newTradesCount = skipDuplicateCheck 
    ? trades.length 
    : trades.filter(t => !existingTradeIds.has(`topstepx-${t.id}`)).length
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0)
  const hasPrices = trades.some(t => t.entryPrice > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      
      <div className="relative w-full max-w-2xl bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">T</span>
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">Import from TopstepX</h2>
              <p className="text-sm text-dark-500">
                {inputMethod === 'html' ? 'With entry/exit prices' : 'Quick import (no prices)'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Step 1: Choose Method & Enter Data */}
          {step === 'input' && (
            <div className="space-y-6">
              {/* Method Selection */}
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setInputMethod('html')}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    inputMethod === 'html'
                      ? 'border-profit bg-profit/10'
                      : 'border-dark-700 hover:border-dark-600'
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      inputMethod === 'html' ? 'bg-profit/20' : 'bg-dark-700'
                    )}>
                      <Code className={cn(
                        'w-4 h-4',
                        inputMethod === 'html' ? 'text-profit' : 'text-dark-400'
                      )} />
                    </div>
                    <div>
                      <span className="font-medium text-white block">Paste HTML</span>
                      <span className="text-xs text-profit">Recommended! With prices</span>
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => setInputMethod('api')}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    inputMethod === 'api'
                      ? 'border-primary bg-primary/10'
                      : 'border-dark-700 hover:border-dark-600'
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center',
                      inputMethod === 'api' ? 'bg-primary/20' : 'bg-dark-700'
                    )}>
                      <Zap className={cn(
                        'w-4 h-4',
                        inputMethod === 'api' ? 'text-primary' : 'text-dark-400'
                      )} />
                    </div>
                    <div>
                      <span className="font-medium text-white block">Quick API</span>
                      <span className="text-xs text-dark-500">Without prices</span>
                    </div>
                  </div>
                </button>
              </div>

              {/* HTML Paste Method */}
              {inputMethod === 'html' && (
                <div className="space-y-4">
                  <div className="p-4 bg-profit/10 rounded-xl border border-profit/30">
                    <h4 className="font-medium text-profit mb-2 flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      This method includes entry/exit prices!
                    </h4>
                    <ol className="text-sm text-dark-300 space-y-1 list-decimal list-inside" dir="rtl">
                      <li>Open the TopstepX share page in your browser</li>
                      <li>Press Ctrl+A (select all) then Ctrl+C (copy)</li>
                      <li>Paste below (Ctrl+V)</li>
                    </ol>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Paste page content here:
                    </label>
                    <textarea
                      value={htmlContent}
                      onChange={(e) => setHtmlContent(e.target.value)}
                      placeholder="Paste all page content here (Ctrl+V)..."
                      className="input w-full h-48 font-mono text-xs"
                      dir="ltr"
                    />
                    <p className="text-xs text-dark-500 mt-2">
                      Tip: You can also open Developer Tools (F12), go to Elements, select the trades table and copy the HTML
                    </p>
                  </div>
                </div>
              )}

              {/* API Method */}
              {inputMethod === 'api' && (
                <div className="space-y-4">
                  <div className="p-4 bg-accent-orange/10 rounded-xl border border-accent-orange/30">
                    <h4 className="font-medium text-accent-orange mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Note: This method does not include entry/exit prices
                    </h4>
                    <p className="text-sm text-dark-400">
                      TopstepX API does not provide prices. Only PnL and times.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">
                      Share ID or link
                    </label>
                    <div className="relative">
                      <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-500" />
                      <input
                        type="text"
                        value={shareId}
                        onChange={(e) => setShareId(e.target.value)}
                        placeholder="7534754 or https://topstepx.com/share/stats?share=7534754"
                        className="input w-full pl-11 text-left"
                        dir="ltr"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleFetchFromApi()
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 p-4 bg-loss/20 border border-loss/50 rounded-lg text-loss text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 2: Preview Trades */}
          {step === 'preview' && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700 text-center">
                  <p className="text-2xl font-bold text-white">{trades.length}</p>
                  <p className="text-sm text-dark-500">Total trades</p>
                </div>
                <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700 text-center">
                  <p className="text-2xl font-bold text-profit">{newTradesCount}</p>
                  <p className="text-sm text-dark-500">trades new</p>
                </div>
                <div className="p-4 bg-dark-800/50 rounded-xl border border-dark-700 text-center">
                  <p className={cn('text-2xl font-bold', totalPnl >= 0 ? 'text-profit' : 'text-loss')}>
                    {formatCurrency(totalPnl)}
                  </p>
                  <p className="text-sm text-dark-500">Total P/L</p>
                </div>
              </div>

              {/* Prices Status */}
              {hasPrices ? (
                <div className="p-3 bg-profit/10 rounded-lg border border-profit/30 flex items-center gap-2">
                  <Check className="w-5 h-5 text-profit" />
                  <span className="text-profit text-sm">Entry/exit prices available!</span>
                </div>
              ) : (
                <div className="p-3 bg-accent-orange/10 rounded-lg border border-accent-orange/30 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-accent-orange" />
                  <span className="text-accent-orange text-sm">Entry/exit prices not available (API import)</span>
                </div>
              )}

              {duplicateCount > 0 && (
                <div className="p-4 bg-accent-orange/20 border border-accent-orange/50 rounded-lg">
                  <div className="flex items-center gap-2 text-accent-orange text-sm mb-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {duplicateCount} trades already exist and will be skipped
                  </div>
                  <label className="flex items-center gap-2 text-sm text-dark-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={skipDuplicateCheck}
                      onChange={(e) => setSkipDuplicateCheck(e.target.checked)}
                      className="rounded border-dark-600"
                    />
                    Import anyway (will create duplicates)
                  </label>
                </div>
              )}

              {/* Trade Preview */}
              <div className="border border-dark-700 rounded-xl overflow-hidden">
                <div className="p-3 bg-dark-800/50 border-b border-dark-700">
                  <h4 className="font-medium text-white">Preview</h4>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-dark-800/30 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-dark-500 font-medium">Symbol</th>
                        <th className="px-3 py-2 text-left text-dark-500 font-medium">Direction</th>
                        <th className="px-3 py-2 text-right text-dark-500 font-medium">Qty</th>
                        <th className="px-3 py-2 text-right text-dark-500 font-medium">Entry</th>
                        <th className="px-3 py-2 text-right text-dark-500 font-medium">Exit</th>
                        <th className="px-3 py-2 text-right text-dark-500 font-medium">P&L</th>
                        <th className="px-3 py-2 text-center text-dark-500 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-dark-800/50">
                      {trades.slice(0, 20).map((trade) => {
                        const isDuplicate = existingTradeIds.has(`topstepx-${trade.id}`)
                        return (
                          <tr 
                            key={trade.id} 
                            className={cn(
                              isDuplicate && !skipDuplicateCheck && 'opacity-50'
                            )}
                          >
                            <td className="px-3 py-2 text-white font-medium">{trade.symbol}</td>
                            <td className="px-3 py-2">
                              <span className={cn(
                                'px-2 py-0.5 rounded text-xs font-medium',
                                trade.direction === 'long' 
                                  ? 'bg-accent-blue/20 text-accent-blue'
                                  : 'bg-accent-orange/20 text-accent-orange'
                              )}>
                                {trade.direction.toUpperCase()}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-dark-300">{trade.quantity}</td>
                            <td className="px-3 py-2 text-right text-dark-300">
                              {trade.entryPrice > 0 
                                ? `$${trade.entryPrice.toLocaleString()}`
                                : <span className="text-dark-500">N/A</span>
                              }
                            </td>
                            <td className="px-3 py-2 text-right text-dark-300">
                              {trade.exitPrice > 0 
                                ? `$${trade.exitPrice.toLocaleString()}`
                                : <span className="text-dark-500">N/A</span>
                              }
                            </td>
                            <td className={cn(
                              'px-3 py-2 text-right font-medium',
                              trade.pnl >= 0 ? 'text-profit' : 'text-loss'
                            )}>
                              {formatCurrency(trade.pnl)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {isDuplicate && !skipDuplicateCheck ? (
                                <span className="text-xs text-accent-orange">Duplicate</span>
                              ) : (
                                <Check className="w-4 h-4 text-profit mx-auto" />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {trades.length > 20 && (
                    <div className="p-3 text-center text-dark-500 text-sm bg-dark-800/30">
                      ... and {trades.length - 20} trades additional
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Select Account */}
          {step === 'account' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-white mb-4">Select account for import</h3>
                
                {accounts.length === 0 ? (
                  <div className="text-center py-8">
                    <Wallet className="w-12 h-12 text-dark-600 mx-auto mb-3" />
                    <p className="text-dark-400 mb-2">No accounts</p>
                    <p className="text-sm text-dark-500">Create a new account in account management</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {accounts.map(account => (
                      <button
                        key={account.id}
                        onClick={() => setSelectedAccount(account.id!)}
                        className={cn(
                          'w-full p-4 rounded-xl border-2 text-left transition-all',
                          selectedAccount === account.id
                            ? 'border-primary bg-primary/10'
                            : 'border-dark-700 hover:border-dark-600'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-white">{account.name}</p>
                            <p className="text-sm text-dark-500">{account.broker}</p>
                          </div>
                          {selectedAccount === account.id && (
                            <Check className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="flex items-center gap-2 p-4 bg-loss/20 border border-loss/50 rounded-lg text-loss text-sm">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Step 4: Importing */}
          {step === 'importing' && (
            <div className="text-center py-12">
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-6 animate-spin" />
              <h3 className="text-xl font-medium text-white mb-2">Importing trades...</h3>
              <p className="text-dark-400 mb-6">Please wait</p>
              
              <div className="w-full max-w-xs mx-auto">
                <div className="h-2 bg-dark-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-sm text-dark-500 mt-2">{importProgress}%</p>
              </div>
            </div>
          )}

          {/* Step 5: Success */}
          {step === 'success' && (
            <div className="text-center py-12">
              <div className="w-20 h-20 rounded-full bg-profit/20 flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-profit" />
              </div>
              <h3 className="text-xl font-medium text-white mb-2">Import completed!</h3>
              <p className="text-dark-400 mb-6">
                {importedCount} trades imported successfully
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-dark-800 bg-dark-900">
          {step === 'input' && (
            <>
              <button onClick={handleClose} className="btn-secondary">
                Cancel
              </button>
              <button 
                onClick={inputMethod === 'html' ? handleParseHtml : handleFetchFromApi}
                disabled={loading || (inputMethod === 'html' ? !htmlContent.trim() : !shareId.trim())}
                className="btn-primary flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button onClick={() => setStep('input')} className="btn-secondary">
                Back
              </button>
              <button 
                onClick={() => setStep('account')}
                disabled={newTradesCount === 0}
                className="btn-primary flex items-center gap-2"
              >
                Select account
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'account' && (
            <>
              <button onClick={() => setStep('preview')} className="btn-secondary">
                Back
              </button>
              <button 
                onClick={handleSelectAccount}
                disabled={!selectedAccount || accounts.length === 0}
                className="btn-primary flex items-center gap-2"
              >
                Start Import
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}

          {step === 'success' && (
            <button onClick={handleClose} className="btn-primary w-full">
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
