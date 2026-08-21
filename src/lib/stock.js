import { supabase } from './supabase'

export async function validateStock(cart) {
  const tracked = cart.filter((c) => c.track_stock)
  if (tracked.length === 0) return { ok: true }

  const ids = tracked.map((c) => c.id)
  const { data, error } = await supabase
    .from('menu_items')
    .select('id, name, stock_qty, track_stock')
    .in('id', ids)

  if (error) return { ok: false, message: error.message }

  for (const line of tracked) {
    const row = data.find((d) => d.id === line.id)
    if (!row || !row.track_stock) continue
    const left = row.stock_qty ?? 0
    if (left < line.quantity) {
      return {
        ok: false,
        message:
          left <= 0
            ? `${row.name} is out of stock`
            : `Only ${left} left of ${row.name}`,
      }
    }
  }
  return { ok: true }
}

export async function reduceStock(cart) {
  for (const line of cart) {
    if (!line.track_stock) continue

    const { data: row, error } = await supabase
      .from('menu_items')
      .select('stock_qty')
      .eq('id', line.id)
      .single()

    if (error) {
      console.error('reduceStock read error', error)
      continue
    }

    const current = row?.stock_qty ?? 0
    const next = Math.max(0, current - Number(line.quantity || 0))

    const { error: upErr } = await supabase
      .from('menu_items')
      .update({ stock_qty: next })
      .eq('id', line.id)

    if (upErr) console.error('reduceStock update error', upErr)
  }
}

export async function restoreStockFromOrderItems(orderItems) {
  if (!orderItems?.length) return { ok: true, restored: 0 }

  let restored = 0

  for (const line of orderItems) {
    let row = null

    // 1) Prefer menu_item_id
    if (line.menu_item_id) {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, stock_qty, track_stock, name')
        .eq('id', line.menu_item_id)
        .maybeSingle()

      if (error) console.error('restore by id error', error)
      row = data
    }

    // 2) Fallback: match by item name
    if (!row && line.name) {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, stock_qty, track_stock, name')
        .eq('name', line.name)
        .maybeSingle()

      if (error) console.error('restore by name error', error)
      row = data
    }

    if (!row) continue
    if (!row.track_stock) continue

    const qty = Number(line.quantity || 0)
    if (qty <= 0) continue

    const next = (row.stock_qty ?? 0) + qty

    const { error: upErr } = await supabase
      .from('menu_items')
      .update({ stock_qty: next })
      .eq('id', row.id)

    if (upErr) {
      console.error('restore update error', upErr)
      return { ok: false, message: upErr.message, restored }
    }

    restored += 1
  }

  return { ok: true, restored }
}