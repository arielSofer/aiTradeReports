'use client'

import { useEffect, useRef, useState } from 'react'
import { Trade } from '@/lib/store'
import { TrendingUp, TrendingDown, Clock, DollarSign, Maximize2, Minimize2 } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// Timeframes זמינים
const TIMEFRAMES = [
  { value: '5m', label: '5 דק׳' },
  { value: '15m', label: '15 דק׳' },
  { value: '1h', label: '1 שעה' },
] as const

type Timeframe = typeof TIMEFRAMES[number]['value']

interface TradeChartViewerProps {
  trade: Trade
  onClose?: () => void
  isFullScreen?: boolean
  onToggleFullScreen?: () => void
}

export function TradeChartViewer({
  trade,
  onClose,
  isFullScreen = false,
  onToggleFullScreen
}: TradeChartViewerProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef = useRef<any>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)
  const isDisposedRef = useRef(false)
  const [marketData, setMarketData] = useState<CandleData[]>([])
  const [isMounted, setIsMounted] = useState(false)
  const [timeframe, setTimeframe] = useState<Timeframe>('15m')

  // רק לאחר mount ניתן לגשת ל-window
  useEffect(() => {
    setIsMounted(true)
    return () => {
      isDisposedRef.current = true
    }
  }, [])

  // יצירת נתונים סינתטיים
  useEffect(() => {
    // Helper to generate realistic looking candles around trade entry/exit
    const generateData = () => {
      const entryTime = new Date(trade.entryTime).getTime() / 1000
      const exitTime = trade.exitTime ? new Date(trade.exitTime).getTime() / 1000 : entryTime + 3600 // Default 1h duration if open

      const duration = exitTime - entryTime
      const paddingBefore = 3600 * 4 // Show 4 hours before
      const paddingAfter = 3600 * 2 // Show 2 hours after

      const startTime = entryTime - paddingBefore
      const endTime = exitTime + paddingAfter

      const data: CandleData[] = []
      let currentTime = startTime

      // Interval in seconds
      const interval = timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 3600

      // Start price slightly offset from entry to verify we cross it
      let currentPrice = trade.entryPrice * 0.995
      let trend = trade.direction === 'long' ? 1 : -1

      // Adjust trend logic:
      // If winner: price should move in direction
      // If loser: price should move against direction
      const isWinner = trade.pnlNet && trade.pnlNet > 0
      const mainTrend = (trade.direction === 'long' && isWinner) || (trade.direction === 'short' && !isWinner) ? 1 : -1

      // Volatility factor
      const volatility = trade.entryPrice * 0.001

      while (currentTime <= endTime) {
        // Simple random walk with trend bias
        const move = (Math.random() - 0.45) * volatility + (mainTrend * volatility * 0.1)
        const close = currentPrice + move
        const high = Math.max(currentPrice, close) + Math.random() * volatility
        const low = Math.min(currentPrice, close) - Math.random() * volatility

        // Force price to touch entry/exit at correct times
        // This is "cheating" to make the chart look perfect for the specific trade
        if (Math.abs(currentTime - entryTime) < interval) {
          // Close to entry
          // Ensure candle spans entry price
          // @ts-ignore
          if (Math.abs(currentTime - entryTime) <= interval / 2) {
            // Exact entry candle
          }
        }

        data.push({
          time: currentTime,
          open: currentPrice,
          high: high,
          low: low,
          close: close
        })

        currentPrice = close
        currentTime += interval
      }

      // 2nd pass: Smooth out and ensure entry/exit visual exactness
      // Find candle closest to entry
      const entryIdx = data.findIndex(c => Math.abs(c.time - entryTime) < interval)
      if (entryIdx !== -1) {
        // ensure candle body or wick covers entry price
        data[entryIdx].open = trade.entryPrice - volatility / 2
        data[entryIdx].close = trade.entryPrice + volatility / 2
        data[entryIdx].high = Math.max(data[entryIdx].high, trade.entryPrice + volatility)
        data[entryIdx].low = Math.min(data[entryIdx].low, trade.entryPrice - volatility)
      }

      if (trade.exitPrice) {
        const exitIdx = data.findIndex(c => Math.abs(c.time - exitTime) < interval)
        if (exitIdx !== -1) {
          // ensure candle body or wick covers exit price
          data[exitIdx].high = Math.max(data[exitIdx].high, trade.exitPrice)
          data[exitIdx].low = Math.min(data[exitIdx].low, trade.exitPrice)
          // Make it close near exit price
          data[exitIdx].close = trade.exitPrice
        }
      }

      setMarketData(data)
    }

    generateData()
  }, [trade, timeframe])

  // יצירת הגרף
  useEffect(() => {
    if (!chartContainerRef.current || marketData.length === 0 || !isMounted) return

    // סימון שהגרף פעיל
    isDisposedRef.current = false

    // הסרת resize handler קודם
    if (resizeHandlerRef.current) {
      window.removeEventListener('resize', resizeHandlerRef.current)
      resizeHandlerRef.current = null
    }

    // ניקוי גרף קודם לפני יצירת חדש
    if (chartRef.current) {
      try {
        chartRef.current.remove()
      } catch {
        // Ignore if already disposed
      }
      chartRef.current = null
    }

    // ייבוא דינמי של lightweight-charts
    const initChart = async () => {
      const { createChart, ColorType } = await import('lightweight-charts')

      // בדיקה אם הקומפוננטה נמחקה בזמן הטעינה
      if (isDisposedRef.current || !chartContainerRef.current) return

      // יצירת גרף חדש עם עיצוב מתקדם
      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { type: ColorType.Solid, color: '#0f0f14' },
          textColor: '#9ca3af',
          fontFamily: "'JetBrains Mono', monospace",
        },
        grid: {
          vertLines: { color: 'rgba(55, 65, 81, 0.3)' },
          horzLines: { color: 'rgba(55, 65, 81, 0.3)' },
        },
        width: chartContainerRef.current.clientWidth,
        height: isFullScreen ? window.innerHeight - 100 : 400,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#374151',
        },
        rightPriceScale: {
          borderColor: '#374151',
          scaleMargins: {
            top: 0.1,
            bottom: 0.1,
          },
        },
        crosshair: {
          mode: 1,
          vertLine: {
            color: 'rgba(99, 102, 241, 0.5)',
            width: 1,
            style: 2,
          },
          horzLine: {
            color: 'rgba(99, 102, 241, 0.5)',
            width: 1,
            style: 2,
          },
        },
      })

      // בדיקה נוספת לאחר יצירת הגרף
      if (isDisposedRef.current) {
        chart.remove()
        return
      }

      chartRef.current = chart

      // הגדרת סדרת הנרות
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      })

      // הוספת נתוני השוק
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      candleSeries.setData(marketData as any)

      // יצירת markers לכניסה ויציאה של העסקה
      const entryTime = new Date(trade.entryTime).getTime() / 1000
      const exitTime = trade.exitTime ? new Date(trade.exitTime).getTime() / 1000 : null

      // מציאת הנרות הקרובים ביותר לזמני הכניסה והיציאה
      const findClosestCandle = (targetTime: number) => {
        let closest = marketData[0]
        let minDiff = Math.abs(marketData[0].time - targetTime)

        for (const candle of marketData) {
          const diff = Math.abs(candle.time - targetTime)
          if (diff < minDiff) {
            minDiff = diff
            closest = candle
          }
        }
        return closest
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markers: any[] = []

      // Entry marker
      const entryCandle = findClosestCandle(entryTime)
      const isLong = trade.direction === 'long'

      markers.push({
        time: entryCandle.time,
        position: isLong ? 'belowBar' : 'aboveBar',
        color: '#3b82f6',
        shape: isLong ? 'arrowUp' : 'arrowDown',
        text: `כניסה @ ${trade.entryPrice.toFixed(2)}`,
        size: 2,
      })

      // Exit marker
      if (exitTime && trade.exitPrice) {
        const exitCandle = findClosestCandle(exitTime)
        const isProfit = trade.pnlNet !== undefined && trade.pnlNet >= 0

        markers.push({
          time: exitCandle.time,
          position: isLong ? 'aboveBar' : 'belowBar',
          color: isProfit ? '#10b981' : '#ef4444',
          shape: isLong ? 'arrowDown' : 'arrowUp',
          text: `יציאה @ ${trade.exitPrice.toFixed(2)}`,
          size: 2,
        })
      }

      // הוספת קו רמה לכניסה
      candleSeries.createPriceLine({
        price: trade.entryPrice,
        color: '#3b82f6',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'Entry',
      })

      // הוספת קו רמה ליציאה
      if (trade.exitPrice) {
        candleSeries.createPriceLine({
          price: trade.exitPrice,
          color: trade.pnlNet && trade.pnlNet >= 0 ? '#10b981' : '#ef4444',
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: 'Exit',
        })
      }

      candleSeries.setMarkers(markers)

      // מרכוז הגרף סביב העסקה
      chart.timeScale().fitContent()

      // Resize handler - שמירה ב-ref כדי שנוכל להסיר אותו ב-cleanup
      resizeHandlerRef.current = () => {
        if (!isDisposedRef.current && chartContainerRef.current && chartRef.current) {
          try {
            chartRef.current.applyOptions({
              width: chartContainerRef.current.clientWidth,
              height: isFullScreen ? window.innerHeight - 100 : 400,
            })
          } catch {
            // Ignore if disposed
          }
        }
      }

      window.addEventListener('resize', resizeHandlerRef.current)
    }

    initChart()

    return () => {
      // סימון שהגרף disposed
      isDisposedRef.current = true

      // הסרת event listener
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current)
        resizeHandlerRef.current = null
      }

      // ניקוי הגרף
      if (chartRef.current) {
        try {
          chartRef.current.remove()
        } catch {
          // Ignore if already disposed
        }
        chartRef.current = null
      }
    }
  }, [marketData, trade, isFullScreen, isMounted])

  if (!isMounted) {
    return (
      <div className="bg-dark-900 rounded-xl border border-dark-800 p-8 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "bg-dark-900 rounded-xl border border-dark-800 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200",
      isFullScreen && "fixed inset-4 z-50 flex flex-col"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800/50 bg-dark-900/80 backdrop-blur-sm">
        <div className="flex items-center gap-4">
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
            trade.direction === 'long'
              ? "bg-accent-blue/20 text-accent-blue"
              : "bg-accent-orange/20 text-accent-orange"
          )}>
            {trade.direction === 'long' ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            {trade.symbol} - {trade.direction.toUpperCase()}
          </div>

          {trade.pnlNet !== undefined && (
            <div className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold",
              trade.pnlNet >= 0 ? "bg-profit/20 text-profit" : "bg-loss/20 text-loss"
            )}>
              <DollarSign className="w-4 h-4" />
              {trade.pnlNet >= 0 ? '+' : ''}{formatCurrency(trade.pnlNet)}
            </div>
          )}

          {trade.durationMinutes && (
            <div className="flex items-center gap-1.5 text-sm text-dark-400">
              <Clock className="w-4 h-4" />
              {Math.floor(trade.durationMinutes / 60)}h {trade.durationMinutes % 60}m
            </div>
          )}

          {/* Timeframe Selector */}
          <div className="flex items-center gap-1 bg-dark-800 rounded-lg p-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                className={cn(
                  "px-3 py-1 text-sm font-medium rounded-md transition-all duration-200",
                  timeframe === tf.value
                    ? "bg-primary text-white shadow-lg shadow-primary/25"
                    : "text-dark-400 hover:text-dark-200 hover:bg-dark-700"
                )}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onToggleFullScreen && (
            <button
              onClick={onToggleFullScreen}
              className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
            >
              {isFullScreen ? (
                <Minimize2 className="w-5 h-5 text-dark-400" />
              ) : (
                <Maximize2 className="w-5 h-5 text-dark-400" />
              )}
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-dark-800 rounded-lg transition-colors"
            >
              <Minimize2 className="w-5 h-5 text-dark-400" />
            </button>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-w-0">
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        {/* Trade Details Panel */}
        <div className="w-64 bg-dark-850 border-l border-dark-800/50 p-4 overflow-y-auto">
          <h4 className="text-sm font-semibold text-dark-300 mb-4">פרטי העסקה</h4>

          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-dark-500 text-sm">זמן כניסה</span>
              <span className="text-dark-200 text-sm">{new Date(trade.entryTime).toLocaleString('he-IL')}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-dark-500 text-sm">מחיר כניסה</span>
              <span className="text-accent-blue text-sm font-medium">${trade.entryPrice.toFixed(2)}</span>
            </div>

            {trade.exitTime && (
              <div className="flex justify-between">
                <span className="text-dark-500 text-sm">זמן יציאה</span>
                <span className="text-dark-200 text-sm">{new Date(trade.exitTime).toLocaleString('he-IL')}</span>
              </div>
            )}

            {trade.exitPrice && (
              <div className="flex justify-between">
                <span className="text-dark-500 text-sm">מחיר יציאה</span>
                <span className={cn(
                  "text-sm font-medium",
                  trade.pnlNet && trade.pnlNet >= 0 ? "text-profit" : "text-loss"
                )}>
                  ${trade.exitPrice.toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-dark-500 text-sm">כמות</span>
              <span className="text-dark-200 text-sm">{trade.quantity}</span>
            </div>

            <div className="flex justify-between">
              <span className="text-dark-500 text-sm">עמלות</span>
              <span className="text-dark-400 text-sm">${trade.commission.toFixed(2)}</span>
            </div>

            {trade.pnlPercent !== undefined && (
              <div className="flex justify-between">
                <span className="text-dark-500 text-sm">שינוי %</span>
                <span className={cn(
                  "text-sm font-medium",
                  trade.pnlPercent >= 0 ? "text-profit" : "text-loss"
                )}>
                  {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                </span>
              </div>
            )}

            <div className="pt-3 border-t border-dark-700">
              <div className="flex justify-between items-center">
                <span className="text-dark-400 font-medium">P&L נטו</span>
                {trade.pnlNet !== undefined && (
                  <span className={cn(
                    "text-lg font-bold",
                    trade.pnlNet >= 0 ? "text-profit" : "text-loss"
                  )}>
                    {trade.pnlNet >= 0 ? '+' : ''}{formatCurrency(trade.pnlNet)}
                  </span>
                )}
              </div>
            </div>

            {trade.tags.length > 0 && (
              <div className="pt-3 border-t border-dark-700">
                <span className="text-dark-500 text-sm block mb-2">תגיות</span>
                <div className="flex flex-wrap gap-1">
                  {trade.tags.map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-dark-700 text-dark-300 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {trade.notes && (
              <div className="pt-3 border-t border-dark-700">
                <span className="text-dark-500 text-sm block mb-2">הערות</span>
                <p className="text-dark-300 text-sm italic">&quot;{trade.notes}&quot;</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

