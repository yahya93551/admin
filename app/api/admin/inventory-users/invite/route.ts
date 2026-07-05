import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * POST /api/admin/inventory-users/invite
 * Invite a new user to an inventory tenant
 */

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, tenantId, role, userName } = body

    if (!email || !tenantId || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, tenantId, role' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate role
    const validRoles = ['owner', 'accountant', 'sales', 'admin']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if user exists
    let userId: string | null = null
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()

    const existingUser = existingUsers?.users.find((u) => u.email === email)
    if (existingUser) {
      userId = existingUser.id
    } else {
      // Create new user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          full_name: userName || email.split('@')[0],
        },
      })

      if (createError) {
        return NextResponse.json(
          { error: `Failed to create user: ${createError.message}` },
          { status: 500 }
        )
      }

      userId = newUser?.user?.id
    }

    if (!userId) {
      return NextResponse.json({ error: 'Failed to get or create user ID' }, { status: 500 })
    }

    // Add user to tenant with specified role
    const { data, error } = await supabaseAdmin
      .from('tenant_members')
      .upsert(
        {
          user_id: userId,
          tenant_id: tenantId,
          user_email: email,
          role,
          active: true,
          created_by: tenantId, // Admin system as creator
        },
        {
          onConflict: 'tenant_id,user_id',
        }
      )
      .select()

    if (error) {
      return NextResponse.json(
        { error: `Failed to add user to tenant: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `User ${email} invited with role '${role}'`,
      userId,
      data,
    })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
