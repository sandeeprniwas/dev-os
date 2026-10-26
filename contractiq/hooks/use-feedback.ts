'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/utils/api-fetch'
import type { ContractDetailDTO, FeedbackDTO } from '@/types/api'
import type { FeedbackRating } from '@/types/domain'
import { contractKey } from './use-contract'

export function useSubmitFeedback(contractId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { rating: FeedbackRating; comment: string }) =>
      (await apiFetch<{ feedback: FeedbackDTO }>(`/api/contracts/${contractId}/feedback`, {
        method: 'POST',
        body: { rating: input.rating, comment: input.comment.trim() || undefined },
      })).feedback,
    onSuccess: (feedback) => {
      queryClient.setQueryData<ContractDetailDTO | undefined>(contractKey(contractId), (detail) =>
        detail ? { ...detail, feedback } : detail,
      )
    },
    onError: () => toast.error("Couldn't save your feedback. Try again."),
  })
}

export function useMarkReviewComplete(contractId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => apiFetch<void>(`/api/contracts/${contractId}/complete`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.setQueryData<ContractDetailDTO | undefined>(contractKey(contractId), (detail) =>
        detail
          ? { ...detail, contract: { ...detail.contract, reviewCompletedAt: detail.contract.reviewCompletedAt ?? new Date().toISOString() } }
          : detail,
      )
    },
    onError: () => toast.error("Couldn't mark the review complete. Try again."),
  })
}
