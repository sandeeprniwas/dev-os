'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { apiFetch } from '@/lib/utils/api-fetch'
import type { ContractDetailDTO, KeyTermDTO } from '@/types/api'
import { contractKey } from './use-contract'

export function patchTerm(
  detail: ContractDetailDTO | undefined,
  termId: string,
  update: (term: KeyTermDTO) => KeyTermDTO,
): ContractDetailDTO | undefined {
  if (!detail) return detail
  return { ...detail, keyTerms: detail.keyTerms.map((term) => (term.id === termId ? update(term) : term)) }
}

/** Optimistic inline edit; the server keeps the first AI value in originalValue. */
export function useUpdateKeyTerm(contractId: string) {
  const queryClient = useQueryClient()
  const key = contractKey(contractId)

  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      apiFetch<{ keyTerm: KeyTermDTO }>(`/api/key-terms/${id}`, { method: 'PATCH', body: { value } }),
    onMutate: async ({ id, value }) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<ContractDetailDTO>(key)
      queryClient.setQueryData<ContractDetailDTO | undefined>(key, (detail) =>
        patchTerm(detail, id, (term) =>
          term.value === value
            ? term
            : {
                ...term,
                value,
                isEdited: true,
                originalValue: term.isEdited ? term.originalValue : term.value,
                editedAt: new Date().toISOString(),
              },
        ),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(key, context?.previous)
      toast.error("Couldn't save your edit. Try again.")
    },
    onSuccess: ({ keyTerm }) => {
      queryClient.setQueryData<ContractDetailDTO | undefined>(key, (detail) => patchTerm(detail, keyTerm.id, () => keyTerm))
    },
  })
}
