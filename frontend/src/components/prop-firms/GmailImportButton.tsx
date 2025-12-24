'use client'

import { useState } from 'react'
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google'
import { Loader2, Mail, Check, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// Web Application Client ID
const CLIENT_ID = '218876218712-nepnfrv5j8jlnos75efg7iu9idqo4reu.apps.googleusercontent.com'

export interface FoundAccount {
    id: string
    login: string
    size: number
    type: string
    date: Date
    provider: string
}

interface GmailImportButtonProps {
    onImport: (accounts: FoundAccount[]) => Promise<void>
}

function GmailImportButtonContent({ onImport }: GmailImportButtonProps) {
    const [isLoading, setIsLoading] = useState(false)
    const [status, setStatus] = useState<string>('')
    const [foundAccounts, setFoundAccounts] = useState<FoundAccount[]>([])
    const [showModal, setShowModal] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    const login = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            setIsLoading(true)
            setStatus('Scanning emails...')
            try {
                const accounts = await fetchTopstepAccounts(tokenResponse.access_token, (msg) => setStatus(msg))
                if (accounts.length > 0) {
                    setFoundAccounts(accounts)
                    // Select all by default
                    setSelectedIds(new Set(accounts.map(a => a.id)))
                    setShowModal(true)
                } else {
                    alert('No Topstep "Trading Combine Started" emails found.')
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
        flow: 'implicit' // Get access token directly
    })

    const handleImportConfirm = async () => {
        const toImport = foundAccounts.filter(a => selectedIds.has(a.id))
        if (toImport.length === 0) return

        setIsLoading(true)
        try {
            await onImport(toImport)
            setShowModal(false)
            setFoundAccounts([])
        } catch (error) {
            console.error(error)
            alert('Failed to import accounts')
        } finally {
            setIsLoading(false)
        }
    }

    if (showModal) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
                <div className="relative w-full max-w-2xl bg-dark-900 rounded-2xl border border-dark-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                    <div className="flex items-center justify-between p-6 border-b border-dark-800">
                        <h2 className="text-xl font-display font-bold text-white flex items-center gap-2">
                            <Mail className="w-5 h-5 text-blue-400" />
                            Found Accounts from Gmail
                        </h2>
                    </div>

                    <div className="p-0 overflow-y-auto flex-1">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-dark-800 bg-dark-800/50 text-xs font-medium text-dark-400 uppercase tracking-wider">
                                    <th className="p-4 w-10">
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.size === foundAccounts.length}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedIds(new Set(foundAccounts.map(a => a.id)))
                                                else setSelectedIds(new Set())
                                            }}
                                            className="rounded border-dark-600 bg-dark-800"
                                        />
                                    </th>
                                    <th className="p-4">Account / Login</th>
                                    <th className="p-4">Size</th>
                                    <th className="p-4">Date</th>
                                    <th className="p-4">Provider</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-800/50">
                                {foundAccounts.map(acc => (
                                    <tr key={acc.id} className="hover:bg-dark-800/30 transition-colors">
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(acc.id)}
                                                onChange={(e) => {
                                                    const newSet = new Set(selectedIds)
                                                    if (e.target.checked) newSet.add(acc.id)
                                                    else newSet.delete(acc.id)
                                                    setSelectedIds(newSet)
                                                }}
                                                className="rounded border-dark-600 bg-dark-800"
                                            />
                                        </td>
                                        <td className="p-4 font-mono text-sm text-white">{acc.login}</td>
                                        <td className="p-4 text-sm text-dark-200">${(acc.size / 1000).toFixed(0)}K</td>
                                        <td className="p-4 text-sm text-dark-300">{acc.date.toLocaleDateString()}</td>
                                        <td className="p-4 text-sm text-dark-300">{acc.provider}</td>
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
                            Import {selectedIds.size} Accounts
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <button
            onClick={() => login()}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 bg-dark-800 hover:bg-dark-700 text-dark-100 rounded-lg text-sm font-medium border border-dark-700 transition-all"
        >
            {isLoading ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {status || 'Scanning...'}
                </>
            ) : (
                <>
                    <Mail className="w-4 h-4 text-red-400" />
                    Import from Gmail
                </>
            )}
        </button>
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

async function fetchTopstepAccounts(accessToken: string, onStatus: (msg: string) => void): Promise<FoundAccount[]> {
    const found: FoundAccount[] = []

    // 1. Search for emails
    onStatus('Searching emails...')
    const query = encodeURIComponent('from:noreply@topstep.com')
    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${query}&maxResults=20`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    })

    if (!listRes.ok) throw new Error('Failed to list messages')
    const listData = await listRes.json()
    const messages = listData.messages || []

    if (messages.length === 0) return []

    // 2. Fetch details for each
    onStatus(`Scanning ${messages.length} emails...`)

    // Helper to decode Base64Url
    const decode = (str: string) => {
        try {
            return decodeURIComponent(atob(str.replace(/-/g, '+').replace(/_/g, '/')).split('').map(function (c) {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join(''));
        } catch (e) { return '' }
    }

    for (let i = 0; i < messages.length; i++) {
        const msgId = messages[i].id
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        const msg = await detailRes.json()

        // Extract headers
        const headers = msg.payload?.headers || []
        const subject = headers.find((h: any) => h.name === 'Subject')?.value || ''
        const dateStr = headers.find((h: any) => h.name === 'Date')?.value || ''

        // We really only care about "Trading Combine Started" or similar
        // But let's check body for "Account Name" anyway to be robust
        if (!subject.includes('Started')) continue

        // Extract body
        let body = ''
        const getBody = (payload: any) => {
            if (payload.body?.data) {
                // Check mime type? Priority for text/html
                if (payload.mimeType?.includes('html')) {
                    // It's html
                    return decode(payload.body.data)
                }
                else if (payload.mimeType?.includes('plain')) {
                    return decode(payload.body.data)
                }
            }
            if (payload.parts) {
                for (const part of payload.parts) {
                    const res = getBody(part)
                    if (res) return res // Prefer first found?
                }
            }
            return ''
        }

        // A simpler recursive search for HTML part
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

        const rawHtml = findHtmlPart(msg.payload?.parts ? [msg.payload] : []) || getBody(msg.payload)

        if (!rawHtml) continue

        // Parse HTML to text for easier regex? Or regex on HTML
        // Use DOMParser
        const parser = new DOMParser()
        const doc = parser.parseFromString(rawHtml, 'text/html')
        const textContent = doc.body.textContent || ''

        // Regex logic
        // Try looking for "Account Name:" in text content
        // Or in innerText of specific elements? Text content is safest for simple search

        // Regex patterns
        const accountNameMatch = textContent.match(/Account Name:?\s*([A-Za-z0-9-]+)/i)

        if (accountNameMatch) {
            const login = accountNameMatch[1] // e.g. 50KTC-V2...

            // Determine size
            let size = 0
            if (login.includes('50K')) size = 50000
            else if (login.includes('100K')) size = 100000
            else if (login.includes('150K')) size = 150000
            else if (login.includes('300K')) size = 300000
            else size = 50000 // Default fallback

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

    // Deduplicate by login (keep latest date)
    const unique = new Map<string, FoundAccount>()
    found.forEach(acc => {
        if (!unique.has(acc.login) || unique.get(acc.login)!.date < acc.date) {
            unique.set(acc.login, acc)
        }
    })

    return Array.from(unique.values())
}
