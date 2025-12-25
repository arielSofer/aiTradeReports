'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  LineChart,
  History,
  Settings,
  Upload,
  Wallet,
  TrendingUp,
  BarChart3,
  LogOut,
  Trophy,
  ChevronLeft
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: History, label: 'Trade Journal', href: '/journal' },
  { icon: LineChart, label: 'Analytics', href: '/analytics' },
  { icon: Wallet, label: 'Accounts', href: '/accounts' },
  { icon: Trophy, label: 'Prop Firms', href: '/prop-firms' },
  { icon: Upload, label: 'Import', href: '/import' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

export function Sidebar() {
  const pathname = usePathname()
  const { isSidebarCollapsed, toggleSidebar } = useStore()

  return (
    <aside
      className={cn(
        "fixed top-4 left-4 h-[calc(100vh-2rem)] z-50 transition-all duration-300 ease-in-out",
        "bg-dark-950/60 backdrop-blur-xl border border-dark-800/50 rounded-2xl shadow-2xl",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo & Toggle */}
      <div className={cn("flex items-center p-4", isSidebarCollapsed ? "justify-center mb-4" : "justify-between mb-4 border-b border-dark-800/50 pb-4 mx-2")}>
        {!isSidebarCollapsed && (
          <Link href="/" className="flex items-center gap-3 overflow-hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div className="whitespace-nowrap">
              <h1 className="font-display font-bold text-base text-white">TradeTracker</h1>
            </div>
          </Link>
        )}

        <button
          onClick={toggleSidebar}
          className={cn(
            "p-2 rounded-lg hover:bg-dark-800/50 text-dark-400 hover:text-white transition-colors",
            isSidebarCollapsed && "bg-dark-800/30 text-white"
          )}
        >
          {isSidebarCollapsed ? <TrendingUp className="w-6 h-6 text-primary-500" /> : <ChevronLeft className="w-5 h-5" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="px-2 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href

          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group relative',
                isActive
                  ? 'bg-primary-600/20 text-primary-400'
                  : 'text-dark-400 hover:bg-dark-800/50 hover:text-dark-200',
                isSidebarCollapsed ? "justify-center" : ""
              )}
            >
              <Icon className={cn('w-5 h-5 min-w-[1.25rem]', isActive && 'text-primary-400')} />

              {!isSidebarCollapsed ? (
                <span className="text-sm font-medium whitespace-nowrap overflow-hidden transition-all delay-100">
                  {item.label}
                </span>
              ) : (
                /* Tooltip for collapsed state */
                <div className="absolute left-full ml-2 px-2 py-1 bg-dark-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 shadow-xl border border-dark-700">
                  {item.label}
                </div>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Account Info - Collapsed vs Expanded */}
      <div className={cn("absolute bottom-0 left-0 right-0 p-4 transition-all duration-300", isSidebarCollapsed ? "opacity-0 pointer-events-none" : "opacity-100")}>
        <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-900/50 border border-dark-800/30">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <p className="text-sm font-medium text-dark-200 truncate">Demo Account</p>
            <p className="text-xs text-dark-500 truncate">Paper Trading</p>
          </div>
          <button className="p-1.5 text-dark-500 hover:text-dark-300 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
