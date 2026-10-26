import type { Metadata } from 'next'
import { NewContractView } from '@/components/upload/NewContractView'

export const metadata: Metadata = { title: 'Review a contract' }

export default function NewContractPage() {
  return <NewContractView />
}
