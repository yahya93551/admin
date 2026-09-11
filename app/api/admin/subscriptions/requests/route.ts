import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireGlobalAdmin } from '@/lib/requireGlobalAdmin'

async function getUserEmail(userId: string) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId)
    if (error) return null
    return data?.user?.email ?? null
  } catch {
    return null
  }
}

const VALID_SUBSCRIPTION_DURATIONS = [1, 3, 6, 12] as const

function normalizeSubscriptionDurationMonths(value: unknown) {
  const parsed = typeof value === 'string' ? Number(value) : value
  if (typeof parsed !== 'number' || !Number.isFinite(parsed)) return 1

  return VALID_SUBSCRIPTION_DURATIONS.includes(
    parsed as (typeof VALID_SUBSCRIPTION_DURATIONS)[number],
  )
    ? parsed
    : 1
}

function getExtensionBaseDate(value: unknown, now: Date) {
  if (typeof value !== 'string') return now

  const existingActiveUntil = new Date(value)
  return Number.isNaN(existingActiveUntil.getTime()) || existingActiveUntil <= now
    ? now
    : existingActiveUntil
}

// GET: list all subscription records and pending requests
// POST: { action: 'approve'|'decline', id: string }

export async function GET(request: Request) {
  try {
    const unauthorized = await requireGlobalAdmin(request)
    if (unauthorized) return unauthorized

    const { data, error } = await supabaseAdmin
      .from('tenant_subscriptions')
      .select('*')
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
    const unauthorized = await requireGlobalAdmin(request)
    if (unauthorized) return unauthorized

    const body = await request.json()
    const { action, id } = body
    if (!action || !id) {
      return NextResponse.json({ error: 'Missing action or request id' }, { status: 400 })
    }

    if (!['approve', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const { data: subscription, error: subscriptionError } = await supabaseAdmin
      .from('tenant_subscriptions')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (subscriptionError) return NextResponse.json({ error: subscriptionError.message }, { status: 500 })
    if (!subscription) return NextResponse.json({ error: 'Subscription request not found' }, { status: 404 })

    const newStatus = action === 'approve' ? 'active' : 'declined'
    const updateData: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    }

    if (action === 'approve') {
      const now = new Date()
      const durationMonths = normalizeSubscriptionDurationMonths(subscription.subscription_duration_months)
      const extensionBaseDate = getExtensionBaseDate(subscription.active_until, now)
      const activeUntil = new Date(extensionBaseDate)
      activeUntil.setMonth(activeUntil.getMonth() + durationMonths)

      updateData.billing_date = now.toISOString().split('T')[0]
      updateData.next_billing_date = activeUntil.toISOString().split('T')[0]
      updateData.active_until = activeUntil.toISOString()
      updateData.approved_at = now.toISOString()
      updateData.subscription_duration_months = durationMonths
    }

    let { data, error } = await supabaseAdmin
      .from('tenant_subscriptions')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .single()

    if (error && action === 'approve' && error.message.toLowerCase().includes('subscription_duration_months')) {
      const fallbackUpdate = { ...updateData }
      delete fallbackUpdate.subscription_duration_months
      const fallbackResult = await supabaseAdmin
        .from('tenant_subscriptions')
        .update(fallbackUpdate)
        .eq('id', id)
        .select('*')
        .single()
      data = fallbackResult.data
      error = fallbackResult.error
    }

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
