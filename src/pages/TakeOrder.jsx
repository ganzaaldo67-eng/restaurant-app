import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function TakeOrder() {
  const { user } = useAuth()
  const [menu, setMenu] = useState([])
  const [cart, setCart] = useState([])
  const [table, setTable] = useState('')
  const [customer, setCustomer] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase
      .from('menu_items')
      .select('*')
      .order('category')
      .then(({ data }) => {
        setMenu(data || [])
        setLoading(false)
      })
  }, [])

  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) {
        return prev.map((c) => (c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c))
      }
      return [...prev, { ...item, quantity: 1 }]
    })
  }

  function updateQty(id, delta) {
    setCart((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0)
    )
  }

  const total = cart.reduce((s, c) => s + Number(c.price) * c.quantity, 0)
  const filtered = menu.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
  )

  async function placeOrder() {
    const tableNum = parseInt(table)
    if (!tableNum || tableNum < 1) {
      alert('Enter table number')
      return
    }
    if (cart.length === 0) {
      alert('Add items first')
      return
    }

    setSubmitting(true)
    try {
      const { data: existingOrders, error: findError } = await supabase
        .from('orders')
        .select('id, total, notes')
        .eq('table_number', tableNum)
        .neq('status', 'paid')
        .order('created_at', { ascending: false })
        .limit(1)

      if (findError) throw findError

      let orderId
      let newTotal = total

      if (existingOrders && existingOrders.length > 0) {
        orderId = existingOrders[0].id
        newTotal = Number(existingOrders[0].total) + total

        const mergedNotes = notes.trim()
          ? `${existingOrders[0].notes || ''}${existingOrders[0].notes ? ' | ' : ''}${notes.trim()}`
          : existingOrders[0].notes

        const { error: updateError } = await supabase
          .from('orders')
          .update({
            total: newTotal,
            notes: mergedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', orderId)

        if (updateError) throw updateError
      } else {
        const { data: order, error } = await supabase
          .from('orders')
          .insert({
            table_number: tableNum,
            customer_name: customer.trim() || 'Guest',
            notes: notes.trim() || null,
            total,
            status: 'pending',
            source: 'staff',
            created_by: user?.id,
          })
          .select()
          .single()

        if (error) throw error
        orderId = order.id
      }

      const items = cart.map((c) => ({
        order_id: orderId,
        menu_item_id: c.id,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(items)
      if (itemsError) throw itemsError

      setCart([])
      setTable('')
      setCustomer('')
      setNotes('')
      alert(`Order saved for table ${tableNum}`)
    } catch (err) {
      alert(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4 text-white">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Table number *</label>
          <input
            type="number"
            min="1"
            value={table}
            onChange={(e) => setTable(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-white"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Customer name</label>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-white"
          />
        </div>
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search menu..."
        className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white"
      />

      {loading ? (
        <p className="text-zinc-500">Loading menu...</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {filtered.map((item) => {
            const inCart = cart.find((c) => c.id === item.id)
            return (
              <button
                key={item.id}
                onClick={() => addToCart(item)}
                className={`text-left p-3 rounded-xl border ${
                  inCart ? 'border-white bg-zinc-800' : 'border-zinc-800 bg-zinc-900'
                }`}
              >
                <div className="text-xs text-zinc-400 mb-1">{item.category}</div>
                <div className="font-medium text-sm">{item.name}</div>
                <div className="text-sm mt-1">RWF {Number(item.price).toLocaleString()}</div>
                {inCart && <div className="mt-1 text-xs font-medium">×{inCart.quantity}</div>}
              </button>
            )
          })}
        </div>
      )}

      {cart.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-medium">Current order</h3>
            <span className="text-lg font-semibold">RWF {total.toLocaleString()}</span>
          </div>
          <div className="space-y-2 mb-3">
            {cart.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span>{c.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQty(c.id, -1)} className="w-6 h-6 border border-zinc-700 rounded">−</button>
                  <span>{c.quantity}</span>
                  <button onClick={() => updateQty(c.id, 1)} className="w-6 h-6 border border-zinc-700 rounded">+</button>
                </div>
              </div>
            ))}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Order notes..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm mb-3 text-white"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setCart([])} className="px-4 py-2 rounded-lg border border-zinc-700 text-sm">
              Clear
            </button>
            <button
              onClick={placeOrder}
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Placing...' : 'Place order'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}