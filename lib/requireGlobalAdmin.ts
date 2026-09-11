import { createServerClient } from '@supabase/ssr'
import { type User } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const globalAdminEmails = (process.env.NEXT_PUBLIC_SUPABASE_GLOBAL_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const globalAdminUserIds = (process.env.NEXT_PUBLIC_SUPABASE_GLOBAL_ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

function isGlobalAdmin(user: User) {
  const normalizedEmail = (user.email ?? '').toLowerCase()
  return globalAdminEmails.includes(normalizedEmail) || globalAdminUserIds.includes(user.id)
}

export async function requireGlobalAdmin(request: Request): Promise<NextResponse | null> {
  const authorization = request.headers.get('authorization')
  const accessToken = authorization?.replace(/^Bearer\s+/i, '').trim()

  let user: User | null = null

  if (accessToken) {
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken)
    if (!error) user = data.user
  } else {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll() {},
        },
      },
    )

    const { data } = await supabase.auth.getUser()
    user = data.user
  }

  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  if (!isGlobalAdmin(user)) {
    return NextResponse.json({ error: 'Global admin access required' }, { status: 403 })
  }

  return null
}