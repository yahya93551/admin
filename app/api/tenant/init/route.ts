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

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!authHeader) {
    return NextResponse.json({ error: 'Missing authorization token' }, { status: 401 })
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(authHeader)
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 })
  }

  const user = userData.user
  const userEmail = user.email ?? ''
  const normalizedEmail = userEmail.toLowerCase()
  const isGlobalAdmin =
    globalAdminEmails.includes(normalizedEmail) || globalAdminUserIds.includes(user.id)

  if (isGlobalAdmin) {
    return NextResponse.json({
      data: {
        tenant_id: 'global',
        role: 'super_admin',
        user_id: user.id,
        user_email: userEmail,
        isGlobalAdmin: true,
      },
    })
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from('tenant_members')
    .select('tenant_id, role, user_email')
    .eq('user_id', user.id)
    .maybeSingle()

  if (membershipError) {
    return NextResponse.json(
      { error: membershipError.message || 'Failed to determine tenant membership' },
      { status: 500 },
    )
  }

  if (membership) {
    return NextResponse.json({
      data: {
        tenant_id: membership.tenant_id,
        role: membership.role as string,
        user_id: user.id,
        user_email: membership.user_email,
      },
    })
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('tenant_members')
    .insert({
      tenant_id: user.id,
      user_id: user.id,
      user_email: userEmail,
      role: 'owner',
      active: true,
      created_by: user.id,
    })
    .select('tenant_id, role, user_email')
    .maybeSingle()

  if (createError || !created) {
    return NextResponse.json(
      { error: createError?.message || 'Failed to initialize tenant membership' },
      { status: 500 },
    )
  }

  return NextResponse.json({
    data: {
      tenant_id: created.tenant_id,
      role: created.role as string,
      user_id: user.id,
      user_email: created.user_email,
    },
  })
}
