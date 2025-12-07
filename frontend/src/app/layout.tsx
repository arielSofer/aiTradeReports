import type { Metadata } from 'next'
import { AuthProvider } from '@/contexts/AuthContext'
import './globals.css'

export const metadata: Metadata = {
  title: 'TradeTracker - Trade Analysis Platform',
  description: 'Professional trading journal and analytics platform',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <AuthProvider>
          <div className="gradient-mesh fixed inset-0 pointer-events-none" />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
