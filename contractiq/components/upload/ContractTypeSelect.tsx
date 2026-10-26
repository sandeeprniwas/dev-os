'use client'

import { FormField } from '@/components/ui/FormField'
import { Select } from '@/components/ui/Select'
import { CONTRACT_TYPE_LABELS } from '@/lib/constants/standard-terms'
import type { ContractType } from '@/types/domain'

const OPTIONS = (['nda', 'msa'] as const).map((type) => ({ value: type, label: CONTRACT_TYPE_LABELS[type].long }))

type ContractTypeSelectProps = {
  value: ContractType | null
  onChange: (type: ContractType) => void
  disabled?: boolean
}

export function ContractTypeSelect({ value, onChange, disabled }: ContractTypeSelectProps) {
  return (
    <FormField id="contract-type" label="Contract type" required>
      <Select
        id="contract-type"
        options={OPTIONS}
        value={value ?? undefined}
        onValueChange={(next) => onChange(next as ContractType)}
        placeholder="Select NDA or MSA"
        disabled={disabled}
      />
    </FormField>
  )
}
