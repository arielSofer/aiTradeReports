'use client'

import { useState, useRef, useEffect } from 'react'
import { Filter, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagFilterProps {
    availableTags: string[]
    selectedTags: string[]
    onChange: (tags: string[]) => void
}

export function TagFilter({ availableTags, selectedTags, onChange }: TagFilterProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const toggleTag = (tag: string) => {
        if (selectedTags.includes(tag)) {
            onChange(selectedTags.filter(t => t !== tag))
        } else {
            onChange([...selectedTags, tag])
        }
        // Don't close so user can select multiple
    }

    const clearTags = (e: React.MouseEvent) => {
        e.stopPropagation()
        onChange([])
        setIsOpen(false)
    }

    if (availableTags.length === 0) return null

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors",
                    selectedTags.length > 0
                        ? "bg-primary/10 border-primary/50 text-white"
                        : "bg-dark-800 border-dark-700 text-dark-300 hover:bg-dark-700 hover:text-white"
                )}
            >
                <Filter className="w-4 h-4" />
                Tags
                {selectedTags.length > 0 && (
                    <span className="flex items-center gap-1 ml-1">
                        <span className="bg-primary/20 text-primary px-1.5 py-0.5 rounded text-xs">
                            {selectedTags.length}
                        </span>
                        <span
                            role="button"
                            onClick={clearTags}
                            className="hover:text-white hover:bg-primary/30 rounded-full p-0.5 transition-colors"
                        >
                            <X className="w-3 h-3" />
                        </span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-dark-900 border border-dark-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                    <div className="p-3 border-b border-dark-800 bg-dark-900/95 sticky top-0">
                        <h3 className="text-sm font-semibold text-white">Filter by Tags</h3>
                        <p className="text-xs text-dark-500 mt-0.5">Select tags to filter trades</p>
                    </div>

                    <div className="max-h-64 overflow-y-auto p-2">
                        {availableTags.map(tag => {
                            const isSelected = selectedTags.includes(tag)
                            return (
                                <button
                                    key={tag}
                                    onClick={() => toggleTag(tag)}
                                    className={cn(
                                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center justify-between group",
                                        isSelected
                                            ? "bg-primary/10 text-white"
                                            : "hover:bg-dark-800 text-dark-300 hover:text-white"
                                    )}
                                >
                                    <span>{tag}</span>
                                    {isSelected && <Check className="w-4 h-4 text-primary" />}
                                </button>
                            )
                        })}
                    </div>

                    {selectedTags.length > 0 && (
                        <div className="p-2 border-t border-dark-800 bg-dark-900 sticky bottom-0">
                            <button
                                onClick={() => onChange([])}
                                className="w-full py-2 text-xs text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                            >
                                Clear Filters
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
