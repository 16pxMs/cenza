import '@/styles/tokens.css'
import '../styles/globals.css'

import type { Metadata } from 'next'
import { Outfit, DM_Serif_Display } from 'next/font/google'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  display: 'swap',
  weight: ['300', '400', '500', '600', '700', '800'],
})

const dmSerifDisplay = DM_Serif_Display({
  subsets: ['latin'],
  variable: '--font-dm-serif-display',
  display: 'swap',
  weight: '400',
})

export const metadata: Metadata = {
  title: 'Cenza',
  description: 'Know your numbers.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${outfit.variable} ${dmSerifDisplay.variable}`}>
      <body>{children}</body>
    </html>
  )
}
