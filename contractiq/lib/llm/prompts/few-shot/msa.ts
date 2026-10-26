import type { FewShotExample } from './types'

// Original illustrative excerpts written for ContractIQ (not taken from real contracts).
export const MSA_EXAMPLES: FewShotExample[] = [
  {
    contractType: 'msa',
    excerpt: `[PAGE 1]
MASTER SERVICES AGREEMENT
This Master Services Agreement is made between Harbor Retail Group LLC ("Customer") and Lumen Digital Studio Ltd. ("Provider").
2. Services. Provider will perform the services described in each Statement of Work ("SOW") executed by the parties. Each SOW is governed by this Agreement.
[PAGE 2]
4. Fees and Payment. Customer shall pay the fees set out in each SOW within thirty (30) days of the invoice date. Provider will invoice monthly in arrears.
5. Late Payment. Overdue amounts accrue interest at 1.5% per month or the maximum rate permitted by law, whichever is lower.`,
    targets: [
      { term_key: 'parties', term_name: 'Parties', definition: 'The legal names of the customer and the service provider.' },
      { term_key: 'service_scope', term_name: 'Service Scope', definition: 'The services to be provided and how scope is defined.' },
      { term_key: 'payment_terms', term_name: 'Payment Terms', definition: 'Fees, pricing basis and when payment is due.' },
      { term_key: 'invoice_schedule', term_name: 'Invoice Schedule', definition: 'When and how invoices are issued.' },
      { term_key: 'late_payment_penalty', term_name: 'Late Payment Penalty', definition: 'Interest or fees charged on overdue amounts.' },
    ],
    output: {
      detected_type: 'msa',
      terms: [
        {
          term_key: 'parties',
          term_name: 'Parties',
          value: 'Harbor Retail Group LLC (Customer) and Lumen Digital Studio Ltd. (Provider)',
          page_number: 1,
          confidence_score: 97,
          source_sentence:
            'This Master Services Agreement is made between Harbor Retail Group LLC ("Customer") and Lumen Digital Studio Ltd. ("Provider").',
        },
        {
          term_key: 'service_scope',
          term_name: 'Service Scope',
          value: 'Services defined in each signed Statement of Work (SOW)',
          page_number: 1,
          confidence_score: 88,
          source_sentence: 'Provider will perform the services described in each Statement of Work ("SOW") executed by the parties.',
        },
        {
          term_key: 'payment_terms',
          term_name: 'Payment Terms',
          value: 'Fees per SOW, due within 30 days of invoice date',
          page_number: 2,
          confidence_score: 94,
          source_sentence: 'Customer shall pay the fees set out in each SOW within thirty (30) days of the invoice date.',
        },
        {
          term_key: 'invoice_schedule',
          term_name: 'Invoice Schedule',
          value: 'Monthly in arrears',
          page_number: 2,
          confidence_score: 95,
          source_sentence: 'Provider will invoice monthly in arrears.',
        },
        {
          term_key: 'late_payment_penalty',
          term_name: 'Late Payment Penalty',
          value: '1.5% interest per month (or the legal maximum, if lower)',
          page_number: 2,
          confidence_score: 96,
          source_sentence:
            'Overdue amounts accrue interest at 1.5% per month or the maximum rate permitted by law, whichever is lower.',
        },
      ],
    },
  },
  {
    contractType: 'msa',
    excerpt: `[PAGE 4]
9. Limitation of Liability. Except for breach of confidentiality or indemnification obligations, each party's total liability under this Agreement shall not exceed the fees paid by Customer in the twelve (12) months preceding the claim.
10. Indemnification. Provider shall defend and indemnify Customer against third-party claims alleging that the deliverables infringe any intellectual property right.
[PAGE 5]
11. Intellectual Property. Upon full payment, Provider assigns to Customer all rights in the deliverables, excluding Provider's pre-existing materials, which are licensed to Customer on a non-exclusive basis.`,
    targets: [
      { term_key: 'liability_cap', term_name: 'Liability Cap', definition: 'The maximum amount either party can be liable for, and any exclusions.' },
      { term_key: 'indemnification', term_name: 'Indemnification', definition: 'Who must compensate whom for which third-party claims or losses.' },
      { term_key: 'ip_ownership', term_name: 'IP Ownership', definition: 'Who owns deliverables and pre-existing IP; licences granted.' },
    ],
    output: {
      detected_type: 'msa',
      terms: [
        {
          term_key: 'liability_cap',
          term_name: 'Liability Cap',
          value: 'Fees paid in the 12 months before the claim; excludes confidentiality and indemnity breaches',
          page_number: 4,
          confidence_score: 92,
          source_sentence:
            "Except for breach of confidentiality or indemnification obligations, each party's total liability under this Agreement shall not exceed the fees paid by Customer in the twelve (12) months preceding the claim.",
        },
        {
          term_key: 'indemnification',
          term_name: 'Indemnification',
          value: 'Provider indemnifies Customer against third-party IP infringement claims about the deliverables',
          page_number: 4,
          confidence_score: 90,
          source_sentence:
            'Provider shall defend and indemnify Customer against third-party claims alleging that the deliverables infringe any intellectual property right.',
        },
        {
          term_key: 'ip_ownership',
          term_name: 'IP Ownership',
          value: "Deliverables assigned to Customer on full payment; Provider's pre-existing materials licensed non-exclusively",
          page_number: 5,
          confidence_score: 89,
          source_sentence:
            "Upon full payment, Provider assigns to Customer all rights in the deliverables, excluding Provider's pre-existing materials, which are licensed to Customer on a non-exclusive basis.",
        },
      ],
    },
  },
  {
    contractType: 'msa',
    excerpt: `[PAGE 6]
14. Term and Termination. This Agreement continues until terminated. Either party may terminate for convenience on sixty (60) days' written notice, or immediately if the other party materially breaches and fails to cure within thirty (30) days of notice.
15. Notices. Notices must be in writing and sent by email with confirmation of receipt to the addresses in each SOW.
16. Governing Law. This Agreement is governed by the laws of England and Wales.`,
    targets: [
      { term_key: 'termination_clause', term_name: 'Termination Clause', definition: 'How and when either party may terminate.' },
      { term_key: 'notice_period', term_name: 'Notice Period', definition: 'Required notice periods and how notices are given.' },
      { term_key: 'dispute_resolution', term_name: 'Dispute Resolution', definition: 'How disputes are resolved.' },
      { term_key: 'custom_auto_renewal', term_name: 'Auto-renewal', definition: null },
    ],
    output: {
      detected_type: 'msa',
      terms: [
        {
          term_key: 'termination_clause',
          term_name: 'Termination Clause',
          value: 'Either party: 60 days\' notice for convenience, or immediately for uncured material breach (30-day cure period)',
          page_number: 6,
          confidence_score: 94,
          source_sentence:
            "Either party may terminate for convenience on sixty (60) days' written notice, or immediately if the other party materially breaches and fails to cure within thirty (30) days of notice.",
        },
        {
          term_key: 'notice_period',
          term_name: 'Notice Period',
          value: "60 days for termination for convenience; notices in writing by email with confirmation",
          page_number: 6,
          confidence_score: 74,
          source_sentence: 'Notices must be in writing and sent by email with confirmation of receipt to the addresses in each SOW.',
        },
        {
          term_key: 'dispute_resolution',
          term_name: 'Dispute Resolution',
          value: null,
          page_number: null,
          confidence_score: 0,
          source_sentence: null,
        },
        {
          term_key: 'custom_auto_renewal',
          term_name: 'Auto-renewal',
          value: 'No fixed term to renew; continues until terminated',
          page_number: 6,
          confidence_score: 58,
          source_sentence: 'This Agreement continues until terminated.',
        },
      ],
    },
  },
]
