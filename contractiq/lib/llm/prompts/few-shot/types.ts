import type { ExtractionTarget, ExtractionWire } from '../../schemas/extraction-output'

export type FewShotExample = {
  contractType: 'nda' | 'msa'
  excerpt: string
  targets: ExtractionTarget[]
  output: ExtractionWire
}
