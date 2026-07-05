'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import InventoryUsersManager from '@/components/InventoryUsersManager'
import SubscriptionRequestsManager from '@/components/SubscriptionRequestsManager'
import type { ActivityLog, TenantContext, TenantMember } from '@/types'

interface AuthUser {
  id: string
  email: string | null
  role: string | null
  user_metadata: Record<string, unknown> | null
  created_at: string
  confirmed_at: string | null
  last_sign_in_at: string | null
}

export default function AdminDashboard() {
  const [tenant, setTenant] = useState<TenantContext | null>(null)
  const [members, setMembers] = useState<TenantMember[]>([])
  const [users, setUsers] = useState<TenantMember[]>([])
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([])
  const displayedUsers = useMemo(() => (authUsers.length > 0 ? authUsers : users), [authUsers, users])
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [userLogs, setUserLogs] = useState<ActivityLog[]>([])
  const [selectedUser, setSelectedUser] = useState<TenantMember | AuthUser | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeSection, setActiveSection] = useState<'overview' | 'users' | 'members' | 'logs' | 'inventory' | 'subscriptions'>('overview')
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const section = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('section') : null
    if (
      section === 'overview' ||
      section === 'users' ||
      section === 'members' ||
      section === 'logs' ||
      section === 'inventory' ||
      section === 'subscriptions'
    ) {
      setActiveSection(section)
    }
  }, [])

  useEffect(() => {
    const loadContext = async () => {
      setError(null)
      try {
        setLoading(true)
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) throw new Error('Authentication required')
        setTenant({
          tenant_id: 'global',
          role: 'super_admin',
          user_id: user.id,
          user_email: user.email || '',
          isGlobalAdmin: true,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to authenticate'
        setError(message)
        if (message.toLowerCase().includes('authentication')) {
          router.push('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    loadContext()
  }, [])

  useEffect(() => {
    if (!tenant) return

    const loadData = async () => {
      setLoading(true)
      setError(null)
      try {
        await Promise.all([fetchAllUsers(), fetchAuthUsers(), fetchMembers()])
        await fetchActivityLogs().catch((error) => {
          if (error instanceof Error && error.message.includes('schema cache')) {
            setMessage('Activity logs are unavailable because the activity_logs table does not exist.')
            setLogs([])
            return
          }
          throw error
        })
      } catch (error) {
        setError(error instanceof Error ? error.message : 'Failed to load admin data')
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [tenant])

  const fetchMembers = async () => {
    if (!tenant) return
    const query = supabase
      .from('tenant_members')
      .select('*')
      .order('created_at', { ascending: false })
    const { data, error } = await query

    if (error) throw new Error(error.message)
    setMembers(data ?? [])
  }

  const fetchActivityLogs = async () => {
    if (!tenant) return
    try {
      const query = supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20)
      const { data, error } = await query

      if (error) throw new Error(error.message)
      setLogs(data ?? [])
    } catch (error) {
      if (error instanceof Error && error.message.includes('schema cache')) {
        setLogs([])
        return
      }
      throw error
    }
  }

  const fetchAllUsers = async () => {
    if (!tenant) return
    const { data, error } = await supabase
      .from('tenant_members')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    setUsers(data ?? [])
  }

  const fetchAuthUsers = async () => {
    if (!tenant) return
    const response = await fetch('/api/admin/users')
    if (!response.ok) {
      const json = await response.json()
      throw new Error(json.error || 'Failed to fetch auth users')
    }
    const json = await response.json()
    setAuthUsers(json.users ?? [])
  }

  const fetchUserLogs = async (userId: string) => {
    if (!tenant) return
    try {
      const query = supabase
        .from('activity_logs')
        .select('*')
        .eq('performed_by', userId)
        .order('created_at', { ascending: false })
        .limit(10)
      const { data, error } = await query

      if (error) throw new Error(error.message)
      setUserLogs(data ?? [])
    } catch (error) {
      if (error instanceof Error && error.message.includes('schema cache')) {
        setUserLogs([])
        return
      }
      throw error
    }
  }

  const toggleMemberActive = async (member: TenantMember) => {
    if (!tenant) return
    setLoading(true)
    setError(null)
    try {
      const query = supabase.from('tenant_members').update({ active: !member.active }).eq('id', member.id)
      const { error } = tenant.isGlobalAdmin ? await query : await query.eq('tenant_id', tenant.tenant_id)
      if (error) throw new Error(error.message)
      setMessage('Member status updated.')
      if (tenant.isGlobalAdmin) {
        await fetchAllUsers()
      } else {
        await fetchMembers()
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to update member')
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (!tenant) {
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-slate-900">Unable to load admin dashboard</p>
            <p className="mt-3 text-sm text-slate-600">{error}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-6 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Go back to login
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-700">Loading admin dashboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="border-b border-slate-200 bg-white/95 shadow-sm sticky top-0 z-20">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <h1 className="text-xl font-semibold">Inventory Admin</h1>
            <p className="text-sm text-slate-600">
              Tenant: {tenant.isGlobalAdmin ? 'All tenants' : tenant.tenant_id} • Role: {tenant.role}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-700">{tenant.user_email}</span>
            <button
              onClick={handleLogout}
              className="rounded bg-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-rose-500"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <nav className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.15em] text-slate-500 mb-3">Navigation</div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {(tenant.isGlobalAdmin
              ? (['users', 'overview', 'inventory', 'subscriptions', 'logs'] as const)
              : (['overview', 'members', 'inventory', 'subscriptions', 'logs'] as const)
            ).map((section) => (
              <button
                key={section}
                onClick={() => setActiveSection(section)}
                className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  activeSection === section
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {section === 'inventory'
                  ? 'Inventory Users'
                  : section === 'subscriptions'
                  ? 'Subscription Requests'
                  : section.charAt(0).toUpperCase() + section.slice(1)}
              </button>
            ))}
          </div>
        </nav>

        <section className="space-y-6">
          {(error || message || loading) && (
            <div className="space-y-2">
              {error && <div className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-700">{error}</div>}
              {message && <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-700">{message}</div>}
              {loading && <div className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-700">Working…</div>}
            </div>
          )}

          {activeSection === 'overview' && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm text-slate-500">{tenant.isGlobalAdmin ? 'All users' : 'Team members'}</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{tenant.isGlobalAdmin ? displayedUsers.length : members.length}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm text-slate-500">Recent activity</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{logs.length}</p>
                </div>
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-sm text-slate-500">Active users</p>
                  <p className="mt-2 text-3xl font-semibold text-slate-900">{(tenant.isGlobalAdmin ? users : members).filter((u) => u.active).length}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4">
                  <p className="text-sm font-semibold text-slate-900">Quick notes</p>
                  <p className="text-sm text-slate-500">
                    {tenant.isGlobalAdmin
                      ? `Viewing ${users.length} users across all tenants.`
                      : `Viewing ${members.length} tenant members.`}
                  </p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Users loaded</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{displayedUsers.length}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Logs loaded</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{logs.length}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-50 p-4">
                    <p className="text-sm text-slate-500">Selected section</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-900">{activeSection.charAt(0).toUpperCase() + activeSection.slice(1)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'users' && tenant.isGlobalAdmin && (
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">All Users</h2>
                <p className="text-sm text-slate-500">Manage users across all tenants.</p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Tenant</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Created</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {displayedUsers.map((user) => {
                      const email = 'user_email' in user ? user.user_email : user.email ?? ''
                      const tenantId = 'tenant_id' in user ? user.tenant_id : 'N/A'
                      const role = user.role ?? 'authenticated'
                      const status = 'active' in user ? (user.active ? 'Active' : 'Inactive') : user.confirmed_at ? 'Active' : 'Pending'
                      const createdAt = new Date(user.created_at).toLocaleDateString()
                      const userId = 'user_id' in user ? user.user_id : user.id

                      return (
                        <tr key={user.id}>
                          <td className="px-4 py-3 text-slate-900">{email}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs font-mono">
                            {tenantId === 'N/A' ? 'N/A' : `${tenantId.substring(0, 8)}...`}
                          </td>
                          <td className="px-4 py-3 text-slate-700">{role}</td>
                          <td className="px-4 py-3 text-slate-700">{status}</td>
                          <td className="px-4 py-3 text-slate-700 text-xs">{createdAt}</td>
                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => {
                                setSelectedUser(user)
                                fetchUserLogs(userId)
                                setActiveSection('logs')
                              }}
                              className="rounded-2xl bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-500"
                            >
                              View Logs
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                    {users.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-sm text-slate-500">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="rounded-3xl bg-blue-50 p-4">
                <p className="text-sm text-blue-900">
                  <strong>Global Admin Mode:</strong> You are viewing all users across all tenants. Use the actions above to manage user access.
                </p>
              </div>
            </div>
          )}

          {activeSection === 'members' && !tenant.isGlobalAdmin && (
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Tenant Members</h2>
                <p className="text-sm text-slate-500">Review who has access and update member status.</p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-200">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {members.map((member) => (
                      <tr key={member.id}>
                        <td className="px-4 py-3 text-slate-900">{member.user_email}</td>
                        <td className="px-4 py-3 text-slate-700">{member.role}</td>
                        <td className="px-4 py-3 text-slate-700">{member.active ? 'Active' : 'Inactive'}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => toggleMemberActive(member)}
                            className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                          >
                            {member.active ? 'Disable' : 'Enable'}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {members.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-sm text-slate-500">
                          No tenant members found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeSection === 'inventory' && (
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <InventoryUsersManager />
            </div>
          )}

          {activeSection === 'subscriptions' && (
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <SubscriptionRequestsManager />
            </div>
          )}

          {activeSection === 'logs' && (
            <div className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedUser ? `Logs for ${((selectedUser as any).user_email ?? (selectedUser as any).email ?? '')}` : 'Activity Logs'}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {selectedUser ? 'Recent actions by this user.' : 'Recent actions on your tenant.'}
                  </p>
                </div>
                {selectedUser && (
                  <button
                    onClick={() => {
                      setSelectedUser(null)
                      fetchActivityLogs()
                    }}
                    className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700 hover:bg-slate-200"
                  >
                    View All Logs
                  </button>
                )}
              </div>

              <div className="space-y-4">
                {(selectedUser ? userLogs : logs).map((log) => (
                  <div key={log.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{log.action}</p>
                        <p className="text-xs text-slate-500">Entity: {log.entity}</p>
                      </div>
                      <span className="text-xs text-slate-500">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.details && (
                      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-2xl bg-white p-3 text-xs text-slate-600">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
                {(selectedUser ? userLogs : logs).length === 0 && (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-slate-500">
                    {selectedUser ? 'No logs found for this user.' : 'No activity logs available.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
