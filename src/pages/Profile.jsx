import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, profile } = useAuth()
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    emergency_name: '',
    emergency_phone: '',
    photo_url: '',
    id_card_url: '',
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        emergency_name: profile.emergency_name || '',
        emergency_phone: profile.emergency_phone || '',
        photo_url: profile.photo_url || '',
        id_card_url: profile.id_card_url || '',
      })
    }
  }, [profile])

  async function uploadFile(bucket, file, prefix) {
    if (!file || !user) return null
    if (!file.type.startsWith('image/')) {
      alert('Please select an image')
      return null
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB')
      return null
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/${prefix}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from(bucket).getPublicUrl(path)
      return data.publicUrl
    } catch (err) {
      alert(err.message)
      return null
    } finally {
      setUploading(false)
    }
  }

  async function onPhoto(e) {
    const file = e.target.files?.[0]
    const url = await uploadFile('staff-photos', file, 'face')
    if (url) setForm((f) => ({ ...f, photo_url: url }))
  }

  async function onId(e) {
    const file = e.target.files?.[0]
    const url = await uploadFile('staff-ids', file, 'id')
    if (url) setForm((f) => ({ ...f, id_card_url: url }))
  }

  async function save(e) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          emergency_name: form.emergency_name.trim(),
          emergency_phone: form.emergency_phone.trim(),
          photo_url: form.photo_url || null,
          id_card_url: form.id_card_url || null,
        })
        .eq('id', user.id)

      if (error) throw error
      alert('Profile saved. Refresh if the sidebar name does not update yet.')
    } catch (err) {
      alert(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg space-y-4 text-white">
      <h2 className="text-xl font-bold">My Profile</h2>
      <p className="text-sm text-zinc-400">
        Update your details, face photo, and ID card.
      </p>

      <form onSubmit={save} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-4">
        <div className="flex gap-4 items-center">
          <div className="w-20 h-20 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
            {form.photo_url ? (
              <img src={form.photo_url} alt="Face" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>
            )}
          </div>
          <div className="text-sm text-zinc-400">
            <div>{profile?.email}</div>
            <div className="capitalize mt-1">{(profile?.role || '').replaceAll('_', ' ')}</div>
          </div>
        </div>

        <label className="block text-sm">
          Full name
          <input
            className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </label>

        <label className="block text-sm">
          Phone
          <input
            className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-sm">
            Emergency name
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
              value={form.emergency_name}
              onChange={(e) => setForm({ ...form, emergency_name: e.target.value })}
            />
          </label>
          <label className="block text-sm">
            Emergency phone
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
              value={form.emergency_phone}
              onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })}
            />
          </label>
        </div>

        <label className="block text-sm">
          Face photo
          <input type="file" accept="image/*" capture="user" className="mt-1 w-full text-sm" onChange={onPhoto} />
        </label>

        <label className="block text-sm">
          ID card
          <input type="file" accept="image/*" capture="environment" className="mt-1 w-full text-sm" onChange={onId} />
          {form.id_card_url && (
            <img src={form.id_card_url} alt="ID" className="mt-2 h-28 w-full object-cover rounded-lg border border-zinc-700" />
          )}
        </label>

        {uploading && <p className="text-xs text-blue-400">Uploading...</p>}

        <button
          type="submit"
          disabled={saving || uploading}
          className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save profile'}
        </button>
      </form>
    </div>
  )
}