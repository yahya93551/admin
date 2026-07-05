import { supabase } from '@/lib/supabase'
import type { TenantContext } from '@/types'

const globalAdminEmails = (process.env.NEXT_PUBLIC_SUPABASE_GLOBAL_ADMIN_EMAILS || '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

const globalAdminUserIds = (process.env.NEXT_PUBLIC_SUPABASE_GLOBAL_ADMIN_USER_IDS || '')
  .split(',')
  .map((id) => id.trim())
  .filter(Boolean)

export async function getTenantContext(): Promise<TenantContext> {
  const { data: authData, error: authError } = await supabase.auth.getUser()
  if (authError || !authData.user) {
    throw new Error('Authentication required')
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError || !sessionData?.session?.access_token) {
    throw new Error('Authentication required')
  }

  const accessToken = sessionData.session.access_token
  const userId = authData.user.id
  const userEmail = authData.user.email || ''
  const normalizedEmail = userEmail.toLowerCase()

  const isGlobalAdmin =
    globalAdminEmails.includes(normalizedEmail) || globalAdminUserIds.includes(userId)

  if (isGlobalAdmin) {
    return {
      tenant_id: 'global',
      role: 'super_admin',
      user_id: userId,
      user_email: userEmail,
      isGlobalAdmin: true,
    }
  }

  const { data, error } = await supabase
    .from('tenant_members')
    .select('tenant_id, role, user_email')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  if (data) {
    return {
      tenant_id: data.tenant_id,
      role: data.role as TenantContext['role'],
      user_id: userId,
      user_email: data.user_email,
    }
  }

  const response = await fetch('/api/tenant/init', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })

  const json = await response.json()
  if (!response.ok || json.error) {
    throw new Error(json.error || 'Failed to initialize tenant membership')
  }

  return json.data as TenantContext
}
