import { encode } from 'gpt-tokenizer/model/gpt-4o'

/** Token count with GPT-4o's o200k_base encoding. Runs locally; no network call. */
export function countTokens(text: string): number {
  return encode(text).length
}
