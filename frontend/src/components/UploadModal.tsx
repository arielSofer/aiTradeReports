'use client'

import { useState, useCallback, useEffect } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, FileText, Check, AlertCircle, Loader2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { uploadApi } from '@/lib/api'
import { getAccounts, batchCreateTrades, FirestoreAccount } from '@/lib/firebase/firestore'
import { Timestamp } from 'firebase/firestore'

interface UploadModalProps {
  isOpen: boolean
  onClose: () => void
}

const brokers = [
  { id: 'generic', name: 'Generic CSV', description: 'Standard CSV format' },
  { id: 'interactive_brokers', name: 'Interactive Brokers', description: 'Flex Query or Activity Statement' },
  { id: 'ninja_trader', name: 'NinjaTrader 8', description: 'Trade Performance export' },
  { id: 'tradovate', name: 'Tradovate', description: 'Trade History export' },
  { id: 'metatrader4', name: 'MetaTrader 4/5', description: 'Account History export' },
  { id: 'binance', name: 'Binance', description: 'Spot or Futures Trade History' },
]

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error'

export function UploadModal({ isOpen, onClose }: UploadModalProps) {
  const { user } = useAuth()
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [result, setResult] = useState<any>(null)

  // Account selection
  const [accounts, setAccounts] = useState<FirestoreAccount[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null)
  const [showAccountDropdown, setShowAccountDropdown] = useState(false)
  const [loadingAccounts, setLoadingAccounts] = useState(false)

  // Load accounts when modal opens
  useEffect(() => {
    const loadAccounts = async () => {
      if (user && isOpen) {
        setLoadingAccounts(true)
        try {
          const accountsList = await getAccounts(user.uid)
          setAccounts(accountsList)
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
  }, [user, isOpen])

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

  const handleUpload = async () => {
    if (!file || !user || !selectedAccountId) return

    setStatus('uploading')

    try {
      // 1. Parse file on backend
      const response = await uploadApi.parse(
        file,
        selectedBroker || undefined
      )

      if (!response.success || !response.trades || response.trades.length === 0) {
        throw new Error(response.message || 'No trades parsed')
      }

      // 2. Format trades
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
      }))

      // 3. Save to Firestore
      const createdCount = await batchCreateTrades(
        user.uid,
        selectedAccountId,
        trades
      )

      setResult({
        success: true,
        tradesCreated: createdCount,
        totalPnl: 0, // Could calculate if needed
        winRate: response.win_rate || null,
      })
      setStatus('success')
    } catch (error: any) {
      console.error('Upload error:', error)
      setResult({
        success: false,
        tradesCreated: 0,
        errors: [error.response?.data?.detail || error.message || 'Upload failed']
      })
      setStatus('error')
    }
  }

  const resetModal = () => {
    setFile(null)
    setSelectedBroker(null)
    setStatus('idle')
    setResult(null)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={resetModal}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800 sticky top-0 bg-dark-900 z-10">
          <div>
            <h2 className="text-xl font-display font-bold text-white">Import Trades</h2>
            <p className="text-sm text-dark-500">Upload a CSV file with your trade history</p>
          </div>
          <button
            onClick={resetModal}
            className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {status === 'success' && result ? (
            // Success view
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto bg-profit/20 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-profit" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">Import Successful!</h3>
                <p className="text-dark-400">
                  {result.tradesCreated} trades imported successfully
                </p>
              </div>

              <div className="flex justify-center gap-4 py-4">
                <button
                  onClick={resetModal}
                  className="btn-primary"
                >
                  View Dashboard
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Account Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-2">Select Account</label>
                <div className="relative">
                  <button
                    onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                    className="w-full flex items-center justify-between p-3 bg-dark-800 border border-dark-700 rounded-lg text-left"
                  >
                    <span className="text-white">
                      {selectedAccountId
                        ? accounts.find(a => a.id === selectedAccountId)?.name || 'Select Account'
                        : 'Select Account'}
                    </span>
                    <ChevronDown className="w-4 h-4 text-dark-400" />
                  </button>

                  {showAccountDropdown && (
                    <div className="absolute z-10 w-full mt-2 bg-dark-800 border border-dark-700 rounded-lg shadow-xl max-h-60 overflow-auto">
                      {accounts.map(acc => (
                        <button
                          key={acc.id}
                          onClick={() => {
                            setSelectedAccountId(acc.id || null)
                            setShowAccountDropdown(false)
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2 hover:bg-dark-700",
                            selectedAccountId === acc.id && "bg-primary-500/10 text-primary-400"
                          )}
                        >
                          {acc.name}
                          <span className="ml-2 text-xs text-dark-500">{acc.broker}</span>
                        </button>
                      ))}
                      {accounts.length === 0 && (
                        <div className="p-4 text-center text-sm text-dark-400">No accounts found. Create one first.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Broker Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-3">
                  Select Broker (optional - auto-detected)
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {brokers.map((broker) => (
                    <button
                      key={broker.id}
                      onClick={() => setSelectedBroker(
                        selectedBroker === broker.id ? null : broker.id
                      )}
                      className={cn(
                        'p-3 rounded-lg border text-left transition-all duration-200',
                        selectedBroker === broker.id
                          ? 'border-primary-500 bg-primary-500/10'
                          : 'border-dark-700 hover:border-dark-600 bg-dark-800/50'
                      )}
                    >
                      <p className="font-medium text-white">{broker.name}</p>
                      <p className="text-xs text-dark-500">{broker.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-dark-300 mb-3">
                  Upload File
                </label>
                <div
                  {...getRootProps()}
                  className={cn(
                    'border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer',
                    isDragActive
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-dark-700 hover:border-dark-600',
                    file && 'border-primary-500/50'
                  )}
                >
                  <input {...getInputProps()} />

                  {file ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center">
                        <FileText className="w-6 h-6 text-primary-400" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-white">{file.name}</p>
                        <p className="text-sm text-dark-500">
                          {(file.size / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Upload className="w-10 h-10 text-dark-500 mx-auto mb-4" />
                      <p className="text-dark-300">
                        Drag & drop your file here, or{' '}
                        <span className="text-primary-400">browse</span>
                      </p>
                      <p className="text-sm text-dark-500 mt-2">
                        Supports CSV, XLS, XLSX files
                      </p>
                    </>
                  )}
                </div>
              </div>

              {status === 'error' && result?.errors && (
                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg">
                  <p className="text-red-400 text-sm">{result.errors[0]}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {status !== 'success' && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-dark-800">
            <button
              onClick={resetModal}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
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
                  Import Trades
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
