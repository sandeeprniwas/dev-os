'use client'

import { useMutation } from '@tanstack/react-query'
import { apiFetch } from '@/lib/utils/api-fetch'
import type { CustomTermDTO } from '@/types/api'

/** PUT the full custom-term list (empty clears it) before processing starts. */
export function useSaveCustomTerms(contractId: string | null) {
  return useMutation({
    mutationFn: async (terms: string[]) =>
      (await apiFetch<{ customTerms: CustomTermDTO[] }>(`/api/contracts/${contractId}/custom-terms`, {
        method: 'PUT',
        body: { terms },
      })).customTerms,
  })
}
