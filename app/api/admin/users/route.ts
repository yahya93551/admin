import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireGlobalAdmin } from '@/lib/requireGlobalAdmin'

export async function GET(request: Request) {
  const unauthorized = await requireGlobalAdmin(request)
  if (unauthorized) return unauthorized

  const { data, error } = await supabaseAdmin.auth.admin.listUsers()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ users: data?.users ?? [] })
}
