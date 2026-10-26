'use client'

import { useEffect, useState } from 'react'
import { MobileBrowserBanner } from '@/components/layout/MobileBrowserBanner'
import { Button } from '@/components/ui/Button'
import { useProcessContract } from '@/hooks/use-process-contract'
import { useSaveCustomTerms } from '@/hooks/use-save-custom-terms'
import { useUploadContract } from '@/hooks/use-upload-contract'
import { apiFetch, ApiClientError } from '@/lib/utils/api-fetch'
import { useUploadStore } from '@/stores/upload-store'
import { ContractTypeSelect } from './ContractTypeSelect'
import { KeyTermPreviewCard } from './KeyTermPreviewCard'
import { PdfDropzone } from './PdfDropzone'
import { ProcessingProgress } from './ProcessingProgress'

export function NewContractView() {
  const store = useUploadStore()
  const upload = useUploadContract()
  const saveCustomTerms = useSaveCustomTerms(store.contract?.id ?? null)
  const processing = useProcessContract(store.contract?.id ?? null)
  const [clientError, setClientError] = useState<string | null>(null)

  const { reset } = store
  useEffect(() => () => reset(), [reset])

  const busy = ['saving', 'analysing', 'compiling', 'waiting', 'done'].includes(processing.step)
  const canEditTerms = Boolean(store.contract) && !busy

  async function handleProcess() {
    if (!store.contract) return
    processing.setStep('saving')
    try {
      await saveCustomTerms.mutateAsync(store.customTerms)
    } catch (error) {
      processing.setStep('error')
      processing.setError({
        code: error instanceof ApiClientError ? error.code : 'INTERNAL_ERROR',
        message:
          error instanceof ApiClientError && error.fields
            ? Object.values(error.fields)[0]
            : error instanceof ApiClientError
              ? error.message
              : 'Something went wrong. Try again.',
      })
      return
    }
    await processing.start()
  }

  function handleChangeFile() {
    const previous = store.contract
    if (previous) {
      // The abandoned upload is removed so it doesn't linger on the dashboard.
      apiFetch(`/api/contracts/${previous.id}`, { method: 'DELETE' }).catch(() => undefined)
    }
    processing.reset()
    setClientError(null)
    store.reset({ keepType: true })
  }

  const uploadState = store.contract ? 'done' : store.step === 'uploading' ? 'active' : 'pending'
  const dropzoneError = clientError ?? (store.step === 'error' ? store.error?.message ?? null : null)

  return (
    <div className="flex flex-col gap-8">
      <MobileBrowserBanner />
      <div className="flex flex-col gap-1">
        <h1 className="text-h5 text-fg">Review a contract</h1>
        <p className="text-body text-fg-muted">Upload an NDA or MSA to extract its key terms.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_400px]">
        <div className="flex flex-col gap-6">
          <ContractTypeSelect
            value={store.contractType}
            onChange={store.setContractType}
            disabled={Boolean(store.contract) || store.step === 'uploading'}
          />
          <PdfDropzone
            disabled={!store.contractType}
            disabledReason="Select a contract type first"
            uploading={store.step === 'uploading'}
            fileName={store.file?.name ?? null}
            contract={store.contract}
            error={dropzoneError}
            onFile={(file) => {
              setClientError(null)
              if (store.contractType) upload.mutate({ file, contractType: store.contractType })
            }}
            onReject={(message) => setClientError(message)}
            onChangeFile={handleChangeFile}
          />
        </div>

        <KeyTermPreviewCard
          contractType={store.contractType}
          customTerms={store.customTerms}
          canEdit={canEditTerms}
          onAdd={store.addCustomTerm}
          onRemove={store.removeCustomTerm}
          progress={
            store.contractType ? (
              <ProcessingProgress
                uploadState={uploadState}
                processStep={processing.step}
                error={processing.error}
                onRetry={handleProcess}
                retrying={busy}
              />
            ) : null
          }
          action={
            processing.step !== 'error' && (
              <Button size="lg" className="w-full" disabled={!store.contract || busy} loading={busy} onClick={handleProcess}>
                Process contract
              </Button>
            )
          }
        />
      </div>
    </div>
  )
}
