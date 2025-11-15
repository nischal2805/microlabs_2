import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { AuthProvider } from '@/lib/AuthContext'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Fever Diagnosis System - Microlabs',
  description: 'AI-powered fever diagnosis and triage system with doctor recommendations and medication guidance',
  keywords: 'fever, triage, AI, medical, healthcare, diagnosis, emergency, India, Microlabs',
  authors: [{ name: 'Microlabs Fever Diagnosis Team' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'AI Fever Diagnosis System - Microlabs',
    description: 'Intelligent emergency decision support for fever cases with comprehensive diagnosis',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
