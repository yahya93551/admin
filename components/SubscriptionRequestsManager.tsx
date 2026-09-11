'use client'

import { Fragment, useEffect, useState } from 'react'
import type { Subscription } from '@/types'

interface RequestItem extends Subscription {
  user_email: string | null
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

function formatFee(value: string | number | null) {
  const fee = Number(value)
  return Number.isFinite(fee) ? `$${fee.toFixed(2)}` : '—'
}

function isExpiringSoon(value: string | null | undefined) {
  if (!value) return false
  const activeUntil = new Date(value).getTime()
  const now = Date.now()
  const inThirtyDays = now + 30 * 24 * 60 * 60 * 1000
  return activeUntil >= now && activeUntil <= inThirtyDays
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
  const expiringSoon = activeSubscriptions.filter((r) => isExpiringSoon(r.active_until))
  const activeMonthlyRevenue = activeSubscriptions.reduce((total, request) => {
    const fee = Number(request.monthly_fee)
    return total + (Number.isFinite(fee) ? fee : 0)
  }, 0)
  const planCounts = activeSubscriptions.reduce<Record<string, number>>((counts, request) => {
    const plan = request.plan ?? 'legacy'
    counts[plan] = (counts[plan] ?? 0) + 1
    return counts
  }, {})
  const orderedRequests = [...requests].sort((left, right) => {
    if (left.status === 'pending' && right.status !== 'pending') return -1
    if (left.status !== 'pending' && right.status === 'pending') return 1

    const leftRequestedAt = left.requested_at ? new Date(left.requested_at).getTime() : 0
    const rightRequestedAt = right.requested_at ? new Date(right.requested_at).getTime() : 0
    return rightRequestedAt - leftRequestedAt
  })

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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">Monthly revenue</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{formatFee(activeMonthlyRevenue)}</p>
        </div>
        <div className="rounded-3xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <p className="text-sm text-amber-700">Renewing soon</p>
          <p className="mt-2 text-3xl font-semibold text-amber-900">{expiringSoon.length}</p>
        </div>
      </div>

      {activeSubscriptions.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">Active plan mix</p>
              <p className="text-xs text-slate-500">Current active subscriptions by plan.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(planCounts).map(([plan, count]) => (
                <span key={plan} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                  {plan}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Fee</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Active until</th>
                <th className="px-4 py-3">Next billing</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orderedRequests.map((r) => (
                <Fragment key={r.id}>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-3 font-mono text-xs text-slate-800">{formatTenant(r.tenant_id)}</td>
                    <td className="px-4 py-3 text-sm text-slate-800">{formatEmail(r.user_email)}</td>
                    <td className="px-4 py-3 text-slate-700 capitalize">{r.plan ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{r.subscription_duration_months ? `${r.subscription_duration_months} month${r.subscription_duration_months === 1 ? '' : 's'}` : '—'}</td>
                    <td className="px-4 py-3 text-slate-800">{formatFee(r.monthly_fee)}</td>
                    <td className="px-4 py-3 text-slate-700 capitalize">{r.status}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatTimestamp(r.requested_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatTimestamp(r.active_until)}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{formatTimestamp(r.next_billing_date)}</td>
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
                      <td colSpan={11} className="px-4 py-3 text-sm text-slate-700">
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
                              <span className="font-semibold">Requested fee:</span> {formatFee(r.monthly_fee)}
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
