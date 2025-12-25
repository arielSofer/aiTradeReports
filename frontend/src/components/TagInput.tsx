'use client'

import { useState, useRef, useEffect } from 'react'
import { X, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TagInputProps {
    tags: string[]
    onChange: (tags: string[]) => void
    placeholder?: string
    className?: string
    suggestions?: string[]
}

export function TagInput({
    tags,
    onChange,
    placeholder = "Add tags...",
    className,
    suggestions = []
}: TagInputProps) {
    const [input, setInput] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Filter suggestions
    const filteredSuggestions = suggestions.filter(
        s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
    )

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setShowSuggestions(false)
            }
        }

        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    const addTag = (tag: string) => {
        const trimmedTag = tag.trim()
        if (trimmedTag && !tags.includes(trimmedTag)) {
            onChange([...tags, trimmedTag])
        }
        setInput('')
        setShowSuggestions(false)
    }

    const removeTag = (tagToRemove: string) => {
        onChange(tags.filter(tag => tag !== tagToRemove))
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            addTag(input)
        } else if (e.key === 'Backspace' && !input && tags.length > 0) {
            removeTag(tags[tags.length - 1])
        }
    }

    return (
        <div className={cn("relative", className)} ref={containerRef}>
            <div
                className="flex flex-wrap gap-2 p-2 bg-dark-800 border border-dark-700 rounded-lg focus-within:ring-2 focus-within:ring-primary/50 transition-all"
                onClick={() => inputRef.current?.focus()}
            >
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-sm rounded-md group hover:bg-primary/20 transition-colors"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                removeTag(tag)
                            }}
                            className="p-0.5 hover:bg-primary/20 rounded-full opacity-60 group-hover:opacity-100 transition-all"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    </span>
                ))}

                <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => {
                        setInput(e.target.value)
                        setShowSuggestions(true)
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-dark-400 min-w-[80px]"
                    placeholder={tags.length === 0 ? placeholder : ""}
                />
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && input && filteredSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-dark-800 border border-dark-700 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto">
                    {filteredSuggestions.map(suggestion => (
                        <button
                            key={suggestion}
                            type="button"
                            onClick={() => addTag(suggestion)}
                            className="w-full text-left px-3 py-2 hover:bg-dark-700 text-sm text-dark-200 hover:text-white transition-colors flex items-center gap-2"
                        >
                            <Plus className="w-3 h-3 text-dark-400" />
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
