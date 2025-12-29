'use client'

import { useState } from 'react'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'
import { Loader2, Mail, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

import { PropFirmAccount } from '@/lib/firebase/propFirms'

// Web Application Client ID - Users need to configure origin for this ID
const CLIENT_ID = '218876218712-nepnfrv5j8jlnos75efg7iu9idqo4reu.apps.googleusercontent.com'

export interface FoundAccount {
    id: string
    login: string
    size: number
    type: 'Trading Combine' | 'Payout'
    date: Date
    provider: string
    amount?: number // For payouts
    targetAccountId?: string // For linking payouts to existing accounts
    cost?: number // Cost of the account/evaluation
}

interface GmailImportButtonProps {
    onImport: (items: FoundAccount[]) => Promise<void>
    existingAccounts: PropFirmAccount[]
}

function GmailImportButtonContent({ onImport, existingAccounts }: GmailImportButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [status, setStatus] = useState<string>('')
    const [foundItems, setFoundItems] = useState<FoundAccount[]>([])
    const [showModal, setShowModal] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Filter state
    const [startDate, setStartDate] = useState<string>('')

    const fundedAccounts = existingAccounts.filter(a => a.isFunded)

    // Helper to filter out already-imported items
    const filterImportedItems = (items: FoundAccount[]) => {
        return items.filter(item => {
            // Filter out already-imported accounts (compare login to account name)
            if (item.type === 'Trading Combine') {
                return !existingAccounts.some(acc => acc.name.includes(item.login))
            }
            // Filter out already-imported payouts (by amount + date match)
            if (item.type === 'Payout') {
                return !existingAccounts.some(acc =>
                    acc.withdrawalHistory?.some((w: any) =>
                        w.amount === item.amount &&
                        new Date(w.date).toDateString() === item.date.toDateString()
                    )
                )
            }
            return true
        })
    }

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setIsLoading(true)
            setStatus('Scanning emails...')
            try {
                console.log('Starting Import. Start Date:', startDate)
                const items = await fetchTopstepEmails(tokenResponse.access_token, startDate, (msg) => setStatus(msg))
                if (items.length > 0) {
                    setFoundItems(items)
                    // Select only non-imported items by default
                    const filteredItems = filterImportedItems(items)
                    setSelectedIds(new Set(filteredItems.map(a => a.id)))
                    setShowModal(true)
                } else {
                    alert('No relevant Topstep emails found matching criteria. Check console for debug info.')
                }
            } catch (error) {
                console.error('Gmail Scan Error:', error)
                alert('Failed to scan Gmail. See console for details.')
            } finally {
                setIsLoading(false)
                setStatus('')
            }
        },
        onError: () => {
            console.error('Login Failed')
            alert('Google Login Failed')
        },
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        flow: 'implicit'
    })

    const handleImportConfirm = async () => {
        // Only consider non-imported items that are selected
        const filteredItems = filterImportedItems(foundItems)
        const toImport = filteredItems.filter(a => selectedIds.has(a.id))

        // Validate Payouts have a target account
        const invalidPayouts = toImport.filter(item => item.type === 'Payout' && !item.targetAccountId)
        if (invalidPayouts.length > 0) {
            alert('Please select a target account for all selected payouts.')
            return
        }

        if (toImport.length === 0) return

        setIsLoading(true)
        try {
            await onImport(toImport)
            setShowModal(false)
            setFoundItems([])
        } catch (error) {
            console.error(error)
            alert('Failed to import items')
        } finally {
            setIsLoading(false)
        }
    }

    const updateTargetAccount = (itemId: string, accountId: string) => {
        setFoundItems(prev => prev.map(item =>
            item.id === itemId ? { ...item, targetAccountId: accountId } : item
        ))
    }

    if (showModal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                <div className="relative w-full max-w-4xl bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b border-dark-800">
                        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                            <Mail className="w-5 h-5 text-blue-400" />
                            Found Items from Gmail
                        </h2>
                    </div>

                    <div className="p-0 overflow-y-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-dark-800 bg-dark-800/50 text-xs font-medium text-dark-400 uppercase tracking-wider">
                                    <th className="p-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === foundItems.length}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedIds(new Set(foundItems.map(a => a.id)))
                                                else setSelectedIds(new Set())
                                            }}
                                            className="rounded border-dark-600 bg-dark-800"
                                        />
                                    </th>
                                    <th className="p-4">Type</th>
                                    <th className="p-4">Account / Login</th>
                                    <th className="p-4">Details</th>
                                    <th className="p-4">Assign To (Payouts)</th>
                                    <th className="p-4">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-800/50">
                                {filterImportedItems(foundItems).map(item => (
                                    <tr key={item.id} className="hover:bg-dark-800/30 transition-colors">
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(item.id)}
                                                onChange={(e) => {
                                                    const newSet = new Set(selectedIds)
                                                    if (e.target.checked) newSet.add(item.id)
                                                    else newSet.delete(item.id)
                                                    setSelectedIds(newSet)
                                                }}
                                                className="rounded border-dark-600 bg-dark-800"
                                            />
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "text-xs px-2 py-1 rounded-full font-medium",
                                                item.type === 'Payout' ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-400"
                                            )}>
                                                {item.type === 'Payout' ? 'Payout' : 'Account'}
                                            </span>
                                        </td>
                                        <td className="p-4 font-mono text-sm text-white">{item.login}</td>
                                        <td className="p-4 text-sm text-dark-200">
                                            {item.type === 'Payout'
                                                ? <span className="text-green-400 font-bold">+${item.amount?.toLocaleString()}</span>
                                                : <span className="text-dark-300">Size: {(item.size / 1000).toFixed(0)}K</span>
                                            }
                                        </td>
                                        <td className="p-4">
                                            {item.type === 'Payout' ? (
                                                <select
                                                    value={item.targetAccountId || ''}
                                                    onChange={(e) => updateTargetAccount(item.id, e.target.value)}
                                                    className="bg-dark-800 border-dark-700 text-sm rounded-lg p-2 w-48 text-white focus:ring-primary-500 focus:border-primary-500"
                                                    disabled={!selectedIds.has(item.id)}
                                                >
                                                    <option value="">Select Account...</option>
                                                    {fundedAccounts.map(acc => (
                                                        <option key={acc.id} value={acc.id}>
                                                            {acc.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <span className="text-dark-500 text-xs">-</span>
                                            )}
                                        </td>
                                        <td className="p-4 text-sm text-dark-300">{item.date.toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-6 border-t border-dark-800 flex justify-end gap-3 bg-dark-900">
                        <button
                            onClick={() => setShowModal(false)}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleImportConfirm}
                            disabled={isLoading || selectedIds.size === 0}
                            className="btn-primary"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                            Import {selectedIds.size} Items
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 bg-dark-800/50 rounded-lg p-1 border border-dark-700/50 hover:border-dark-600 transition-colors">
                <span className="text-xs text-dark-400 pl-2 font-medium">From:</span>
                <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent text-xs text-white border-none focus:ring-0 w-[100px] p-1"
                />
            </div>

            <button
                onClick={() => login()}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 text-dark-100 rounded-lg text-sm font-medium border border-dark-700 transition-all shadow-sm"
            >
                {isLoading ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {status || 'Scanning...'}
                    </>
                ) : (
                    <>
                        <Mail className="w-4 h-4 text-red-400" />
                        Import
                    </>
                )}
            </button>
        </div>
    )
}

export function GmailImportButton(props: GmailImportButtonProps) {
    return (
        <GoogleOAuthProvider clientId={CLIENT_ID}>
            <GmailImportButtonContent {...props} />
        </GoogleOAuthProvider>
    )
}

// ================= Logic =================

async function fetchTopstepEmails(accessToken: string, startDate: string, onStatus: (msg: string) => void): Promise<FoundAccount[]> {
    const found: FoundAccount[] = []
    let nextPageToken: string | undefined = undefined

    // Build Query - includes Topstep, MFFU, Bulenox, and Take Profit Trader
    let q = '(' +
        'from:noreply@topstep.com OR ' +
        'from:*myfundedfutures* OR ' +
        'from:*bulenox* OR ' +
        'from:*takeprofittrader*' +
        ') (' +
        'subject:(Trading Combine) OR ' +
        'subject:(Payout) OR ' +
        'subject:(Tradovate Account Credentials) OR ' +
        'subject:(Passed Your Evaluation) OR ' +
        'subject:(Payment Receipt) OR ' +  // Bulenox payment
        'subject:(Setting Up Your Trading Test)' +  // TPT account
        ')'

    if (startDate) {
        // Gmail format: after:YYYY/MM/DD
        const dateStr = startDate.replace(/-/g, '/')
        q += ` after:${dateStr}`
    }

    console.log('Query String:', q)

    const query = encodeURIComponent(q)
    let totalMessages: any[] = []

    onStatus('Searching emails...')

    // Pagination Loop
    // Limit increased to 50 pages (~10,000 emails) to ensure we get everything
    let pageCount = 0
    const maxPages = 50

    while (pageCount < maxPages) {
        let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=200`
        if (nextPageToken) url += `&pageToken=${nextPageToken}`

        console.log(`Fetching page ${pageCount + 1}. Url:`, url)

        const listRes = await fetch(url, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })

        if (!listRes.ok) throw new Error('Failed to list messages')
        const listData = await listRes.json()
        const messages = listData.messages || []

        console.log(`Page ${pageCount + 1} found ${messages.length} messages. Next Page Token:`, listData.nextPageToken)

        if (messages.length > 0) {
            totalMessages = [...totalMessages, ...messages]
        }

        nextPageToken = listData.nextPageToken
        pageCount++

        onStatus(`Found ${totalMessages.length} emails so far (Page ${pageCount})...`)

        if (!nextPageToken) {
            console.log('No more pages.')
            break
        }
    }

    if (totalMessages.length === 0) {
        console.log('Total messages found is 0.')
        return []
    }

    onStatus(`Scanning content of ${totalMessages.length} emails...`)

    // Helper to decode Base64Url
    const decode = (str: string) => {
        try {
            return decodeURIComponent(atob(str.replace(/-/g, '+').replace(/_/g, '/')).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
        } catch (e) { return '' }
    }

    // Helper for recursive body
    const getBody = (payload: any): string => {
        if (payload.body?.data) {
            if (payload.mimeType?.includes('html') || payload.mimeType?.includes('plain')) {
                return decode(payload.body.data)
            }
        }
        if (payload.parts) {
            for (const part of payload.parts) {
                const res = getBody(part)
                if (res) return res
            }
        }
        return ''
    }

    const findHtmlPart = (parts: any[]): string | null => {
        if (!parts) return null
        for (const p of parts) {
            if (p.mimeType === 'text/html' && p.body?.data) return decode(p.body.data)
            if (p.parts) {
                const found = findHtmlPart(p.parts)
                if (found) return found
            }
        }
        return null
    }

    // Enable console logs for debugging
    console.log(`Starting scan of ${totalMessages.length} messages`)

    // Limit concurrency if needed, but 200 is manageable usually. Sequential for safety and status updates.
    // Process in chunks to avoid overwhelming browser/limit
    for (let i = 0; i < totalMessages.length; i++) {
        const msgId = totalMessages[i].id
        // Report status every 10 emails
        if (i % 10 === 0) onStatus(`Scanning ${i}/${totalMessages.length}...`)

        try {
            const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
            })
            const msg = await detailRes.json()

            const headers = msg.payload?.headers || []
            const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
            const dateStr = headers.find((h: any) => h.name === 'Date')?.value || ''

            // Console log dates periodically to trace progress
            if (i % 20 === 0) {
                console.log(`Processing email #${i}: ${subject} [${dateStr}]`)
            }

            // Parse Body
            const rawHtml = findHtmlPart(msg.payload?.parts ? [msg.payload] : []) || getBody(msg.payload)
            if (!rawHtml) continue

            const parser = new DOMParser()
            const doc = parser.parseFromString(rawHtml, 'text/html')
            const textContent = doc.body.textContent || ''

            // 1. Topstep New Account (subject contains "started")
            if (subject.toLowerCase().includes('started')) {
                const accountNameMatch = textContent.match(/Account Name:?\s*([A-Za-z0-9-]+)/i)
                if (accountNameMatch) {
                    const login = accountNameMatch[1]
                    let size = 0
                    if (login.includes('50K')) size = 50000
                    else if (login.includes('100K')) size = 100000
                    else if (login.includes('150K')) size = 150000
                    else if (login.includes('300K')) size = 300000
                    else size = 50000

                    found.push({
                        id: msgId,
                        login,
                        size,
                        type: 'Trading Combine',
                        date: new Date(dateStr),
                        provider: 'Topstep'
                    })
                }
            }
            // 2. Topstep Payout (subject contains "payout")
            else if (subject.toLowerCase().includes('payout')) {
                // "Payout Request Confirmation"
                console.log('Analyzing Payout Email:', subject, textContent.substring(0, 500))

                let login: string | undefined
                let amount: number | undefined

                // Pattern 1: Specific sentence "account [ID] in the amount of $ [AMOUNT]"
                // Example: "for your account EXPRESSMay... in the amount of $ 799.00"
                // Note: Space after $ is common in some templates
                const sentenceMatch = textContent.match(/account\s+([A-Za-z0-9-]+)\s+in\s+the\s+amount\s+of\s+\$\s*([\d,]+(?:\.\d{2})?)/i)

                if (sentenceMatch) {
                    login = sentenceMatch[1]
                    amount = parseFloat(sentenceMatch[2].replace(/,/g, ''))
                } else {
                    // Pattern 2: Generic fallback
                    console.log('Specific sentence match failed, trying generic...')

                    // Login
                    const loginMatch = textContent.match(/(?:Account(?:\s+Name)?|Login|Trading\s+Account)[:\s]+([A-Za-z0-9-]+)/i)
                    if (loginMatch) login = loginMatch[1].trim()

                    // Amount
                    const amountMatch = textContent.match(/\$\s*([\d,]+(?:\.\d{2})?)/i)
                    if (amountMatch) amount = parseFloat(amountMatch[1].replace(/,/g, ''))
                }

                if (login && amount && !isNaN(amount)) {
                    found.push({
                        id: msgId,
                        login,
                        size: 0,
                        type: 'Payout',
                        date: new Date(dateStr),
                        provider: 'Topstep',
                        amount
                    })
                } else {
                    console.warn('Payout regex failed:', { login, amount, subject })
                }
            }
            // 3. MFFU Account Credentials (subject contains "Tradovate Account Credentials")
            else if (subject.toLowerCase().includes('tradovate account credentials')) {
                console.log('Parsing MFFU Account Credentials:', subject)
                // Extract account ID - pattern like "Account ID MFFUEVST131173035"
                const accountMatch = textContent.match(/Account\s*ID\s*:?\s*([A-Za-z0-9]+)/i)
                console.log('MFFU match:', accountMatch, textContent.substring(0, 300))
                if (accountMatch) {
                    const login = accountMatch[1]
                    let size = 0
                    let cost = 0
                    // MFFU Core Plan pricing (as of 2024)
                    if (textContent.includes('50,000') || textContent.includes('50000') || textContent.includes('50K')) {
                        size = 50000
                        cost = 77
                    } else if (textContent.includes('100,000') || textContent.includes('100000') || textContent.includes('100K')) {
                        size = 100000
                        cost = 150
                    } else if (textContent.includes('150,000') || textContent.includes('150000') || textContent.includes('150K')) {
                        size = 150000
                        cost = 220
                    } else {
                        size = 50000
                        cost = 77
                    }

                    found.push({
                        id: msgId,
                        login,
                        size,
                        type: 'Trading Combine',
                        date: new Date(dateStr),
                        provider: 'MFFU',
                        cost
                    })
                }
            }
            // 4. MFFU Evaluation Passed (subject contains "Passed Your Evaluation")
            else if (subject.toLowerCase().includes('passed your evaluation')) {
                console.log('Parsing MFFU Evaluation Passed:', subject)
                const accountMatch = textContent.match(/Account\s*ID\s*:?\s*([A-Za-z0-9]+)/i)
                console.log('MFFU Eval match:', accountMatch)
                if (accountMatch) {
                    const login = accountMatch[1]
                    let size = 0
                    let cost = 0
                    // MFFU Core Plan pricing (as of 2024)
                    if (textContent.includes('50,000') || textContent.includes('50000') || textContent.includes('50K')) {
                        size = 50000
                        cost = 77
                    } else if (textContent.includes('100,000') || textContent.includes('100000') || textContent.includes('100K')) {
                        size = 100000
                        cost = 150
                    } else if (textContent.includes('150,000') || textContent.includes('150000') || textContent.includes('150K')) {
                        size = 150000
                        cost = 220
                    } else {
                        size = 50000
                        cost = 77
                    }

                    found.push({
                        id: msgId,
                        login,
                        size,
                        type: 'Trading Combine',
                        date: new Date(dateStr),
                        provider: 'MFFU',
                        cost
                    })
                }
            }
            // 5. Bulenox Payment Receipt
            else if (subject.toLowerCase().includes('payment receipt') && subject.toLowerCase().includes('bulenox')) {
                console.log('Parsing Bulenox Payment Receipt:', subject)
                // Extract payment amount from email body
                const amountMatch = textContent.match(/Payment\s*Amount:?\s*\$?\s*([\d,.]+)/i)
                    || textContent.match(/Amount:?\s*\$?\s*([\d,.]+)\s*USD/i)

                if (amountMatch) {
                    const cost = parseFloat(amountMatch[1].replace(/,/g, ''))

                    // Try to find account size from email or use a default
                    let size = 50000 // Default
                    if (textContent.includes('25,000') || textContent.includes('25000') || textContent.includes('25K') || textContent.includes('25k')) {
                        size = 25000
                    } else if (textContent.includes('50,000') || textContent.includes('50000') || textContent.includes('50K') || textContent.includes('50k')) {
                        size = 50000
                    } else if (textContent.includes('100,000') || textContent.includes('100000') || textContent.includes('100K') || textContent.includes('100k')) {
                        size = 100000
                    } else if (textContent.includes('150,000') || textContent.includes('150000') || textContent.includes('150K') || textContent.includes('150k')) {
                        size = 150000
                    } else if (textContent.includes('250,000') || textContent.includes('250000') || textContent.includes('250K') || textContent.includes('250k')) {
                        size = 250000
                    }

                    // Generate a login from date + provider
                    const login = `Bulenox-${size / 1000}K-${new Date(dateStr).toISOString().split('T')[0]}`

                    found.push({
                        id: msgId,
                        login,
                        size,
                        type: 'Trading Combine',
                        date: new Date(dateStr),
                        provider: 'Bulenox',
                        cost
                    })
                }
            }
            // 6. Take Profit Trader - Setting Up Your Trading Test
            else if (subject.toLowerCase().includes('setting up your trading test')) {
                console.log('Parsing TPT Trading Test:', subject)

                // Try to find account size
                let size = 50000 // Default
                if (textContent.includes('25,000') || textContent.includes('25000') || textContent.includes('$25K') || textContent.includes('25K')) {
                    size = 25000
                } else if (textContent.includes('50,000') || textContent.includes('50000') || textContent.includes('$50K') || textContent.includes('50K')) {
                    size = 50000
                } else if (textContent.includes('100,000') || textContent.includes('100000') || textContent.includes('$100K') || textContent.includes('100K')) {
                    size = 100000
                } else if (textContent.includes('150,000') || textContent.includes('150000') || textContent.includes('$150K') || textContent.includes('150K')) {
                    size = 150000
                }

                // Generate a login from date + provider
                const login = `TPT-${size / 1000}K-${new Date(dateStr).toISOString().split('T')[0]}`

                found.push({
                    id: msgId,
                    login,
                    size,
                    type: 'Trading Combine',
                    date: new Date(dateStr),
                    provider: 'Take Profit Trader'
                })
            } else {
                // Catch-all for debugging skipped emails
                // Log only occasionally or if needed
                if (i < 50 || i % 20 === 0) {
                    console.log(`Skipped email (no match): ${subject}`)
                }
            }
        } catch (err) {
            console.error('Error fetching message details', err)
        }
    }

    // Deduplication Logic
    const uniqueAccounts = new Map<string, FoundAccount>()
    const payouts: FoundAccount[] = []

    found.forEach(item => {
        if (item.type === 'Payout') {
            payouts.push(item)
        } else {
            if (!uniqueAccounts.has(item.login) || uniqueAccounts.get(item.login)!.date < item.date) {
                uniqueAccounts.set(item.login, item)
            }
        }
    })

    // Sort by date desc
    const result = [...Array.from(uniqueAccounts.values()), ...payouts].sort((a, b) => b.date.getTime() - a.date.getTime())
    console.log('Final found items:', result)
    return result
}
