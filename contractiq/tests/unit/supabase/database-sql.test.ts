import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(__dirname, '../../..')
const canonical = readFileSync(resolve(projectRoot, 'supabase/database.sql'), 'utf8')

describe('supabase/database.sql', () => {
  it('is byte-identical to docs/specs/supabase-schema.sql', () => {
    const specCopy = readFileSync(resolve(projectRoot, '../docs/specs/supabase-schema.sql'), 'utf8')
    expect(specCopy).toBe(canonical)
  })

  it('runs as a single transaction', () => {
    expect(canonical).toMatch(/^begin;$/m)
    expect(canonical.trimEnd().endsWith('commit;')).toBe(true)
  })

  it('enables RLS on every application table', () => {
    const tables = [...canonical.matchAll(/create table if not exists public\.(\w+)/g)].map((m) => m[1])
    expect(tables).toHaveLength(9)
    for (const table of tables) {
      expect(canonical).toMatch(new RegExp(`alter table public\\.${table}\\s+enable row level security`))
    }
  })

  it('grants privileges explicitly (newer Supabase projects do not auto-grant)', () => {
    expect(canonical).toMatch(/grant all on public\.profiles[\s\S]*?to service_role;/)
  })

  it('keeps server-controlled data server-authoritative (security plan §2)', () => {
    expect(canonical).toContain('grant select, delete on public.contracts to authenticated;')
    expect(canonical).toContain('grant select on public.key_terms to authenticated;')
    expect(canonical).not.toMatch(/grant [^;]*insert[^;]*on public\.contracts to authenticated/)
    expect(canonical).toMatch(/and role = 'user'/)
    expect(canonical).toContain('contracts_file_path_owner')
    expect(canonical).toContain('create table if not exists public.rate_limit_events')
    expect(canonical).not.toContain('create table if not exists public.rate_limits')
  })
})
