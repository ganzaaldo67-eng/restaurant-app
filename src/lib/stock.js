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
    const { data: row } = await supabase
      .from('menu_items')
      .select('stock_qty')
      .eq('id', line.id)
      .single()

    const current = row?.stock_qty ?? 0
    const next = Math.max(0, current - line.quantity)
    await supabase.from('menu_items').update({ stock_qty: next }).eq('id', line.id)
  }
}

export async function restoreStockFromOrderItems(orderItems) {
  if (!orderItems?.length) return

  for (const line of orderItems) {
    if (!line.menu_item_id) continue
    const { data: row } = await supabase
      .from('menu_items')
      .select('stock_qty, track_stock')
      .eq('id', line.menu_item_id)
      .single()

    if (!row?.track_stock) continue
    const next = (row.stock_qty ?? 0) + (line.quantity || 0)
    await supabase
      .from('menu_items')
      .update({ stock_qty: next })
      .eq('id', line.menu_item_id)
  }
}