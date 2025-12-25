'use client'

import { useState, useEffect } from 'react'
import { X, Save, Check } from 'lucide-react'
import { Trade } from '@/lib/store'
import { TRADE_DETAILS_CONFIG } from '@/lib/tradeDetailsConfig'
import { cn } from '@/lib/utils'
import { updateTrade } from '@/lib/firebase/firestore'
import { TagInput } from './TagInput'

interface TradeDetailsModalProps {
    isOpen: boolean
    onClose: () => void
    trade: Trade
    onSave: (updatedTrade: Trade) => void
    isNewTrade?: boolean
}

export function TradeDetailsModal({ isOpen, onClose, trade, onSave, isNewTrade }: TradeDetailsModalProps) {
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
    const [customTags, setCustomTags] = useState<string[]>([])
    const [notes, setNotes] = useState(trade.notes || '')
    const [isSaving, setIsSaving] = useState(false)

    // Initialize selected options from trade tags
    useEffect(() => {
        if (isOpen && trade) {
            setNotes(trade.notes || '')
            const initialOptions: Record<string, string[]> = {}
            const initialCustomTags: string[] = []

            // Initialize empty arrays for all categories
            TRADE_DETAILS_CONFIG.forEach(cat => {
                initialOptions[cat.id] = []
            })

            // Parse existing tags
            trade.tags.forEach(tag => {
                let isKnownOption = false
                // Check if tag matches any option in our config
                for (const cat of TRADE_DETAILS_CONFIG) {
                    // Check for exact match or "Category: Option" format
                    const optionMatch = cat.options.find(opt => opt === tag || `${cat.name}: ${opt}` === tag)
                    if (optionMatch) {
                        isKnownOption = true
                        if (!initialOptions[cat.id].includes(optionMatch)) {
                            initialOptions[cat.id].push(optionMatch)
                        }
                    }
                }

                if (!isKnownOption) {
                    initialCustomTags.push(tag)
                }
            })

            setSelectedOptions(initialOptions)
            setCustomTags(initialCustomTags)
        }
    }, [isOpen, trade])

    const toggleOption = (categoryId: string, option: string) => {
        setSelectedOptions(prev => {
            const current = prev[categoryId] || []
            const isSelected = current.includes(option)

            if (isSelected) {
                return {
                    ...prev,
                    [categoryId]: current.filter(item => item !== option)
                }
            } else {
                return {
                    ...prev,
                    [categoryId]: [...current, option]
                }
            }
        })
    }

    const handleSave = async () => {
        setIsSaving(true)
        try {
            // Collect all selected options as tags
            const newTags: string[] = [...customTags]

            // We don't need to filter existing unknown tags because they are now in customTags
            // const knownOptions = new Set(TRADE_DETAILS_CONFIG.flatMap(c => c.options))
            // const existingUnknownTags = trade.tags.filter(t => !knownOptions.has(t))
            // newTags.push(...existingUnknownTags)

            Object.keys(selectedOptions).forEach(catId => {
                selectedOptions[catId].forEach(opt => {
                    if (!newTags.includes(opt)) {
                        newTags.push(opt)
                    }
                })
            })

            const updatedTradeStart = { ...trade, tags: newTags, notes }

            // Update via API only if it's an existing trade
            if (!isNewTrade) {
                if (trade.id) {
                    await updateTrade(String(trade.id), { tags: newTags, notes })
                }
            }

            onSave(updatedTradeStart)
            onClose()
        } catch (error) {
            console.error('Failed to save trade details:', error)
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c515b6be-06d5-4b2c-9fd7-edc0f43b741e', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sessionId: 'debug-session', runId: 'pre-fix', hypothesisId: 'H4', location: 'frontend/src/components/TradeDetailsModal.tsx:handleSave:error', message: 'Save failed', data: { errorMessage: error instanceof Error ? error.message : String(error) }, timestamp: Date.now() }) }).catch(() => { })
            // #endregion
            alert('Failed to save changes')
        } finally {
            setIsSaving(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-5xl h-[90vh] bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-dark-800">
                    <div>
                        <h2 className="text-2xl font-display font-bold text-white">Trade Details</h2>
                        <p className="text-dark-400">Add details and reviews for {trade.symbol}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-dark-800 rounded-lg transition-colors text-dark-400 hover:text-white"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content - Scrollable */}
                <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-dark-700 scrollbar-track-transparent">

                    {/* Notes Section */}
                    <div className="mb-6 bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
                        <label className="text-sm font-medium text-dark-300 mb-2 block">Trade Notes</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="input w-full min-h-[100px] resize-none"
                            placeholder="Add your thoughts, emotions, and analysis of this trade..."
                        />
                    </div>

                    {/* Custom Tags Section */}
                    <div className="mb-6 bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
                        <label className="text-sm font-medium text-dark-300 mb-2 block">Custom Tags</label>
                        <TagInput
                            tags={customTags}
                            onChange={setCustomTags}
                            placeholder="Add custom tags..."
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {TRADE_DETAILS_CONFIG.map((category) => (
                            <div
                                key={category.id}
                                className="bg-dark-800/50 rounded-xl p-4 border border-dark-700/50 hover:border-dark-600 transition-colors"
                            >
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-1 h-5 bg-primary rounded-full" />
                                    <h3 className="font-semibold text-white">{category.name}</h3>
                                </div>

                                <div className="space-y-2">
                                    {category.options.map((option) => {
                                        const isSelected = selectedOptions[category.id]?.includes(option)
                                        return (
                                            <label
                                                key={option}
                                                className={cn(
                                                    "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all duration-200 border",
                                                    isSelected
                                                        ? "bg-primary/10 border-primary/50 text-white"
                                                        : "bg-dark-900/50 border-transparent hover:bg-dark-800 text-dark-300"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                                                    isSelected
                                                        ? "bg-primary border-primary text-white"
                                                        : "border-dark-600 group-hover:border-dark-500"
                                                )}>
                                                    {isSelected && <Check className="w-3.5 h-3.5" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={isSelected}
                                                    onChange={() => toggleOption(category.id, option)}
                                                />
                                                <span className="text-sm font-medium">{option}</span>
                                            </label>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-dark-800 bg-dark-900/95 flex justify-end gap-3 backdrop-blur-sm">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl text-dark-300 hover:bg-dark-800 transition-colors font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl shadow-lg shadow-primary/20 
                       flex items-center gap-2 font-medium transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSaving ? (
                            <>Saving...</>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Save Details
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    )
}
