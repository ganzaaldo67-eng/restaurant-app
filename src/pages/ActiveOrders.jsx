import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { restoreStockFromOrderItems } from '../lib/stock'

const FOOD_FLOW = ['pending', 'cooking', 'ready', 'served']
const DRINKS_FLOW = ['pending', 'ready', 'served']
const MAIN_FLOW = ['pending', 'cooking', 'ready', 'served', 'paid']

function isDrinkItem(item) {
  const category = (item.category || '').toLowerCase()
  if (category === 'drinks' || category === 'drink') return true

  const name = (item.name || '').toLowerCase()
  const drinkWords = [
    'wine', 'beer', 'juice', 'fanta', 'coca', 'water', 'whisky', 'whiskey',
    'vodka', 'gin', 'champagne', 'hennessy', 'amarula', 'label', 'red bull',
    'skol', 'mutzig', 'primus', 'heineken', 'guinness', 'drink', 'tuska',
    'smirnoff', 'jack', 'red label', 'black label', 'savanna', 'desperados',
    'mirinda', 'novida', 'energy', 'raki', 'siminoff', 'gilbis', 'cousins',
    'tea', 'coffee', 'leite', 'leffe', 'marte', 'inyange', 'nile', 'amazi',
  ]
  return drinkWords.some((w) => name.includes(w))
}

function canManageOrders(role) {
  return [
    'admin',
    'manager',
    'operations_manager',
    'accountant',
    'waiter',
    'reception',
    'room_manager',
  ].includes(role)
}

function canUpdateFood(role) {
  return ['kitchen', 'admin', 'manager', 'operations_manager'].includes(role)
}

function canUpdateDrinks(role) {
  return [
    'waiter',
    'admin',
    'manager',
    'operations_manager',
    'accountant',
    'reception',
  ].includes(role)
}

export default function ActiveOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const { role } = useAuth()
  const navigate = useNavigate()
  const previousOrderIds = useRef(new Set())
  const isFirstLoad = useRef(true)

  function playNotificationSound() {
    try {
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      audio.volume = 0.7
      audio.play().catch(() => {})
    } catch (e) {
      console.log('Sound error', e)
    }
  }

  useEffect(() => {
    loadOrders()

    const channel = supabase
      .channel('active-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          loadOrders()
          if (payload.eventType === 'INSERT') playNotificationSound()
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        () => loadOrders()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function loadOrders() {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*)`)
        .neq('status', 'paid')
        .order('created_at', { ascending: false })

      if (error) throw error

      const newOrders = data || []

      if (!isFirstLoad.current) {
        const currentIds = new Set(newOrders.map((o) => o.id))
        const hasNewOrder = [...currentIds].some((id) => !previousOrderIds.current.has(id))
        if (hasNewOrder) playNotificationSound()
      }

      previousOrderIds.current = new Set(newOrders.map((o) => o.id))
      isFirstLoad.current = false
      setOrders(newOrders)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function setMainStatus(orderId, newStatus) {
    const updates = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'paid') updates.completed_at = new Date().toISOString()

    const { error } = await supabase.from('orders').update(updates).eq('id', orderId)
    if (error) alert(error.message)
  }

  async function setFoodStatus(orderId, newStatus) {
    const { error } = await supabase
      .from('orders')
      .update({
        food_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
    if (error) alert(error.message)
  }

  async function setDrinksStatus(orderId, newStatus) {
    const { error } = await supabase
      .from('orders')
      .update({
        drinks_status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
    if (error) alert(error.message)
  }

  async function cancelOrder(orderId) {
    if (!confirm('Cancel this order? Stock for tracked drinks will be put back.')) return

    const order = orders.find((o) => o.id === orderId)
    const items = order?.order_items || []

    const result = await restoreStockFromOrderItems(items, orderId)
    if (!result?.ok) {
      alert('Could not restore stock: ' + (result?.message || 'Unknown error'))
      return
    }

    const { error } = await supabase.from('orders').delete().eq('id', orderId)
    if (error) {
      alert(error.message)
      return
    }

    if ((result.restored || 0) > 0) {
      alert(`Order cancelled. Restored stock for ${result.restored} item(s).`)
    } else {
      alert('Order cancelled. No tracked stock items were found to restore.')
    }
  }

  const pill = {
    pending: 'bg-amber-900/50 text-amber-300 border-amber-700',
    cooking: 'bg-blue-900/50 text-blue-300 border-blue-700',
    ready: 'bg-green-900/50 text-green-300 border-green-700',
    served: 'bg-zinc-700 text-zinc-200 border-zinc-600',
    paid: 'bg-emerald-900/50 text-emerald-300 border-emerald-700',
  }

  if (loading) return <div className="text-zinc-500 p-4">Loading orders...</div>

  if (orders.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-500">
        <p className="text-lg">No active orders</p>
        <p className="text-sm mt-2">New orders will appear here automatically</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 text-white">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Active Orders ({orders.length})</h2>
        <span className="text-xs text-green-400 bg-green-900/30 px-3 py-1 rounded-full">Live</span>
      </div>

      {orders.map((order) => {
        const allItems = order.order_items || []
        const foodItems = allItems.filter((item) => !isDrinkItem(item))
        const drinkItems = allItems.filter((item) => isDrinkItem(item))
        const hasFood = foodItems.length > 0
        const hasDrinks = drinkItems.length > 0

        const foodStatus = order.food_status || 'pending'
        const drinksStatus = order.drinks_status || 'pending'
        const visibleItems = role === 'kitchen' ? foodItems : allItems

        return (
          <div key={order.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="text-lg font-semibold">
                  Table {order.table_number} — {order.customer_name}
                  {order.source === 'customer' && (
                    <span className="ml-2 text-xs bg-green-900/50 text-green-300 px-2 py-0.5 rounded-full">
                      Customer
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 mt-1">
                  {new Date(order.created_at).toLocaleString()}
                </div>
              </div>
              <span
                className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize border ${
                  pill[order.status] || pill.pending
                }`}
              >
                {order.status}
              </span>
            </div>

            <ul className="space-y-1 mb-3">
              {visibleItems.map((item) => (
                <li key={item.id} className="flex justify-between text-sm text-zinc-400">
                  <span>
                    {item.quantity}× {item.name}
                    {isDrinkItem(item) ? (
                      <span className="ml-2 text-[10px] text-sky-400">drink</span>
                    ) : (
                      <span className="ml-2 text-[10px] text-orange-400">food</span>
                    )}
                  </span>
                  <span>RWF {(item.price * item.quantity).toLocaleString()}</span>
                </li>
              ))}
            </ul>

            {role === 'kitchen' && hasDrinks && (
              <p className="text-xs text-amber-400 mb-2">
                + {drinkItems.length} drink item(s) — waiter handles drinks
              </p>
            )}

            <div className="flex justify-between font-medium border-t border-zinc-800 pt-2 mb-3">
              <span>Total</span>
              <span>RWF {Number(order.total).toLocaleString()}</span>
            </div>

            {order.notes && (
              <p className="text-xs text-zinc-500 italic mb-3">Note: {order.notes}</p>
            )}

            {hasFood && (canUpdateFood(role) || role === 'waiter' || canManageOrders(role)) && (
              <div className="mb-3">
                <div className="text-xs text-orange-300 font-medium mb-1.5">
                  🍽️ Food status: <span className="capitalize">{foodStatus}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {FOOD_FLOW.map((s) => {
                    const isActive = s === foodStatus
                    const canClick = canUpdateFood(role)
                    return (
                      <button
                        key={s}
                        disabled={!canClick}
                        onClick={() => canClick && setFoodStatus(order.id, s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition capitalize ${
                          isActive
                            ? 'bg-orange-500 text-black border-orange-400'
                            : 'border-zinc-700 text-zinc-400 hover:border-orange-500 disabled:opacity-40'
                        }`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {hasDrinks && (canUpdateDrinks(role) || role === 'kitchen' || canManageOrders(role)) && (
              <div className="mb-3">
                <div className="text-xs text-sky-300 font-medium mb-1.5">
                  🥤 Drinks status: <span className="capitalize">{drinksStatus}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DRINKS_FLOW.map((s) => {
                    const isActive = s === drinksStatus
                    const canClick = canUpdateDrinks(role)
                    return (
                      <button
                        key={s}
                        disabled={!canClick}
                        onClick={() => canClick && setDrinksStatus(order.id, s)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition capitalize ${
                          isActive
                            ? 'bg-sky-500 text-black border-sky-400'
                            : 'border-zinc-700 text-zinc-400 hover:border-sky-500 disabled:opacity-40'
                        }`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="mb-1">
              <div className="text-xs text-zinc-400 font-medium mb-1.5">Order status</div>
              <div className="flex flex-wrap gap-1.5">
                {MAIN_FLOW.map((s) => {
                  const isActive = s === order.status
                  return (
                    <button
                      key={s}
                      onClick={() => setMainStatus(order.id, s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition capitalize ${
                        isActive
                          ? 'bg-white text-black border-white'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {canManageOrders(role) && (
              <div className="mt-3 flex justify-end gap-4">
                <button
                  onClick={() => navigate(`/staff/receipt/${order.id}`)}
                  className="text-xs text-blue-400 hover:underline"
                >
                  Receipt
                </button>
                <button
                  onClick={() => navigate(`/staff/take-order?table=${order.table_number}`)}
                  className="text-xs text-emerald-400 hover:underline"
                >
                  + Add items
                </button>
                <button
                  onClick={() => cancelOrder(order.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Cancel order
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}