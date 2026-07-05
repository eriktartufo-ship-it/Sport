import './globals.css'
import type { Metadata, Viewport } from 'next'
import AuthHeader from '@/components/AuthHeader'
import MobileNavOffset from '@/components/MobileNavOffset'

// Applica il tema salvato PRIMA del paint (niente flash chiaro→scuro).
const THEME_SCRIPT = `(function(){try{var t=localStorage.getItem('sport_theme');if(t!=='light'&&t!=='dark'){t='dark';}document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}})();`

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
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0b0d12' },
    { media: '(prefers-color-scheme: light)', color: '#f6f7fb' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="it" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
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
