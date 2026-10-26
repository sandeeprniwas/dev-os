/**
 * Local / manual run of the 90-day PDF retention job.
 *   npm run job:purge-pdfs            # deletes expired PDFs
 *   npm run job:purge-pdfs -- --dry-run
 */
import { config } from 'dotenv'
import { createAdminClient } from '../lib/supabase/admin'
import { purgeExpiredPdfs } from '../lib/jobs/purge-expired-pdfs'

config({ path: '.env.local' })

async function main() {
  const admin = createAdminClient()
  if (!admin) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local')
    process.exit(1)
  }
  const dryRun = process.argv.includes('--dry-run')
  const result = await purgeExpiredPdfs(admin, { dryRun, budgetMs: 10 * 60_000 })
  console.info(
    dryRun
      ? `Dry run: ${result.scanned} PDF(s) are older than the retention window.`
      : `Purged ${result.purged} PDF(s); ${result.failed} failed (will retry next run).`,
  )
  process.exit(result.failed > 0 ? 2 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
