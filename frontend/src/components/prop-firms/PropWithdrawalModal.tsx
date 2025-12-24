'use client'

import { useState } from 'react'
import { X, DollarSign, Loader2 } from 'lucide-react'
import { PropFirmAccount } from '@/lib/firebase/propFirms'

interface PropWithdrawalModalProps {
    isOpen: boolean
    onClose: () => void
    account: PropFirmAccount
    onSubmit: (amount: number, splitPercentage: number, date: Date, note: string) => Promise<void>
}

export function PropWithdrawalModal({ isOpen, onClose, account, onSubmit }: PropWithdrawalModalProps) {
    const [amount, setAmount] = useState<string>('')
    const [splitPercentage, setSplitPercentage] = useState<number>(account.profitSplit || 100)
    const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 16))
    const [note, setNote] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!amount || parseFloat(amount) <= 0) return

        setIsSubmitting(true)
        try {
            await onSubmit(parseFloat(amount), splitPercentage, new Date(date), note)
            onClose()
            setAmount('')
            setNote('')
        } catch (error) {
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    const gross = parseFloat(amount) || 0
    const net = gross * (splitPercentage / 100)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-sm bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-display font-bold text-white">Record Withdrawal</h2>
                    <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg">
                        <X className="w-5 h-5 text-dark-400" />
                    </button>
                </div>

                <p className="text-sm text-dark-400 mb-6">
                    Add a payout from <span className="text-white font-medium">{account.name}</span>
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-dark-300">Gross Amount ($)</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="input w-full pl-9 text-lg font-mono"
                                placeholder="0.00"
                                min="0"
                                step="0.01"
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-dark-300">Split %</label>
                            <input
                                type="number"
                                value={splitPercentage}
                                onChange={(e) => setSplitPercentage(parseFloat(e.target.value))}
                                className="input w-full"
                                min="0"
                                max="100"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-dark-300">Net Payout</label>
                            <div className="input w-full bg-dark-800 text-profit font-mono font-bold flex items-center border-dark-700">
                                ${net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-dark-300">Date Received</label>
                        <input
                            type="datetime-local"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="input w-full"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-dark-300">Note</label>
                        <input
                            type="text"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            className="input w-full"
                            placeholder="e.g. First payout"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !amount}
                        className="btn-primary w-full mt-4 justify-center"
                    >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm Withdrawal'}
                    </button>
                </form>
            </div>
        </div>
    )
}
