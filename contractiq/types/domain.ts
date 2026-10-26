import type { Database } from './database.types'

type Tables = Database['public']['Tables']
type Enums = Database['public']['Enums']

export type ProfileRow = Tables['profiles']['Row']
export type ContractRow = Tables['contracts']['Row']
export type CustomKeyTermRow = Tables['custom_key_terms']['Row']
export type KeyTermRow = Tables['key_terms']['Row']
export type ChatSessionRow = Tables['chat_sessions']['Row']
export type ChatMessageRow = Tables['chat_messages']['Row']
export type UserFeedbackRow = Tables['user_feedback']['Row']
export type LlmUsageInsert = Tables['llm_usage']['Insert']

export type ContractType = Enums['contract_type']
export type DetectedContractType = Enums['detected_contract_type']
export type ContractStatus = Enums['contract_status']
export type ChatRole = Enums['chat_role']
export type FeedbackRating = Enums['feedback_rating']
export type LlmOperation = Enums['llm_operation']

export type ConfidenceLevel = 'high' | 'medium' | 'low'
export type QueryClass = 'contract' | 'history' | 'both'
