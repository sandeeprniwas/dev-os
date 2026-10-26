import type { ContractType } from '@/types/domain'

export type StandardTerm = { key: string; name: string; definition: string }

/** PRD Flow 3 step 2 — the terms ContractIQ extracts per contract type, in display order. */
export const STANDARD_TERMS: Record<ContractType, StandardTerm[]> = {
  nda: [
    { key: 'parties', name: 'Parties', definition: 'The legal names of all parties bound by the agreement and their roles (e.g. Disclosing / Receiving Party).' },
    { key: 'effective_date', name: 'Effective Date', definition: 'The date the agreement takes effect.' },
    { key: 'confidentiality_obligations', name: 'Confidentiality Obligations', definition: 'What the receiving party must do or not do with confidential information.' },
    { key: 'permitted_disclosures', name: 'Permitted Disclosures', definition: 'Situations where confidential information may be shared (e.g. advisors, legal requirement).' },
    { key: 'term_and_duration', name: 'Term & Duration', definition: 'How long the agreement lasts and how long confidentiality obligations survive.' },
    { key: 'governing_law', name: 'Governing Law', definition: 'The jurisdiction whose laws govern the agreement.' },
    { key: 'jurisdiction', name: 'Jurisdiction', definition: 'The courts or venue where disputes must be brought.' },
    { key: 'ip_ownership', name: 'IP Ownership', definition: 'Who owns intellectual property and whether any licence is granted.' },
    { key: 'non_solicitation', name: 'Non-Solicitation', definition: "Restrictions on hiring or soliciting the other party's employees or customers." },
    { key: 'breach_and_remedy', name: 'Breach & Remedy', definition: 'What happens on breach — injunctive relief, damages, indemnities.' },
  ],
  msa: [
    { key: 'parties', name: 'Parties', definition: 'The legal names of the customer and the service provider.' },
    { key: 'service_scope', name: 'Service Scope', definition: 'The services to be provided and how scope is defined (e.g. via SOWs).' },
    { key: 'payment_terms', name: 'Payment Terms', definition: 'Fees, pricing basis and when payment is due.' },
    { key: 'invoice_schedule', name: 'Invoice Schedule', definition: 'When and how invoices are issued.' },
    { key: 'late_payment_penalty', name: 'Late Payment Penalty', definition: 'Interest or fees charged on overdue amounts.' },
    { key: 'liability_cap', name: 'Liability Cap', definition: 'The maximum amount either party can be liable for, and any exclusions.' },
    { key: 'indemnification', name: 'Indemnification', definition: 'Who must compensate whom for which third-party claims or losses.' },
    { key: 'ip_ownership', name: 'IP Ownership', definition: 'Who owns deliverables and pre-existing IP; licences granted.' },
    { key: 'termination_clause', name: 'Termination Clause', definition: 'How and when either party may terminate, including for convenience or cause.' },
    { key: 'governing_law', name: 'Governing Law', definition: 'The jurisdiction whose laws govern the agreement.' },
    { key: 'dispute_resolution', name: 'Dispute Resolution', definition: 'How disputes are resolved — negotiation, mediation, arbitration or courts.' },
    { key: 'notice_period', name: 'Notice Period', definition: 'Required notice periods (e.g. for termination or renewal) and how notices are given.' },
  ],
}

export const CONTRACT_TYPE_LABELS: Record<ContractType, { short: string; long: string }> = {
  nda: { short: 'NDA', long: 'NDA — Non-Disclosure Agreement' },
  msa: { short: 'MSA', long: 'MSA — Master Service Agreement' },
}

/** Plain-English definition for a standard term key (results-page glossary tooltips). */
export function termDefinition(contractType: ContractType, termKey: string): string | null {
  return STANDARD_TERMS[contractType].find((term) => term.key === termKey)?.definition ?? null
}
