import { create } from 'zustand'

export interface Trade {
  id: string
  accountId?: string
  accountName?: string
  symbol: string
  direction: 'long' | 'short'
  status: 'open' | 'closed'
  entryTime: string
  exitTime?: string
  entryPrice: number
  exitPrice?: number
  quantity: number
  commission: number
  pnlNet?: number
  pnlPercent?: number
  isWinner?: boolean
  durationMinutes?: number
  tags: string[]
  notes?: string
}

export interface Stats {
  totalTrades: number
  winningTrades: number
  losingTrades: number
  openTrades: number
  totalPnl: number
  winRate: number
  profitFactor: number
  avgWinner: number
  avgLoser: number
  largestWinner: number
  largestLoser: number
  totalCommission: number
  currentStreak: number
  bestStreak: number
  worstStreak: number
}

export interface DailyPnL {
  date: string
  pnl: number
  tradesCount: number
  winners: number
  losers: number
  cumulativePnl: number
}

export interface HourlyStat {
  hour: number
  trades: number
  wins: number
  pnl: number
  winRate: number
}

interface StoreState {
  // User
  user: { email: string; fullName: string } | null
  token: string | null

  // Data
  trades: Trade[]
  stats: Stats | null
  dailyPnL: DailyPnL[]
  hourlyStats: HourlyStat[]

  // UI
  selectedAccount: string | null
  isLoading: boolean

  // Actions
  setUser: (user: { email: string; fullName: string } | null) => void
  setToken: (token: string | null) => void
  setTrades: (trades: Trade[]) => void
  setStats: (stats: Stats) => void
  setDailyPnL: (data: DailyPnL[]) => void
  setHourlyStats: (data: HourlyStat[]) => void
  setSelectedAccount: (id: string | null) => void
  setIsLoading: (loading: boolean) => void
  logout: () => void

  // Sidebar
  isSidebarCollapsed: boolean
  toggleSidebar: () => void

  // Filters
  selectedTags: string[]
  setSelectedTags: (tags: string[]) => void
}

export const useStore = create<StoreState>((set) => ({
  // Initial state
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('token') : null,
  trades: [],
  stats: null,
  dailyPnL: [],
  hourlyStats: [],
  selectedAccount: null,
  isLoading: false,

  // Actions
  setUser: (user) => set({ user }),
  setToken: (token) => {
    if (token) {
      localStorage.setItem('token', token)
    } else {
      localStorage.removeItem('token')
    }
    set({ token })
  },
  setTrades: (trades) => set({ trades }),
  setStats: (stats) => set({ stats }),
  setDailyPnL: (dailyPnL) => set({ dailyPnL }),
  setHourlyStats: (hourlyStats) => set({ hourlyStats }),
  setSelectedAccount: (selectedAccount) => set({ selectedAccount }),
  setIsLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    localStorage.removeItem('token')
    set({ user: null, token: null, trades: [], stats: null })
  },

  // Sidebar
  isSidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),

  // Filters
  selectedTags: [],
  setSelectedTags: (selectedTags) => set({ selectedTags }),
}))





