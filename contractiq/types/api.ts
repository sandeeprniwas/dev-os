import type { ErrorCode } from '@/lib/api/errors'
import type {
  ChatRole,
  ContractStatus,
  ContractType,
  DetectedContractType,
  FeedbackRating,
} from './domain'

/** Error envelope returned by every API route (foundation spec §7.1). */
export type ApiErrorPayload = {
  code: ErrorCode
  message: string
  requestId: string
  fields?: Record<string, string>
}

export type ContractSummaryDTO = {
  id: string
  title: string
  contractType: ContractType
  status: ContractStatus
  pageCount: number
  createdAt: string
  processedAt: string | null
}

export type UploadedContractDTO = {
  id: string
  title: string
  contractType: ContractType
  status: ContractStatus
  pageCount: number
  wordCount: number
  tokenCount: number
  storageAvailable: boolean
  createdAt: string
}

export type ContractDTO = {
  id: string
  title: string
  contractType: ContractType
  detectedType: DetectedContractType | null
  status: ContractStatus
  pageCount: number
  contractText: string
  signedUrl: string | null
  signedUrlExpiresAt: string | null
  errorCode: string | null
  errorMessage: string | null
  processedAt: string | null
  reviewCompletedAt: string | null
  createdAt: string
}

export type KeyTermDTO = {
  id: string
  termKey: string
  termName: string
  value: string | null
  originalValue: string | null
  pageNumber: number | null
  confidenceScore: number
  sourceSentence: string | null
  sourceVerified: boolean
  isCustom: boolean
  isEdited: boolean
  editedAt: string | null
}

export type CustomTermDTO = { id: string; termName: string }

export type FeedbackDTO = { id: string; rating: FeedbackRating; comment: string | null; updatedAt: string }

export type ContractDetailDTO = {
  contract: ContractDTO
  keyTerms: KeyTermDTO[]
  customTerms: CustomTermDTO[]
  feedback: FeedbackDTO | null
}

export type ContractsListDTO = {
  items: ContractSummaryDTO[]
  page: number
  pageSize: number
  total: number
}

export type DashboardStatsDTO = {
  total: number
  byType: { nda: number; msa: number }
  recent: ContractSummaryDTO[]
}

export type ChatMessageDTO = {
  id: string
  role: ChatRole
  content: string
  citedPages: number[]
  createdAt: string
}

export type ChatHistoryDTO = {
  session: { id: string; messageCount: number } | null
  messages: ChatMessageDTO[]
}

/** NDJSON events streamed by POST /api/contracts/[id]/process. */
export type ProcessEvent =
  | { step: 'analysing' }
  | { step: 'compiling' }
  | { step: 'done'; contractId: string; termCount: number; detectedType: DetectedContractType | null }
  | { step: 'error'; code: ErrorCode; message: string }

/** SSE payloads streamed by POST /api/contracts/[id]/chat. */
export type ChatStreamEvents = {
  meta: { userMessageId: string; sessionId: string }
  delta: { text: string }
  replace: { content: string }
  done: { assistantMessageId: string; citedPages: number[]; latencyMs: number }
  error: { code: ErrorCode; message: string }
}
