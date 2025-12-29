'use client'

import { useState, useEffect } from 'react'
import { X, Save, Check, Calculator } from 'lucide-react'
import { Trade, useStore } from '@/lib/store'
import { TRADE_DETAILS_CONFIG } from '@/lib/tradeDetailsConfig'
import { cn, formatCurrency } from '@/lib/utils'
import { updateTrade, getUserChecklist } from '@/lib/firebase/firestore'
import { TagInput } from './TagInput'
import { useAuth } from '@/contexts/AuthContext'

interface TradeDetailsModalProps {
    isOpen?: boolean
    onClose: () => void
    trade: Trade
    onSave: (updatedTrade: Trade) => void
    isNewTrade?: boolean
    readOnly?: boolean
}

export function TradeDetailsModal({ isOpen = true, onClose, trade, onSave, isNewTrade, readOnly }: TradeDetailsModalProps) {
    const { user } = useAuth()
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({})
    const [customTags, setCustomTags] = useState<string[]>([])
    const [notes, setNotes] = useState(trade.notes || '')
    const [isSaving, setIsSaving] = useState(false)

    // Checklist state
    const [checklistItems, setChecklistItems] = useState<string[]>([])
    const [checklistCompleted, setChecklistCompleted] = useState<string[]>([])

    // SL/TP state
    const [manualSL, setManualSL] = useState<string>('')
    const [manualTP, setManualTP] = useState<string>('')

    const { trades } = useStore()
    const allTags = Array.from(new Set(trades.flatMap(t => t.tags)))

    // Load user's checklist items
    useEffect(() => {
        if (user && isOpen) {
            getUserChecklist(user.uid).then(items => {
                setChecklistItems(items)
            }).catch(console.error)
        }
    }, [user, isOpen])

    // Initialize selected options from trade tags
    useEffect(() => {
        if (isOpen && trade) {
            setNotes(trade.notes || '')
            // Initialize SL/TP from trade if they exist
            setManualSL((trade as any).manualSL?.toString() || '')
            setManualTP((trade as any).manualTP?.toString() || '')
            setChecklistCompleted((trade as any).checklistCompleted || [])

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

    // Calculate R:R ratio
    const calculateRR = (): number | null => {
        const sl = parseFloat(manualSL)
        const tp = parseFloat(manualTP)
        const entry = trade.entryPrice
        const exit = trade.exitPrice

        if (!entry) return null

        const isWinner = (trade.pnlNet || 0) > 0

        if (isWinner && sl) {
            // For winning trade: R:R = (exit - entry) / (entry - SL) for long
            // or (entry - exit) / (SL - entry) for short
            const reward = Math.abs((exit || entry) - entry)
            const risk = Math.abs(entry - sl)
            if (risk === 0) return null
            return reward / risk
        } else if (!isWinner && tp) {
            // For losing trade: R:R = (TP - entry) / (entry - exit) for long
            const expectedReward = Math.abs(tp - entry)
            const actualLoss = Math.abs((exit || entry) - entry)
            if (actualLoss === 0) return null
            return expectedReward / actualLoss
        }
        return null
    }

    const toggleChecklistItem = (item: string) => {
        setChecklistCompleted(prev =>
            prev.includes(item)
                ? prev.filter(i => i !== item)
                : [...prev, item]
        )
    }

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

            Object.keys(selectedOptions).forEach(catId => {
                selectedOptions[catId].forEach(opt => {
                    if (!newTags.includes(opt)) {
                        newTags.push(opt)
                    }
                })
            })

            // Prepare additional fields
            const rrRatio = calculateRR()
            const additionalFields: any = {
                tags: newTags,
                notes,
                checklistCompleted
            }

            // Only add SL/TP if provided
            if (manualSL) additionalFields.manualSL = parseFloat(manualSL)
            if (manualTP) additionalFields.manualTP = parseFloat(manualTP)
            if (rrRatio !== null) additionalFields.riskRewardRatio = rrRatio

            const updatedTradeStart = { ...trade, ...additionalFields }

            // Update via API only if it's an existing trade
            if (!isNewTrade) {
                if (trade.id) {
                    await updateTrade(String(trade.id), additionalFields)
                }
            }

            onSave(updatedTradeStart)
            onClose()
        } catch (error) {
            console.error('Failed to save trade details:', error)
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
                        <p className="text-dark-400">
                            {readOnly ? `Viewing ${trade.symbol} trade` : `Add details and reviews for ${trade.symbol}`}
                        </p>
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
                        {readOnly ? (
                            <div className="input w-full min-h-[60px] text-dark-300">
                                {notes || <span className="text-dark-500 italic">No notes</span>}
                            </div>
                        ) : (
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="input w-full min-h-[100px] resize-none"
                                placeholder="Add your thoughts, emotions, and analysis of this trade..."
                            />
                        )}
                    </div>

                    {/* Custom Tags Section */}
                    <div className="mb-6 bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
                        <label className="text-sm font-medium text-dark-300 mb-2 block">Custom Tags</label>
                        {readOnly ? (
                            <div className="flex flex-wrap gap-2">
                                {customTags.length > 0 ? customTags.map(tag => (
                                    <span key={tag} className="px-2 py-1 bg-dark-700 text-dark-300 rounded text-sm">{tag}</span>
                                )) : <span className="text-dark-500 italic">No custom tags</span>}
                            </div>
                        ) : (
                            <TagInput
                                tags={customTags}
                                onChange={setCustomTags}
                                placeholder="Add custom tags..."
                                suggestions={allTags}
                            />
                        )}
                    </div>

                    {/* Trade Checklist */}
                    {checklistItems.length > 0 && (
                        <div className="mb-6 bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
                            <label className="text-sm font-medium text-dark-300 mb-3 block">Trade Checklist</label>
                            <div className="space-y-2">
                                {checklistItems.map((item, index) => {
                                    const isChecked = checklistCompleted.includes(item)
                                    return (
                                        <label
                                            key={index}
                                            className={cn(
                                                'flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors',
                                                readOnly ? 'cursor-default' : 'hover:bg-dark-700/50'
                                            )}
                                        >
                                            <div className={cn(
                                                'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                                                isChecked
                                                    ? 'bg-profit border-profit'
                                                    : 'border-dark-500'
                                            )}>
                                                {isChecked && <Check className="w-3 h-3 text-white" />}
                                            </div>
                                            <input
                                                type="checkbox"
                                                className="hidden"
                                                checked={isChecked}
                                                onChange={() => !readOnly && toggleChecklistItem(item)}
                                                disabled={readOnly}
                                            />
                                            <span className={cn(
                                                'text-sm',
                                                isChecked ? 'text-white' : 'text-dark-400'
                                            )}>{item}</span>
                                        </label>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* Manual SL/TP for R:R Calculation */}
                    {!readOnly && (
                        <div className="mb-6 bg-dark-800/50 rounded-xl p-4 border border-dark-700/50">
                            <div className="flex items-center gap-2 mb-3">
                                <Calculator className="w-4 h-4 text-primary-400" />
                                <label className="text-sm font-medium text-dark-300">Risk/Reward Calculation</label>
                            </div>
                            <p className="text-xs text-dark-500 mb-4">
                                {(trade.pnlNet || 0) > 0
                                    ? "This trade won. Enter your intended Stop Loss to calculate R:R."
                                    : "This trade lost. Enter your intended Take Profit to calculate R:R."
                                }
                            </p>
                            <div className="grid grid-cols-2 gap-4">
                                {(trade.pnlNet || 0) > 0 ? (
                                    <div>
                                        <label className="text-xs text-dark-400 mb-1 block">Intended Stop Loss</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={manualSL}
                                            onChange={(e) => setManualSL(e.target.value)}
                                            placeholder={`Below ${trade.entryPrice}`}
                                            className="input w-full"
                                        />
                                    </div>
                                ) : (
                                    <div>
                                        <label className="text-xs text-dark-400 mb-1 block">Intended Take Profit</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={manualTP}
                                            onChange={(e) => setManualTP(e.target.value)}
                                            placeholder={`Target price`}
                                            className="input w-full"
                                        />
                                    </div>
                                )}
                                <div>
                                    <label className="text-xs text-dark-400 mb-1 block">R:R Ratio</label>
                                    <div className="input w-full bg-dark-700/50 flex items-center">
                                        {calculateRR() !== null ? (
                                            <span className={cn(
                                                'font-bold',
                                                calculateRR()! >= 1 ? 'text-profit' : 'text-loss'
                                            )}>
                                                1:{calculateRR()!.toFixed(2)}
                                            </span>
                                        ) : (
                                            <span className="text-dark-500">Enter SL/TP</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

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
                                                    onChange={() => !readOnly && toggleOption(category.id, option)}
                                                    disabled={readOnly}
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
                        {readOnly ? 'Close' : 'Cancel'}
                    </button>
                    {!readOnly && (
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
                    )}
                </div>
            </div>
        </div>
    )
}
