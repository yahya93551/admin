import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { requireGlobalAdmin } from '@/lib/requireGlobalAdmin'

export async function GET(request: Request) {
  const unauthorized = await requireGlobalAdmin(request)
  if (unauthorized) return unauthorized

  try {
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('activity_logs')
      .select('performed_by')
      .not('performed_by', 'is', null)
      .limit(10000)

    if (logsError) return NextResponse.json({ error: logsError.message }, { status: 500 })

    const counts = new Map<string, number>()
    for (const log of logs ?? []) {
      counts.set(log.performed_by, (counts.get(log.performed_by) ?? 0) + 1)
    }

    const topUserIds = [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([userId]) => userId)

    const { data: authUsers, error: usersError } = await supabaseAdmin.auth.admin.listUsers()
    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 500 })

    const emails = new Map(
      (authUsers?.users ?? []).map((user) => [user.id, user.email ?? null]),
    )

    return NextResponse.json({
      users: topUserIds.map((userId) => ({
        user_id: userId,
        user_email: emails.get(userId) ?? null,
        activity_count: counts.get(userId) ?? 0,
      })),
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load activity summary' },
      { status: 500 },
    )
  }
}