import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

async function getUserEmail(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error) return null
    return data?.user?.email ?? null
  } catch {
    return null
  }
}

// GET: list all subscription records and pending requests
// POST: { action: 'approve'|'decline', id: string }

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('tenant_subscriptions')
      .select('id, tenant_id, status, monthly_fee, requested_at, approved_at, approved_by, notes, created_at, updated_at')
      .order('requested_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const subscriptions = data ?? []
    const tenantIds = Array.from(new Set(subscriptions.map((item) => item.tenant_id).filter(Boolean)))
    const emailMap = new Map<string, string | null>()

    await Promise.all(
      tenantIds.map(async (tenantId) => {
        const email = await getUserEmail(tenantId)
        emailMap.set(tenantId, email)
      })
    )

    const requests = subscriptions.map((subscription) => ({
      ...subscription,
      user_email: emailMap.get(subscription.tenant_id) ?? null,
    }))

    return NextResponse.json({ requests })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, id } = body
    if (!action || !id) {
      return NextResponse.json({ error: 'Missing action or request id' }, { status: 400 })
    }

    if (!['approve', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'active' : 'declined'
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      const now = new Date()
      const nextBillingDate = new Date(now)
      nextBillingDate.setDate(nextBillingDate.getDate() + 30)
      const activeUntil = new Date(now)
      activeUntil.setMonth(activeUntil.getMonth() + 1)

      updateData.billing_date = now.toISOString().split('T')[0]
      updateData.next_billing_date = nextBillingDate.toISOString().split('T')[0]
      updateData.active_until = activeUntil.toISOString()
      updateData.approved_at = now.toISOString()
    }

    const { data, error } = await supabaseAdmin
      .from('tenant_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select('id, tenant_id, status, monthly_fee, requested_at, approved_at, approved_by, notes, billing_date, next_billing_date, active_until, created_at, updated_at')
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) {
      return NextResponse.json({ error: 'Subscription request not found' }, { status: 404 })
    }

    const user_email = await getUserEmail(data.tenant_id)

    return NextResponse.json({ success: true, request: { ...data, user_email } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500 })
  }
}
