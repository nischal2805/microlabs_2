import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'AI Fever Triage System',
  description: 'AI-powered fever diagnostics and triage system for emergency decision support',
  keywords: 'fever, triage, AI, medical, healthcare, diagnosis, emergency',
  authors: [{ name: 'AI Fever Triage Team' }],
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'AI Fever Triage System',
    description: 'Intelligent emergency decision support for fever cases',
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
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
          {children}
        </div>
      </body>
    </html>
  )
}
