import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['All Items', 'Rwandan Dishes', 'Main Course', 'Sides', 'Drinks']

export default function CustomerOrder() {
  const [menu, setMenu] = useState([])
  const [cart, setCart] = useState([])
  const [tableNumber, setTableNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('All Items')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showCart, setShowCart] = useState(false)
  const [orderTotal, setOrderTotal] = useState(0)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    loadMenu()
  }, [])

  async function loadMenu() {
    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category')
      .order('name')

    if (error) {
      console.error(error)
      alert('Error loading menu: ' + error.message)
    } else {
      setMenu(data || [])
    }
    setLoading(false)
  }

  function addToCart(item) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      if (existing) {
        return prev.map((c) =>
          c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
        )
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

  const total = cart.reduce((sum, c) => sum + Number(c.price) * c.quantity, 0)
  const itemCount = cart.reduce((sum, c) => sum + c.quantity, 0)

  const filtered = menu.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase())
    const matchCategory =
      activeCategory === 'All Items' || m.category === activeCategory
    return matchSearch && matchCategory
  })

  async function placeOrder() {
    const table = parseInt(tableNumber)
    if (!table || table < 1) {
      alert('Please enter a valid table number')
      return
    }
    if (cart.length === 0) {
      alert('Add some items first')
      return
    }

    setSubmitting(true)
    try {
      const { data: existingOrders, error: findError } = await supabase
        .from('orders')
        .select('id, total, notes')
        .eq('table_number', table)
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
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            table_number: table,
            customer_name: customerName.trim() || 'Guest',
            notes: notes.trim() || null,
            total,
            status: 'pending',
            source: 'customer',
          })
          .select()
          .single()

        if (orderError) throw orderError
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

      setOrderTotal(newTotal)
      setSuccess(true)
      setCart([])
      setNotes('')
    } catch (err) {
      alert('Failed to place order: ' + err.message)
    } finally {
      setSubmitting(false)
      setShowCart(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 p-4">
        <div className="text-center max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-lg w-full">
          <div className="text-5xl mb-4 text-green-600">✓</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Order Placed!</h1>
          <p className="text-gray-600 mb-2">
            Your order for Table {tableNumber} has been sent.
          </p>
          <p className="text-lg font-semibold text-green-700 mb-6">
            Total: RWF {orderTotal.toLocaleString()}
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="px-8 py-3 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 w-full sm:w-auto"
          >
            Place another order
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-50">
      {/* Mobile top bar */}
      <div className="md:hidden bg-green-950 text-white p-4 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-sm">🌿</div>
          <div className="font-bold">LA VERDURE</div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowCart(true)} className="relative px-3 py-1.5 rounded-lg bg-green-800 text-sm">
            🛒 {itemCount > 0 && <span className="ml-1">{itemCount}</span>}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-2xl">
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-green-900 text-white p-4 space-y-2">
          <div className="font-medium py-2">🛒 Order Online</div>
          <Link to="/login" className="block py-2 text-green-200" onClick={() => setMobileMenuOpen(false)}>
            👤 Staff Login
          </Link>
        </div>
      )}

      {/* Desktop left sidebar */}
      <aside className="hidden md:flex w-56 xl:w-64 bg-green-950 text-white flex-col shrink-0">
        <div className="p-5 border-b border-green-900">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-green-700 flex items-center justify-center text-xl">🌿</div>
            <div>
              <div className="font-bold text-lg leading-tight">LA VERDURE</div>
              <div className="text-xs text-green-300">Vacation Resort</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-800 font-medium">
            <span>🛒</span> Order Online
          </div>
          <Link to="/login" className="flex items-center gap-3 px-4 py-3 rounded-lg text-green-200 hover:bg-green-900">
            <span>👤</span> Staff Login
          </Link>
        </nav>

        <div className="p-4 text-xs text-green-400 border-t border-green-900">
          © 2025 LA VERDURE<br />Vacation Resort
        </div>
      </aside>

      {/* MENU + DESKTOP CART */}
      <div className="flex-1 flex min-w-0">
        {/* MENU AREA */}
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          <div className="relative h-36 sm:h-48 bg-gradient-to-r from-green-900/80 to-green-700/60">
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200')] bg-cover bg-center opacity-40"></div>
            <div className="relative h-full flex items-end p-4 sm:p-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white">Order Online</h1>
                <p className="text-green-100 mt-1 text-sm sm:text-base">Select your table and add items</p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-6 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Table number <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Your name <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search menu..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-500 outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-1">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                    activeCategory === cat
                      ? 'bg-green-700 text-white'
                      : 'bg-white border border-gray-200 text-gray-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {loading ? (
              <p className="text-center text-gray-500 py-20">Loading menu...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-gray-500 py-20">No dishes found</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
                {filtered.map((item) => {
                  const inCart = cart.find((c) => c.id === item.id)
                  return (
                    <div
                      key={item.id}
                      onClick={() => addToCart(item)}
                      className={`bg-white rounded-xl border overflow-hidden cursor-pointer transition hover:shadow-md ${
                        inCart ? 'border-green-600 ring-2 ring-green-100' : 'border-gray-100'
                      }`}
                    >
                      <div className="h-28 sm:h-36 bg-gray-100 overflow-hidden">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl bg-gradient-to-br from-green-100 to-amber-50">
                            {item.category === 'Drinks' ? '🥤' : item.category === 'Rwandan Dishes' ? '🍲' : '🍽️'}
                          </div>
                        )}
                      </div>
                      <div className="p-3 sm:p-4">
                        <h3 className="font-semibold text-gray-800 text-sm sm:text-base leading-tight">{item.name}</h3>
                        <p className="text-xs text-gray-500 mt-1 hidden sm:block">{item.category}</p>
                        <div className="mt-2 sm:mt-3 flex items-center justify-between">
                          <span className="font-bold text-green-700 text-sm sm:text-base">
                            RWF {Number(item.price).toLocaleString()}
                          </span>
                          {inCart && (
                            <span className="bg-green-700 text-white text-xs px-2 py-0.5 rounded-full">
                              ×{inCart.quantity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <p className="text-center text-xs text-gray-400 mt-10">
              All prices are in Rwandan Francs (RWF) and include VAT.
            </p>
          </div>
        </main>

        {/* DESKTOP CART - always visible, no scroll needed */}
        <aside className="hidden lg:flex w-80 xl:w-96 border-l border-gray-200 bg-white flex-col sticky top-0 h-screen shrink-0">
          <div className="p-4 border-b">
            <h2 className="text-lg font-bold text-gray-800">Your Cart</h2>
            <p className="text-sm text-gray-500">
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <p className="text-gray-400 text-sm text-center py-10">
                Cart is empty.<br />Tap dishes to add.
              </p>
            ) : (
              cart.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 border-b border-gray-100 pb-3">
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-800">{c.name}</div>
                    <div className="text-xs text-gray-500">
                      RWF {Number(c.price).toLocaleString()} each
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQty(c.id, -1)}
                      className="w-7 h-7 rounded-full border flex items-center justify-center text-sm hover:bg-gray-50"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-medium">{c.quantity}</span>
                    <button
                      onClick={() => updateQty(c.id, 1)}
                      className="w-7 h-7 rounded-full border flex items-center justify-center text-sm hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t bg-white">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Special requests..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-3"
            />
            <div className="flex justify-between font-bold text-lg mb-3">
              <span>Total</span>
              <span className="text-green-700">RWF {total.toLocaleString()}</span>
            </div>
            <button
              onClick={placeOrder}
              disabled={submitting || cart.length === 0}
              className="w-full py-3 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 disabled:opacity-50"
            >
              {submitting ? 'Placing Order...' : 'Place Order'}
            </button>
          </div>
        </aside>
      </div>

      {/* MOBILE bottom cart bar */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t p-4 z-20">
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-3 rounded-lg bg-green-700 text-white font-medium flex items-center justify-between px-4"
          >
            <span>View Cart ({itemCount})</span>
            <span>RWF {total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {/* MOBILE cart modal */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="p-5 border-b flex justify-between items-center sticky top-0 bg-white">
              <h2 className="text-lg font-bold">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="text-2xl text-gray-400">×</button>
            </div>

            <div className="p-5 space-y-4">
              {cart.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Cart is empty</p>
              ) : (
                cart.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3">
                    <div className="flex-1">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-sm text-gray-500">
                        RWF {Number(c.price).toLocaleString()} each
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(c.id, -1)} className="w-8 h-8 rounded-full border flex items-center justify inter">−</button>
                      <span className="w-6 text-center font-medium">{c.quantity}</span>
                      <button onClick={() => updateQty(c.id, 1)} className="w-8 h-8 rounded-full border flex items-center justify-center">+</button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <>
                <div className="px-5">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Special requests / notes..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>

                <div className="p-5 border-t sticky bottom-0 bg-white">
                  <div className="flex justify-between text-lg font-bold mb-4">
                    <span>Total</span>
                    <span className="text-green-700">RWF {total.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={submitting}
                    className="w-full py-3 rounded-lg bg-green-700 text-white font-medium hover:bg-green-800 disabled:opacity-50"
                  >
                    {submitting ? 'Placing Order...' : 'Place Order'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}