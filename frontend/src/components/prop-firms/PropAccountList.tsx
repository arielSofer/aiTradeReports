'use client'

import { useState } from 'react'
import { PropFirmAccount, updatePropAccount, deletePropAccount, addWithdrawal } from '@/lib/firebase/propFirms'
import { PropAccountModal } from './PropAccountModal'
import { PropWithdrawalModal } from './PropWithdrawalModal'
import { Edit2, Trash2, Plus, TrendingUp, AlertCircle, CheckCircle2, History } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PropAccountListProps {
    accounts: PropFirmAccount[]
    onUpdate: () => void // Trigger refresh
}

export function PropAccountList({ accounts, onUpdate }: PropAccountListProps) {
    const [editingAccount, setEditingAccount] = useState<PropFirmAccount | null>(null)
    const [withdrawalAccount, setWithdrawalAccount] = useState<PropFirmAccount | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const handleEdit = async (data: Partial<PropFirmAccount>) => {
        if (editingAccount?.id) {
            await updatePropAccount(editingAccount.id, data)
            setEditingAccount(null)
            onUpdate()
        }
    }

    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this account? This cannot be undone.')) {
            setDeletingId(id)
            await deletePropAccount(id)
            setDeletingId(null)
            onUpdate()
        }
    }

    const handleAddWithdrawal = async (amount: number, date: Date, note: string) => {
        if (withdrawalAccount?.id) {
            await addWithdrawal(withdrawalAccount.id, amount, date, note)
            setWithdrawalAccount(null)
            onUpdate()
        }
    }

    if (accounts.length === 0) {
        return (
            <div className="text-center py-12 bg-dark-900/50 rounded-2xl border border-dark-800 border-dashed">
                <p className="text-dark-400">No prop firm accounts tracked yet.</p>
                <p className="text-sm text-dark-500 mt-1">Add your first evaluation or funded account.</p>
            </div>
        )
    }

    return (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(account => (
                    <AccountCard
                        key={account.id}
                        account={account}
                        onEdit={() => setEditingAccount(account)}
                        onDelete={() => handleDelete(account.id!)}
                        onAddWithdrawal={() => setWithdrawalAccount(account)}
                        isDeleting={deletingId === account.id}
                    />
                ))}
            </div>

            {editingAccount && (
                <PropAccountModal
                    isOpen={true}
                    onClose={() => setEditingAccount(null)}
                    onSubmit={handleEdit}
                    initialData={editingAccount}
                />
            )}

            {withdrawalAccount && (
                <PropWithdrawalModal
                    isOpen={true}
                    onClose={() => setWithdrawalAccount(null)}
                    account={withdrawalAccount}
                    onSubmit={handleAddWithdrawal}
                />
            )}
        </>
    )
}

function AccountCard({
    account,
    onEdit,
    onDelete,
    onAddWithdrawal,
    isDeleting
}: {
    account: PropFirmAccount
    onEdit: () => void
    onDelete: () => void
    onAddWithdrawal: () => void
    isDeleting: boolean
}) {
    const statusColor = account.status.includes('passed') ? 'text-green-400' :
        account.status.includes('failed') || account.status.includes('blown') ? 'text-red-400' :
            account.status.includes('funded') ? 'text-yellow-400' : 'text-blue-400'

    const statusLabel = account.status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    const hasWithdrawals = (account.totalWithdrawals || 0) > 0
    const netPnl = (account.totalWithdrawals || 0) - account.cost

    return (
        <div className="group relative bg-dark-900 rounded-xl border border-dark-700 overflow-hidden hover:border-dark-600 transition-all hover:shadow-lg">
            <div className={cn("h-1.5 w-full", account.color || 'bg-dark-700')} />

            <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-dark-300 uppercase tracking-wider text-[10px]">{account.provider}</span>
                            {account.isFunded && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                    FUNDED
                                </span>
                            )}
                        </div>
                        <h3 className="font-display font-bold text-lg text-white">{account.name}</h3>
                        <div className="flex items-center gap-2 mt-1">
                            <div className={cn("flex items-center gap-1.5 text-xs font-medium", statusColor)}>
                                <div className={cn("w-1.5 h-1.5 rounded-full", statusColor.replace('text-', 'bg-'))} />
                                {statusLabel}
                            </div>
                            <span className="text-dark-600 text-xs">•</span>
                            <span className="text-dark-400 text-xs text-mono">
                                {account.purchaseDate instanceof Date ? account.purchaseDate.toLocaleDateString() : 'Unknown Date'}
                            </span>
                        </div>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                            onClick={onEdit}
                            className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-800 rounded transition-colors"
                            title="Edit Account"
                        >
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                            onClick={onDelete}
                            disabled={isDeleting}
                            className="p-1.5 text-dark-400 hover:text-red-400 hover:bg-dark-800 rounded transition-colors"
                            title="Delete Account"
                        >
                            {isDeleting ? <div className="w-4 h-4 border-2 border-dark-600 border-t-red-500 rounded-full animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3 border-t border-b border-dark-800/50 mb-3">
                    <div>
                        <span className="text-xs text-dark-500 block mb-0.5">Account Size</span>
                        <span className="text-sm font-mono text-dark-200">
                            ${(account.size || 0).toLocaleString()}
                        </span>
                    </div>
                    <div>
                        <span className="text-xs text-dark-500 block mb-0.5">Cost</span>
                        <span className="text-sm font-mono text-dark-200">
                            ${(account.cost || 0).toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Financials for funded accounts or passed accounts */}
                {(account.isFunded || hasWithdrawals) && (
                    <div className="bg-dark-800/50 rounded-lg p-3 space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-dark-400">Total Withdrawn</span>
                            <span className={cn("text-sm font-mono font-medium", hasWithdrawals ? 'text-profit' : 'text-dark-400')}>
                                +${(account.totalWithdrawals || 0).toLocaleString()}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-dark-700/50">
                            <span className="text-xs text-dark-400">Net ROI</span>
                            <span className={cn("text-sm font-mono font-bold", netPnl >= 0 ? 'text-profit' : 'text-loss')}>
                                {netPnl >= 0 ? '+' : ''}${netPnl.toLocaleString()}
                            </span>
                        </div>
                    </div>
                )}

                {/* Action Button */}
                {account.isFunded && (
                    <button
                        onClick={onAddWithdrawal}
                        className="w-full mt-3 py-2 flex items-center justify-center gap-2 text-xs font-medium text-profit bg-profit/10 hover:bg-profit/20 border border-profit/20 rounded-lg transition-colors"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Payout
                    </button>
                )}
            </div>
        </div>
    )
}
