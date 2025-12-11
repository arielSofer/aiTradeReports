import axios from 'axios'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  register: async (email: string, password: string, fullName?: string) => {
    const response = await api.post('/auth/register', { email, password, full_name: fullName })
    return response.data
  },
  
  login: async (email: string, password: string) => {
    const formData = new FormData()
    formData.append('username', email)
    formData.append('password', password)
    
    const response = await api.post('/auth/login', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
  
  me: async () => {
    const response = await api.get('/auth/me')
    return response.data
  },
}

// Accounts API
export const accountsApi = {
  list: async () => {
    const response = await api.get('/accounts')
    return response.data
  },
  
  create: async (data: { name: string; broker: string; currency?: string }) => {
    const response = await api.post('/accounts', data)
    return response.data
  },
  
  get: async (id: number) => {
    const response = await api.get(`/accounts/${id}`)
    return response.data
  },
  
  delete: async (id: number) => {
    await api.delete(`/accounts/${id}`)
  },
}

// Trades API
export const tradesApi = {
  list: async (params?: {
    account_id?: number
    symbol?: string
    start_date?: string
    end_date?: string
    status?: string
    direction?: string
    limit?: number
    offset?: number
  }) => {
    const response = await api.get('/trades', { params })
    return response.data
  },
  
  chartData: async (params?: { account_id?: number; symbol?: string }) => {
    const response = await api.get('/trades/chart-data', { params })
    return response.data
  },
  
  get: async (id: number) => {
    const response = await api.get(`/trades/${id}`)
    return response.data
  },
  
  create: async (data: any) => {
    const response = await api.post('/trades', data)
    return response.data
  },
  
  update: async (id: number, data: any) => {
    const response = await api.put(`/trades/${id}`, data)
    return response.data
  },
  
  delete: async (id: number) => {
    await api.delete(`/trades/${id}`)
  },
}

// Upload API
export const uploadApi = {
  upload: async (file: File, accountId: number, broker?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('account_id', accountId.toString())
    if (broker) {
      formData.append('broker', broker)
    }
    
    const response = await api.post('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  },
  
  brokers: async () => {
    const response = await api.get('/upload/brokers')
    return response.data
  },
}

// Stats API
export const statsApi = {
  get: async (params?: {
    account_id?: number
    start_date?: string
    end_date?: string
  }) => {
    const response = await api.get('/stats', { params })
    return response.data
  },
  
  dailyPnL: async (days = 30, accountId?: number) => {
    const response = await api.get('/stats/daily-pnl', { 
      params: { days, account_id: accountId } 
    })
    return response.data
  },
  
  summary: async () => {
    const response = await api.get('/stats/summary')
    return response.data
  },
}




