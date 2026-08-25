import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Stock() {
  const [items, setItems] = useState([])
  const [movements, setMovements] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [filter, setFilter] = useState('tracked')
  const [movementSearch, setMovementSearch] = useState('')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)

    const { data, error } = await supabase
      .from('menu_items')
      .select('*')
      .order('category')
      .order('name')

    if (error) alert(error.message)
    setItems(data || [])

    // movements + staff name from profiles
    const { data: moves } = await supabase
      .from('stock_movements')
      .select('*, profiles:created_by (full_name, email)')
      .order('created_at', { ascending: false })
      .limit(50)

    setMovements(moves || [])
    setLoading(false)
  }

  async function logManualChange(item, oldQty, newQty) {
    const diff = newQty - oldQty
    if (diff === 0) return

    try {
      const { data: userData } = await supabase.auth.getUser()
      await supabase.from('stock_movements').insert({
        menu_item_id: item.id,
        item_name: item.name,
        change_qty: diff,
        reason: 'manual',
        created_by: userData?.user?.id || null,
        note: `Manual adjust ${oldQty} → ${newQty}`,
      })
    } catch (e) {
      console.error('manual log error', e)
    }
  }

  async function updateItem(id, patch, itemForLog = null, oldQty = null) {
    setSavingId(id)
    const { error } = await supabase.from('menu_items').update(patch).eq('id', id)
    if (error) {
      alert(error.message)
      setSavingId(null)
      return
    }

    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))

    // log manual stock qty change
    if (
      itemForLog &&
      patch.stock_qty !== undefined &&
      oldQty !== null &&
      Number(patch.stock_qty) !== Number(oldQty)
    ) {
      await logManualChange(itemForLog, Number(oldQty), Number(patch.stock_qty))
      // refresh movements
      const { data: moves } = await supabase
        .from('stock_movements')
        .select('*, profiles:created_by (full_name, email)')
        .order('created_at', { ascending: false })
        .limit(50)
      setMovements(moves || [])
    }

    setSavingId(null)
  }

  const filtered = items.filter((i) => {
    if (filter === 'tracked') return i.track_stock
    if (filter === 'low') {
      return i.track_stock && i.stock_qty > 0 && i.stock_qty <= (i.low_stock_threshold ?? 5)
    }
    if (filter === 'out') return i.track_stock && i.stock_qty <= 0
    return true
  })

  const filteredMovements = movements.filter((m) => {
    const q = movementSearch.trim().toLowerCase()
    if (!q) return true
    return (m.item_name || '').toLowerCase().includes(q)
  })

  function staffLabel(m) {
    const p = m.profiles
    if (!p) return 'System / customer'
    return p.full_name || p.email || 'Staff'
  }

  return (
    <div className="space-y-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Stock / Inventory</h2>
        <div className="flex flex-wrap gap-2">
          {[
            ['tracked', 'Tracked'],
            ['low', 'Low stock'],
            ['out', 'Out of stock'],
            ['all', 'All items'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filter === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-zinc-700 text-zinc-400 hover:border-blue-500 hover:text-blue-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-zinc-400">
        Only tracked items reduce stock when ordered. Set quantity and your own warning level.
      </p>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 py-10 text-center">No items in this filter</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => {
            const threshold = item.low_stock_threshold ?? 5
            const qty = item.stock_qty ?? 0
            const isOut = item.track_stock && qty <= 0
            const isLow = item.track_stock && qty > 0 && qty <= threshold

            return (
              <div
                key={item.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 grid lg:grid-cols-[1fr_auto] gap-4"
              >
                <div>
                  <div className="font-semibold">{item.name}</div>
                  <div className="text-xs text-zinc-500 mt-1">{item.category}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.track_stock ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/40 text-emerald-300">
                        Tracking ON
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400">
                        Not tracked
                      </span>
                    )}
                    {isOut && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-900/40 text-red-300">
                        Out of stock
                      </span>
                    )}
                    {isLow && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300">
                        Low stock
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <label className="text-xs text-zinc-400">
                    Track
                    <div className="mt-1">
                      <input
                        type="checkbox"
                        checked={!!item.track_stock}
                        onChange={(e) =>
                          updateItem(item.id, { track_stock: e.target.checked })
                        }
                      />
                    </div>
                  </label>

                  <label className="text-xs text-zinc-400">
                    Stock qty
                    <input
                      type="number"
                      min="0"
                      defaultValue={qty}
                      key={`qty-${item.id}-${qty}`}
                      onBlur={(e) => {
                        const v = Math.max(0, parseInt(e.target.value) || 0)
                        if (v !== qty) {
                          updateItem(item.id, { stock_qty: v }, item, qty)
                        }
                      }}
                      className="mt-1 block w-24 px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white text-sm"
                    />
                  </label>

                  <label className="text-xs text-zinc-400">
                    Warn below
                    <input
                      type="number"
                      min="0"
                      defaultValue={threshold}
                      key={`th-${item.id}-${threshold}`}
                      onBlur={(e) => {
                        const v = Math.max(0, parseInt(e.target.value) || 0)
                        if (v !== threshold) {
                          updateItem(item.id, { low_stock_threshold: v })
                        }
                      }}
                      className="mt-1 block w-24 px-2 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-white text-sm"
                    />
                  </label>

                  {savingId === item.id && (
                    <span className="text-xs text-zinc-500">Saving...</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* History */}
      <div className="mt-8 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-bold">Recent stock movements</h3>
          <input
            type="search"
            value={movementSearch}
            onChange={(e) => setMovementSearch(e.target.value)}
            placeholder="Filter by item name..."
            className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-sm w-full sm:w-64"
          />
        </div>

        {filteredMovements.length === 0 ? (
          <p className="text-zinc-500 text-sm">No movements found.</p>
        ) : (
          <div className="space-y-2">
            {filteredMovements.map((m) => (
              <div
                key={m.id}
                className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <div>
                  <span className="font-medium">{m.item_name || 'Item'}</span>
                  <span className="text-zinc-500 ml-2 capitalize">{m.reason}</span>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    by {staffLabel(m)}
                    {m.note ? ` · ${m.note}` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={
                      m.change_qty < 0
                        ? 'text-red-400 font-medium'
                        : 'text-emerald-400 font-medium'
                    }
                  >
                    {m.change_qty > 0 ? '+' : ''}
                    {m.change_qty}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {new Date(m.created_at).toLocaleString()}
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