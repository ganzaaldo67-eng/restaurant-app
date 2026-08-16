import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function OrderHistory() {
  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    const { data } = await supabase
      .from('orders')
      .select(`*, order_items (*)`)
      .eq('status', 'paid')
      .order('completed_at', { ascending: false })
    setOrders(data || [])
    setLoading(false)
  }

  const filtered = orders.filter((o) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      String(o.table_number).includes(q) ||
      o.customer_name?.toLowerCase().includes(q) ||
      o.order_items?.some((i) => i.name.toLowerCase().includes(q))
    )
  })

  if (loading) return <div className="text-zinc-500">Loading history...</div>

  return (
    <div className="space-y-4 text-white">
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by table or item..." className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white" />

      {filtered.length === 0 ? (
        <p className="text-center text-zinc-500 py-12">No completed orders yet</p>
      ) : (
        filtered.map((order) => (
          <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex justify-between items-start mb-2">
              <div>
                <div className="font-medium">Table {order.table_number} — {order.customer_name}</div>
                <div className="text-xs text-zinc-500">
                  {new Date(order.completed_at || order.created_at).toLocaleString()}
                </div>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-900/40 text-emerald-300 font-medium">Paid</span>
            </div>
            <ul className="text-sm text-zinc-400 space-y-1 mb-2">
              {(order.order_items || []).map((i) => (
                <li key={i.id} className="flex justify-between">
                  <span>{i.quantity}× {i.name}</span>
                  <span>RWF {(i.price * i.quantity).toFixed(0)}</span>
                </li>
              ))}
            </ul>
            <div className="flex justify-between font-medium border-t border-zinc-800 pt-2">
              <span>Total</span>
              <span>RWF {Number(order.total).toFixed(0)}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}