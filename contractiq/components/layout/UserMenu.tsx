'use client'

import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu'
import { apiFetch } from '@/lib/utils/api-fetch'

export function UserMenu({ email }: { email: string }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [signingOut, setSigningOut] = useState(false)
  const initial = email.charAt(0).toUpperCase() || '?'

  async function signOut() {
    setSigningOut(true)
    try {
      // Server-side sign-out revokes the refresh token and clears the HttpOnly session cookies.
      await apiFetch('/api/auth/logout', { method: 'POST', redirectOnUnauthenticated: false })
    } catch {
      setSigningOut(false)
      toast.error("We couldn't sign you out. Try again.")
      return
    }
    queryClient.clear()
    router.replace('/')
    router.refresh()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${email}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-body font-medium text-brand-700 hover:bg-brand-100"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>{email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/dashboard')}>
          <LayoutDashboard aria-hidden="true" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem disabled={signingOut} onSelect={signOut}>
          <LogOut aria-hidden="true" />
          {signingOut ? 'Signing out…' : 'Sign out'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
