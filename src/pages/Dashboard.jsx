import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const [stats, setStats] = useState({
    active: 0,
    revenue: 0,
    paidToday: 0,
    menuCount: 0,
    lowStock: 0,
  })
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel('dashboard-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () =>
        loadData()
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  async function loadData() {
    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const [ordersRes, menuRes, stockRes] = await Promise.all([
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('menu_items').select('id', { count: 'exact', head: true }),
        supabase
          .from('menu_items')
          .select('stock_qty, low_stock_threshold, track_stock')
          .eq('track_stock', true),
      ])

      const orders = ordersRes.data || []
      const active = orders.filter((o) => o.status !== 'paid').length

      const paidTodayOrders = orders.filter(
        (o) =>
          o.status === 'paid' &&
          new Date(o.completed_at || o.created_at) >= today
      )

      const revenue = paidTodayOrders.reduce(
        (sum, o) => sum + Number(o.total || 0) + Number(o.tip || 0),
        0
      )

      const lowStock = (stockRes.data || []).filter((i) => {
        const q = i.stock_qty ?? 0
        const t = i.low_stock_threshold ?? 5
        return q <= t
      }).length

      setStats({
        active,
        revenue,
        paidToday: paidTodayOrders.length,
        menuCount: menuRes.count || 0,
        lowStock,
      })
      setRecent(orders.slice(0, 8))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const statusColors = {
    pending: 'bg-amber-900/50 text-amber-300',
    cooking: 'bg-blue-900/50 text-blue-300',
    ready: 'bg-green-900/50 text-green-300',
    served: 'bg-zinc-800 text-zinc-300',
    paid: 'bg-emerald-900/50 text-emerald-300',
  }

  if (loading) return <div className="text-zinc-500">Loading dashboard...</div>

  return (
    <div className="space-y-6 text-white">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-zinc-400 text-sm mt-1">Live overview of your restaurant</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="text-sm text-zinc-400 mb-1">Active Orders</div>
          <div className="text-3xl font-bold text-amber-400">{stats.active}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="text-sm text-zinc-400 mb-1">Revenue Today</div>
          <div className="text-2xl font-bold text-green-400">
            RWF {stats.revenue.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1">includes tips</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="text-sm text-zinc-400 mb-1">Paid Today</div>
          <div className="text-3xl font-bold text-blue-400">{stats.paidToday}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="text-sm text-zinc-400 mb-1">Menu Items</div>
          <div className="text-3xl font-bold">{stats.menuCount}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <div className="text-sm text-zinc-400 mb-1">Low / Out Stock</div>
          <div className="text-3xl font-bold text-red-400">{stats.lowStock}</div>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <h2 className="font-medium mb-4">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/staff/take-order"
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-sm font-medium"
          >
            + New Order
          </Link>
          <Link
            to="/staff/active"
            className="px-5 py-2.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-sm font-medium"
          >
            View Active Orders
          </Link>
          <Link
            to="/staff/accounts"
            className="px-5 py-2.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-sm font-medium"
          >
            Accounts / Bills
          </Link>
          <Link
            to="/staff/stock"
            className="px-5 py-2.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-sm font-medium"
          >
            Stock
          </Link>
          <Link
            to="/staff/menu"
            className="px-5 py-2.5 rounded-lg border border-zinc-700 hover:bg-zinc-800 text-sm font-medium"
          >
            Manage Menu
          </Link>
        </div>
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Recent Orders</h2>
          <Link to="/staff/active" className="text-sm text-blue-400 hover:underline">
            View all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="text-zinc-500 text-sm py-8 text-center">No orders yet</p>
        ) : (
          <div className="space-y-2">
            {recent.map((o) => (
              <div
                key={o.id}
                className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0"
              >
                <div>
                  <div className="font-medium">
                    Table {o.table_number} — {o.customer_name}
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {new Date(o.created_at).toLocaleString()} · RWF{' '}
                    {(Number(o.total || 0) + Number(o.tip || 0)).toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Link
                    to={`/staff/receipt/${o.id}`}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    Receipt
                  </Link>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                      statusColors[o.status] || statusColors.pending
                    }`}
                  >
                    {o.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}