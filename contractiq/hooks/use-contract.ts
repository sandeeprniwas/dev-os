'use client'

import { useQuery } from '@tanstack/react-query'
import { apiFetch } from '@/lib/utils/api-fetch'
import type { ContractDetailDTO } from '@/types/api'

export const contractKey = (id: string) => ['contract', id] as const

const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60_000

/** Results-page data. Refetches before the 1-hour signed PDF URL expires, and polls while processing. */
export function useContract(id: string, initialData?: ContractDetailDTO) {
  return useQuery({
    queryKey: contractKey(id),
    queryFn: () => apiFetch<ContractDetailDTO>(`/api/contracts/${id}`),
    initialData,
    staleTime: 5 * 60_000,
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return false
      if (data.contract.status === 'processing') return 3000
      const expiresAt = data.contract.signedUrlExpiresAt
      if (!expiresAt) return false
      return Math.max(10_000, new Date(expiresAt).getTime() - Date.now() - SIGNED_URL_REFRESH_MARGIN_MS)
    },
  })
}
