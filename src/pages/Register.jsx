import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    password: '',
    emergency_name: '',
    emergency_phone: '',
  })
  const [idCard, setIdCard] = useState(null)
  const [photo, setPhoto] = useState(null)
  const [idPreview, setIdPreview] = useState('')
  const [photoPreview, setPhotoPreview] = useState('')
  const [loading, setLoading] = useState(false)

  function onFile(e, type) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB')
      return
    }
    const url = URL.createObjectURL(file)
    if (type === 'id') {
      setIdCard(file)
      setIdPreview(url)
    } else {
      setPhoto(file)
      setPhotoPreview(url)
    }
  }

  async function uploadFile(bucket, userId, file, prefix) {
    const ext = file.name.split('.').pop() || 'jpg'
    const path = `${userId}/${prefix}-${Date.now()}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    // private bucket: store path; for viewing use signed URL later
    return data?.publicUrl || path
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const {
      full_name, phone, email, password, emergency_name, emergency_phone,
    } = form

    if (!full_name.trim() || !phone.trim() || !email.trim() || !password) {
      alert('Please fill name, phone, email and password')
      return
    }
    if (password.length < 6) {
      alert('Password must be at least 6 characters')
      return
    }
    if (!idCard || !photo) {
      alert('Please upload ID card and face photo')
      return
    }
    if (!emergency_name.trim() || !emergency_phone.trim()) {
      alert('Please fill emergency contact')
      return
    }

    setLoading(true)
    try {
      // 1) Create auth user
      const { data: signData, error: signError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (signError) throw signError
      const user = signData.user
      if (!user) throw new Error('Signup failed. Check email confirmation settings.')

      // 2) Upload images (must be logged in)
      const id_card_url = await uploadFile('staff-ids', user.id, idCard, 'id')
      const photo_url = await uploadFile('staff-photos', user.id, photo, 'face')

      // 3) Save profile
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: user.id,
        email: email.trim(),
        full_name: full_name.trim(),
        phone: phone.trim(),
        emergency_name: emergency_name.trim(),
        emergency_phone: emergency_phone.trim(),
        id_card_url,
        photo_url,
        role: 'pending',
        status: 'pending',
      })
      if (profileError) throw profileError

      alert('Account created. Wait for admin/manager to approve and set your role.')
      await supabase.auth.signOut()
      navigate('/login')
    } catch (err) {
      alert(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4"
      >
        <div>
          <h1 className="text-2xl font-bold">Staff Registration</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Create your account. Admin will set your role after review.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm block">
            Full name *
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </label>
          <label className="text-sm block">
            Telephone *
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </label>
        </div>

        <label className="text-sm block">
          Email * (used to login)
          <input
            type="email"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>

        <label className="text-sm block">
          Password *
          <input
            type="password"
            className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm block">
            Emergency contact name *
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
              value={form.emergency_name}
              onChange={(e) => setForm({ ...form, emergency_name: e.target.value })}
            />
          </label>
          <label className="text-sm block">
            Emergency phone *
            <input
              className="mt-1 w-full px-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700"
              value={form.emergency_phone}
              onChange={(e) => setForm({ ...form, emergency_phone: e.target.value })}
            />
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm block">
            ID card (upload / camera) *
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="mt-1 w-full text-sm"
              onChange={(e) => onFile(e, 'id')}
            />
            {idPreview && (
              <img src={idPreview} alt="ID preview" className="mt-2 h-28 w-full object-cover rounded-lg border border-zinc-700" />
            )}
          </label>

          <label className="text-sm block">
            Face photo *
            <input
              type="file"
              accept="image/*"
              capture="user"
              className="mt-1 w-full text-sm"
              onChange={(e) => onFile(e, 'photo')}
            />
            {photoPreview && (
              <img src={photoPreview} alt="Face preview" className="mt-2 h-28 w-full object-cover rounded-lg border border-zinc-700" />
            )}
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold disabled:opacity-50 transition"
        >
          {loading ? 'Creating account...' : 'Create staff account'}
        </button>

        <p className="text-center text-sm text-zinc-400">
          Already registered? <Link to="/login" className="text-emerald-400 underline">Login</Link>
        </p>
      </form>
    </div>
  )
}