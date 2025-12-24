'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, Search, Upload, Plus, User, LogOut, Settings, ChevronDown } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

interface HeaderProps {
  onUploadClick?: () => void
  onAddTradeClick?: () => void
}

export function Header({ onUploadClick, onAddTradeClick }: HeaderProps) {
  const { user, profile, signOut } = useAuth()
  const router = useRouter()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  const handleUploadClick = () => {
    if (onUploadClick) {
      onUploadClick()
    } else {
      router.push('/import')
    }
  }

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const displayName = profile?.displayName || user?.displayName || user?.email?.split('@')[0] || 'User'
  const photoURL = user?.photoURL

  return (
    <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side */}
        <div>
          <h2 className="text-xl font-display font-bold text-white">Dashboard</h2>
          <p className="text-sm text-dark-500">
            {formatDate(new Date())} · Overview of your trading performance
          </p>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500" />
            <input
              type="text"
              placeholder="Search trades..."
              className="w-64 pl-10 pr-4 py-2 bg-dark-900/50 border border-dark-700/50 rounded-lg
                         text-sm text-dark-200 placeholder:text-dark-500
                         focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500
                         transition-all duration-200"
            />
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-dark-400 hover:text-dark-200 transition-colors">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
          </button>

          {/* Upload Button */}
          <button
            onClick={handleUploadClick}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-500 
                       text-white rounded-lg font-medium transition-all duration-200
                       shadow-lg shadow-primary-900/30 hover:shadow-primary-800/40"
          >
            <Upload className="w-4 h-4" />
            Import Trades
          </button>

          {/* Quick Add */}
          <button
            onClick={onAddTradeClick}
            className="p-2 bg-dark-800 hover:bg-dark-700 text-dark-300 rounded-lg 
                       border border-dark-700 transition-all duration-200"
            title="Add Trade"
          >
            <Plus className="w-5 h-5" />
          </button>

          {/* User Menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-3 py-2 bg-dark-800/50 hover:bg-dark-800 
                         rounded-lg border border-dark-700/50 transition-colors"
            >
              {photoURL ? (
                <img
                  src={photoURL}
                  alt={displayName}
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 
                              flex items-center justify-center text-white text-sm font-medium">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-dark-200 max-w-[100px] truncate hidden sm:block">
                {displayName}
              </span>
              <ChevronDown className="w-4 h-4 text-dark-500" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-dark-900 border border-dark-700 rounded-xl 
                            shadow-2xl shadow-black/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="p-4 border-b border-dark-700/50">
                  <p className="text-sm font-medium text-white truncate">{displayName}</p>
                  <p className="text-xs text-dark-500 truncate">{user?.email}</p>
                </div>

                <div className="p-2">
                  <button
                    onClick={() => {
                      setShowUserMenu(false)
                      router.push('/settings')
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-dark-300 
                               hover:text-white hover:bg-dark-800 rounded-lg transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Settings
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-loss 
                               hover:bg-loss/10 rounded-lg transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
