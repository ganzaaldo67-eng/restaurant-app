import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { validateStock, reduceStock } from '../lib/stock'

const MENU_TYPES = {
  restaurant: {
    label: 'Restaurant Menu',
    categories: ['All Items', 'Meals', 'Salads', 'Drinks'],
  },
  bar: {
    label: 'Bar Menu',
    categories: ['All Items', 'Sides', 'Grilled', 'Salads', 'Drinks'],
  },
}

const C = {
  deepGreen: '#0B3D2E',
  cream: '#F8F4EC',
  creamDark: '#EEE8DC',
  muted: '#5C6B63',
  gold: '#E0B12B',
  border: '#E8E2D6',
}

export default function CustomerOrder() {
  const [menu, setMenu] = useState([])
  const [cart, setCart] = useState([])
  const [tableNumber, setTableNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [menuType, setMenuType] = useState(null)
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
    if (item.track_stock && (item.stock_qty ?? 0) <= 0) return

    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id)
      const currentQty = existing ? existing.quantity : 0
      if (item.track_stock && currentQty + 1 > (item.stock_qty ?? 0)) {
        alert(`Only ${item.stock_qty} left of ${item.name}`)
        return prev
      }
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
        .map((c) => {
          if (c.id !== id) return c
          const nextQty = c.quantity + delta
          if (delta > 0 && c.track_stock && nextQty > (c.stock_qty ?? 0)) {
            alert(`Only ${c.stock_qty} left of ${c.name}`)
            return c
          }
          return { ...c, quantity: nextQty }
        })
        .filter((c) => c.quantity > 0)
    )
  }

  const total = cart.reduce((sum, c) => sum + Number(c.price) * c.quantity, 0)
  const itemCount = cart.reduce((sum, c) => sum + c.quantity, 0)
  const currentCategories = menuType ? MENU_TYPES[menuType].categories : []

  const menuTypeItems = menu.filter((m) => {
    if (!menuType) return false
    const cat = (m.category || '').trim()
    if (menuType === 'restaurant') {
      return ['Meals', 'Salads', 'Drinks'].includes(cat)
    }
    return ['Sides', 'Grilled', 'Salads', 'Drinks'].includes(cat)
  })

  const filtered = menuTypeItems.filter((m) => {
    const q = search.toLowerCase()
    const matchSearch =
      m.name.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q) ||
      (m.description || '').toLowerCase().includes(q)
    const matchCategory =
      activeCategory === 'All Items' || m.category === activeCategory
    return matchSearch && matchCategory
  })

  function categoryEmoji(category) {
    const c = (category || '').toLowerCase()
    if (c.includes('drink')) return '☕'
    if (c.includes('salad')) return '🥗'
    if (c.includes('side')) return '🍟'
    if (c.includes('grill')) return '🔥'
    if (c.includes('meal')) return '🍽️'
    return '🍽️'
  }

  function selectMenuType(type) {
    setMenuType(type)
    setActiveCategory('All Items')
    setSearch('')
  }

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
      // Check stock before placing
      const stockCheck = await validateStock(cart)
      if (!stockCheck.ok) {
        alert(stockCheck.message)
        setSubmitting(false)
        return
      }

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

      // Reduce stock after successful order
      await reduceStock(cart, orderId)

      setOrderTotal(newTotal)
      setSuccess(true)
      setCart([])
      setNotes('')
      loadMenu() // refresh stock numbers
    } catch (err) {
      alert('Failed to place order: ' + err.message)
    } finally {
      setSubmitting(false)
      setShowCart(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: C.cream }}>
        <div className="text-center max-w-md bg-white p-8 sm:p-10 rounded-2xl shadow-lg w-full border" style={{ borderColor: C.border }}>
          <div className="text-5xl mb-4" style={{ color: C.deepGreen }}>✓</div>
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: C.deepGreen }}>Order Placed!</h1>
          <p className="mb-2" style={{ color: C.muted }}>
            Your order for Table {tableNumber} has been sent.
          </p>
          <p className="text-lg font-extrabold mb-6" style={{ color: C.deepGreen }}>
            Total: RWF {orderTotal.toLocaleString()}
          </p>
          <button
            onClick={() => setSuccess(false)}
            className="px-8 py-3 rounded-xl font-bold w-full sm:w-auto"
            style={{ backgroundColor: C.gold, color: C.deepGreen }}
          >
            Place another order
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row" style={{ backgroundColor: C.cream }}>
      <div
        className="md:hidden text-white p-4 flex items-center justify-between sticky top-0 z-30"
        style={{ backgroundColor: C.deepGreen }}
      >
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ backgroundColor: C.gold, color: C.deepGreen }}
          >
            🌿
          </div>
          <div className="font-bold">LA VERDURE</div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCart(true)}
            className="relative px-3 py-1.5 rounded-lg text-sm font-bold"
            style={{ backgroundColor: C.gold, color: C.deepGreen }}
          >
            🛒 {itemCount > 0 && <span className="ml-1">{itemCount}</span>}
          </button>
          <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-2xl">
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden text-white p-4 space-y-2" style={{ backgroundColor: '#0A3327' }}>
          <div className="font-medium py-2">🛒 Order Online</div>
          <Link to="/login" className="block py-2" style={{ color: C.gold }} onClick={() => setMobileMenuOpen(false)}>
            👤 Staff Login
          </Link>
        </div>
      )}

      <aside
        className="hidden md:flex w-56 xl:w-64 text-white flex-col shrink-0"
        style={{ backgroundColor: C.deepGreen }}
      >
        <div className="p-5 border-b" style={{ borderColor: '#0A3327' }}>
          <div className="flex items-center gap-2">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold"
              style={{ backgroundColor: C.gold, color: C.deepGreen }}
            >
              🌿
            </div>
            <div>
              <div className="font-bold text-lg leading-tight">LA VERDURE</div>
              <div className="text-xs" style={{ color: C.gold }}>Vacation Resort</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          <div
            className="flex items-center gap-3 px-4 py-3 rounded-lg font-medium"
            style={{ backgroundColor: '#0A3327' }}
          >
            <span>🛒</span> Order Online
          </div>
          <Link
            to="/login"
            className="flex items-center gap-3 px-4 py-3 rounded-lg hover:opacity-90"
            style={{ color: C.gold }}
          >
            <span>👤</span> Staff Login
          </Link>
        </nav>

        <div className="p-4 text-xs border-t" style={{ borderColor: '#0A3327', color: '#7A9A8C' }}>
          © 2025 LA VERDURE<br />Vacation Resort
        </div>
      </aside>

      <div className="flex-1 flex min-w-0">
        <main className="flex-1 overflow-y-auto pb-24 lg:pb-0">
          <div className="relative h-36 sm:h-48" style={{ backgroundColor: C.deepGreen }}>
            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200')] bg-cover bg-center opacity-30"></div>
            <div className="relative h-full flex items-end p-4 sm:p-8">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white">Order Online</h1>
                <p className="mt-1 text-sm sm:text-base" style={{ color: C.gold }}>
                  Select your table and add items
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div
              className="rounded-2xl shadow-sm border p-4 sm:p-5 mb-6 grid sm:grid-cols-2 gap-4"
              style={{ backgroundColor: '#fff', borderColor: C.border }}
            >
              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: C.deepGreen }}>
                  Table number <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full px-4 py-2.5 rounded-xl border-2 font-medium outline-none"
                  style={{ borderColor: C.border, color: C.deepGreen }}
                />
              </div>
              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: C.deepGreen }}>
                  Your name <span className="font-normal" style={{ color: C.muted }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                  className="w-full px-4 py-2.5 rounded-xl border-2 font-medium outline-none"
                  style={{ borderColor: C.border, color: C.deepGreen }}
                />
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-bold mb-3" style={{ color: C.deepGreen }}>Choose menu</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => selectMenuType('restaurant')}
                  className="p-4 rounded-2xl border-2 text-left transition"
                  style={{
                    borderColor: menuType === 'restaurant' ? C.gold : C.border,
                    backgroundColor: menuType === 'restaurant' ? '#FFF8E7' : '#fff',
                  }}
                >
                  <div className="text-2xl mb-1">🍽️</div>
                  <div className="font-extrabold" style={{ color: C.deepGreen }}>Restaurant Menu</div>
                  <div className="text-xs mt-1 font-medium" style={{ color: C.muted }}>Meals, salads & drinks</div>
                </button>

                <button
                  onClick={() => selectMenuType('bar')}
                  className="p-4 rounded-2xl border-2 text-left transition"
                  style={{
                    borderColor: menuType === 'bar' ? C.gold : C.border,
                    backgroundColor: menuType === 'bar' ? '#FFF8E7' : '#fff',
                  }}
                >
                  <div className="text-2xl mb-1">🍹</div>
                  <div className="font-extrabold" style={{ color: C.deepGreen }}>Bar Menu</div>
                  <div className="text-xs mt-1 font-medium" style={{ color: C.muted }}>Sides, grilled, salads & drinks</div>
                </button>
              </div>
            </div>

            {menuType && (
              <>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-medium" style={{ color: C.muted }}>
                    Viewing:{' '}
                    <span className="font-extrabold" style={{ color: C.deepGreen }}>
                      {MENU_TYPES[menuType].label}
                    </span>
                  </div>
                  <button
                    onClick={() => setMenuType(null)}
                    className="text-sm underline font-medium"
                    style={{ color: C.muted }}
                  >
                    Change menu
                  </button>
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: C.muted }}>🔍</span>
                    <input
                      type="search"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search menu..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 font-medium outline-none"
                      style={{ borderColor: C.border, color: C.deepGreen, backgroundColor: '#fff' }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-1">
                  {currentCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-sm font-bold whitespace-nowrap transition border-2"
                      style={
                        activeCategory === cat
                          ? { backgroundColor: C.deepGreen, color: C.cream, borderColor: C.deepGreen }
                          : { backgroundColor: '#fff', color: C.deepGreen, borderColor: C.border }
                      }
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {loading ? (
                  <p className="text-center py-20 font-medium" style={{ color: C.muted }}>Loading menu...</p>
                ) : filtered.length === 0 ? (
                  <p className="text-center py-20 font-medium" style={{ color: C.muted }}>No dishes found in this section</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-5">
                    {filtered.map((item) => {
                      const inCart = cart.find((c) => c.id === item.id)
                      const outOfStock = item.track_stock && (item.stock_qty ?? 0) <= 0
                      const lowStock =
                        item.track_stock &&
                        (item.stock_qty ?? 0) > 0 &&
                        (item.stock_qty ?? 0) <= (item.low_stock_threshold ?? 5)

                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (!outOfStock) addToCart(item)
                          }}
                          className="rounded-2xl overflow-hidden transition border"
                          style={{
                            backgroundColor: C.cream,
                            borderColor: inCart && !outOfStock ? C.gold : C.border,
                            boxShadow: inCart && !outOfStock ? `0 0 0 2px ${C.gold}40` : undefined,
                            opacity: outOfStock ? 0.55 : 1,
                            cursor: outOfStock ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <div className="h-28 sm:h-36 overflow-hidden" style={{ backgroundColor: C.creamDark }}>
                            {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl sm:text-4xl">
                                {categoryEmoji(item.category)}
                              </div>
                            )}
                          </div>

                          <div className="p-3 sm:p-4">
                            <h3
                              className="font-extrabold text-[15px] sm:text-base leading-snug"
                              style={{ color: C.deepGreen }}
                            >
                              {item.name}
                            </h3>

                            <div className="mt-2">
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                style={{ backgroundColor: C.deepGreen, color: C.cream }}
                              >
                                {categoryEmoji(item.category)} {item.category}
                              </span>
                            </div>

                            {item.description && (
                              <p className="text-xs mt-2 line-clamp-2 leading-relaxed" style={{ color: C.muted }}>
                                {item.description}
                              </p>
                            )}

                            <div className="mt-3 flex items-center justify-between gap-2">
                              <span className="font-extrabold text-sm sm:text-base" style={{ color: C.deepGreen }}>
                                RWF {Number(item.price).toLocaleString()}
                              </span>

                              {outOfStock ? (
                                <span className="text-xs font-extrabold text-red-700">Out of stock</span>
                              ) : lowStock ? (
                                <span className="text-xs font-bold text-amber-700">
                                  Only {item.stock_qty} left
                                </span>
                              ) : inCart ? (
                                <span
                                  className="text-xs px-2.5 py-1 rounded-full font-extrabold"
                                  style={{ backgroundColor: C.gold, color: C.deepGreen }}
                                >
                                  ×{inCart.quantity}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {!menuType && (
              <p className="text-center text-sm mt-4 font-medium" style={{ color: C.muted }}>
                Select Restaurant Menu or Bar Menu to view dishes
              </p>
            )}

            <p className="text-center text-xs mt-10 font-medium" style={{ color: C.muted }}>
              All prices are in Rwandan Francs (RWF) and include VAT.
            </p>
          </div>
        </main>

        <aside
          className="hidden lg:flex w-80 xl:w-96 flex-col sticky top-0 h-screen shrink-0"
          style={{ backgroundColor: C.deepGreen, color: C.cream }}
        >
          <div className="p-4 border-b" style={{ borderColor: '#0A3327' }}>
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <span style={{ color: C.gold }}>🛒</span> Your Cart
            </h2>
            <p className="text-sm font-medium" style={{ color: '#7A9A8C' }}>
              {itemCount} item{itemCount !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-3" style={{ color: C.gold }}>🛒</div>
                <p className="font-bold mb-1">Your cart is empty</p>
                <p className="text-sm" style={{ color: '#7A9A8C' }}>
                  Tap dishes to add them to your cart.
                </p>
              </div>
            ) : (
              cart.map((c) => (
                <div key={c.id} className="flex items-start justify-between gap-2 border-b pb-3" style={{ borderColor: '#0A3327' }}>
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm">{c.name}</div>
                    <div className="text-xs font-semibold" style={{ color: C.gold }}>
                      RWF {Number(c.price).toLocaleString()} each
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => updateQty(c.id, -1)}
                      className="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold"
                      style={{ borderColor: C.gold, color: C.gold }}
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-sm font-extrabold">{c.quantity}</span>
                    <button
                      onClick={() => updateQty(c.id, 1)}
                      className="w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold"
                      style={{ borderColor: C.gold, color: C.gold }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="p-4 border-t" style={{ borderColor: '#0A3327' }}>
            <label className="block text-sm font-medium mb-1" style={{ color: '#7A9A8C' }}>
              💬 Special requests (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="E.g. No onions, extra spicy..."
              className="w-full px-3 py-2 rounded-xl text-sm font-medium mb-3 outline-none"
              style={{ backgroundColor: '#0A3327', color: C.cream, border: `1px solid #1A4D3C` }}
            />
            <div className="flex justify-between font-extrabold text-lg mb-3">
              <span>Total</span>
              <span style={{ color: C.gold }}>RWF {total.toLocaleString()}</span>
            </div>
            <button
              onClick={placeOrder}
              disabled={submitting || cart.length === 0}
              className="w-full py-3 rounded-xl font-extrabold disabled:opacity-50"
              style={{ backgroundColor: C.gold, color: C.deepGreen }}
            >
              {submitting ? 'Placing Order...' : '🔒 Place Order'}
            </button>
          </div>
        </aside>
      </div>

      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 p-4 z-20" style={{ backgroundColor: C.deepGreen }}>
          <button
            onClick={() => setShowCart(true)}
            className="w-full py-3 rounded-xl font-extrabold flex items-center justify-between px-4"
            style={{ backgroundColor: C.gold, color: C.deepGreen }}
          >
            <span>View Cart ({itemCount})</span>
            <span>RWF {total.toLocaleString()}</span>
          </button>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div
            className="rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl"
            style={{ backgroundColor: C.deepGreen, color: C.cream }}
          >
            <div className="p-5 border-b flex justify-between items-center sticky top-0" style={{ borderColor: '#0A3327', backgroundColor: C.deepGreen }}>
              <h2 className="text-lg font-extrabold">Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="text-2xl" style={{ color: C.gold }}>×</button>
            </div>
            <div className="p-5 space-y-4">
              {cart.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="font-extrabold">{c.name}</div>
                    <div className="text-sm font-semibold" style={{ color: C.gold }}>
                      RWF {Number(c.price).toLocaleString()} each
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => updateQty(c.id, -1)}
                      className="w-8 h-8 rounded-full border flex items-center justify-center font-bold"
                      style={{ borderColor: C.gold, color: C.gold }}
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-extrabold">{c.quantity}</span>
                    <button
                      onClick={() => updateQty(c.id, 1)}
                      className="w-8 h-8 rounded-full border flex items-center justify-center font-bold"
                      style={{ borderColor: C.gold, color: C.gold }}
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <>
                <div className="px-5">
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Special requests / notes..."
                    className="w-full px-3 py-2 rounded-xl text-sm font-medium outline-none"
                    style={{ backgroundColor: '#0A3327', color: C.cream }}
                  />
                </div>
                <div className="p-5 border-t sticky bottom-0" style={{ borderColor: '#0A3327', backgroundColor: C.deepGreen }}>
                  <div className="flex justify-between text-lg font-extrabold mb-4">
                    <span>Total</span>
                    <span style={{ color: C.gold }}>RWF {total.toLocaleString()}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={submitting}
                    className="w-full py-3 rounded-xl font-extrabold disabled:opacity-50"
                    style={{ backgroundColor: C.gold, color: C.deepGreen }}
                  >
                    {submitting ? 'Placing Order...' : '🔒 Place Order'}
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