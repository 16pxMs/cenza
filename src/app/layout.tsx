import '@/styles/tokens.css'
import type { Metadata } from 'next'
import { DM_Sans, Lora } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const lora = Lora({
  subsets: ['latin'],
  variable: '--font-lora',
  display: 'swap',
})

export const metadata: Metadata = {
  title:       'Cenza',
  description: 'Know your numbers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${lora.variable}`}>
      <body style={{
        margin:          0,
        padding:         0,
        backgroundColor: '#FAFAF8',
        fontFamily:      'var(--font-dm-sans), system-ui, sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}>
        {children}
      </body>
    </html>
  )
}
