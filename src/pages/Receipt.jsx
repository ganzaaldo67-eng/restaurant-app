import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Receipt() {
  const { id } = useParams()
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [id])

  async function load() {
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .single()

    if (error) alert(error.message)
    setOrder(data)
    setLoading(false)
  }

  if (loading) return <div className="text-zinc-500 p-6">Loading receipt...</div>
  if (!order) return <div className="text-zinc-500 p-6">Order not found</div>

  const items = order.order_items || []
  const subtotal = Number(order.total) || 0
  const tip = Number(order.tip) || 0
  const grand = subtotal + tip
  const paid = Number(order.paid_amount) || 0

  return (
    <div className="max-w-md mx-auto text-white">
      <div className="flex gap-2 mb-4 print:hidden">
        <Link to="/staff/history" className="text-sm text-zinc-400 underline">
          ← Back
        </Link>
        <button
          onClick={() => window.print()}
          className="ml-auto px-3 py-1.5 rounded-lg bg-blue-600 text-sm font-medium"
        >
          Print
        </button>
      </div>

      <div className="bg-white text-black rounded-xl p-6 print:rounded-none">
        <div className="text-center mb-4">
          <div className="text-xl font-bold">LA VERDURE</div>
          <div className="text-sm text-gray-600">Order receipt</div>
        </div>

        <div className="text-sm space-y-1 mb-4">
          <div>Table: <strong>{order.table_number}</strong></div>
          <div>Customer: {order.customer_name || 'Guest'}</div>
          <div>{new Date(order.created_at).toLocaleString()}</div>
          <div className="capitalize">Status: {order.status}</div>
        </div>

        <div className="border-t border-b border-dashed border-gray-300 py-3 space-y-1 text-sm">
          {items.map((it) => (
            <div key={it.id} className="flex justify-between gap-2">
              <span>
                {it.quantity}× {it.name}
              </span>
              <span>RWF {(Number(it.price) * it.quantity).toLocaleString()}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>RWF {subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Tip</span>
            <span>RWF {tip.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-1">
            <span>Total</span>
            <span>RWF {grand.toLocaleString()}</span>
          </div>
          {paid > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Paid</span>
              <span>RWF {paid.toLocaleString()}</span>
            </div>
          )}
        </div>

        {order.notes && (
          <p className="text-xs text-gray-500 mt-4">Note: {order.notes}</p>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">Thank you</p>
      </div>
    </div>
  )
}