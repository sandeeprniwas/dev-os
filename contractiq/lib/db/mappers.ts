import type {
  ChatMessageDTO,
  ContractSummaryDTO,
  CustomTermDTO,
  FeedbackDTO,
  KeyTermDTO,
} from '@/types/api'
import type { ChatMessageRow, ContractRow, CustomKeyTermRow, KeyTermRow, UserFeedbackRow } from '@/types/domain'

export type ContractSummaryRow = Pick<
  ContractRow,
  'id' | 'title' | 'contract_type' | 'status' | 'page_count' | 'created_at' | 'processed_at'
>

export const CONTRACT_SUMMARY_COLUMNS = 'id,title,contract_type,status,page_count,created_at,processed_at'

export function toContractSummaryDTO(row: ContractSummaryRow): ContractSummaryDTO {
  return {
    id: row.id,
    title: row.title,
    contractType: row.contract_type,
    status: row.status,
    pageCount: row.page_count,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  }
}

export function toKeyTermDTO(row: KeyTermRow): KeyTermDTO {
  return {
    id: row.id,
    termKey: row.term_key,
    termName: row.term_name,
    value: row.value,
    originalValue: row.original_value,
    pageNumber: row.page_number,
    confidenceScore: row.confidence_score,
    sourceSentence: row.source_sentence,
    sourceVerified: row.source_verified,
    isCustom: row.is_custom,
    isEdited: row.is_edited,
    editedAt: row.edited_at,
  }
}

export function toCustomTermDTO(row: Pick<CustomKeyTermRow, 'id' | 'term_name'>): CustomTermDTO {
  return { id: row.id, termName: row.term_name }
}

export function toFeedbackDTO(row: UserFeedbackRow): FeedbackDTO {
  return { id: row.id, rating: row.rating, comment: row.comment, updatedAt: row.updated_at }
}

export function toChatMessageDTO(row: ChatMessageRow): ChatMessageDTO {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    citedPages: row.cited_pages ?? [],
    createdAt: row.created_at,
  }
}
