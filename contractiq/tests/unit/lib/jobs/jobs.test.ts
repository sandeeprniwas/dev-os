import { describe, expect, it, vi } from 'vitest'
import type { DbClient } from '@/lib/db/types'
import { runCorrectionRateAlert, runCostAlert } from '@/lib/jobs/alerts'
import { purgeExpiredPdfs } from '@/lib/jobs/purge-expired-pdfs'

/** Minimal chainable fake of the supabase-js query builder. */
function query(result: { data?: unknown; error?: unknown; count?: number }) {
  const builder: Record<string, unknown> = {}
  for (const method of ['select', 'not', 'lt', 'gte', 'order', 'limit', 'range', 'update', 'delete', 'in', 'eq']) {
    builder[method] = vi.fn(() => builder)
  }
  builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null, count: undefined, ...result })
  return builder
}

describe('purgeExpiredPdfs', () => {
  it('removes expired PDFs via the Storage API and clears file_path', async () => {
    const rows = [
      { id: 'c1', user_id: 'u', file_path: 'u/c1/a.pdf' },
      { id: 'c2', user_id: 'u', file_path: 'u/c2/b.pdf' },
    ]
    const selects = [query({ data: rows }), query({ data: [] })]
    const update = query({})
    const remove = vi.fn().mockResolvedValue({ data: [], error: null })
    const admin = {
      from: vi.fn(() => {
        const next = selects.shift()
        return next ?? update
      }),
      storage: { from: () => ({ remove }) },
    } as unknown as DbClient

    const result = await purgeExpiredPdfs(admin, { now: new Date('2026-10-25T00:00:00Z') })
    expect(remove).toHaveBeenCalledWith(['u/c1/a.pdf', 'u/c2/b.pdf'])
    expect(result).toMatchObject({ scanned: 2, purged: 2, failed: 0, rejected: 0 })
  })

  it('never deletes an object outside the contract owner\'s folder (cross-tenant path)', async () => {
    const selects = [query({ data: [{ id: 'c1', user_id: 'attacker', file_path: 'victim/c9/secret.pdf' }] }), query({ data: [] })]
    const remove = vi.fn()
    const admin = {
      from: vi.fn(() => selects.shift() ?? query({})),
      storage: { from: () => ({ remove }) },
    } as unknown as DbClient
    const result = await purgeExpiredPdfs(admin)
    expect(remove).not.toHaveBeenCalled()
    expect(result).toMatchObject({ rejected: 1, purged: 0 })
  })

  it('dry run counts without deleting', async () => {
    const remove = vi.fn()
    const admin = {
      from: vi.fn(() => query({ data: [{ id: 'c1', user_id: 'u', file_path: 'u/c1/a.pdf' }] })),
      storage: { from: () => ({ remove }) },
    } as unknown as DbClient
    const result = await purgeExpiredPdfs(admin, { dryRun: true })
    expect(remove).not.toHaveBeenCalled()
    expect(result).toMatchObject({ scanned: 1, purged: 0, dryRun: true })
  })
})

describe('alerts', () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true })
  vi.stubGlobal('fetch', fetchMock)

  it('cost alert fires at ≥ 80 % of budget', async () => {
    fetchMock.mockClear()
    const admin = { from: () => query({ data: [{ cost_usd: 250, operation: 'extraction', success: true }] }) } as unknown as DbClient
    const result = await runCostAlert(admin, { budgetUsd: 300, webhookUrl: 'https://hooks.slack.test/x' })
    expect(result.alerted).toBe(true)
    expect(fetchMock).toHaveBeenCalledOnce()
  })

  it('cost alert stays quiet under budget and target', async () => {
    fetchMock.mockClear()
    const admin = { from: () => query({ data: [{ cost_usd: 0.07, operation: 'extraction', success: true }] }) } as unknown as DbClient
    expect((await runCostAlert(admin, { budgetUsd: 300, webhookUrl: 'https://hooks.slack.test/x' })).alerted).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [100, 13, true],
    [100, 11, false],
    [40, 30, false],
  ])('correction alert with %i terms / %i edited → %s', async (total, edited, expected) => {
    fetchMock.mockClear()
    const counts = [total, edited]
    const admin = {
      from: (table: string) => (table === 'contracts' ? query({ data: [{ id: 'c1' }] }) : query({ count: counts.shift() })),
    } as unknown as DbClient
    const result = await runCorrectionRateAlert(admin, { webhookUrl: 'https://hooks.slack.test/x' })
    expect(result.alerted).toBe(expected)
  })
})
