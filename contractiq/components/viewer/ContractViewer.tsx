'use client'

import { useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { useState } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import { contractKey } from '@/hooks/use-contract'
import { TextViewer } from './TextViewer'

const PdfViewer = dynamic(() => import('./PdfViewer'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
})

type ContractViewerProps = {
  contractId: string
  signedUrl: string | null
  contractText: string
  pageCount: number
  title: string
}

/** PDF.js when the stored PDF is available, otherwise the [PAGE N] text viewer (FR-06). */
export function ContractViewer({ contractId, signedUrl, contractText, pageCount, title }: ContractViewerProps) {
  const queryClient = useQueryClient()
  const [pdfFailed, setPdfFailed] = useState(false)

  if (signedUrl && !pdfFailed) {
    return (
      <PdfViewer
        key={signedUrl}
        signedUrl={signedUrl}
        pageCount={pageCount}
        title={title}
        onFatalError={() => setPdfFailed(true)}
        onExpiredUrl={() => queryClient.invalidateQueries({ queryKey: contractKey(contractId) })}
      />
    )
  }

  return (
    <TextViewer
      contractText={contractText}
      pageCount={pageCount}
      title={title}
      downloadUrl={signedUrl}
      notice={
        signedUrl
          ? "We couldn't display the original PDF. Showing extracted text instead."
          : "The original PDF isn't available, so we're showing the extracted text."
      }
    />
  )
}
