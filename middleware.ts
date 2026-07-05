import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const globalAdminEmails = (process.env.NEXT_PUBLIC_SUPABASE_GLOBAL_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const globalAdminUserIds = (process.env.NEXT_PUBLIC_SUPABASE_GLOBAL_ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

function isGlobalAdmin(user: { id: string; email?: string | null } | null | undefined) {
  if (!user) return false
  const normalizedEmail = (user.email ?? '').toLowerCase()
  return globalAdminEmails.includes(normalizedEmail) || globalAdminUserIds.includes(user.id)
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function middleware(req: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll().map(cookie => ({
            name: cookie.name,
            value: cookie.value,
          }))
        },
        setAll(cookies) {
          cookies.forEach(({ name, value, options }) => {
            req.cookies.set(name, value)
            response.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session && req.nextUrl.pathname.startsWith('/admin')) {
    const redirectUrl = req.nextUrl.clone()
    redirectUrl.pathname = '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (session && req.nextUrl.pathname.startsWith('/admin')) {
    const { data: user } = await supabase.auth.getUser()
    if (!isGlobalAdmin(user.user)) {
      const email = user.user?.email ?? ''
      const userId = user.user?.id

      let membershipQuery = supabaseAdmin
        .from('tenant_members')
        .select('role')
        .eq('active', true)

      if (userId) {
        membershipQuery = membershipQuery.or(`user_id.eq.${userId},user_email.eq.${encodeURIComponent(email)}`)
      } else {
        membershipQuery = membershipQuery.eq('user_email', email)
      }

      const { data: membership } = await membershipQuery.maybeSingle()
      const hasInventoryAdmin = membership?.role === 'admin' || membership?.role === 'owner'

      if (!hasInventoryAdmin) {
        const redirectUrl = req.nextUrl.clone()
        redirectUrl.pathname = '/unauthorized'
        return NextResponse.redirect(redirectUrl)
      }
    }
  }

  return response
}

export const config = {
  matcher: ['/admin/:path*'],
}