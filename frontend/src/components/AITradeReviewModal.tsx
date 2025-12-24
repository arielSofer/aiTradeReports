'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Sparkles, Loader2, Download, Image as ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TradeChartViewer } from './TradeChartViewer'
import html2canvas from 'html2canvas'
import { generateTradeReview } from '@/lib/openrouter'

import { Trade } from '@/lib/store'

interface AITradeReviewModalProps {
  isOpen: boolean
  onClose: () => void
  trade: Trade | null
}

export function AITradeReviewModal({ isOpen, onClose, trade }: AITradeReviewModalProps) {
  const [loading, setLoading] = useState(false)
  const [review, setReview] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [generatingCharts, setGeneratingCharts] = useState(false)
  const [chartImages, setChartImages] = useState<string[]>([])

  const chart5minRef = useRef<HTMLDivElement>(null)
  const chart15minRef = useRef<HTMLDivElement>(null)
  const chart1hRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen && trade) {
      setReview('')
      setError('')
      setChartImages([])
    }
  }, [isOpen, trade])

  const captureChart = async (element: HTMLElement | null): Promise<string> => {
    if (!element) return ''

    try {
      // Find the canvas inside the element (lightweight-charts renders to canvas)
      const canvas = element.querySelector('canvas')
      if (canvas) {
        // Directly export canvas as image
        return canvas.toDataURL('image/png')
      }

      // Fallback to html2canvas if no canvas found
      const htmlCanvas = await html2canvas(element, {
        backgroundColor: '#0f172a',
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: true,
      })
      return htmlCanvas.toDataURL('image/png')
    } catch (error) {
      console.error('Error capturing chart:', error)
      return ''
    }
  }

  const generateCharts = async () => {
    if (!trade) return []

    setGeneratingCharts(true)
    try {
      // Wait for charts to fully render (lightweight-charts needs more time)
      await new Promise(resolve => setTimeout(resolve, 2000))

      const images: string[] = []

      // Capture each chart with retry
      const captureWithRetry = async (element: HTMLElement | null, retries = 3): Promise<string> => {
        if (!element) return ''
        for (let i = 0; i < retries; i++) {
          const img = await captureChart(element)
          if (img) return img
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        return ''
      }

      if (chart5minRef.current) {
        const img5min = await captureWithRetry(chart5minRef.current)
        if (img5min) images.push(img5min)
      }

      if (chart15minRef.current) {
        const img15min = await captureWithRetry(chart15minRef.current)
        if (img15min) images.push(img15min)
      }

      if (chart1hRef.current) {
        const img1h = await captureWithRetry(chart1hRef.current)
        if (img1h) images.push(img1h)
      }

      return images
    } finally {
      setGeneratingCharts(false)
    }
  }

  const handleGenerateReview = async () => {
    if (!trade || !trade.exitTime) {
      setError('עסקה חייבת להיות סגורה כדי לקבל סקירה')
      return
    }

    setLoading(true)
    setError('')
    setReview('')

    try {
      // First generate chart images
      const images = await generateCharts()

      if (images.length === 0) {
        throw new Error('לא הצלחתי ליצור את הגרפים')
      }

      setChartImages(images)

      // Try API route first (works on Vercel), fallback to client-side
      let data: { review: string; model?: string }

      try {
        // Try API route
        const response = await fetch('/api/ai/review-trade', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            images: images,
            tradeData: {
              symbol: trade.symbol,
              direction: trade.direction,
              entryTime: trade.entryTime,
              exitTime: trade.exitTime,
              entryPrice: trade.entryPrice,
              exitPrice: trade.exitPrice || trade.entryPrice,
              quantity: trade.quantity,
              pnl: trade.pnlNet || 0,
              timeframe: 'multiple',
            }
          })
        })

        if (response.ok) {
          data = await response.json()
        } else {
          // Fallback to client-side
          data = await generateTradeReview({
            images: images,
            tradeData: {
              symbol: trade.symbol,
              direction: trade.direction,
              entryTime: trade.entryTime,
              exitTime: trade.exitTime,
              entryPrice: trade.entryPrice,
              exitPrice: trade.exitPrice || trade.entryPrice,
              quantity: trade.quantity,
              pnl: trade.pnlNet || 0,
              timeframe: 'multiple',
            }
          })
        }
      } catch (apiError) {
        // Fallback to client-side if API route fails
        data = await generateTradeReview({
          images: images,
          tradeData: {
            symbol: trade.symbol,
            direction: trade.direction,
            entryTime: trade.entryTime,
            exitTime: trade.exitTime,
            entryPrice: trade.entryPrice,
            exitPrice: trade.exitPrice || trade.entryPrice,
            quantity: trade.quantity,
            pnl: trade.pnlNet || 0,
            timeframe: 'multiple',
          }
        })
      }

      setReview(data.review || 'לא התקבלה סקירה')
    } catch (error: any) {
      console.error('Error generating review:', error)

      // Show user-friendly error message
      let errorMessage = error.message || 'שגיאה ביצירת סקירה'

      // Add retry suggestion for rate limits
      if (error.message?.includes('יותר מדי בקשות')) {
        errorMessage = error.message
      } else if (error.message?.includes('429')) {
        errorMessage = 'יותר מדי בקשות. אנא נסה שוב בעוד כמה דקות.'
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !trade) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-white">AI Trade Review</h2>
              <p className="text-sm text-dark-500">{trade.symbol} · {trade.direction.toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg transition-colors">
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Trade Info */}
          <div className="mb-6 p-4 bg-dark-800/50 rounded-xl border border-dark-700">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-dark-500">Entry:</span>
                <span className="text-white ml-2">${trade.entryPrice.toLocaleString()}</span>
              </div>
              <div>
                <span className="text-dark-500">Exit:</span>
                <span className="text-white ml-2">${(trade.exitPrice || trade.entryPrice).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-dark-500">P&L:</span>
                <span className={cn('ml-2', trade.pnlNet && trade.pnlNet >= 0 ? 'text-profit' : 'text-loss')}>
                  ${(trade.pnlNet || 0).toFixed(2)}
                </span>
              </div>
              <div>
                <span className="text-dark-500">Quantity:</span>
                <span className="text-white ml-2">{trade.quantity}</span>
              </div>
            </div>
          </div>

          {/* Charts Preview (visible, used for capture) */}
          {trade.exitTime && !review && (
            <div className="space-y-4 mb-6">
              <h4 className="text-sm font-medium text-white mb-3">Charts for AI Review</h4>
              <div ref={chart5minRef} className="border border-dark-700 rounded-lg overflow-hidden h-[400px]">
                <TradeChartViewer
                  trade={trade}
                  initialTimeframe="5m"
                  hideControls={true}
                />
              </div>
              <div ref={chart15minRef} className="border border-dark-700 rounded-lg overflow-hidden h-[400px]">
                <TradeChartViewer
                  trade={trade}
                  initialTimeframe="15m"
                  hideControls={true}
                />
              </div>
              <div ref={chart1hRef} className="border border-dark-700 rounded-lg overflow-hidden h-[400px]">
                <TradeChartViewer
                  trade={trade}
                  initialTimeframe="1h"
                  hideControls={true}
                />
              </div>
            </div>
          )}

          {/* Generate Button */}
          {!review && (
            <div className="text-center py-8">
              <button
                onClick={handleGenerateReview}
                disabled={loading || generatingCharts || !trade.exitTime}
                className="btn-primary flex items-center gap-2 mx-auto"
              >
                {loading || generatingCharts ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {generatingCharts ? 'יוצר גרפים...' : 'מבקש סקירה מ-AI...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    צור סקירת AI
                  </>
                )}
              </button>
              {!trade.exitTime && (
                <p className="text-sm text-dark-500 mt-4">
                  רק עסקאות סגורות יכולות לקבל סקירה
                </p>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-4 bg-loss/20 border border-loss/50 rounded-lg mb-4">
              <div className="text-loss text-sm mb-3 whitespace-pre-wrap">
                {error}
              </div>
              {error.includes('יותר מדי בקשות') && (
                <button
                  onClick={handleGenerateReview}
                  disabled={loading || generatingCharts}
                  className="btn-primary flex items-center gap-2 text-sm"
                >
                  {loading || generatingCharts ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      מנסה שוב...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      נסה שוב
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Review */}
          {review && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-display font-semibold text-white">AI Review</h3>
                <button
                  onClick={() => {
                    const blob = new Blob([review], { type: 'text/plain' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `trade-review-${trade.symbol}-${Date.now()}.txt`
                    a.click()
                  }}
                  className="btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download className="w-4 h-4" />
                  הורד
                </button>
              </div>

              <div className="p-6 bg-dark-800/50 rounded-xl border border-dark-700">
                <div className="prose prose-invert max-w-none">
                  <pre className="text-sm text-dark-200 whitespace-pre-wrap font-sans">
                    {review}
                  </pre>
                </div>
              </div>

              {/* Chart Images Preview */}
              {chartImages.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Charts Sent to AI
                  </h4>
                  <div className="grid grid-cols-3 gap-4">
                    {chartImages.map((img, idx) => (
                      <div key={idx} className="border border-dark-700 rounded-lg overflow-hidden">
                        <img
                          src={img}
                          alt={`Chart ${idx + 1}`}
                          className="w-full h-auto"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t border-dark-800">
          <button onClick={onClose} className="btn-secondary">
            סגור
          </button>
        </div>
      </div>
    </div>
  )
}

