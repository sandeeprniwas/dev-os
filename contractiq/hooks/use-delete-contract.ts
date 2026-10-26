'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch, ApiClientError } from '@/lib/utils/api-fetch'
import { dashboardKeys } from './use-dashboard'

export function useDeleteContract(options: { onDeleted?: () => void } = {}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (contractId: string) => apiFetch<void>(`/api/contracts/${contractId}`, { method: 'DELETE' }),
    onSuccess: (_data, contractId) => {
      queryClient.removeQueries({ queryKey: ['contract', contractId] })
      queryClient.removeQueries({ queryKey: ['chat', contractId] })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.allContracts })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats })
      toast.success('Contract deleted')
      options.onDeleted?.()
    },
    onError: (error) => {
      toast.error(error instanceof ApiClientError ? error.message : "Couldn't delete the contract. Try again.")
    },
  })
}
