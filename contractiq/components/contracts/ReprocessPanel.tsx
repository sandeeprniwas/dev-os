'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { KeyTermPreviewCard } from '@/components/upload/KeyTermPreviewCard'
import { ProcessingProgress } from '@/components/upload/ProcessingProgress'
import { useProcessContract } from '@/hooks/use-process-contract'
import { useSaveCustomTerms } from '@/hooks/use-save-custom-terms'
import { MAX_CUSTOM_TERMS } from '@/lib/constants/limits'
import { ApiClientError } from '@/lib/utils/api-fetch'
import { customTermIssue } from '@/lib/validation/custom-terms'
import type { ContractDTO, CustomTermDTO } from '@/types/api'

/**
 * Results-page state for contracts that are `uploaded`, `processing` or `error`: lets the user adjust
 * custom terms and (re)run extraction without re-uploading.
 */
export function ReprocessPanel({ contract, customTerms }: { contract: ContractDTO; customTerms: CustomTermDTO[] }) {
  const [terms, setTerms] = useState(() => customTerms.map((term) => term.termName))
  const processing = useProcessContract(contract.id, { navigateOnDone: false })
  const saveCustomTerms = useSaveCustomTerms(contract.id)

  const serverError = useMemo(
    () => (contract.status === 'error' ? { code: contract.errorCode ?? 'INTERNAL_ERROR', message: contract.errorMessage ?? 'Something went wrong. Try again.' } : null),
    [contract.status, contract.errorCode, contract.errorMessage],
  )

  const { setStep, setError } = processing
  useEffect(() => {
    if (contract.status === 'processing') setStep('waiting')
    else if (serverError) {
      setStep('error')
      setError(serverError)
    }
  }, [contract.status, serverError, setStep, setError])

  const busy = ['saving', 'analysing', 'compiling', 'waiting', 'done'].includes(processing.step)

  async function run() {
    processing.setStep('saving')
    try {
      await saveCustomTerms.mutateAsync(terms)
    } catch (error) {
      processing.setStep('error')
      processing.setError({
        code: error instanceof ApiClientError ? error.code : 'INTERNAL_ERROR',
        message: error instanceof ApiClientError ? error.message : 'Something went wrong. Try again.',
      })
      return
    }
    await processing.start()
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <KeyTermPreviewCard
        contractType={contract.contractType}
        customTerms={terms}
        canEdit={!busy}
        onAdd={(name) => {
          if (terms.length >= MAX_CUSTOM_TERMS) return 'limit'
          const issue = customTermIssue(name, terms, contract.contractType)
          if (issue) return issue
          setTerms((current) => [...current, name])
          return 'added'
        }}
        onRemove={(name) => setTerms((current) => current.filter((term) => term !== name))}
        progress={
          <ProcessingProgress uploadState="done" processStep={processing.step} error={processing.error} onRetry={run} retrying={busy} />
        }
        action={
          processing.step !== 'error' && (
            <Button size="lg" className="w-full" loading={busy} disabled={busy} onClick={run}>
              Process contract
            </Button>
          )
        }
      />
    </div>
  )
}
