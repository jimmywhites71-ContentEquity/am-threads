import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AM Intelligence',
  description: 'What asset managers publish, measured.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', background: '#f7f7f5', color: '#1a1a1a' }}>{children}</body>
    </html>
  )
}
