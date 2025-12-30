'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import {
    Users,
    Search,
    UserPlus,
    Check,
    X,
    Loader2,
    Eye,
    UserMinus,
    Mail,
    AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/lib/store'
import {
    getFirestoreUserProfile,
    setUsername,
    sendFriendRequest,
    getPendingFriendRequests,
    respondToFriendRequest,
    getFriends,
    removeFriend,
    FriendRequest,
    FirestoreUserProfile
} from '@/lib/firebase/firestore'
import { FriendProfileModal } from '@/components/FriendProfileModal'

function FriendsContent() {
    const { user } = useAuth()
    const { isSidebarCollapsed } = useStore()

    const [profile, setProfile] = useState<FirestoreUserProfile | null>(null)
    const [username, setUsernameInput] = useState('')
    const [searchUsername, setSearchUsername] = useState('')
    const [isSettingUsername, setIsSettingUsername] = useState(false)
    const [isSendingRequest, setIsSendingRequest] = useState(false)
    const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([])
    const [friends, setFriends] = useState<{ id: string; username: string }[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [selectedFriend, setSelectedFriend] = useState<{ id: string; username: string } | null>(null)

    // Load user profile and friends
    useEffect(() => {
        if (user) {
            loadData()
        }
    }, [user])

    const loadData = async () => {
        if (!user) return
        setLoading(true)
        try {
            const [userProfile, requests, friendsList] = await Promise.all([
                getFirestoreUserProfile(user.uid),
                getPendingFriendRequests(user.uid),
                getFriends(user.uid)
            ])
            setProfile(userProfile)
            setPendingRequests(requests)
            setFriends(friendsList)
        } catch (err) {
            console.error('Error loading data:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleSetUsername = async () => {
        if (!user || !username.trim()) return
        setIsSettingUsername(true)
        setError('')

        const result = await setUsername(user.uid, username)
        if (result.success) {
            setProfile(prev => prev ? { ...prev, username } : { id: user.uid, username, createdAt: null, updatedAt: null })
            setSuccess('Username set successfully!')
            setTimeout(() => setSuccess(''), 3000)
        } else {
            setError(result.error || 'Failed to set username')
        }
        setIsSettingUsername(false)
    }

    const handleSendRequest = async () => {
        if (!user || !profile?.username || !searchUsername.trim()) return
        setIsSendingRequest(true)
        setError('')

        const result = await sendFriendRequest(user.uid, profile.username, searchUsername)
        if (result.success) {
            setSuccess('Friend request sent!')
            setSearchUsername('')
            setTimeout(() => setSuccess(''), 3000)
        } else {
            setError(result.error || 'Failed to send request')
        }
        setIsSendingRequest(false)
    }

    const handleRespondToRequest = async (requestId: string, accept: boolean) => {
        try {
            await respondToFriendRequest(requestId, accept)
            await loadData()
            setSuccess(accept ? 'Friend request accepted!' : 'Friend request declined')
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError('Failed to respond to request')
        }
    }

    const handleRemoveFriend = async (friendId: string) => {
        if (!user) return
        if (!confirm('Are you sure you want to remove this friend?')) return

        try {
            await removeFriend(user.uid, friendId)
            setFriends(friends.filter(f => f.id !== friendId))
            setSuccess('Friend removed')
            setTimeout(() => setSuccess(''), 3000)
        } catch (err) {
            setError('Failed to remove friend')
        }
    }

    return (
        <div className="flex min-h-screen">
            <Sidebar />

            <main className={cn(
                "flex-1 transition-all duration-300",
                "ml-0",
                isSidebarCollapsed ? "md:ml-28" : "md:ml-72"
            )}>
                <div className="p-8 max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-display font-bold text-white">Friends</h1>
                        <p className="text-dark-400 mt-1">Connect with other traders and view their performance</p>
                    </div>

                    {/* Alerts */}
                    {error && (
                        <div className="mb-4 p-4 bg-loss/20 border border-loss/30 rounded-lg flex items-center gap-3">
                            <AlertCircle className="w-5 h-5 text-loss" />
                            <span className="text-loss">{error}</span>
                            <button onClick={() => setError('')} className="ml-auto text-loss/50 hover:text-loss">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-4 bg-profit/20 border border-profit/30 rounded-lg flex items-center gap-3">
                            <Check className="w-5 h-5 text-profit" />
                            <span className="text-profit">{success}</span>
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Username Setup */}
                            {!profile?.username && (
                                <div className="chart-container p-6">
                                    <h2 className="text-lg font-display font-semibold text-white mb-4">
                                        Set Your Username
                                    </h2>
                                    <p className="text-dark-400 text-sm mb-4">
                                        Choose a unique username so friends can find you.
                                    </p>
                                    <div className="flex gap-3">
                                        <input
                                            type="text"
                                            value={username}
                                            onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                            placeholder="your_username"
                                            className="input flex-1"
                                            maxLength={20}
                                        />
                                        <button
                                            onClick={handleSetUsername}
                                            disabled={isSettingUsername || username.length < 3}
                                            className="btn-primary"
                                        >
                                            {isSettingUsername ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Send Friend Request */}
                            {profile?.username && (
                                <div className="chart-container p-6">
                                    <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
                                        <UserPlus className="w-5 h-5 text-primary-400" />
                                        Add Friend
                                    </h2>
                                    <p className="text-dark-400 text-sm mb-4">
                                        Your username: <span className="text-primary-400 font-mono">@{profile.username}</span>
                                    </p>
                                    <div className="flex gap-3">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
                                            <input
                                                type="text"
                                                value={searchUsername}
                                                onChange={(e) => setSearchUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                                placeholder="Enter username..."
                                                className="input w-full pl-10"
                                            />
                                        </div>
                                        <button
                                            onClick={handleSendRequest}
                                            disabled={isSendingRequest || !searchUsername.trim()}
                                            className="btn-primary flex items-center gap-2"
                                        >
                                            {isSendingRequest ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <>
                                                    <Mail className="w-4 h-4" />
                                                    Send Request
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Pending Requests */}
                            {pendingRequests.length > 0 && (
                                <div className="chart-container p-6">
                                    <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
                                        <Mail className="w-5 h-5 text-accent-orange" />
                                        Pending Requests
                                        <span className="ml-2 px-2 py-0.5 bg-accent-orange/20 text-accent-orange text-xs rounded-full">
                                            {pendingRequests.length}
                                        </span>
                                    </h2>
                                    <div className="space-y-3">
                                        {pendingRequests.map(request => (
                                            <div key={request.id} className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                                                <div>
                                                    <p className="text-white font-medium">@{request.fromUsername}</p>
                                                    <p className="text-sm text-dark-500">wants to connect with you</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => handleRespondToRequest(request.id!, true)}
                                                        className="p-2 bg-profit/20 text-profit rounded-lg hover:bg-profit/30 transition-colors"
                                                        title="Accept"
                                                    >
                                                        <Check className="w-5 h-5" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleRespondToRequest(request.id!, false)}
                                                        className="p-2 bg-loss/20 text-loss rounded-lg hover:bg-loss/30 transition-colors"
                                                        title="Decline"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Friends List */}
                            <div className="chart-container p-6">
                                <h2 className="text-lg font-display font-semibold text-white mb-4 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-primary-400" />
                                    Your Friends
                                    <span className="ml-2 text-sm text-dark-500">({friends.length})</span>
                                </h2>

                                {friends.length === 0 ? (
                                    <div className="text-center py-8 text-dark-500">
                                        <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p>No friends yet</p>
                                        <p className="text-sm">Send a friend request to start connecting!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {friends.map(friend => (
                                            <div key={friend.id} className="flex items-center justify-between p-4 bg-dark-800 rounded-lg">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-primary-500/20 flex items-center justify-center">
                                                        <span className="text-primary-400 font-bold">
                                                            {friend.username.charAt(0).toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <p className="text-white font-medium">@{friend.username}</p>
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => setSelectedFriend(friend)}
                                                        className="p-2 bg-primary-500/20 text-primary-400 rounded-lg hover:bg-primary-500/30 transition-colors flex items-center gap-2"
                                                        title="View Profile"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                        <span className="text-sm">View</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleRemoveFriend(friend.id)}
                                                        className="p-2 bg-dark-700 text-dark-400 rounded-lg hover:text-loss hover:bg-loss/10 transition-colors"
                                                        title="Remove Friend"
                                                    >
                                                        <UserMinus className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {/* Friend Profile Modal */}
            {selectedFriend && (
                <FriendProfileModal
                    friendId={selectedFriend.id}
                    friendUsername={selectedFriend.username}
                    onClose={() => setSelectedFriend(null)}
                />
            )}
        </div>
    )
}

export default function FriendsPage() {
    return (
        <ProtectedRoute>
            <FriendsContent />
        </ProtectedRoute>
    )
}
