export const MAX_FILE_SIZE_BYTES = 10_485_760 // 10 MB
export const MAX_PAGES = 20
export const MIN_WORDS = 100
export const MAX_CONTRACT_TOKENS = 15_000
export const MAX_CUSTOM_TERMS = 5
export const MAX_CHAT_MESSAGES = 200
export const MAX_CHAT_INPUT_CHARS = 2000
export const LOW_CONFIDENCE = 50
export const HIGH_CONFIDENCE = 80
export const SIGNED_URL_TTL_SECONDS = 3600
export const STALE_PROCESSING_MS = 120_000
// Azure AI Foundry agent calls can take 20–30 s, so routes run up to 60 s (maxDuration).
export const PROCESS_DEADLINE_MS = 55_000
export const LLM_TIMEOUT_MS = 50_000
