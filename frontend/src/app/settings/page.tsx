'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from '@/components/Sidebar'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import {
  User,
  Bell,
  Shield,
  CreditCard,
  Palette,
  Globe,
  Save,
  Check,
  Plus,
  X,
  ClipboardList,
  Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useStore } from '@/lib/store'
import { getUserChecklist, updateUserChecklist } from '@/lib/firebase/firestore'

function SettingsContent() {
  const { user, profile } = useAuth()
  const { isSidebarCollapsed } = useStore()
  const [activeTab, setActiveTab] = useState('profile')
  const [saved, setSaved] = useState(false)

  // Checklist state
  const [checklistItems, setChecklistItems] = useState<string[]>([])
  const [newItem, setNewItem] = useState('')
  const [isLoadingChecklist, setIsLoadingChecklist] = useState(false)
  const [isSavingChecklist, setIsSavingChecklist] = useState(false)

  // Load checklist on mount
  useEffect(() => {
    if (user) {
      loadChecklist()
    }
  }, [user])

  const loadChecklist = async () => {
    if (!user) return
    setIsLoadingChecklist(true)
    try {
      const items = await getUserChecklist(user.uid)
      setChecklistItems(items)
    } catch (err) {
      console.error('Error loading checklist:', err)
    } finally {
      setIsLoadingChecklist(false)
    }
  }

  const handleAddChecklistItem = () => {
    if (!newItem.trim()) return
    setChecklistItems([...checklistItems, newItem.trim()])
    setNewItem('')
  }

  const handleRemoveChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index))
  }

  const handleSaveChecklist = async () => {
    if (!user) return
    setIsSavingChecklist(true)
    try {
      await updateUserChecklist(user.uid, checklistItems)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error('Error saving checklist:', err)
    } finally {
      setIsSavingChecklist(false)
    }
  }

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'trading', label: 'Trading', icon: ClipboardList },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'billing', label: 'Billing', icon: CreditCard },
  ]

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className={cn(
        "flex-1 transition-all duration-300",
        isSidebarCollapsed ? "ml-28" : "ml-72"
      )}>
        {/* Header */}
        <header className="sticky top-0 z-40 bg-dark-950/80 backdrop-blur-xl border-b border-dark-800/50">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-xl font-display font-bold text-white">Settings</h2>
              <p className="text-sm text-dark-500">Manage your account and preferences</p>
            </div>
            <button
              onClick={handleSave}
              className="btn-primary flex items-center gap-2"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </header>

        <div className="p-6 flex gap-6">
          {/* Tabs */}
          <div className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all',
                      'text-sm font-medium',
                      activeTab === tab.id
                        ? 'bg-dark-800 text-white'
                        : 'text-dark-400 hover:bg-dark-800/50 hover:text-dark-200'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'profile' && (
              <div className="chart-container p-6 space-y-6">
                <h3 className="text-lg font-display font-semibold text-white">Profile Settings</h3>

                <div className="flex items-center gap-6">
                  {user?.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-accent-purple flex items-center justify-center">
                      <span className="text-2xl font-bold text-white">
                        {(profile?.displayName || user?.email || 'A').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <button className="btn-secondary text-sm">Change Avatar</button>
                    <p className="text-xs text-dark-500 mt-2">JPG, PNG or GIF. Max 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Full Name</label>
                    <input
                      type="text"
                      defaultValue={profile?.displayName || user?.displayName || ''}
                      className="input w-full"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Email</label>
                    <input
                      type="email"
                      defaultValue={user?.email || ''}
                      className="input w-full"
                      disabled
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Timezone</label>
                  <select className="input w-full">
                    <option>America/New_York (EST)</option>
                    <option>America/Chicago (CST)</option>
                    <option>America/Los_Angeles (PST)</option>
                    <option>Europe/London (GMT)</option>
                    <option>Asia/Jerusalem (IST)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">Default Currency</label>
                  <select className="input w-full">
                    <option>USD ($)</option>
                    <option>EUR (€)</option>
                    <option>GBP (£)</option>
                    <option>ILS (₪)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === 'trading' && (
              <div className="chart-container p-6 space-y-6">
                <h3 className="text-lg font-display font-semibold text-white">Trade Checklist</h3>
                <p className="text-sm text-dark-400">Create a checklist to track for each trade. These items will appear in your trade details.</p>

                {isLoadingChecklist ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
                  </div>
                ) : (
                  <>
                    {/* Add new item */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAddChecklistItem()}
                        placeholder="Add checklist item..."
                        className="input flex-1"
                      />
                      <button
                        onClick={handleAddChecklistItem}
                        disabled={!newItem.trim()}
                        className="btn-primary"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Checklist items */}
                    <div className="space-y-2">
                      {checklistItems.length === 0 ? (
                        <p className="text-dark-500 text-sm py-4 text-center">No checklist items yet. Add your first one above!</p>
                      ) : (
                        checklistItems.map((item, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-dark-800/50 rounded-lg">
                            <span className="text-white">{item}</span>
                            <button
                              onClick={() => handleRemoveChecklistItem(index)}
                              className="p-1 text-dark-400 hover:text-loss transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Save button */}
                    <button
                      onClick={handleSaveChecklist}
                      disabled={isSavingChecklist}
                      className="btn-primary flex items-center gap-2"
                    >
                      {isSavingChecklist ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                      ) : (
                        <><Save className="w-4 h-4" /> Save Checklist</>
                      )}
                    </button>
                  </>
                )}
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="chart-container p-6 space-y-6">
                <h3 className="text-lg font-display font-semibold text-white">Notification Preferences</h3>

                <div className="space-y-4">
                  {[
                    { label: 'Daily P&L Summary', description: 'Receive a daily email with your trading summary' },
                    { label: 'Weekly Report', description: 'Get a weekly performance report every Sunday' },
                    { label: 'Trade Alerts', description: 'Get notified when trades are imported' },
                    { label: 'Win Streak Celebrations', description: 'Celebrate your winning streaks!' },
                    { label: 'Risk Warnings', description: 'Get warned when you exceed risk limits' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                      <div>
                        <p className="font-medium text-white">{item.label}</p>
                        <p className="text-sm text-dark-500">{item.description}</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" defaultChecked className="sr-only peer" />
                        <div className="w-11 h-6 bg-dark-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="chart-container p-6 space-y-6">
                <h3 className="text-lg font-display font-semibold text-white">Security Settings</h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Current Password</label>
                    <input type="password" placeholder="••••••••" className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">New Password</label>
                    <input type="password" placeholder="••••••••" className="input w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-300 mb-2">Confirm New Password</label>
                    <input type="password" placeholder="••••••••" className="input w-full" />
                  </div>
                </div>

                <div className="border-t border-dark-800 pt-6">
                  <h4 className="font-medium text-white mb-4">Two-Factor Authentication</h4>
                  <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
                    <div>
                      <p className="font-medium text-white">2FA is disabled</p>
                      <p className="text-sm text-dark-500">Add an extra layer of security</p>
                    </div>
                    <button className="btn-secondary">Enable 2FA</button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="chart-container p-6 space-y-6">
                <h3 className="text-lg font-display font-semibold text-white">Appearance</h3>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-3">Theme</label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { id: 'dark', label: 'Dark', active: true },
                      { id: 'light', label: 'Light', active: false },
                      { id: 'system', label: 'System', active: false },
                    ].map(theme => (
                      <button
                        key={theme.id}
                        className={cn(
                          'p-4 rounded-lg border text-center transition-all',
                          theme.active
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-dark-700 hover:border-dark-600 bg-dark-800/50'
                        )}
                      >
                        <span className="text-white">{theme.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-3">Accent Color</label>
                  <div className="flex gap-3">
                    {['#22c55e', '#3b82f6', '#8b5cf6', '#f97316', '#ef4444'].map(color => (
                      <button
                        key={color}
                        className="w-10 h-10 rounded-full ring-2 ring-offset-2 ring-offset-dark-900 ring-transparent hover:ring-white transition-all"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="chart-container p-6 space-y-6">
                <h3 className="text-lg font-display font-semibold text-white">Billing & Subscription</h3>

                <div className="p-6 bg-gradient-to-br from-primary-600/20 to-accent-purple/20 rounded-xl border border-primary-500/30">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-primary-400 uppercase tracking-wider">Current Plan</p>
                      <p className="text-2xl font-bold text-white">Free Trial</p>
                    </div>
                    <span className="px-3 py-1 bg-primary-500/20 text-primary-400 rounded-full text-sm">
                      14 days left
                    </span>
                  </div>
                  <button className="w-full btn-primary">Upgrade to Pro</button>
                </div>

                <div className="border-t border-dark-800 pt-6">
                  <h4 className="font-medium text-white mb-4">Plans</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 border border-dark-700 rounded-xl">
                      <p className="font-bold text-white text-lg">Free</p>
                      <p className="text-3xl font-bold text-white mt-2">$0<span className="text-sm text-dark-500">/mo</span></p>
                      <ul className="mt-4 space-y-2 text-sm text-dark-400">
                        <li>✓ 100 trades/month</li>
                        <li>✓ Basic analytics</li>
                        <li>✓ 1 account</li>
                      </ul>
                    </div>
                    <div className="p-6 border border-primary-500/50 rounded-xl bg-primary-500/5">
                      <p className="font-bold text-white text-lg">Pro</p>
                      <p className="text-3xl font-bold text-white mt-2">$29<span className="text-sm text-dark-500">/mo</span></p>
                      <ul className="mt-4 space-y-2 text-sm text-dark-400">
                        <li>✓ Unlimited trades</li>
                        <li>✓ Advanced analytics</li>
                        <li>✓ Unlimited accounts</li>
                        <li>✓ Trade replay</li>
                        <li>✓ API access</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  )
}

