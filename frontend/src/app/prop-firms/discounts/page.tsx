'use client'

import { DISCOUNTS, PROP_FIRMS } from '@/lib/data/propFirmsData'
import { Sidebar } from '@/components/Sidebar'
import { ArrowLeft, ExternalLink, Percent, Copy, Check } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'

export default function DiscountsPage() {
    const { isSidebarCollapsed } = useStore()
    const [copiedCode, setCopiedCode] = useState<string | null>(null)

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code)
        setCopiedCode(code)
        setTimeout(() => setCopiedCode(null), 2000)
    }

    return (
        <div className="flex h-screen bg-dark-950 overflow-hidden">
            <Sidebar />

            <main className={cn(
                "flex-1 transition-all duration-300 ease-in-out",
                "ml-0",
                isSidebarCollapsed ? "md:ml-28" : "md:ml-72"
            )}>
                <div className="p-8 max-w-7xl mx-auto space-y-8">

                    {/* Header */}
                    <div>
                        <Link href="/prop-firms" className="inline-flex items-center text-sm text-dark-400 hover:text-white mb-4 transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-1" />
                            Back to Dashboard
                        </Link>
                        <h1 className="text-3xl font-display font-bold text-white flex items-center gap-3">
                            <div className="p-2 bg-profit/10 rounded-lg">
                                <Percent className="w-8 h-8 text-profit" />
                            </div>
                            Prop Firm Discounts
                        </h1>
                        <p className="text-dark-400 mt-2 max-w-2xl">
                            Exclusive offers and active discount codes for top prop firms. Save money on your next evaluation.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {DISCOUNTS.map((deal, i) => {
                            const firm = PROP_FIRMS.find(f => f.name === deal.firmName)
                            const color = firm?.logoColor || 'bg-blue-600'

                            return (
                                <div key={i} className="group bg-dark-900 rounded-xl border border-dark-700 overflow-hidden hover:border-dark-500 transition-all hover:shadow-xl hover:shadow-black/20">
                                    <div className={cn("h-2 w-full", color)} />

                                    <div className="p-6">
                                        <h3 className="text-lg font-bold text-white mb-1">{deal.firmName}</h3>
                                        <div className="text-4xl font-display font-black text-white mb-4">
                                            {deal.amount}
                                        </div>
                                        <p className="text-sm text-dark-400 mb-6 min-h-[40px]">
                                            {deal.description}
                                        </p>

                                        <div className="flex items-center gap-2 mb-4 bg-dark-950 p-2 rounded-lg border border-dark-800 border-dashed">
                                            <code className="flex-1 text-center font-mono font-bold text-lg text-primary tracking-wider">
                                                {deal.code}
                                            </code>
                                            <button
                                                onClick={() => handleCopy(deal.code)}
                                                className="p-2 hover:bg-dark-800 rounded bg-dark-900 text-dark-300 hover:text-white transition-colors"
                                                title="Copy Code"
                                            >
                                                {copiedCode === deal.code ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                                            </button>
                                        </div>

                                        <a
                                            href={deal.link || '#'}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center justify-center gap-2 w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors"
                                        >
                                            Claim Offer <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="p-6 bg-dark-900 rounded-xl border border-dark-800 mt-8">
                        <h3 className="text-lg font-bold text-white mb-2">About These Discounts</h3>
                        <p className="text-dark-400 text-sm">
                            These codes are verified and sourced from PropFirmMatch. Offers may be subject to change by the provider at any time.
                            Always double-check the final price at checkout before purchasing.
                        </p>
                    </div>

                </div>
            </main>
        </div>
    )
}
