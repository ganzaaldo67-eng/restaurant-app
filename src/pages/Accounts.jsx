import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Accounts() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('unpaid') // unpaid | all_open | paid_today
  const [tipDraft, setTipDraft] = useState({})

  useEffect(() => {
    load()
  }, [filter])

  async function load() {
    setLoading(true)
    let q = supabase
      .from('orders')
      .select('*, order_items(name, quantity, price)')
      .order('created_at', { ascending: false })

    if (filter === 'unpaid' || filter === 'all_open') {
      q = q.neq('status', 'paid')
    } else if (filter === 'paid_today') {
      const start = new Date()
      start.setHours(0, 0, 0, 0)
      q = q.eq('status', 'paid').gte('completed_at', start.toISOString())
    }

    const { data, error } = await q.limit(100)
    if (error) alert(error.message)
    setOrders(data || [])
    setLoading(false)
  }

  async function markPaid(order) {
    const tip = Number(tipDraft[order.id] || order.tip || 0)
    const total = Number(order.total) || 0
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'paid',
        tip,
        paid_amount: total + tip,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id)

    if (error) alert(error.message)
    else load()
  }

  const openTotal = orders
    .filter((o) => o.status !== 'paid')
    .reduce((s, o) => s + Number(o.total || 0) + Number(o.tip || 0), 0)

  return (
    <div className="space-y-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Accounts / Bills</h2>
        <div className="flex flex-wrap gap-2">
          {[
            ['unpaid', 'Unpaid'],
            ['all_open', 'All open'],
            ['paid_today', 'Paid today'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                filter === k
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-zinc-700 text-zinc-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {filter !== 'paid_today' && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="text-sm text-zinc-400">Open bills total</div>
          <div className="text-2xl font-bold">RWF {openTotal.toLocaleString()}</div>
        </div>
      )}

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="text-zinc-500 py-10 text-center">No orders in this filter</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const tip = Number(tipDraft[o.id] ?? o.tip ?? 0)
            const grand = Number(o.total || 0) + tip
            return (
              <div key={o.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      Table {o.table_number} — {o.customer_name || 'Guest'}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(o.created_at).toLocaleString()} ·{' '}
                      <span className="capitalize">{o.status}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">RWF {grand.toLocaleString()}</div>
                    <Link
                      to={`/staff/receipt/${o.id}`}
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Receipt
                    </Link>
                  </div>
                </div>

                <div className="text-xs text-zinc-400 mt-2">
                  {(o.order_items || [])
                    .map((i) => `${i.quantity}× ${i.name}`)
                    .join(', ')}
                </div>

                {o.status !== 'paid' && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <label className="text-xs text-zinc-400">
                      Tip (RWF)
                      <input
                        type="number"
                        min="0"
                        value={tipDraft[o.id] ?? o.tip ?? 0}
                        onChange={(e) =>
                          setTipDraft((prev) => ({
                            ...prev,
                            [o.id]: e.target.value,
                          }))
                        }
                        className="mt-1 block w-28 px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-sm"
                      />
                    </label>
                    <button
                      onClick={() => markPaid(o)}
                      className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium"
                    >
                      Mark paid
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}