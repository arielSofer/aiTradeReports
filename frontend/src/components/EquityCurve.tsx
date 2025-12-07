'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useStore } from '@/lib/store'
import { formatCurrency, formatDate } from '@/lib/utils'

export function EquityCurve() {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const resizeHandlerRef = useRef<(() => void) | null>(null)
  const isDisposedRef = useRef(false)
  const { dailyPnL } = useStore()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || !chartContainerRef.current || dailyPnL.length === 0) return

    // Reset disposed flag
    isDisposedRef.current = false

    const initChart = async () => {
      try {
        // Dynamic import only on client side
        const { createChart, ColorType } = await import('lightweight-charts')
        
        // Check if component was unmounted during async import
        if (isDisposedRef.current || !chartContainerRef.current) return

        // Clear previous chart and resize handler
        if (resizeHandlerRef.current) {
          window.removeEventListener('resize', resizeHandlerRef.current)
          resizeHandlerRef.current = null
        }
        
        if (chartRef.current) {
          try {
            chartRef.current.remove()
          } catch (e) {
            // Chart already disposed
          }
          chartRef.current = null
        }

        if (!chartContainerRef.current) return

        const chart = createChart(chartContainerRef.current, {
          layout: {
            background: { type: ColorType.Solid, color: 'transparent' },
            textColor: '#64748b',
            fontFamily: 'monospace',
          },
          grid: {
            vertLines: { color: 'rgba(30, 41, 59, 0.5)' },
            horzLines: { color: 'rgba(30, 41, 59, 0.5)' },
          },
          width: chartContainerRef.current.clientWidth,
          height: 300,
          rightPriceScale: {
            borderColor: 'rgba(30, 41, 59, 0.5)',
          },
          timeScale: {
            borderColor: 'rgba(30, 41, 59, 0.5)',
            timeVisible: true,
          },
          crosshair: {
            vertLine: {
              color: 'rgba(34, 197, 94, 0.3)',
              width: 1,
              style: 2,
            },
            horzLine: {
              color: 'rgba(34, 197, 94, 0.3)',
              width: 1,
              style: 2,
            },
          },
        })

        // Store chart reference immediately
        chartRef.current = chart

        // Configure main price scale to use full height
        chart.priceScale('right').applyOptions({
          scaleMargins: {
            top: 0.05,
            bottom: 0.05,
          },
        })

        // Area series for equity curve
        const areaSeries = chart.addAreaSeries({
          topColor: 'rgba(34, 197, 94, 0.4)',
          bottomColor: 'rgba(34, 197, 94, 0.0)',
          lineColor: '#22c55e',
          lineWidth: 2,
        })

        // Transform data for chart
        const chartData = dailyPnL.map(d => ({
          time: d.date,
          value: d.cumulativePnl,
        }))

        areaSeries.setData(chartData as any)

        // Add histogram for daily P&L
        const histogramSeries = chart.addHistogramSeries({
          color: '#22c55e',
          priceFormat: {
            type: 'price',
            precision: 2,
          },
          priceScaleId: 'histogram',
        })

        chart.priceScale('histogram').applyOptions({
          scaleMargins: {
            top: 0.75,
            bottom: 0.02,
          },
          visible: false, // Hide the histogram price scale
        })

        const histogramData = dailyPnL.map(d => ({
          time: d.date,
          value: d.pnl,
          color: d.pnl >= 0 ? 'rgba(34, 197, 94, 0.5)' : 'rgba(239, 68, 68, 0.5)',
        }))

        histogramSeries.setData(histogramData as any)

        chart.timeScale().fitContent()

        // Handle resize with disposed check
        const handleResize = () => {
          if (isDisposedRef.current) return
          if (chartContainerRef.current && chartRef.current) {
            try {
              chartRef.current.applyOptions({ width: chartContainerRef.current.clientWidth })
            } catch (e) {
              // Chart might be disposed, ignore
            }
          }
        }

        resizeHandlerRef.current = handleResize
        window.addEventListener('resize', handleResize)
      } catch (error) {
        console.error('Error initializing chart:', error)
      }
    }

    initChart()

    return () => {
      // Mark as disposed first to prevent any async operations
      isDisposedRef.current = true
      
      // Remove resize handler
      if (resizeHandlerRef.current) {
        window.removeEventListener('resize', resizeHandlerRef.current)
        resizeHandlerRef.current = null
      }
      
      // Remove chart
      if (chartRef.current) {
        try {
          chartRef.current.remove()
        } catch (e) {
          // Chart already disposed
        }
        chartRef.current = null
      }
    }
  }, [isClient, dailyPnL])

  // Calculate stats
  const latestPnL = dailyPnL.length > 0 ? dailyPnL[dailyPnL.length - 1] : null

  return (
    <div className="chart-container">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-dark-800/50">
        <div>
          <h3 className="text-lg font-display font-semibold text-white">Equity Curve</h3>
          <p className="text-sm text-dark-500">Cumulative P&L over time</p>
        </div>
        
        {latestPnL && (
          <div className="text-right">
            <p className={`text-2xl font-bold ${latestPnL.cumulativePnl >= 0 ? 'text-profit' : 'text-loss'}`}>
              {formatCurrency(latestPnL.cumulativePnl)}
            </p>
            <p className="text-xs text-dark-500">
              Total P&L as of {formatDate(latestPnL.date)}
            </p>
          </div>
        )}
      </div>

      {/* Chart */}
      <div ref={chartContainerRef} className="w-full min-h-[300px]">
        {!isClient ? (
          <div className="h-[300px] flex items-center justify-center text-dark-500">
            Loading chart...
          </div>
        ) : dailyPnL.length === 0 ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-3">
            <div className="w-16 h-16 rounded-full bg-dark-800 flex items-center justify-center">
              <svg className="w-8 h-8 text-dark-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-dark-400 font-medium">No trading data yet</p>
              <p className="text-sm text-dark-500">Add trades to see your equity curve</p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer stats */}
      <div className="flex items-center justify-between p-4 border-t border-dark-800/50 text-sm">
        <div className="flex gap-6">
          <div>
            <span className="text-dark-500">Best Day: </span>
            <span className="text-profit font-medium">
              {dailyPnL.length > 0 && formatCurrency(Math.max(...dailyPnL.map(d => d.pnl)))}
            </span>
          </div>
          <div>
            <span className="text-dark-500">Worst Day: </span>
            <span className="text-loss font-medium">
              {dailyPnL.length > 0 && formatCurrency(Math.min(...dailyPnL.map(d => d.pnl)))}
            </span>
          </div>
        </div>
        <div className="text-dark-500">
          {dailyPnL.length} trading days
        </div>
      </div>
    </div>
  )
}
