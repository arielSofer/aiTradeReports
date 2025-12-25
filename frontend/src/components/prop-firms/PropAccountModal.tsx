'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PropFirmAccount, PropAccountStatus } from '@/lib/firebase/propFirms'
import { PROP_FIRMS, PropFirm } from '@/lib/data/propFirmsData'

interface PropAccountModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: Partial<PropFirmAccount>) => Promise<void>
    initialData?: PropFirmAccount
}

const statusOptions: { value: PropAccountStatus; label: string; color: string }[] = [
    { value: 'challenge_active', label: 'Challenge Active', color: 'text-blue-400' },
    { value: 'challenge_passed', label: 'Challenge Passed', color: 'text-green-400' },
    { value: 'challenge_failed', label: 'Challenge Failed', color: 'text-red-400' },
    { value: 'funded_active', label: 'Funded Active', color: 'text-yellow-400' },
    { value: 'funded_blown', label: 'Funded Blown', color: 'text-gray-400' },
]

const colorOptions = [
    { value: 'bg-emerald-500', label: 'Green' }, // Good/Profit
    { value: 'bg-blue-500', label: 'Blue' }, // Standard
    { value: 'bg-purple-500', label: 'Purple' }, // Special
    { value: 'bg-yellow-500', label: 'Gold' }, // Funded
    { value: 'bg-rose-500', label: 'Red' }, // Danger/Hot
    { value: 'bg-slate-500', label: 'Gray' }, // Neutral
    { value: 'bg-orange-500', label: 'Orange' },
    { value: 'bg-cyan-500', label: 'Cyan' },
]

export function PropAccountModal({ isOpen, onClose, onSubmit, initialData }: PropAccountModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [formData, setFormData] = useState<Partial<PropFirmAccount>>({
        name: '',
        provider: '',
        size: 50000,
        cost: 49,
        status: 'challenge_active',
        purchaseDate: new Date(),
        notes: '',
        color: 'bg-blue-500',
        profitSplit: 100,
        isFunded: false
    })

    // Selected Provider Object for helper logic
    const [selectedFirm, setSelectedFirm] = useState<PropFirm | null>(null)

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                purchaseDate: initialData.purchaseDate instanceof Date ?
                    initialData.purchaseDate :
                    (initialData.purchaseDate as any)?.toDate?.() || new Date()
            })

            // Try to find matching firm
            const firm = PROP_FIRMS.find(f => f.name === initialData.provider)
            if (firm) setSelectedFirm(firm)

        } else {
            setFormData({
                name: '',
                provider: '',
                size: 50000,
                cost: 49,
                status: 'challenge_active',
                purchaseDate: new Date(),
                notes: '',
                color: 'bg-blue-500',
                profitSplit: 100,
                isFunded: false
            })
            setSelectedFirm(null)
        }
    }, [initialData, isOpen])

    // Handle Provider Selection
    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const providerName = e.target.value
        const firm = PROP_FIRMS.find(f => f.name === providerName)

        setFormData(prev => ({
            ...prev,
            provider: providerName,
            // Reset size/cost if changing provider (optional, but cleaner)
            size: firm ? firm.accounts[0].size : prev.size,
            cost: firm ? firm.accounts[0].price : prev.cost,
            color: firm?.logoColor || prev.color
        }))
        setSelectedFirm(firm || null)
    }

    // Handle Size Selection
    const handleSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const sizeStr = e.target.value
        const size = parseInt(sizeStr)

        // Find account details to auto-set cost
        if (selectedFirm) {
            const account = selectedFirm.accounts.find(a => a.size === size)
            setFormData(prev => ({
                ...prev,
                size: size,
                cost: account ? account.price : prev.cost
            }))
        } else {
            setFormData(prev => ({ ...prev, size: size }))
        }
    }



    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target

        if (name === 'purchaseDate') {
            setFormData(prev => ({ ...prev, purchaseDate: new Date(value) }))
            return
        }

        setFormData(prev => ({
            ...prev,
            [name]: type === 'number' ? parseFloat(value) : value
        }))
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!formData.provider || !formData.size) {
            setError('Please fill in required fields')
            return
        }

        // Default name if empty
        const finalData = {
            ...formData,
            name: formData.name || `${formData.provider} ${formData.size && formData.size >= 1000 ? formData.size / 1000 + 'K' : formData.size}`
        }

        setIsSubmitting(true)
        try {
            await onSubmit(finalData)
            onClose()
        } catch (err) {
            setError('Failed to save account')
            console.error(err)
        } finally {
            setIsSubmitting(false)
        }
    }

    if (!isOpen) return null

    const dateValue = formData.purchaseDate instanceof Date
        ? formData.purchaseDate.toISOString().slice(0, 16)
        : new Date().toISOString().slice(0, 16)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative w-full max-w-lg bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-dark-800">
                    <h2 className="text-xl font-display font-bold text-white">
                        {initialData ? 'Edit Account' : 'Add Prop Account'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-dark-800 rounded-lg">
                        <X className="w-5 h-5 text-dark-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-dark-300">Account Name</label>
                        <input
                            type="text"
                            name="name"
                            value={formData.name || ''}
                            onChange={handleChange}
                            placeholder="e.g. Topstep 50K - Account 1"
                            className="input w-full"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-dark-300">Provider *</label>
                            <div className="relative">
                                <select
                                    name="provider"
                                    value={formData.provider}
                                    onChange={handleProviderChange}
                                    className="input w-full appearance-none pr-8"
                                    autoFocus
                                >
                                    <option value="">Select Provider...</option>
                                    {PROP_FIRMS.map(firm => (
                                        <option key={firm.name} value={firm.name}>{firm.name}</option>
                                    ))}
                                    <option disabled>──────────</option>
                                    <option value="Custom">Custom Provider</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                            </div>

                            {formData.provider === 'Custom' && (
                                <input
                                    type="text"
                                    name="provider_custom"
                                    placeholder="Enter Provider Name"
                                    className="input w-full mt-2"
                                    onChange={(e) => setFormData(p => ({ ...p, provider: e.target.value }))}
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-dark-300">Size *</label>
                            {selectedFirm ? (
                                <div className="relative">
                                    <select
                                        name="size"
                                        value={formData.size}
                                        onChange={handleSizeChange}
                                        className="input w-full appearance-none pr-8"
                                    >
                                        {selectedFirm.accounts.map(acc => (
                                            <option key={acc.size} value={acc.size}>{acc.sizeLabel} - ${acc.price}</option>
                                        ))}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500 pointer-events-none" />
                                </div>
                            ) : (
                                <input
                                    type="number"
                                    name="size"
                                    value={formData.size}
                                    onChange={handleChange}
                                    placeholder="50000"
                                    className="input w-full"
                                />
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-dark-300">Cost ($)</label>
                            <input
                                type="number"
                                name="cost"
                                value={formData.cost}
                                onChange={handleChange}
                                className="input w-full"
                            />
                            <p className="text-xs text-dark-500">Edit if you had a discount.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-dark-300">Profit Split (%)</label>
                            <input
                                type="number"
                                name="profitSplit"
                                value={formData.profitSplit || 100}
                                onChange={handleChange}
                                min="0"
                                max="100"
                                className="input w-full"
                                placeholder="100"
                            />
                            <p className="text-xs text-dark-500">Your share (e.g. 90).</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-dark-300">Purchase Date</label>
                            <input
                                type="datetime-local"
                                name="purchaseDate"
                                value={dateValue}
                                onChange={handleChange}
                                className="input w-full"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-dark-300">Status</label>
                        <div className="grid grid-cols-2 gap-2">
                            {statusOptions.map(opt => (
                                <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => {
                                        const isFunded = opt.value.includes('funded')
                                        let newColor = formData.color

                                        // Auto-update color for specific statuses if the user hasn't set a custom one? 
                                        // Or just always update it to the default for that status to be helpful.
                                        if (opt.value === 'funded_active') newColor = 'bg-yellow-500'
                                        else if (opt.value === 'funded_blown') newColor = 'bg-slate-600'
                                        else if (opt.value === 'challenge_passed') newColor = 'bg-green-500'
                                        else if (opt.value === 'challenge_active') newColor = 'bg-blue-500'
                                        else if (opt.value === 'challenge_failed') newColor = 'bg-red-500'

                                        setFormData(p => ({
                                            ...p,
                                            status: opt.value,
                                            isFunded,
                                            color: newColor
                                        }))
                                    }}
                                    className={cn(
                                        "px-3 py-2 rounded-lg border text-sm text-left transition-all",
                                        formData.status === opt.value
                                            ? "bg-dark-700 border-primary text-white"
                                            : "bg-dark-800 border-dark-700 text-dark-400 hover:border-dark-600"
                                    )}
                                >
                                    <span className={cn("inline-block w-2 h-2 rounded-full mr-2",
                                        opt.value.includes('passed') ? 'bg-green-500' :
                                            opt.value.includes('failed') || opt.value.includes('blown') ? 'bg-red-500' :
                                                opt.value.includes('funded') ? 'bg-yellow-500' : 'bg-blue-500'
                                    )} />
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-dark-300">Display Color</label>
                        <div className="flex flex-wrap gap-2">
                            {colorOptions.map(color => (
                                <button
                                    key={color.value}
                                    type="button"
                                    onClick={() => setFormData(p => ({ ...p, color: color.value }))}
                                    className={cn(
                                        "w-8 h-8 rounded-full transition-all flex items-center justify-center",
                                        color.value,
                                        formData.color === color.value ? "ring-2 ring-white ring-offset-2 ring-offset-dark-900 scale-110" : "opacity-60 hover:opacity-100"
                                    )}
                                    title={color.label}
                                >
                                    {formData.color === color.value && <Check className="w-4 h-4 text-white drop-shadow-md" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-dark-300">Notes (Optional)</label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            className="input w-full resize-none h-20"
                            placeholder="Account details, login info, etc."
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-dark-800">
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="btn-primary"
                        >
                            {isSubmitting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4 mr-2" />
                            )}
                            {initialData ? 'Save Changes' : 'Create Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
