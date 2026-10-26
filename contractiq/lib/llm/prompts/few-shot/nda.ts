import type { FewShotExample } from './types'

// Original illustrative excerpts written for ContractIQ (not taken from real contracts).
export const NDA_EXAMPLES: FewShotExample[] = [
  {
    contractType: 'nda',
    excerpt: `[PAGE 1]
MUTUAL NON-DISCLOSURE AGREEMENT
This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of March 3, 2025 (the "Effective Date") by and between Northwind Analytics Ltd., a company registered in England and Wales ("Northwind"), and Bluepeak Software Inc., a Delaware corporation ("Bluepeak").
1. Confidential Information. Each party may disclose to the other non-public business, technical and financial information ("Confidential Information").
[PAGE 2]
2. Obligations. The Receiving Party shall hold Confidential Information in strict confidence, shall use it solely to evaluate a potential business relationship, and shall not disclose it to any third party except as permitted in Section 3.
3. Term. This Agreement shall remain in effect for two (2) years from the Effective Date. The obligations in Section 2 shall survive for three (3) years after expiry or termination.`,
    targets: [
      { term_key: 'parties', term_name: 'Parties', definition: 'The legal names of all parties bound by the agreement and their roles.' },
      { term_key: 'effective_date', term_name: 'Effective Date', definition: 'The date the agreement takes effect.' },
      { term_key: 'term_and_duration', term_name: 'Term & Duration', definition: 'How long the agreement lasts and how long confidentiality obligations survive.' },
    ],
    output: {
      detected_type: 'nda',
      terms: [
        {
          term_key: 'parties',
          term_name: 'Parties',
          value: 'Northwind Analytics Ltd. (England and Wales) and Bluepeak Software Inc. (Delaware); mutual disclosure',
          page_number: 1,
          confidence_score: 96,
          source_sentence:
            'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of March 3, 2025 (the "Effective Date") by and between Northwind Analytics Ltd., a company registered in England and Wales ("Northwind"), and Bluepeak Software Inc., a Delaware corporation ("Bluepeak").',
        },
        {
          term_key: 'effective_date',
          term_name: 'Effective Date',
          value: 'March 3, 2025',
          page_number: 1,
          confidence_score: 97,
          source_sentence:
            'This Mutual Non-Disclosure Agreement (the "Agreement") is entered into as of March 3, 2025 (the "Effective Date") by and between Northwind Analytics Ltd., a company registered in England and Wales ("Northwind"), and Bluepeak Software Inc., a Delaware corporation ("Bluepeak").',
        },
        {
          term_key: 'term_and_duration',
          term_name: 'Term & Duration',
          value: '2 years from the Effective Date; confidentiality obligations survive 3 years after expiry or termination',
          page_number: 2,
          confidence_score: 84,
          source_sentence: 'This Agreement shall remain in effect for two (2) years from the Effective Date.',
        },
      ],
    },
  },
  {
    contractType: 'nda',
    excerpt: `[PAGE 1]
5. Permitted Disclosures. The Receiving Party may disclose Confidential Information (a) to its employees, legal counsel and accountants who need to know it and are bound by confidentiality duties at least as protective as this Agreement, or (b) to the extent required by law or court order, provided it gives prompt written notice where legally permitted.
6. Governing Law. This Agreement is governed by the laws of the State of New York, without regard to its conflict-of-laws rules.`,
    targets: [
      { term_key: 'permitted_disclosures', term_name: 'Permitted Disclosures', definition: 'Situations where confidential information may be shared.' },
      { term_key: 'governing_law', term_name: 'Governing Law', definition: 'The jurisdiction whose laws govern the agreement.' },
      { term_key: 'jurisdiction', term_name: 'Jurisdiction', definition: 'The courts or venue where disputes must be brought.' },
    ],
    output: {
      detected_type: 'nda',
      terms: [
        {
          term_key: 'permitted_disclosures',
          term_name: 'Permitted Disclosures',
          value: 'To employees, lawyers and accountants who need to know and are bound by confidentiality; or when required by law, with prompt notice',
          page_number: 1,
          confidence_score: 93,
          source_sentence:
            'The Receiving Party may disclose Confidential Information (a) to its employees, legal counsel and accountants who need to know it and are bound by confidentiality duties at least as protective as this Agreement, or (b) to the extent required by law or court order, provided it gives prompt written notice where legally permitted.',
        },
        {
          term_key: 'governing_law',
          term_name: 'Governing Law',
          value: 'New York law',
          page_number: 1,
          confidence_score: 97,
          source_sentence:
            'This Agreement is governed by the laws of the State of New York, without regard to its conflict-of-laws rules.',
        },
        {
          term_key: 'jurisdiction',
          term_name: 'Jurisdiction',
          value: null,
          page_number: null,
          confidence_score: 0,
          source_sentence: null,
        },
      ],
    },
  },
  {
    contractType: 'nda',
    excerpt: `[PAGE 3]
8. Non-Solicitation. For twelve (12) months following the Effective Date, neither party shall directly solicit for employment any employee of the other party with whom it had contact in connection with the evaluation, except through general advertisements not targeted at such employees.
9. Remedies. Each party acknowledges that unauthorised disclosure may cause irreparable harm and that the disclosing party may seek injunctive relief in addition to any other remedies available at law.`,
    targets: [
      { term_key: 'non_solicitation', term_name: 'Non-Solicitation', definition: "Restrictions on hiring or soliciting the other party's employees or customers." },
      { term_key: 'breach_and_remedy', term_name: 'Breach & Remedy', definition: 'What happens on breach — injunctive relief, damages, indemnities.' },
      { term_key: 'custom_non_compete_radius', term_name: 'Non-compete radius', definition: null },
    ],
    output: {
      detected_type: 'nda',
      terms: [
        {
          term_key: 'non_solicitation',
          term_name: 'Non-Solicitation',
          value: '12 months from the Effective Date; no direct solicitation of employees met during the evaluation (general ads allowed)',
          page_number: 3,
          confidence_score: 91,
          source_sentence:
            'For twelve (12) months following the Effective Date, neither party shall directly solicit for employment any employee of the other party with whom it had contact in connection with the evaluation, except through general advertisements not targeted at such employees.',
        },
        {
          term_key: 'breach_and_remedy',
          term_name: 'Breach & Remedy',
          value: 'Injunctive relief available in addition to other legal remedies',
          page_number: 3,
          confidence_score: 78,
          source_sentence:
            'Each party acknowledges that unauthorised disclosure may cause irreparable harm and that the disclosing party may seek injunctive relief in addition to any other remedies available at law.',
        },
        {
          term_key: 'custom_non_compete_radius',
          term_name: 'Non-compete radius',
          value: null,
          page_number: null,
          confidence_score: 0,
          source_sentence: null,
        },
      ],
    },
  },
]
