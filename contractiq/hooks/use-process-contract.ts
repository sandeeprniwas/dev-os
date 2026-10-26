'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ERROR_DEFINITIONS } from '@/lib/api/errors'
import { apiFetch, apiRequest, ApiClientError } from '@/lib/utils/api-fetch'
import { readNdjson } from '@/lib/utils/read-ndjson'
import type { ContractDetailDTO, ProcessEvent } from '@/types/api'
import { dashboardKeys } from './use-dashboard'

export type ProcessStep = 'idle' | 'saving' | 'analysing' | 'compiling' | 'waiting' | 'done' | 'error'
export type ProcessError = { code: string; message: string }

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 45_000

/**
 * Streams POST /process (NDJSON) and tracks the 3-step progress. On 409 ALREADY_PROCESSING it polls
 * the contract until it finishes (another tab is processing it). Navigates to the results on success.
 */
export function useProcessContract(contractId: string | null, options: { navigateOnDone?: boolean } = {}) {
  const { navigateOnDone = true } = options
  const router = useRouter()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<ProcessStep>('idle')
  const [error, setError] = useState<ProcessError | null>(null)
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (pollTimer.current) clearTimeout(pollTimer.current)
  }, [])

  const finish = useCallback(async () => {
    if (!contractId) return
    setStep('done')
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['contract', contractId] }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.allContracts }),
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats }),
    ])
    if (navigateOnDone) router.push(`/contracts/${contractId}`)
    router.refresh()
  }, [contractId, navigateOnDone, queryClient, router])

  const poll = useCallback(
    (startedAt: number) => {
      if (!contractId) return
      pollTimer.current = setTimeout(async () => {
        try {
          const detail = await apiFetch<ContractDetailDTO>(`/api/contracts/${contractId}`)
          if (detail.contract.status === 'completed') return void finish()
          if (detail.contract.status === 'error') {
            setStep('error')
            setError({ code: detail.contract.errorCode ?? 'INTERNAL_ERROR', message: detail.contract.errorMessage ?? ERROR_DEFINITIONS.INTERNAL_ERROR.message })
            return
          }
        } catch {
          // transient polling failure — keep polling until the timeout below
        }
        if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
          setStep('error')
          setError({ code: 'TIMEOUT', message: ERROR_DEFINITIONS.TIMEOUT.message })
          return
        }
        poll(startedAt)
      }, POLL_INTERVAL_MS)
    },
    [contractId, finish],
  )

  const start = useCallback(async () => {
    if (!contractId) return
    setError(null)
    setStep('analysing')

    let response: Response
    try {
      response = await apiRequest(`/api/contracts/${contractId}/process`, { method: 'POST' })
    } catch (requestError) {
      if (requestError instanceof ApiClientError && requestError.code === 'ALREADY_PROCESSING') {
        setStep('waiting')
        poll(Date.now())
        return
      }
      setStep('error')
      setError(
        requestError instanceof ApiClientError
          ? { code: requestError.code, message: requestError.message }
          : { code: 'INTERNAL_ERROR', message: ERROR_DEFINITIONS.INTERNAL_ERROR.message },
      )
      return
    }

    let finished = false
    try {
      for await (const event of readNdjson<ProcessEvent>(response.body!)) {
        if (event.step === 'analysing' || event.step === 'compiling') setStep(event.step)
        else if (event.step === 'done') {
          finished = true
          await finish()
        } else if (event.step === 'error') {
          finished = true
          setStep('error')
          setError({ code: event.code, message: event.message })
        }
      }
    } catch {
      // stream dropped — handled below as a timeout
    }

    if (!finished) {
      setStep('error')
      setError({ code: 'TIMEOUT', message: ERROR_DEFINITIONS.TIMEOUT.message })
    }
  }, [contractId, finish, poll])

  const reset = useCallback(() => {
    setStep('idle')
    setError(null)
  }, [])

  return { start, step, setStep, error, setError, reset }
}
