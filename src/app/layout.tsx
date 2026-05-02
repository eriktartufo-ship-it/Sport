import './globals.css'
import type { Metadata } from 'next'
import AuthHeader from '@/components/AuthHeader'

export const metadata: Metadata = {
  title: 'Sport Tracker',
  description: 'Tracker per partite di K.O. e altri sport',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className="animate-fade-in">
        <AuthHeader />
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  )
}
