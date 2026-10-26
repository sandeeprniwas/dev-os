import type { Metadata } from 'next'
import { interDisplay } from './fonts'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: { default: 'ContractIQ', template: '%s · ContractIQ' },
  description:
    'Upload an NDA or MSA and get its key terms with page references, confidence scores and a chat grounded in your document.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={interDisplay.variable}>
      <body className="bg-page font-sans text-body text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
