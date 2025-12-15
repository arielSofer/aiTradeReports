import axios from 'axios'

// Determine API URL based on environment
const getApiBaseUrl = () => {
  // If NEXT_PUBLIC_API_URL is set, use it
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL
  }

  // If running in browser on Vercel, use relative path
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname.includes('vercel.app') || hostname.includes('vercel.com')) {
      return '/api/v1'
    }
    if (hostname.includes('firebaseapp.com') || hostname.includes('web.app')) {
      return '/api/v1'
    }
  }

  // Default to localhost for development
  return 'http://localhost:8000/api/v1'
}

const API_BASE_URL = getApiBaseUrl()

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

// Upload API (Stateless Parser)
export const uploadApi = {
  parse: async (file: File, broker?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (broker) {
      formData.append('broker', broker)
    }

    // We use the same /upload endpoint, but it now behaves as a parser
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





