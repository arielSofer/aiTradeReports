'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { X, Upload, FileText, Check, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  const [selectedBroker, setSelectedBroker] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<UploadStatus>('idle')
  const [result, setResult] = useState<any>(null)

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
    if (!file) return

    setStatus('uploading')
    
    // Simulate upload - replace with actual API call
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Mock result
    setResult({
      success: true,
      tradesCreated: 10,
      totalPnl: 3633.25,
      winRate: 80.0,
      dateRange: {
        start: '2024-01-15',
        end: '2024-01-18',
      },
    })
    setStatus('success')
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
              
              <div className="grid grid-cols-3 gap-4 py-4">
                <div className="p-4 bg-dark-800 rounded-lg">
                  <p className="text-2xl font-bold text-profit">
                    ${result.totalPnl.toFixed(2)}
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

              <button 
                onClick={resetModal}
                className="btn-primary"
              >
                View Dashboard
              </button>
            </div>
          ) : (
            <>
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
              disabled={!file || status === 'uploading'}
              className={cn(
                'btn-primary flex items-center gap-2',
                (!file || status === 'uploading') && 'opacity-50 cursor-not-allowed'
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
