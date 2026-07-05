import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * GET /api/admin/inventory-users - List all tenant members from inventory system
 * POST /api/admin/inventory-users - Manage user roles
 */

export async function GET(request: Request) {
  try {
    // Get all users with their tenant memberships
    const { data: tenantMembers, error } = await supabaseAdmin
      .from('tenant_members')
      .select('id, user_id, user_email, role, active, created_at, tenant_id')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json(
        { error: `Failed to fetch users: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ users: tenantMembers ?? [] })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, userId, tenantId, role } = body

    // Validate required fields
    if (!action || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields: action, userId' },
        { status: 400 }
      )
    }

    // Action: assign-role
    if (action === 'assign-role') {
      if (!tenantId || !role) {
        return NextResponse.json(
          { error: 'Missing required fields for assign-role: tenantId, role' },
          { status: 400 }
        )
      }

      // Validate role
      const validRoles = ['owner', 'accountant', 'sales', 'admin']
      if (!validRoles.includes(role)) {
        return NextResponse.json(
          { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
          { status: 400 }
        )
      }

      // Update or insert tenant member
      const { data, error } = await supabaseAdmin
        .from('tenant_members')
        .upsert(
          {
            user_id: userId,
            tenant_id: tenantId,
            role,
            active: true,
            created_by: tenantId, // System admin is creating
          },
          {
            onConflict: 'tenant_id,user_id',
          }
        )
        .select()

      if (error) {
        return NextResponse.json(
          { error: `Failed to assign role: ${error.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: `Role '${role}' assigned successfully`,
        data,
      })
    }

    // Action: deactivate
    if (action === 'deactivate') {
      const { data, error } = await supabaseAdmin
        .from('tenant_members')
        .update({ active: false })
        .eq('user_id', userId)
        .select()

      if (error) {
        return NextResponse.json(
          { error: `Failed to deactivate user: ${error.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'User deactivated successfully',
        data,
      })
    }

    // Action: activate
    if (action === 'activate') {
      const { data, error } = await supabaseAdmin
        .from('tenant_members')
        .update({ active: true })
        .eq('user_id', userId)
        .select()

      if (error) {
        return NextResponse.json(
          { error: `Failed to activate user: ${error.message}` },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'User activated successfully',
        data,
      })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: `Server error: ${err instanceof Error ? err.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
