import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://websnag.dev'),
  title: 'Websnag — AI-Powered Webhook Debugger',
  description: 'Your webhooks, decoded.',
  openGraph: {
    title: 'Websnag — AI-Powered Webhook Debugger',
    description: 'Your webhooks, decoded.',
    url: 'https://websnag.dev',
    siteName: 'Websnag',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'Websnag — AI-Powered Webhook Debugger',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Websnag — AI-Powered Webhook Debugger',
    description: 'Your webhooks, decoded.',
    images: ['/opengraph-image'],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-text-primary`}
      >
        {children}
      </body>
    </html>
  )
}
