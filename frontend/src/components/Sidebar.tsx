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
  LogOut
} from 'lucide-react'
import { cn } from '@/lib/utils'

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/' },
  { icon: History, label: 'Trade Journal', href: '/journal' },
  { icon: LineChart, label: 'Analytics', href: '/analytics' },
  { icon: Wallet, label: 'Accounts', href: '/accounts' },
  { icon: Upload, label: 'Import', href: '/import' },
  { icon: Settings, label: 'Settings', href: '/settings' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-dark-950/80 backdrop-blur-xl border-r border-dark-800/50 z-50">
      {/* Logo */}
      <div className="p-6 border-b border-dark-800/50">
        <Link href="/" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg text-white">TradeTracker</h1>
            <p className="text-xs text-dark-500">Analytics Platform</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200',
                'text-sm font-medium',
                isActive 
                  ? 'bg-primary-600/20 text-primary-400 border border-primary-500/30' 
                  : 'text-dark-400 hover:bg-dark-800/50 hover:text-dark-200'
              )}
            >
              <Icon className={cn('w-5 h-5', isActive && 'text-primary-400')} />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* Account Info */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-dark-800/50">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-dark-900/50">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-accent-purple to-accent-blue flex items-center justify-center">
            <span className="text-sm font-bold text-white">A</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-dark-200 truncate">Demo Account</p>
            <p className="text-xs text-dark-500">Paper Trading</p>
          </div>
          <button className="p-2 text-dark-500 hover:text-dark-300 transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
