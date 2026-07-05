'use client'

import { useEffect, useState } from 'react'

interface InventoryUser {
  id: string
  user_id: string
  user_email: string
  role: 'owner' | 'accountant' | 'sales' | 'admin'
  active: boolean
  created_at: string
  tenant_id: string
}

interface InviteFormData {
  email: string
  role: 'owner' | 'accountant' | 'sales' | 'admin'
  userName: string
  tenantId: string
}

const VALID_ROLES = ['owner', 'accountant', 'sales', 'admin']

export default function InventoryUsersManager() {
  const [users, setUsers] = useState<InventoryUser[]>([])
  const [tenants, setTenants] = useState<{ id: string; email: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [formData, setFormData] = useState<InviteFormData>({
    email: '',
    role: 'admin',
    userName: '',
    tenantId: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  // Load users on component mount
  useEffect(() => {
    loadUsers()
    fetchTenants()
  }, [])

  const fetchTenants = async () => {
    try {
      const response = await fetch('/api/admin/users')
      if (!response.ok) {
        throw new Error('Failed to load tenants')
      }
      const data = await response.json()
      // Map auth users to tenants
      const availableTenants = (data.users || []).map((u: any) => ({
        id: u.id,
        email: u.email,
      }))
      setTenants(availableTenants)
      if (availableTenants.length > 0 && !formData.tenantId) {
        setFormData((prev) => ({ ...prev, tenantId: availableTenants[0].id }))
      }
    } catch (err) {
      // Tenants are optional for the UI
      console.warn('Could not load tenants:', err)
    }
  }

  const loadUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch('/api/admin/inventory-users')
      if (!response.ok) {
        throw new Error('Failed to load users')
      }
      const data = await response.json()
      setUsers(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.email || !formData.role || !formData.tenantId) {
      setError('Email, role, and tenant are required')
      return
    }

    try {
      setSubmitting(true)
      setError(null)

      const response = await fetch('/api/admin/inventory-users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          role: formData.role,
          userName: formData.userName,
          tenantId: formData.tenantId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to invite user')
      }

      const result = await response.json()
      setMessage(result.message)
      setFormData({ email: '', role: 'admin', userName: '', tenantId: formData.tenantId })
      setShowInviteForm(false)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      setError(null)
      const user = users.find((u) => u.user_id === userId)
      if (!user) return

      const response = await fetch('/api/admin/inventory-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign-role',
          userId,
          tenantId: user.tenant_id,
          role: newRole,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update role')
      }

      setMessage('Role updated successfully')
      await loadUsers()
      setSelectedUserId(null)
      setSelectedRole(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  const handleToggleActive = async (userId: string, currentActive: boolean) => {
    try {
      setError(null)
      const action = currentActive ? 'deactivate' : 'activate'

      const response = await fetch('/api/admin/inventory-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${action} user`)
      }

      setMessage(`User ${action}d successfully`)
      await loadUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory Users Management</h1>
        <button
          onClick={() => setShowInviteForm(!showInviteForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          {showInviteForm ? 'Cancel' : 'Invite User'}
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>}
      {message && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-600">
          {message}
          <button
            onClick={() => setMessage(null)}
            className="ml-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {showInviteForm && (
        <form onSubmit={handleInviteSubmit} className="p-4 bg-gray-50 rounded-lg space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Tenant</label>
            <select
              value={formData.tenantId}
              onChange={(e) => setFormData({ ...formData, tenantId: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            >
              <option value="">Select a tenant</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.email || tenant.id}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name (Optional)</label>
            <input
              type="text"
              value={formData.userName}
              onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              {VALID_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
          >
            {submitting ? 'Inviting...' : 'Send Invite'}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-8">Loading users...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-gray-600">No users found</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b">
                <th className="px-4 py-2 text-left text-sm font-semibold">Email</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Role</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Status</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Created</th>
                <th className="px-4 py-2 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm">{user.user_email}</td>
                  <td className="px-4 py-2 text-sm">
                    {selectedUserId === user.user_id ? (
                      <select
                        value={selectedRole || user.role}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        className="px-2 py-1 border rounded"
                      >
                        {VALID_ROLES.map((role) => (
                          <option key={role} value={role}>
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        {user.role}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        user.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {user.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm">{new Date(user.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-2 text-sm space-x-2">
                    {selectedUserId === user.user_id ? (
                      <>
                        <button
                          onClick={() => handleRoleChange(user.user_id, selectedRole || user.role)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUserId(null)
                            setSelectedRole(null)
                          }}
                          className="px-2 py-1 bg-gray-400 text-white rounded text-xs hover:bg-gray-500"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setSelectedUserId(user.user_id)
                            setSelectedRole(user.role)
                          }}
                          className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                        >
                          Edit Role
                        </button>
                        <button
                          onClick={() => handleToggleActive(user.user_id, user.active)}
                          className={`px-2 py-1 rounded text-xs text-white ${
                            user.active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                          }`}
                        >
                          {user.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
