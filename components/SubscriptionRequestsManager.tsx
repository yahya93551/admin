'use client'

import { Fragment, useEffect, useState } from 'react'

interface RequestItem {
  id: string
  tenant_id: string
  user_email: string | null
  monthly_fee: string | number | null
  status: string
  requested_at: string | null
  approved_at?: string | null
  approved_by?: string | null
  notes?: string | null
  created_at: string
  updated_at?: string | null
}

function formatTenant(tenantId: string) {
  return tenantId.length > 14 ? `${tenantId.slice(0, 12)}…` : tenantId
}

function formatTimestamp(value: string | undefined | null) {
  return value ? new Date(value).toLocaleString() : '—'
}

function formatEmail(email: string | null) {
  return email || 'Unknown email'
}

export default function SubscriptionRequestsManager() {
  const [requests, setRequests] = useState<RequestItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    loadRequests()
  }, [])

  const loadRequests = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/subscriptions/requests')
      if (!res.ok) throw new Error('Failed to load requests')
      const json = await res.json()
      setRequests(json.requests || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleAction = async (id: string, action: 'approve' | 'decline') => {
    setError(null)
    setActionLoading((prev) => ({ ...prev, [id]: true }))

    try {
      const res = await fetch('/api/admin/subscriptions/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      })

      if (!res.ok) {
        const json = await res.json()
        throw new Error(json.error || 'Action failed')
      }

      await res.json()
      setMessage(`Subscription request ${action}d successfully.`)
      await loadRequests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setActionLoading((prev) => ({ ...prev, [id]: false }))
    }
  }

  const activeSubscriptions = requests.filter((r) => r.status === 'active')
  const pendingRequests = requests.filter((r) => r.status === 'pending')
  const inactiveSubscriptions = requests.filter((r) => r.status !== 'active' && r.status !== 'pending')

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Subscription dashboard</h2>
          <p className="text-sm text-slate-500">View active, pending, and inactive tenant subscriptions. Pending requests are shown as review notifications.</p>
        </div>
        <div className="text-sm text-slate-600">{loading ? 'Loading subscriptions…' : `${requests.length} total subscription record${requests.length === 1 ? '' : 's'}`}</div>
      </div>

      {error && <div className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}
      {message && (
        <div className="rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-700 flex items-center justify-between">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="underline text-emerald-700">Dismiss</button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Active Subscriptions</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{activeSubscriptions.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Pending Requests</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{pendingRequests.length}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Inactive / Expired</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{inactiveSubscriptions.length}</p>
        </div>
      </div>

      {pendingRequests.length > 0 && (
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">Pending subscription requests need review.</p>
          <p>{pendingRequests.length} request{pendingRequests.length === 1 ? '' : 's'} are waiting for approval.</p>
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading…</div>
      ) : requests.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">No subscription records found.</div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700">
              <tr>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">User email</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{formatTenant(r.tenant_id)}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{formatEmail(r.user_email)}</td>
                    <td className="px-4 py-3 text-slate-800">${typeof r.monthly_fee === 'number' ? r.monthly_fee.toFixed(2) : r.monthly_fee ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700 capitalize">{r.status}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatTimestamp(r.requested_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatTimestamp(r.approved_at ?? r.updated_at)}</td>
                    <td className="px-4 py-3 space-x-2">
                      <button
                        disabled={r.status !== 'pending' || actionLoading[r.id]}
                        onClick={() => handleAction(r.id, 'approve')}
                        className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={r.status !== 'pending' || actionLoading[r.id]}
                        onClick={() => handleAction(r.id, 'decline')}
                        className="rounded-xl bg-rose-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </td>
                  </tr>
                  {r.status === 'pending' && (
                    <tr key={`${r.id}-details`} className="border-b border-slate-200 bg-slate-50">
                      <td colSpan={7} className="px-4 py-3 text-sm text-slate-700">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="font-semibold text-slate-900">Full pending request details</p>
                            <p className="text-xs text-slate-500">All data submitted by the tenant is visible here.</p>
                          </div>
                          <div className="grid gap-1 text-xs text-slate-600">
                            <div>
                              <span className="font-semibold">Tenant ID:</span> {r.tenant_id}
                            </div>
                            <div>
                              <span className="font-semibold">Requested by:</span> {formatEmail(r.user_email)}
                            </div>
                            <div>
                              <span className="font-semibold">Requested at:</span> {formatTimestamp(r.requested_at)}
                            </div>
                            <div>
                              <span className="font-semibold">Requested fee:</span> ${typeof r.monthly_fee === 'number' ? r.monthly_fee.toFixed(2) : r.monthly_fee ?? '—'}
                            </div>
                            <div>
                              <span className="font-semibold">Approved at:</span> {formatTimestamp(r.approved_at)}
                            </div>
                            <div>
                              <span className="font-semibold">Approved by:</span> {r.approved_by ?? '—'}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
                          <div>
                            <span className="font-semibold">Created:</span> {formatTimestamp(r.created_at)}
                          </div>
                          <div>
                            <span className="font-semibold">Updated:</span> {formatTimestamp(r.updated_at)}
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="font-semibold text-slate-900 text-xs">Notes</p>
                          <p className="whitespace-pre-wrap text-slate-600 text-xs">{r.notes ?? 'No additional notes provided.'}</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
