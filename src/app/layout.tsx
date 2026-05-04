import './globals.css'
import type { Metadata, Viewport } from 'next'
import AuthHeader from '@/components/AuthHeader'
import MobileNavOffset from '@/components/MobileNavOffset'

export const metadata: Metadata = {
  title: 'Sport Tracker',
  description: 'Tracker per partite di K.O. e altri sport',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // resizes-content: i browser moderni (Safari iOS 17+, Chrome 108+)
  // ridimensionano il layout viewport quando il keyboard/barra browser
  // collassa, evitando il bug del fixed-bottom che resta nascosto.
  interactiveWidget: 'resizes-content',
  themeColor: '#0f172a',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it">
      <body className="animate-fade-in">
        <MobileNavOffset />
        <AuthHeader />
        <main className="container">
          {children}
        </main>
      </body>
    </html>
  )
}
