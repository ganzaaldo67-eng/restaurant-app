import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Stock() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [filter, setFilter] = useState('tracked') // tracked | all | low | out

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
    setLoading(false)
  }

  async function updateItem(id, patch) {
    setSavingId(id)
    const { error } = await supabase.from('menu_items').update(patch).eq('id', id)
    if (error) alert(error.message)
    else {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)))
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
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                filter === key
                  ? 'bg-white text-black border-white'
                  : 'border-zinc-700 text-zinc-400'
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
                        if (v !== qty) updateItem(item.id, { stock_qty: v })
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
                        if (v !== threshold) updateItem(item.id, { low_stock_threshold: v })
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
    </div>
  )
}