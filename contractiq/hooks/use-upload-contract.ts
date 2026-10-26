'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, ApiClientError } from '@/lib/utils/api-fetch'
import { useUploadStore } from '@/stores/upload-store'
import type { UploadedContractDTO } from '@/types/api'
import type { ContractType } from '@/types/domain'
import { dashboardKeys } from './use-dashboard'

export function useUploadContract() {
  const queryClient = useQueryClient()
  const { startUpload, uploadSucceeded, uploadFailed } = useUploadStore()

  return useMutation({
    mutationFn: async ({ file, contractType }: { file: File; contractType: ContractType }) => {
      const body = new FormData()
      body.set('file', file)
      body.set('contractType', contractType)
      return (await apiFetch<{ contract: UploadedContractDTO }>('/api/contracts/upload', { method: 'POST', body })).contract
    },
    onMutate: ({ file }) => startUpload(file),
    onSuccess: (contract) => {
      uploadSucceeded(contract)
      queryClient.invalidateQueries({ queryKey: dashboardKeys.stats })
      queryClient.invalidateQueries({ queryKey: dashboardKeys.allContracts })
    },
    onError: (error) => {
      uploadFailed(
        error instanceof ApiClientError
          ? { code: error.code, message: error.message }
          : { code: 'INTERNAL_ERROR', message: 'Upload failed. Check your connection and try again.' },
      )
    },
  })
}
