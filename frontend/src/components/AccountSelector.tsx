'use client'

import { useState, useRef, useEffect } from 'react'
import { Wallet, ChevronDown, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FirestoreAccount } from '@/lib/firebase/firestore'
import { PropAccountStatus } from '@/lib/firebase/propFirms'

interface AccountSelectorProps {
    accounts: FirestoreAccount[]
    selectedAccountId: string
    onChange: (accountId: string) => void
    label?: string
}

export function AccountSelector({ accounts, selectedAccountId, onChange, label = 'Select Account' }: AccountSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)

    // Sort accounts: Active/Funded -> Challenge -> Failed/Blown
    const sortedAccounts = [...accounts].sort((a, b) => {
        const getScore = (acc: FirestoreAccount) => {
            const status = acc.status as PropAccountStatus || ''
            if (status.includes('funded_active')) return 5
            if (status.includes('challenge_passed')) return 4
            if (status.includes('challenge_active')) return 3
            if (status.includes('failed') || status.includes('blown')) return 0
            return 2 // Unknown/Other
        }
        return getScore(b) - getScore(a)
    })

    const selectedAccount = selectedAccountId === 'all'
        ? null
        : accounts.find(a => a.id === selectedAccountId)

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    return (
        <div className="relative" ref={containerRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2 bg-dark-800/50 hover:bg-dark-700/50 border border-dark-700 rounded-xl transition-all min-w-[200px] group"
            >
                <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    selectedAccountId === 'all' ? "bg-primary-500/20" :
                        selectedAccount?.status?.includes('failed') ? "bg-red-500/10" :
                            selectedAccount?.status?.includes('funded') ? "bg-yellow-500/10" :
                                "bg-blue-500/10"
                )}>
                    <Wallet className={cn(
                        "w-4 h-4",
                        selectedAccountId === 'all' ? "text-primary-400" :
                            selectedAccount?.status?.includes('failed') ? "text-red-400" :
                                selectedAccount?.status?.includes('funded') ? "text-yellow-400" :
                                    "text-blue-400"
                    )} />
                </div>

                <div className="flex-1 text-left">
                    <p className="text-xs text-dark-500 font-medium mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-white truncate max-w-[140px]">
                        {selectedAccount ? selectedAccount.name : 'All Accounts'}
                    </p>
                </div>

                <ChevronDown className={cn(
                    "w-4 h-4 text-dark-400 transition-transform duration-200",
                    isOpen ? 'rotate-180' : ''
                )} />
            </button>

            {isOpen && (
                <div className="absolute top-full right-0 mt-2 w-72 bg-dark-900 border border-dark-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                        {/* All Accounts Option */}
                        <button
                            onClick={() => {
                                onChange('all')
                                setIsOpen(false)
                            }}
                            className={cn(
                                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group',
                                selectedAccountId === 'all'
                                    ? 'bg-primary-500/10 border border-primary-500/20'
                                    : 'hover:bg-dark-800 border border-transparent'
                            )}
                        >
                            <div className="w-8 h-8 rounded-lg bg-primary-500/20 flex items-center justify-center text-primary-400">
                                <Wallet className="w-4 h-4" />
                            </div>
                            <div className="text-left flex-1 text-sm">
                                <span className={selectedAccountId === 'all' ? 'text-primary-400 font-bold' : 'text-white'}>All Accounts</span>
                                <span className="block text-xs text-dark-500">{accounts.length} Total</span>
                            </div>
                            {selectedAccountId === 'all' && <Check className="w-4 h-4 text-primary-400" />}
                        </button>

                        <div className="h-px bg-dark-800 my-2" />

                        {/* Account List */}
                        {sortedAccounts.map(account => {
                            const isFailed = account.status?.includes('failed') || account.status?.includes('blown')
                            const isFunded = account.status?.includes('funded')

                            return (
                                <button
                                    key={account.id}
                                    onClick={() => {
                                        onChange(account.id!)
                                        setIsOpen(false)
                                    }}
                                    className={cn(
                                        'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all',
                                        selectedAccountId === account.id
                                            ? 'bg-dark-800 border border-dark-600'
                                            : 'hover:bg-dark-800 border border-transparent',
                                        isFailed && 'opacity-60 hover:opacity-100'
                                    )}
                                >
                                    <div className={cn(
                                        "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold",
                                        isFailed ? "bg-red-500/10 text-red-500" :
                                            isFunded ? "bg-yellow-500/10 text-yellow-500" :
                                                "bg-blue-500/10 text-blue-500"
                                    )}>
                                        {isFailed ? <AlertTriangle className="w-4 h-4" /> :
                                            isFunded ? '$' :
                                                <Wallet className="w-4 h-4" />}
                                    </div>

                                    <div className="text-left flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-sm font-medium truncate",
                                                selectedAccountId === account.id ? "text-white" : "text-dark-200",
                                                isFailed && "line-through decoration-red-500/50"
                                            )}>
                                                {account.name}
                                            </span>
                                            {isFunded && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                    FUNDED
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-xs text-dark-500 truncate block">
                                            {account.provider} • {account.size ? `$${(account.size / 1000).toFixed(0)}K` : ''}
                                        </span>
                                    </div>

                                    {selectedAccountId === account.id && <Check className="w-4 h-4 text-dark-300" />}
                                </button>
                            )
                        })}

                        {accounts.length === 0 && (
                            <div className="px-3 py-4 text-center text-dark-500 text-sm">
                                No accounts found.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
