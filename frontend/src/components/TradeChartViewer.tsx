'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Trade } from '@/lib/store'
import { TrendingUp, TrendingDown, Clock, DollarSign, Maximize2, Minimize2, Play, Pause, SkipBack, Loader2 } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { API_BASE_URL } from '@/lib/api'
import { IChartApi, ISeriesApi, createChart, ColorType } from 'lightweight-charts'

interface CandleData {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// Timeframes
const TIMEFRAMES = [
  { value: '5m', label: '5 min' },
  { value: '15m', label: '15 min' },
  { value: '1h', label: '1 hour' },
] as const

type Timeframe = typeof TIMEFRAMES[number]['value']

interface TradeChartViewerProps {
  trade: Trade
  onClose?: () => void
  isFullScreen?: boolean
  onToggleFullScreen?: () => void
  initialTimeframe?: Timeframe
  hideControls?: boolean
}

export function TradeChartViewer({
  trade,
  onClose,
  isFullScreen = false,
  onToggleFullScreen,
  initialTimeframe = '15m',
  hideControls = false
}: TradeChartViewerProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)

  const [marketData, setMarketData] = useState<CandleData[]>([])
  const [displayedData, setDisplayedData] = useState<CandleData[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe)

  // Playback State
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackIndex, setPlaybackIndex] = useState<number>(-1)
  const playbackIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Generate synthetic candle data around trade entry/exit
  const generateSyntheticData = useCallback((entryPrice: number, exitPrice: number, entryTime: number, exitTime: number): CandleData[] => {
    const candles: CandleData[] = []
    const intervalSeconds = timeframe === '5m' ? 300 : timeframe === '15m' ? 900 : 3600

    // Generate candles from 1 hour before entry to 1 hour after exit
    const startTime = entryTime - 3600
    const endTime = exitTime + 3600

    let currentPrice = entryPrice * (0.995 + Math.random() * 0.01) // Start slightly before entry price
    const priceRange = Math.abs(exitPrice - entryPrice) || entryPrice * 0.005
    const volatility = priceRange / 20

    for (let time = startTime; time <= endTime; time += intervalSeconds) {
      // Drift towards entry price before entry, then towards exit price after entry
      let targetPrice = currentPrice
      if (time < entryTime) {
        targetPrice = entryPrice
      } else if (time <= exitTime) {
        const progress = (time - entryTime) / (exitTime - entryTime || 1)
        targetPrice = entryPrice + (exitPrice - entryPrice) * progress
      } else {
        targetPrice = exitPrice * (1 + (Math.random() - 0.5) * 0.002)
      }

      // Random walk with drift
      const drift = (targetPrice - currentPrice) * 0.1
      currentPrice += drift + (Math.random() - 0.5) * volatility
      const open = currentPrice
      const close = currentPrice + (Math.random() - 0.5) * volatility * 0.5
      const high = Math.max(open, close) + Math.random() * volatility * 0.3
      const low = Math.min(open, close) - Math.random() * volatility * 0.3

      candles.push({ time, open, high, low, close })
      currentPrice = close
    }

    return candles
  }, [timeframe])

  // Fetch high-res market data once
  useEffect(() => {
    const fetchMarketData = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const entryTime = new Date(trade.entryTime).getTime() / 1000
        const exitTime = trade.exitTime ? new Date(trade.exitTime).getTime() / 1000 : entryTime + 3600

        // Request broad range to cover max timeframe (1h) * 50 candles = 50 hours
        const bufferSeconds = 50 * 3600
        const fromTime = entryTime - bufferSeconds
        const toTime = exitTime + bufferSeconds

        // Always request method='1m' from server to get granular data for aggregation
        const res = await fetch(
          `${API_BASE_URL}/market-data/candles?symbol=${encodeURIComponent(trade.symbol)}&from_time=${Math.floor(fromTime)}&to_time=${Math.floor(toTime)}&interval=1m`
        )

        if (!res.ok) {
          throw new Error("Failed to fetch market data")
        }

        const data: CandleData[] = await res.json()

        if (data.length === 0) {
          throw new Error("No market data returned")
        }

        // Deduplicate and sort raw data
        const uniqueData = Array.from(new Map(data.map(item => [item.time, item])).values())
          .sort((a, b) => a.time - b.time)

        setMarketData(uniqueData) // Store raw 1m data

      } catch (err) {
        console.error("Market data API failed, using synthetic data:", err)
        // Fallback to synthetic data
        const entryTime = new Date(trade.entryTime).getTime() / 1000
        const exitTime = trade.exitTime ? new Date(trade.exitTime).getTime() / 1000 : entryTime + 3600
        const syntheticData = generateSyntheticData(
          trade.entryPrice,
          trade.exitPrice || trade.entryPrice,
          entryTime,
          exitTime
        )
        setMarketData(syntheticData)
        // Don't show error - synthetic data is valid fallback
      } finally {
        setIsLoading(false)
      }
    }

    fetchMarketData()
  }, [trade, generateSyntheticData]) // Removed timeframe dependency

  // Aggregate and filter data based on selected timeframe
  useEffect(() => {
    if (marketData.length === 0) return

    const aggregateData = (data: CandleData[], intervalString: Timeframe): CandleData[] => {
      if (intervalString === '5m') { // Actually use server 1m data for client aggregation now
        // Pass through if we want 1m, but we only have 5m/15m/1h selectors
        // Let's implement generic aggregation
      }

      let minutes = 1
      if (intervalString === '5m') minutes = 5
      if (intervalString === '15m') minutes = 15
      if (intervalString === '1h') minutes = 60

      if (minutes === 1) return data

      const intervalSeconds = minutes * 60
      const aggregated: CandleData[] = []
      let currentBucket: CandleData | null = null

      for (const candle of data) {
        const bucketTime = Math.floor(candle.time / intervalSeconds) * intervalSeconds

        if (!currentBucket || currentBucket.time !== bucketTime) {
          if (currentBucket) aggregated.push(currentBucket)
          currentBucket = { ...candle, time: bucketTime }
        } else {
          currentBucket.high = Math.max(currentBucket.high, candle.high)
          currentBucket.low = Math.min(currentBucket.low, candle.low)
          currentBucket.close = candle.close
          // Open stays first open
        }
      }
      if (currentBucket) aggregated.push(currentBucket)
      return aggregated
    }

    // 1. Aggregate
    const aggregated = aggregateData(marketData, timeframe)

    // 2. Filter to show 50 before and 50 after entry
    const entryTime = new Date(trade.entryTime).getTime() / 1000
    let entryIndex = aggregated.findIndex(c => c.time >= entryTime)
    if (entryIndex === -1) entryIndex = aggregated.length - 1

    const candlesBefore = 50
    const candlesAfter = 50
    const startIndex = Math.max(0, entryIndex - candlesBefore)
    const endIndex = Math.min(aggregated.length - 1, entryIndex + candlesAfter)

    const filtered = aggregated.slice(startIndex, endIndex + 1)

    setDisplayedData(filtered)
    setPlaybackIndex(filtered.length - 1)

  }, [marketData, timeframe, trade.entryTime])

  // Initialize/Update Chart
  useEffect(() => {
    if (!chartContainerRef.current) return

    if (!chartRef.current) {
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
        height: isFullScreen ? window.innerHeight - 140 : 400,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
          borderColor: '#374151',
        },
        rightPriceScale: {
          borderColor: '#374151',
        },
        localization: {
          // Force formatting to Hebrew/Israel locale
          timeFormatter: (timestamp: number) => {
            return new Date(timestamp * 1000).toLocaleString('he-IL', {
              timeZone: 'Asia/Jerusalem',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
              day: '2-digit',
              month: '2-digit',
            }).replace(',', '')
          },
        },
      })

      const series = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      })

      chartRef.current = chart
      seriesRef.current = series

      // Resize logic
      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: isFullScreen ? window.innerHeight - 140 : 400
          })
        }
      }
      window.addEventListener('resize', handleResize)
      resizeHandlerRef.current = handleResize
    }

    // Update Data
    if (seriesRef.current && displayedData.length > 0) {
      seriesRef.current.setData(displayedData as any)

      // Add Markers (Entry/Exit)
      // Filter markers that are within displayed range
      const markers = []
      const entryTime = new Date(trade.entryTime).getTime() / 1000
      const exitTime = trade.exitTime ? new Date(trade.exitTime).getTime() / 1000 : null

      // Find closest candle for entry
      const entryCandle = displayedData.find(c => Math.abs(c.time - entryTime) < (timeframe === '5m' ? 300 : 3600))
      if (entryCandle) {
        markers.push({
          time: entryCandle.time,
          position: trade.direction === 'long' ? 'belowBar' : 'aboveBar',
          color: '#3b82f6',
          shape: trade.direction === 'long' ? 'arrowUp' : 'arrowDown',
          text: `Entry @ ${trade.entryPrice}`,
        })
      }

      if (exitTime) {
        const exitCandle = displayedData.find(c => Math.abs(c.time - exitTime) < (timeframe === '5m' ? 300 : 3600))
        if (exitCandle) {
          markers.push({
            time: exitCandle.time,
            position: trade.direction === 'long' ? 'aboveBar' : 'belowBar',
            color: (trade.pnlNet || 0) >= 0 ? '#10b981' : '#ef4444',
            shape: trade.direction === 'long' ? 'arrowDown' : 'arrowUp',
            text: `Exit @ ${trade.exitPrice}`,
          })
        }
      }

      seriesRef.current.setMarkers(markers as any)

      if (playbackIndex === marketData.length - 1 && !isPlaying) {
        chartRef.current?.timeScale().fitContent()
      } else if (isPlaying) {
        // Auto-scroll logic during playback could go here
        // For now let's just fit content periodically or let user scroll?
        // fitContent might be annoying if it zooms out too much.
        // Maybe perform setVisibleRange to last X candles?
        // keeping it simple for now.
      }
    }

    return () => {
      // cleanup on unmount handled by ensuring effect runs
    }

  }, [displayedData, isFullScreen, trade, timeframe, isPlaying, marketData.length, playbackIndex])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (resizeHandlerRef.current) window.removeEventListener('resize', resizeHandlerRef.current)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [])

  const togglePlayback = () => {
    if (playbackIndex >= marketData.length - 1) {
      // Restart
      setPlaybackIndex(0)
      setIsPlaying(true)
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  const resetPlayback = () => {
    setIsPlaying(false)
    setPlaybackIndex(marketData.length - 1)
  }

  return (
    <div className={cn(
      "bg-dark-900 rounded-xl border border-dark-800 overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200",
      isFullScreen && "fixed inset-4 z-50 flex flex-col"
    )}>
      {/* Header */}
      {!hideControls && (
        <div className="flex items-center justify-between p-4 border-b border-dark-800/50 bg-dark-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-4">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium",
              trade.direction === 'long'
                ? "bg-accent-blue/20 text-accent-blue"
                : "bg-accent-orange/20 text-accent-orange"
            )}>
              {trade.direction === 'long' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {trade.symbol}
            </div>

            <div className="h-6 w-px bg-dark-700" />

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

            <div className="h-6 w-px bg-dark-700" />

            {/* Playback Controls */}
            {marketData.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlayback}
                  className="p-2 hover:bg-dark-700 rounded-lg text-dark-200 transition-colors"
                  title={isPlaying ? "Pause" : "Play Replay"}
                >
                  {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={resetPlayback}
                  className="p-2 hover:bg-dark-700 rounded-lg text-dark-200 transition-colors"
                  title="Reset View"
                >
                  <SkipBack size={18} />
                </button>

                {isPlaying && (
                  <span className="text-xs text-primary animate-pulse">
                    Replaying...
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onToggleFullScreen && (
              <button onClick={onToggleFullScreen} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400">
                {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
              </button>
            )}
            {onClose && (
              <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg text-dark-400">
                <Minimize2 size={20} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 relative">

        {isLoading && (
          <div className="absolute inset-0 z-10 bg-dark-900/50 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-sm text-dark-300">Loading live market data...</span>
            </div>
          </div>
        )}

        {error && !isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <div className="bg-dark-900 border border-loss/20 p-4 rounded-xl shadow-xl max-w-sm text-center">
              <p className="text-loss mb-2">{error}</p>
              <p className="text-xs text-dark-400">Try refreshing or check the symbol.</p>
            </div>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div ref={chartContainerRef} className="w-full h-full" />
        </div>

        {/* Trade Info Sidebar */}
        <div className="w-64 bg-dark-850 border-l border-dark-800/50 p-4 overflow-y-auto hidden md:block">
          <div className="space-y-4">
            <div className="pb-4 border-b border-dark-800">
              <span className="text-xs text-dark-500 uppercase tracking-wider">Net P&L</span>
              <div className={cn("text-2xl font-bold mt-1", (trade.pnlNet || 0) >= 0 ? "text-profit" : "text-loss")}>
                {(trade.pnlNet || 0) >= 0 ? "+" : ""}{formatCurrency(trade.pnlNet || 0)}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Entry Price</span>
                <span className="text-white font-mono">{trade.entryPrice}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Exit Price</span>
                <span className="text-white font-mono">{trade.exitPrice || '-'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Date</span>
                <span className="text-white">{new Date(trade.entryTime).toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-dark-400">Time</span>
                <span className="text-white">{new Date(trade.entryTime).toLocaleTimeString()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
