'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { TopstepXImportModal } from '@/components/TopstepXImportModal'
import { useDropzone } from 'react-dropzone'
import {
  Upload,
  FileText,
  Check,
  AlertCircle,
  Loader2,
  Download,
  HelpCircle,
  Link as LinkIcon,
  ExternalLink,
  ChevronDown
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { uploadApi } from '@/lib/api'
import { getAccounts, batchCreateTrades } from '@/lib/firebase/firestore'
import { Timestamp } from 'firebase/firestore'

const brokers = [
  {
    id: 'generic',
    name: 'Generic CSV',
    description: 'Standard CSV format with symbol, direction, price, quantity',
    icon: '📁',
    columns: ['symbol', 'direction', 'entry_time', 'exit_time', 'entry_price', 'exit_price', 'quantity']
  },
  {
    id: 'interactive_brokers',
    name: 'Interactive Brokers',
    description: 'Flex Query or Activity Statement export',
    icon: '🏦',
    columns: ['Date/Time', 'Symbol', 'Quantity', 'Price', 'Comm/Fee', 'Realized P/L']
  },
  {
    id: 'ninja_trader',
    name: 'NinjaTrader 8',
    description: 'Trade Performance export from NT8',
    icon: '🥷',
    columns: ['Trade #', 'Instrument', 'Market pos.', 'Quantity', 'Entry price', 'Exit price', 'Profit']
  },
  {
    id: 'tradovate',
    name: 'Tradovate',
    description: 'Trade History or Order History export',
    icon: '📈',
    columns: ['Date', 'Contract', 'B/S', 'Qty', 'Price', 'P&L', 'Commission']
  },
  {
    id: 'metatrader4',
    name: 'MetaTrader 4/5',
    description: 'Account History export from MT4/MT5 terminal',
    icon: '📊',
    columns: ['Ticket', 'Open Time', 'Type', 'Size', 'Symbol', 'Price', 'Close Price']
  },
  {
    id: 'binance',
    name: 'Binance',
    description: 'Spot or Futures Trade History export',
    icon: '🪙',
    columns: ['Date(UTC)', 'Pair', 'Side', 'Price', 'Executed', 'Fee']
  },
]

// URL-based import sources (prop firms, etc.)
const urlImportSources = [
  {
    id: 'topstepx',
    name: 'TopstepX',
    description: 'Import from your TopstepX share stats page',
    icon: '🏆',
    color: 'from-blue-500 to-purple-600'
  },
]

type ImportStatus = 'idle' | 'uploading' | 'success' | 'error'

interface ImportResult {
  success: boolean
  tradesCreated: number
  totalPnl: number
  winRate: number | null
  errors: string[]
}

function ImportContent() {
  const { user } = useAuth()
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<ImportStatus>('idle')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showTopstepXModal, setShowTopstepXModal] = useState(false)
  const [accounts, setAccounts] = useState<any[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const accountDropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(event.target as Node)) {
        setShowAccountDropdown(false)
      }
    }

    if (showAccountDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAccountDropdown])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      setStatus('idle')
      setResult(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
    },
    maxFiles: 1,
  })

  // Load accounts on mount
  useEffect(() => {
    const loadAccounts = async () => {
      if (user) {
        setLoadingAccounts(true)
        try {
          const accountsList = await getAccounts(user.uid)
          setAccounts(accountsList)
          // Auto-select first account if available
          if (accountsList.length > 0 && !selectedAccountId) {
            setSelectedAccountId(accountsList[0].id || null)
          }
        } catch (error) {
          console.error('Error loading accounts:', error)
        } finally {
          setLoadingAccounts(false)
        }
      }
    }
    loadAccounts()
  }, [user])

  const handleImport = async () => {
    if (!file || !selectedAccountId) {
      alert('אנא בחר תיק לפני הייבוא')
      return
    }

    if (!user) return

    setStatus('uploading')

    try {
      // 1. Parse file on backend (Stateless)
      const response = await uploadApi.parse(
        file,
        selectedBroker || undefined
      )

      if (!response.success || !response.trades || response.trades.length === 0) {
        throw new Error(response.message || 'No trades parsed')
      }

      // 2. Format trades for Firestore
      const trades = response.trades.map((t: any) => ({
        symbol: t.symbol,
        direction: t.direction,
        status: t.status,
        assetType: t.assetType,
        entryTime: t.entry_time ? Timestamp.fromDate(new Date(t.entry_time)) : Timestamp.now(),
        exitTime: t.exit_time ? Timestamp.fromDate(new Date(t.exit_time)) : undefined,
        entryPrice: t.entry_price,
        exitPrice: t.exit_price,
        quantity: t.quantity,
        commission: t.commission,
        tags: t.tags || [],
        notes: t.notes,
        raw_data: t.raw_data
        // pnlGross/Net/Percent are calculated by batchCreateTrades logic if needed,
        // or we can pass them if the parser calculated them.
        // For now relying on firestore.ts logic to recalculate to be safe.
      }))

      // 3. Save to Firestore
      const createdCount = await batchCreateTrades(
        user.uid,
        selectedAccountId.toString(), // Ensure string
        trades
      )

      setResult({
        success: true,
        tradesCreated: createdCount,
        totalPnl: 0, // TODO: Sum from trades if needed
        winRate: response.win_rate || null,
        errors: response.parse_result?.errors?.map((e: any) => e.message) || [],
      })
      setStatus('success')
    } catch (error: any) {
      console.error('Import error:', error)
      setResult({
        success: false,
        tradesCreated: 0,
        totalPnl: 0,
        winRate: null,
        errors: [error.response?.data?.detail || error.message || 'שגיאה בהעלאת הקובץ'],
      })
      setStatus('error')
    }
  }

  const downloadTemplate = () => {
    const broker = brokers.find(b => b.id === selectedBroker) || brokers[0]
    const headers = broker.columns.join(',')

    let example = ''
    if (broker.id === 'generic') {
      example = 'AAPL,long,2024-01-15 10:30:00,2024-01-15 14:45:00,185.50,188.20,100'
    } else if (broker.id === 'ninja_trader') {
      example = '1,ES 03-24,Sim101,MyStrategy,Long,1,4850.25,4855.50,01/15/2024 10:30:00,01/15/2024 11:45:00,Entry,Exit,262.50,262.50,4.04,25.00,312.50,0,15'
    } else if (broker.id === 'tradovate') {
      example = '2024-01-15 10:30:00,ESH4,Buy,1,4850.25,,,'
    }

    const content = `${headers}\n${example}`
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_${broker.id}.csv`
    a.click()
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Import Trades</h2>
              <p className="text-sm text-dark-500">Upload trade history from your broker</p>
            </div>
          </div>
        </header>

        <div className="p-6 max-w-4xl mx-auto space-y-6">
          {/* URL-based Import (TopstepX, etc.) */}
          <div className="chart-container p-6">
            <div className="flex items-center gap-2 mb-4">
              <LinkIcon className="w-5 h-5 text-primary-400" />
              <h3 className="text-lg font-display font-semibold text-white">Import from URL</h3>
              <span className="tag tag-primary text-xs">NEW</span>
            </div>
            <p className="text-dark-400 text-sm mb-4">Import trades directly from your prop firm or broker's share page</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {urlImportSources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => {
                    if (source.id === 'topstepx') setShowTopstepXModal(true)
                  }}
                  className="flex items-center gap-4 p-4 rounded-xl border border-dark-700 bg-dark-800/50 hover:border-primary-500/50 hover:bg-dark-800 transition-all duration-200 group"
                >
                  <div className={cn(
                    'w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl',
                    source.color
                  )}>
                    {source.icon}
                  </div>
                  <div className="text-left flex-1">
                    <p className="font-bold text-white">{source.name}</p>
                    <p className="text-sm text-dark-400">{source.description}</p>
                  </div>
                  <ExternalLink className="w-5 h-5 text-dark-600 group-hover:text-primary-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-dark-950 text-dark-500">or upload a file</span>
            </div>
          </div>

          {status === 'success' && result ? (
            // Success view
            <div className="chart-container p-12 text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-profit/20 rounded-full flex items-center justify-center">
                <Check className="w-10 h-10 text-profit" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Import Successful!</h3>
                <p className="text-dark-400 mt-2">
                  {result.tradesCreated} trades imported successfully
                </p>
              </div>

              {result.errors && result.errors.length > 0 && (
                <div className="mt-4 p-4 bg-dark-800 rounded-lg border border-dark-700 text-left">
                  <p className="text-sm font-semibold text-dark-300 mb-2">Warnings:</p>
                  <ul className="text-sm text-dark-400 space-y-1">
                    {result.errors.slice(0, 5).map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                    {result.errors.length > 5 && (
                      <li className="text-dark-500">... and {result.errors.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                <div className="p-4 bg-dark-800 rounded-lg">
                  <p className="text-2xl font-bold text-profit">
                    {formatCurrency(result.totalPnl)}
                  </p>
                  <p className="text-xs text-dark-500">Total P&L</p>
                </div>
                <div className="p-4 bg-dark-800 rounded-lg">
                  <p className="text-2xl font-bold text-white">
                    {result.winRate}%
                  </p>
                  <p className="text-xs text-dark-500">Win Rate</p>
                </div>
                <div className="p-4 bg-dark-800 rounded-lg">
                  <p className="text-2xl font-bold text-white">
                    {result.tradesCreated}
                  </p>
                  <p className="text-xs text-dark-500">Trades</p>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    setFile(null)
                    setStatus('idle')
                    setResult(null)
                  }}
                  className="btn-secondary"
                >
                  Import More
                </button>
                <button
                  onClick={() => window.location.href = '/'}
                  className="btn-primary"
                >
                  View Dashboard
                </button>
              </div>
            </div>
          ) : status === 'error' && result ? (
            // Error view
            <div className="chart-container p-12 text-center space-y-6">
              <div className="w-20 h-20 mx-auto bg-loss/20 rounded-full flex items-center justify-center">
                <AlertCircle className="w-10 h-10 text-loss" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">Import Failed</h3>
                <p className="text-dark-400 mt-2">
                  {result.errors && result.errors.length > 0
                    ? result.errors[0]
                    : 'An error occurred during import'}
                </p>
              </div>

              {result.errors && result.errors.length > 1 && (
                <div className="mt-4 p-4 bg-dark-800 rounded-lg border border-dark-700 text-left max-h-60 overflow-auto">
                  <p className="text-sm font-semibold text-loss mb-2">Errors:</p>
                  <ul className="text-sm text-dark-400 space-y-1">
                    {result.errors.map((error, idx) => (
                      <li key={idx}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => {
                    setFile(null)
                    setStatus('idle')
                    setResult(null)
                  }}
                  className="btn-secondary"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Select Broker */}
              <div className="chart-container p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center">1</span>
                  <h3 className="text-lg font-display font-semibold text-white">Select Broker Format</h3>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {brokers.map((broker) => (
                    <button
                      key={broker.id}
                      onClick={() => setSelectedBroker(broker.id)}
                      className={cn(
                        'p-4 rounded-xl border text-left transition-all duration-200',
                        selectedBroker === broker.id
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-dark-700 hover:border-dark-600 bg-dark-800/50'
                      )}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">{broker.icon}</span>
                        <span className="font-bold text-white">{broker.name}</span>
                      </div>
                      <p className="text-sm text-dark-400">{broker.description}</p>
                    </button>
                  ))}
                </div>

                {selectedBroker && (
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center gap-2 text-sm text-primary-400 hover:text-primary-300"
                    >
                      <Download className="w-4 h-4" />
                      Download template
                    </button>
                    <span className="text-dark-600">•</span>
                    <button className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-300">
                      <HelpCircle className="w-4 h-4" />
                      View example
                    </button>
                  </div>
                )}
              </div>

              {/* Step 2: Upload File */}
              <div className={cn(
                'chart-container p-6 transition-opacity',
                !selectedBroker && 'opacity-50 pointer-events-none'
              )}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center">2</span>
                  <h3 className="text-lg font-display font-semibold text-white">Upload File</h3>
                </div>

                <div
                  {...getRootProps()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200 cursor-pointer',
                    isDragActive
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-700 hover:border-dark-600',
                    file && 'border-primary-500/50'
                  )}
                >
                  <input {...getInputProps()} />

                  {file ? (
                    <div className="flex items-center justify-center gap-4">
                      <div className="w-14 h-14 bg-primary-500/20 rounded-xl flex items-center justify-center">
                        <FileText className="w-7 h-7 text-primary-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white">{file.name}</p>
                        <p className="text-sm text-dark-500">
                          {(file.size / 1024).toFixed(1)} KB · Click to change
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-12 h-12 text-dark-500 mx-auto mb-4" />
                      <p className="text-dark-300 text-lg">
                        Drag & drop your file here, or{' '}
                        <span className="text-primary-400">browse</span>
                      </p>
                      <p className="text-sm text-dark-500 mt-2">
                        Supports CSV, XLS, XLSX files up to 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>

              {/* Step 3: Select Account */}
              <div className={cn(
                'chart-container p-6 transition-opacity',
                !file && 'opacity-50 pointer-events-none'
              )}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center">3</span>
                  <h3 className="text-lg font-display font-semibold text-white">Select Account</h3>
                </div>

                {loadingAccounts ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                  </div>
                ) : accounts.length === 0 ? (
                  <div className="p-4 bg-dark-800 rounded-lg border border-dark-700">
                    <p className="text-dark-400 text-sm mb-2">אין לך תיקים. אנא צור תיק חדש תחילה.</p>
                    <a href="/accounts" className="text-primary-400 hover:text-primary-300 text-sm">
                      צור תיק חדש →
                    </a>
                  </div>
                ) : (
                  <div className="relative" ref={accountDropdownRef}>
                    <button
                      onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                      className="w-full flex items-center justify-between p-4 bg-dark-800 rounded-lg border border-dark-700 hover:border-primary-500/50 transition-colors"
                    >
                      <span className="text-white">
                        {selectedAccountId
                          ? accounts.find(a => a.id === selectedAccountId)?.name || 'בחר תיק'
                          : 'בחר תיק'}
                      </span>
                      <ChevronDown className={cn(
                        'w-5 h-5 text-dark-400 transition-transform',
                        showAccountDropdown && 'rotate-180'
                      )} />
                    </button>

                    {showAccountDropdown && (
                      <div className="absolute z-10 w-full mt-2 bg-dark-800 rounded-lg border border-dark-700 shadow-xl max-h-60 overflow-auto">
                        {accounts.map((account) => (
                          <button
                            key={account.id}
                            onClick={() => {
                              setSelectedAccountId(account.id)
                              setShowAccountDropdown(false)
                            }}
                            className={cn(
                              'w-full text-left px-4 py-3 hover:bg-dark-700 transition-colors',
                              selectedAccountId === account.id && 'bg-primary-500/10'
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-white">{account.name}</span>
                              <span className="text-sm text-dark-400">{account.broker}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 4: Import */}
              <div className={cn(
                'chart-container p-6 transition-opacity',
                (!file || !selectedAccountId) && 'opacity-50 pointer-events-none'
              )}>
                <div className="flex items-center gap-2 mb-4">
                  <span className="w-6 h-6 rounded-full bg-primary-500 text-white text-sm font-bold flex items-center justify-center">4</span>
                  <h3 className="text-lg font-display font-semibold text-white">Import Trades</h3>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-dark-400">
                    {file && selectedAccountId
                      ? `Ready to import from ${file.name} to ${accounts.find(a => a.id === selectedAccountId)?.name}`
                      : file
                        ? 'Select an account first'
                        : 'Upload a file first'}
                  </p>

                  <button
                    onClick={handleImport}
                    disabled={!file || !selectedAccountId || status === 'uploading'}
                    className={cn(
                      'btn-primary flex items-center gap-2',
                      (!file || !selectedAccountId || status === 'uploading') && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {status === 'uploading' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        Start Import
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Broker-specific info */}
              {selectedBroker && (
                <div className="chart-container p-6">
                  <h3 className="text-lg font-display font-semibold text-white mb-4">
                    How to export from {brokers.find(b => b.id === selectedBroker)?.name}
                  </h3>

                  {selectedBroker === 'ninja_trader' && (
                    <div className="text-sm text-dark-400 space-y-2">
                      <p>1. Open NinjaTrader 8</p>
                      <p>2. Go to <strong className="text-white">Control Center → Trade Performance</strong></p>
                      <p>3. Select the date range you want to export</p>
                      <p>4. Click <strong className="text-white">Export</strong> and choose CSV format</p>
                      <p className="text-dark-500 mt-4">Expected columns: Trade #, Instrument, Market pos., Quantity, Entry/Exit price, Profit, MAE, MFE</p>
                    </div>
                  )}

                  {selectedBroker === 'tradovate' && (
                    <div className="text-sm text-dark-400 space-y-2">
                      <p>1. Log in to Tradovate</p>
                      <p>2. Go to <strong className="text-white">Account → Trade History</strong></p>
                      <p>3. Select the date range and click <strong className="text-white">Export</strong></p>
                      <p>4. Choose CSV format and download</p>
                      <p className="text-dark-500 mt-4">Expected columns: Date, Contract, B/S, Qty, Price, P&L, Commission</p>
                    </div>
                  )}

                  {selectedBroker === 'interactive_brokers' && (
                    <div className="text-sm text-dark-400 space-y-2">
                      <p>1. Log in to IB Account Management</p>
                      <p>2. Go to <strong className="text-white">Reports → Flex Queries</strong></p>
                      <p>3. Create or run a Trades query</p>
                      <p>4. Export as CSV</p>
                    </div>
                  )}

                  {selectedBroker === 'metatrader4' && (
                    <div className="text-sm text-dark-400 space-y-2">
                      <p>1. Open MetaTrader 4/5 terminal</p>
                      <p>2. Go to <strong className="text-white">Account History</strong> tab</p>
                      <p>3. Right-click and select <strong className="text-white">Save as Report</strong></p>
                      <p>4. Save as CSV file</p>
                    </div>
                  )}

                  {selectedBroker === 'binance' && (
                    <div className="text-sm text-dark-400 space-y-2">
                      <p>1. Log in to Binance</p>
                      <p>2. Go to <strong className="text-white">Orders → Trade History</strong></p>
                      <p>3. Select date range and click <strong className="text-white">Export</strong></p>
                      <p>4. Download CSV file</p>
                    </div>
                  )}

                  {selectedBroker === 'generic' && (
                    <div className="text-sm text-dark-400 space-y-2">
                      <p>Use our generic format for any broker not listed above.</p>
                      <p className="mt-2">Required columns:</p>
                      <ul className="list-disc list-inside ml-2">
                        <li><strong className="text-white">symbol</strong> - e.g., AAPL, BTCUSD</li>
                        <li><strong className="text-white">direction</strong> - long or short</li>
                        <li><strong className="text-white">entry_time</strong> - YYYY-MM-DD HH:MM:SS</li>
                        <li><strong className="text-white">entry_price</strong> - decimal number</li>
                        <li><strong className="text-white">quantity</strong> - number of units</li>
                      </ul>
                      <p className="mt-2">Optional: exit_time, exit_price, commission, tags, notes</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* TopstepX Import Modal */}
        <TopstepXImportModal
          isOpen={showTopstepXModal}
          onClose={() => setShowTopstepXModal(false)}
          onSuccess={() => {
            setShowTopstepXModal(false)
            // Show success or refresh
          }}
        />
      </main>
    </div>
  )
}

export default function ImportPage() {
  return (
    <ProtectedRoute>
      <ImportContent />
    </ProtectedRoute>
  )
}
