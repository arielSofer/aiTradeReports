'use client'

import { useState, useEffect } from 'react'
import { Check, X, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
    getPendingFriendRequests,
    respondToFriendRequest,
    FriendRequest
} from '@/lib/firebase/firestore'

export function FriendRequestPopup() {
    const { user } = useAuth()
    const [requests, setRequests] = useState<FriendRequest[]>([])
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isVisible, setIsVisible] = useState(false)
    const [isResponding, setIsResponding] = useState(false)

    useEffect(() => {
        if (user) {
            checkRequests()
            // Check every 30 seconds for new requests
            const interval = setInterval(checkRequests, 30000)
            return () => clearInterval(interval)
        }
    }, [user])

    const checkRequests = async () => {
        if (!user) return
        const pending = await getPendingFriendRequests(user.uid)
        setRequests(pending)
        if (pending.length > 0) {
            setIsVisible(true)
        }
    }

    const handleRespond = async (accept: boolean) => {
        const currentRequest = requests[currentIndex]
        if (!currentRequest?.id) return

        setIsResponding(true)
        try {
            await respondToFriendRequest(currentRequest.id, accept)

            // Remove from list
            const newRequests = requests.filter((_, i) => i !== currentIndex)
            setRequests(newRequests)

            if (newRequests.length === 0) {
                setIsVisible(false)
            } else if (currentIndex >= newRequests.length) {
                setCurrentIndex(newRequests.length - 1)
            }
        } catch (err) {
            console.error('Error responding to request:', err)
        } finally {
            setIsResponding(false)
        }
    }

    if (!isVisible || requests.length === 0) return null

    const currentRequest = requests[currentIndex]

    return (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-dark-800 border border-dark-700 rounded-2xl shadow-2xl p-4 w-80">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-primary-500/20 rounded-lg">
                            <Users className="w-4 h-4 text-primary-400" />
                        </div>
                        <span className="text-sm font-medium text-white">Friend Request</span>
                    </div>
                    {requests.length > 1 && (
                        <span className="text-xs text-dark-500">
                            {currentIndex + 1} of {requests.length}
                        </span>
                    )}
                </div>

                {/* Content */}
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary-400 font-bold text-lg">
                            {currentRequest.fromUsername.charAt(0).toUpperCase()}
                        </span>
                    </div>
                    <div>
                        <p className="text-white font-medium">@{currentRequest.fromUsername}</p>
                        <p className="text-sm text-dark-400">wants to view your trading data</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button
                        onClick={() => handleRespond(true)}
                        disabled={isResponding}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors',
                            'bg-profit/20 text-profit hover:bg-profit/30'
                        )}
                    >
                        <Check className="w-4 h-4" />
                        Accept
                    </button>
                    <button
                        onClick={() => handleRespond(false)}
                        disabled={isResponding}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors',
                            'bg-dark-700 text-dark-300 hover:bg-dark-600 hover:text-white'
                        )}
                    >
                        <X className="w-4 h-4" />
                        Decline
                    </button>
                </div>

                {/* Navigation for multiple requests */}
                {requests.length > 1 && (
                    <div className="flex justify-center gap-2 mt-3">
                        {requests.map((_, i) => (
                            <button
                                key={i}
                                onClick={() => setCurrentIndex(i)}
                                className={cn(
                                    'w-2 h-2 rounded-full transition-colors',
                                    i === currentIndex ? 'bg-primary-400' : 'bg-dark-600 hover:bg-dark-500'
                                )}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
