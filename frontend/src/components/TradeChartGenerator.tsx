'use client'

import { useEffect, useRef } from 'react'
import { createChart, IChartApi, ISeriesApi, ColorType, Time, CandlestickData } from 'lightweight-charts'

interface TradeChartGeneratorProps {
  trade: {
    symbol: string
    entryTime: string
    exitTime: string
    entryPrice: number
    exitPrice: number
    direction: 'long' | 'short'
  }
  timeframe: '5min' | '15min' | '1h'
}

/**
 * Generate candlestick data around entry/exit points
 */
function generateCandlestickData(
  entryTime: Date,
  exitTime: Date,
  entryPrice: number,
  exitPrice: number,
  direction: 'long' | 'short',
  timeframe: '5min' | '15min' | '1h'
): CandlestickData[] {
  const data: CandlestickData[] = []
  
  // Calculate timeframe in seconds
  const timeframeSeconds = timeframe === '5min' ? 300 : timeframe === '15min' ? 900 : 3600
  
  // Start 30 periods before entry, end 30 periods after exit
  const startTime = Math.floor((entryTime.getTime() / 1000) - (30 * timeframeSeconds))
  const endTime = Math.floor((exitTime.getTime() / 1000) + (30 * timeframeSeconds))
  
  // Calculate price movement
  const priceChange = exitPrice - entryPrice
  const priceRange = Math.abs(priceChange) || entryPrice * 0.15
  const volatility = entryPrice * 0.01 // 1% volatility per candle for more realistic look
  
  let currentTime = startTime
  const entryTimeSeconds = Math.floor(entryTime.getTime() / 1000)
  const exitTimeSeconds = Math.floor(exitTime.getTime() / 1000)
  const totalPeriods = Math.floor((endTime - startTime) / timeframeSeconds)
  
  // Start price slightly below entry for context
  let currentPrice = entryPrice - (priceRange * 0.2)
  let previousClose = currentPrice
  
  while (currentTime <= endTime) {
    const isEntry = Math.abs(currentTime - entryTimeSeconds) < timeframeSeconds / 2
    const isExit = Math.abs(currentTime - exitTimeSeconds) < timeframeSeconds / 2
    
    if (isEntry) {
      // At entry, ensure the candle reflects entry price
      currentPrice = entryPrice
      previousClose = entryPrice
    } else if (isExit) {
      // At exit, ensure the candle reflects exit price
      currentPrice = exitPrice
    } else {
      // Calculate progress through the trade (0 to 1)
      const progress = (currentTime - entryTimeSeconds) / (exitTimeSeconds - entryTimeSeconds)
      
      // Smooth trend toward exit price
      const targetPrice = entryPrice + (priceChange * Math.max(0, Math.min(1, progress)))
      
      // Add realistic volatility with mean reversion
      const meanReversion = (targetPrice - currentPrice) * 0.1
      const randomWalk = (Math.random() - 0.5) * volatility * 2
      const momentum = (currentPrice - previousClose) * 0.3 // Momentum factor
      
      currentPrice = currentPrice + meanReversion + randomWalk + momentum
    }
    
    // Create realistic OHLC for candlestick
    const open = previousClose
    const bodySize = volatility * (0.3 + Math.random() * 0.7) // 30-100% of volatility
    const isUp = Math.random() > 0.4 // 60% chance of up candle for trending market
    
    let close: number
    if (isEntry) {
      close = entryPrice
    } else if (isExit) {
      close = exitPrice
    } else {
      close = isUp ? open + bodySize : open - bodySize
    }
    
    // Wicks should extend beyond body
    const wickSize = bodySize * (0.2 + Math.random() * 0.8) // 20-100% of body
    const high = Math.max(open, close) + wickSize * Math.random()
    const low = Math.min(open, close) - wickSize * Math.random()
    
    // Ensure prices are valid
    const candle = {
      time: currentTime as Time,
      open: Math.max(entryPrice * 0.7, open), // Don't go too far from entry
      high: Math.max(entryPrice * 0.7, high),
      low: Math.min(entryPrice * 1.3, low),
      close: Math.max(entryPrice * 0.7, close)
    }
    
    data.push(candle)
    previousClose = candle.close
    currentTime += timeframeSeconds
  }
  
  return data
}

/**
 * Generate a candlestick chart for AI review
 */
export function TradeChartGenerator({ trade, timeframe }: TradeChartGeneratorProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Create chart
    const chart = createChart(chartContainerRef.current, {
      width: 800,
      height: 400,
      layout: {
        background: { type: ColorType.Solid, color: '#0f172a' },
        textColor: '#94a3b8',
      },
      grid: {
        vertLines: { color: '#1e293b' },
        horzLines: { color: '#1e293b' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
    })

    chartRef.current = chart

    // Add candlestick series with better styling
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderUpColor: '#16a34a',
      borderDownColor: '#dc2626',
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      borderVisible: true,
    })

    seriesRef.current = candlestickSeries

    // Generate candlestick data
    const entryTime = new Date(trade.entryTime)
    const exitTime = new Date(trade.exitTime)
    const data = generateCandlestickData(
      entryTime,
      exitTime,
      trade.entryPrice,
      trade.exitPrice,
      trade.direction,
      timeframe
    )
    
    candlestickSeries.setData(data)

    // Add entry marker
    const entryTimeSeconds = Math.floor(entryTime.getTime() / 1000)
    const entryMarker = {
      time: entryTimeSeconds as Time,
      position: 'belowBar' as const,
      color: trade.direction === 'long' ? '#22c55e' : '#ef4444',
      shape: trade.direction === 'long' ? 'arrowUp' as const : 'arrowDown' as const,
      text: `Entry: $${trade.entryPrice.toLocaleString()}`,
    }

    // Add exit marker
    const exitTimeSeconds = Math.floor(exitTime.getTime() / 1000)
    const exitMarker = {
      time: exitTimeSeconds as Time,
      position: 'aboveBar' as const,
      color: trade.direction === 'long' ? '#ef4444' : '#22c55e',
      shape: 'circle' as const,
      text: `Exit: $${trade.exitPrice.toLocaleString()}`,
    }

    candlestickSeries.setMarkers([entryMarker, exitMarker])

    // Fit content
    chart.timeScale().fitContent()

    return () => {
      chart.remove()
    }
  }, [trade, timeframe])

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full"
      style={{ width: '800px', height: '400px' }}
    />
  )
}
