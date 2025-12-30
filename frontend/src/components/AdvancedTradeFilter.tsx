import { useState } from 'react'
import { TRADE_DETAILS_CONFIG } from '@/lib/tradeDetailsConfig'
import { Check, ChevronDown, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdvancedTradeFilterProps {
    filters: Record<string, string[]>
    onChange: (filters: Record<string, string[]>) => void
}

export function AdvancedTradeFilter({ filters, onChange }: AdvancedTradeFilterProps) {
    const [openCategory, setOpenCategory] = useState<string | null>(null)

    const toggleFilter = (categoryId: string, option: string) => {
        const currentOptions = filters[categoryId] || []
        const newOptions = currentOptions.includes(option)
            ? currentOptions.filter(o => o !== option)
            : [...currentOptions, option]

        const newFilters = { ...filters }
        if (newOptions.length > 0) {
            newFilters[categoryId] = newOptions
        } else {
            delete newFilters[categoryId]
        }
        onChange(newFilters)
    }

    const clearFilters = () => onChange({})

    const activeFilterCount = Object.values(filters).reduce((acc, curr) => acc + curr.length, 0)

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-dark-200 flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filter by Trade Details
                </h3>
                {activeFilterCount > 0 && (
                    <button
                        onClick={clearFilters}
                        className="text-xs text-primary hover:text-primary-400 transition-colors"
                    >
                        Clear all ({activeFilterCount})
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {TRADE_DETAILS_CONFIG.map((category) => {
                    const activeCount = (filters[category.id] || []).length
                    const isOpen = openCategory === category.id

                    return (
                        <div
                            key={category.id}
                            className={cn(
                                "border rounded-lg transition-all duration-200",
                                activeCount > 0
                                    ? "bg-dark-800/80 border-primary/30"
                                    : "bg-dark-900/50 border-dark-800 hover:border-dark-700"
                            )}
                        >
                            <button
                                onClick={() => setOpenCategory(isOpen ? null : category.id)}
                                className="w-full flex items-center justify-between p-3 text-left"
                            >
                                <span className={cn(
                                    "text-sm font-medium",
                                    activeCount > 0 ? "text-primary-100" : "text-dark-300"
                                )}>
                                    {category.name}
                                    {activeCount > 0 && <span className="ml-2 text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{activeCount}</span>}
                                </span>
                                <ChevronDown className={cn("w-4 h-4 text-dark-500 transition-transform", isOpen && "rotate-180")} />
                            </button>

                            {isOpen && (
                                <div className="p-3 pt-0 border-t border-dark-800/50 space-y-1 max-h-[200px] overflow-y-auto scrollbar-thin scrollbar-thumb-dark-700">
                                    {category.options.map((option) => {
                                        const isSelected = (filters[category.id] || []).includes(option)
                                        return (
                                            <label
                                                key={option}
                                                className={cn(
                                                    "flex items-center gap-2.5 p-2 rounded cursor-pointer transition-colors",
                                                    isSelected ? "bg-primary/10" : "hover:bg-dark-800"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-4 h-4 rounded border flex items-center justify-center transition-colors flex-shrink-0",
                                                    isSelected
                                                        ? "bg-primary border-primary text-white"
                                                        : "border-dark-600"
                                                )}>
                                                    {isSelected && <Check className="w-3 h-3" />}
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="hidden"
                                                    checked={isSelected}
                                                    onChange={() => toggleFilter(category.id, option)}
                                                />
                                                <span className={cn(
                                                    "text-sm",
                                                    isSelected ? "text-white" : "text-dark-400"
                                                )}>
                                                    {option}
                                                </span>
                                            </label>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
