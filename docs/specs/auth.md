# Spec — Authentication (S3)

**Source:** PRD Flow 1–2, US-001, FR-01 · engineering-doc §4.1–4.2, §5.3, §6.3 · **Release:** v0.1

## 1. Goal
Email/password sign up, sign in and sign out with Supabase Auth. Sessions persist in cookies, and every `(app)` route and every API route is protected.

## 2. Supabase project settings (one-time, manual)

| Setting | Local lab (`localhost:3000`) | Production |
|---|---|---|
| Authentication → URL Configuration → **Site URL** | `http://localhost:3000` | `https://<netlify-domain>` |
| **Redirect URLs** allow-list | `http://localhost:3000/auth/callback` | `https://<domain>/auth/callback` (keep the localhost entry for dev) |
| Providers → Email → **Confirm email** | **Off** recommended for the lab. Supabase's built-in mailer sends only a few emails per hour, which blocks repeated sign-up testing | **On** (PRD requires verification) with custom SMTP configured |
| Minimum password length | 8 | 8 |

The app supports **both** confirmation modes without code changes (§4.1).

## 3. Files
| File | Purpose |
|---|---|
| `middleware.ts` | Session refresh + route guard |
| `lib/supabase/{client,server,middleware}.ts` | Clients (foundation spec §5) |
| `lib/api/require-user.ts` | API auth guard |
| `lib/validation/auth.ts` | `loginSchema`, `signupSchema` |
| `lib/auth/redirect.ts` | `safeRedirectPath(input?: string | null): string` |
| `lib/auth/error-messages.ts` | Maps Supabase auth errors to copy |
| `app/(auth)/layout.tsx` | Centered card shell; redirects signed-in users to `/dashboard` |
| `app/(auth)/login/page.tsx`, `signup/page.tsx`, `verify-email/page.tsx` | Pages |
| `app/auth/callback/route.ts` | Email-link code exchange |
| `components/auth/{LoginForm,SignupForm,VerifyEmailNotice}.tsx` | Client forms |
| `components/layout/UserMenu.tsx` | Avatar menu with Sign out |
| `hooks/use-user.ts` | Client session hook |

## 4. Flows

### 4.1 Sign up
1. `/signup` → `SignupForm` validates with `signupSchema`:
   ```ts
   z.object({
     email: z.string().trim().toLowerCase().email('Enter a valid email address'),
     password: z.string().min(8, 'At least 8 characters')
       .regex(/[A-Za-z]/, 'Include at least one letter').regex(/\d/, 'Include at least one number'),
     confirmPassword: z.string(),
   }).refine(v => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
   ```
2. Submit calls `supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${publicEnv.appUrl}/auth/callback` } })`.
3. Result handling:
   - `data.session` present (confirmation off) → `router.replace('/dashboard')` + `router.refresh()`.
   - `data.user` present, `session` null (confirmation on) → `router.replace('/verify-email?email=' + encodeURIComponent(email))`.
   - `data.user.identities?.length === 0` means the email is already registered (Supabase obfuscates this) → show "An account with this email already exists." with a "Sign in instead" link.
   - Error → mapped message (§6).
4. The `on_auth_user_created` DB trigger creates the `profiles` row.

### 4.2 Email confirmation callback — `GET /auth/callback`
```ts
export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const next = safeRedirectPath(url.searchParams.get('next')) // default '/dashboard'
  if (code) {
    const supabase = createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) return NextResponse.redirect(new URL(next, url.origin))
  }
  return NextResponse.redirect(new URL('/login?error=link_expired', url.origin))
}
```
`safeRedirectPath` accepts only strings that start with `/`, not `//` or `/\`, contain no `://`, and are ≤ 200 chars. Anything else becomes `/dashboard`.

### 4.3 Sign in
1. `/login?redirectTo=/contracts/abc` → `LoginForm` (`loginSchema`: email + non-empty password).
2. `supabase.auth.signInWithPassword({ email, password })`.
3. Success → `router.replace(safeRedirectPath(redirectTo))` then `router.refresh()`.
4. Errors:

   | Supabase error | Copy |
   |---|---|
   | `invalid_credentials` / "Invalid login credentials" | "Email or password is incorrect." |
   | `email_not_confirmed` | "Please verify your email first." + a **Resend email** button |
   | network / 5xx | "We couldn't reach the server. Try again in a moment." |

5. `?error=link_expired` shows a warning banner: "Your link expired. Sign in, or request a new one."

### 4.4 Resend verification
`VerifyEmailNotice` and the login error state call `supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } })`. The button is disabled for 60 s afterwards ("Resend in 42s"). A rate-limit error shows "Too many emails sent. Please wait a few minutes."

### 4.5 Sign out
`UserMenu` → "Sign out" → `supabase.auth.signOut()` → `queryClient.clear()` → `router.replace('/')` → `router.refresh()`.

### 4.6 Route protection — `middleware.ts`
```ts
export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request)
  const path = request.nextUrl.pathname
  const isApp  = path.startsWith('/dashboard') || path.startsWith('/contracts')
  const isAuth = path === '/login' || path === '/signup'
  if (isApp && !user) return NextResponse.redirect(new URL(`/login?redirectTo=${encodeURIComponent(path)}`, request.url))
  if (isAuth && user) return NextResponse.redirect(new URL('/dashboard', request.url))
  return response
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/|demo.gif|logo.svg|api/health).*)'],
}
```
- `updateSession` uses `createServerClient` with request/response cookie adapters and calls `supabase.auth.getUser()`.
- API routes are **not** redirected. They return 401 JSON via `requireUser()`.
- The `(app)/layout.tsx` server component also calls `getUser()` and runs `redirect('/login')` if there is no user, as defence in depth against middleware bypasses (see the Next 14 advisory in foundation §1.1).

### 4.7 Client session — `useUser()`
Returns `{ user: User | null, isLoading: boolean }`. On mount it calls `supabase.auth.getUser()` and subscribes to `onAuthStateChange`. On `SIGNED_OUT` it clears the query cache. On a 401 from any API fetch, the shared fetcher (`lib/utils/api-fetch.ts`) redirects to `/login?redirectTo=<current path>`.

## 5. UI spec
- `(auth)/layout.tsx`: `min-h-screen bg-page flex items-center justify-center px-4`. The card is `Card` at `w-full max-w-[400px] p-8`, with the logo on top.
- **LoginForm:**
  - Title "Sign in to ContractIQ" (`text-h5`).
  - Fields Email and Password, each with a `Label`, an `Input` and a `FieldError` linked through `aria-describedby`. The password field has a show/hide `IconButton`.
  - Primary full-width "Sign in" button (`loading` while pending).
  - Footer "New to ContractIQ? **Create an account**".
- **SignupForm:** title "Create your account", fields Email, Password (helper "8+ characters, with a letter and a number") and Confirm password, button "Create account", footer "Already have an account? **Sign in**".
- **VerifyEmailNotice:** a `MailCheck` icon, "Check your inbox", "We sent a confirmation link to **{email}**. Click it to finish setting up your account.", plus Resend and "Back to sign in".
- **UserMenu:** Radix DropdownMenu trigger showing a 32px circle with the initial (`bg-brand-50 text-brand-700`). Items: email (disabled label), "Dashboard", separator, "Sign out".
- Focus moves to the first invalid field on submit. Errors are announced (`role="alert"`).

## 6. Edge cases
| Case | Behaviour |
|---|---|
| Double submit | Button disabled while pending |
| Email with spaces or upper case | Trimmed and lower-cased by the schema |
| Open-redirect attempt `?redirectTo=https://evil.com` or `//evil.com` | `safeRedirectPath` falls back to `/dashboard` |
| Session expires mid-use | Middleware refreshes it. If refresh fails, API calls return 401 and the client redirects to login with `redirectTo` |
| Signed-in user visits `/login` | Redirected to `/dashboard` |
| Expired or used email link | `/login?error=link_expired` banner |
| Supabase email rate limit on sign-up | Supabase error `over_email_send_rate_limit` → "Too many sign-up emails were sent. Try again later." (and see §2 for the lab setting) |

## 7. Acceptance criteria
- **AC-AUTH-01:** With "Confirm email" off, a new user who signs up lands on `/dashboard` with the empty state in ≤ 10 s, and a `profiles` row exists.
- **AC-AUTH-02:** With "Confirm email" on, sign-up shows `/verify-email`. Clicking the emailed link signs the user in and lands on `/dashboard`.
- **AC-AUTH-03:** Wrong credentials show "Email or password is incorrect." and no session is created.
- **AC-AUTH-04:** Visiting `/dashboard` or `/contracts/new` while signed out redirects to `/login?redirectTo=…`. After sign in, the user lands on the original path.
- **AC-AUTH-05:** `GET /api/contracts` without a session returns 401 `UNAUTHENTICATED` JSON, not a redirect.
- **AC-AUTH-06:** Sign out returns the user to `/`. Pressing Back and reloading `/dashboard` redirects to login.
- **AC-AUTH-07:** `/auth/callback?code=x&next=//evil.com` never redirects off-origin.
- **AC-AUTH-08:** The session persists across a full browser reload (FR-01).
- **AC-AUTH-09:** All auth forms are keyboard-operable and pass axe with 0 serious violations.

## 8. Tests
- Unit: `safeRedirectPath` (10 cases), `signupSchema`, error-message mapping.
- Integration: `requireUser` returns 401 with no cookie.
- E2E `auth.spec.ts`: sign up (confirmation off in the test project), sign out, sign in, the redirectTo round-trip, and the wrong-password message.
