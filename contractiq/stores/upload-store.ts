import { create } from 'zustand'
import { MAX_CUSTOM_TERMS } from '@/lib/constants/limits'
import { customTermIssue } from '@/lib/validation/custom-terms'
import type { UploadedContractDTO } from '@/types/api'
import type { ContractType } from '@/types/domain'

export type UploadStep = 'select' | 'uploading' | 'ready' | 'processing' | 'error'
export type AddCustomTermResult = 'added' | 'duplicate' | 'standard' | 'limit'

type UploadState = {
  contractType: ContractType | null
  file: File | null
  contract: UploadedContractDTO | null
  customTerms: string[]
  step: UploadStep
  error: { code: string; message: string } | null
  setContractType: (type: ContractType) => void
  startUpload: (file: File) => void
  uploadSucceeded: (contract: UploadedContractDTO) => void
  uploadFailed: (error: { code: string; message: string }) => void
  setStep: (step: UploadStep) => void
  addCustomTerm: (name: string) => AddCustomTermResult
  removeCustomTerm: (name: string) => void
  reset: (options?: { keepType?: boolean }) => void
}

const initial = {
  contractType: null,
  file: null,
  contract: null,
  customTerms: [],
  step: 'select' as UploadStep,
  error: null,
}

export const useUploadStore = create<UploadState>((set, get) => ({
  ...initial,
  setContractType: (contractType) => set({ contractType, customTerms: [] }),
  startUpload: (file) => set({ file, step: 'uploading', error: null, contract: null }),
  uploadSucceeded: (contract) => set({ contract, step: 'ready', error: null }),
  uploadFailed: (error) => set({ error, step: 'error', contract: null }),
  setStep: (step) => set({ step }),
  addCustomTerm: (name) => {
    const { customTerms, contractType } = get()
    const clean = name.trim().replace(/\s+/g, ' ')
    if (customTerms.length >= MAX_CUSTOM_TERMS) return 'limit'
    if (contractType) {
      const issue = customTermIssue(clean, customTerms, contractType)
      if (issue) return issue
    }
    set({ customTerms: [...customTerms, clean] })
    return 'added'
  },
  removeCustomTerm: (name) => set({ customTerms: get().customTerms.filter((term) => term !== name) }),
  reset: (options) => set({ ...initial, contractType: options?.keepType ? get().contractType : null }),
}))
