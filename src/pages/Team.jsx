import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ROLES = [
  'pending',
  'admin',
  'manager',
  'operations_manager',
  'room_manager',
  'reception',
  'accounts',
  'waiter',
  'kitchen',
  'gatekeeper',
  'cleaner',
]

export default function Team() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) alert(error.message)
    setStaff(data || [])
    setLoading(false)
  }

  async function updateStaff(id, patch) {
    const { error } = await supabase.from('profiles').update(patch).eq('id', id)
    if (error) alert(error.message)
    else load()
  }

  const filtered = staff.filter((s) => {
    if (filter === 'all') return true
    if (filter === 'pending') return s.status === 'pending' || s.role === 'pending'
    if (filter === 'active') return s.status === 'active'
    return true
  })

  return (
    <div className="space-y-4 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Staff accounts</h2>
        <div className="flex gap-2">
          {[
            ['pending', 'Pending'],
            ['active', 'Active'],
            ['all', 'All'],
          ].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filter === k
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-zinc-700 text-zinc-400 hover:border-blue-500 hover:text-blue-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 py-10 text-center">No staff in this filter</p>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => (
            <div key={s.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex flex-wrap gap-4">
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                  {s.photo_url ? (
                    <img src={s.photo_url} alt={s.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-lg">{s.full_name || 'No name'}</div>
                  <div className="text-sm text-zinc-400">{s.email}</div>
                  <div className="text-sm text-zinc-400">Phone: {s.phone || '—'}</div>
                  <div className="text-sm text-zinc-400">
                    Emergency: {s.emergency_name || '—'} ({s.emergency_phone || '—'})
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 capitalize">
                      role: {(s.role || '').replaceAll('_', ' ')}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 capitalize">
                      status: {s.status}
                    </span>
                  </div>
                </div>

                <div className="w-28 h-20 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                  {s.id_card_url ? (
                    <a href={s.id_card_url} target="_blank" rel="noreferrer">
                      <img src={s.id_card_url} alt="ID" className="w-full h-full object-cover" />
                    </a>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-zinc-500">
                      No ID
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-end gap-3">
                <label className="text-xs text-zinc-400">
                  Set role
                  <select
                    className="mt-1 block px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-sm"
                    value={s.role || 'pending'}
                    onChange={(e) => updateStaff(s.id, { role: e.target.value })}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r.replaceAll('_', ' ')}
                      </option>
                    ))}
                  </select>
                </label>

                <button
                  onClick={() =>
                    updateStaff(s.id, {
                      status: 'active',
                      role: s.role === 'pending' ? 'waiter' : s.role,
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
                >
                  Activate
                </button>

                <button
                  onClick={() => updateStaff(s.id, { status: 'disabled' })}
                  className="px-3 py-2 rounded-lg border border-zinc-700 text-sm hover:border-zinc-500"
                >
                  Disable
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}