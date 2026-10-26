import type { QueryClass } from '@/types/domain'

const HISTORY =
  /\b(you (said|mentioned|told)|earlier|before|previous(ly)?|last (answer|reply)|above|what did (i|you) (ask|say))\b/i
const CONTRACT =
  /\b(clause|term|section|part(y|ies)|agreement|contract|nda|msa|page|liabilit\w*|indemn\w*|terminat\w*|renew\w*|payment|invoice|confidential\w*|governing|jurisdiction|notice|ip|intellectual)\b/i

/** Lightweight routing hint for the chat prompt — no extra model call. */
export function classifyQuery(message: string): QueryClass {
  const history = HISTORY.test(message)
  const contract = CONTRACT.test(message)
  if (history && contract) return 'both'
  if (history) return 'history'
  return 'contract'
}

export const QUERY_CLASS_HINTS: Record<QueryClass, string> = {
  contract: '',
  history: '\n\n(Answer from our conversation so far; cite pages only when referring to the document.)',
  both: '\n\n(Use both our conversation and the document.)',
}
