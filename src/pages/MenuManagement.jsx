import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function MenuManagement() {
  const [menu, setMenu] = useState([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'add' | item
  const [form, setForm] = useState({
    name: '',
    price: '',
    category: '',
    image_url: '',
    description: ''
  })
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    loadMenu()
  }, [])

  async function loadMenu() {
    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .order('category')
      .order('name')
    setMenu(data || [])
    setLoading(false)
  }

  function openAdd() {
    setForm({ name: '', price: '', category: '', image_url: '', description: '' })
    setModal('add')
  }

  function openEdit(item) {
    setForm({
      name: item.name,
      price: item.price,
      category: item.category,
      image_url: item.image_url || '',
      description: item.description || ''
    })
    setModal(item)
  }

  async function uploadImage(file) {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setUploading(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('menu-images')
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('menu-images')
        .getPublicUrl(fileName)

      setForm((prev) => ({ ...prev, image_url: data.publicUrl }))
    } catch (err) {
      console.error(err)
      alert('Upload failed: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    const name = form.name.trim()
    const price = parseFloat(form.price)
    const category = form.category.trim() || 'General'
    const image_url = form.image_url.trim() || null
    const description = form.description.trim() || null

    if (!name || isNaN(price) || price < 0) {
      return alert('Please enter a valid name and price')
    }

    if (modal === 'add') {
      const { error } = await supabase
        .from('menu_items')
        .insert({ name, price, category, image_url, description })
      if (error) return alert(error.message)
    } else {
      const { error } = await supabase
        .from('menu_items')
        .update({ name, price, category, image_url, description })
        .eq('id', modal.id)
      if (error) return alert(error.message)
    }

    setModal(null)
    loadMenu()
  }

  async function remove(id) {
    if (!confirm('Delete this dish?')) return
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) alert(error.message)
    else loadMenu()
  }

  const filtered = menu.filter(
    (m) =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.category.toLowerCase().includes(search.toLowerCase()) ||
      (m.description || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4 text-white">
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search menu..."
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900"
        />
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium"
        >
          + Add dish
        </button>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 text-center py-12">No dishes found</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-xl p-3"
            >
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-zinc-800 shrink-0">
                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🍽️</div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  <span className="bg-zinc-800 px-2 py-0.5 rounded">{item.category}</span>
                </div>
                {item.description && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{item.description}</p>
                )}
              </div>

              <div className="font-medium whitespace-nowrap">
                RWF {Number(item.price).toLocaleString()}
              </div>

              <div className="flex gap-3">
                <button onClick={() => openEdit(item)} className="text-sm text-zinc-400 hover:text-white">
                  Edit
                </button>
                <button onClick={() => remove(item.id)} className="text-sm text-red-400 hover:text-red-300">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-xl w-full max-w-md p-5 border border-zinc-800 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold mb-4">
              {modal === 'add' ? 'Add dish' : 'Edit dish'}
            </h2>

            <div className="space-y-3">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Price (RWF)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Category</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="Main Course, Drinks..."
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  placeholder="Short description of the dish..."
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm"
                />
              </div>

              {/* Image upload */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Dish image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => uploadImage(e.target.files?.[0])}
                  className="w-full text-sm text-zinc-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-green-700 file:text-white"
                />
                {uploading && <p className="text-xs text-green-400 mt-1">Uploading...</p>}
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Or paste image URL</label>
                <input
                  value={form.image_url}
                  onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-sm"
                />
              </div>

              {form.image_url && (
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Preview:</p>
                  <img
                    src={form.image_url}
                    alt="Preview"
                    className="w-full h-40 object-cover rounded-lg border border-zinc-700"
                    onError={(e) => { e.target.style.display = 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, image_url: '' })}
                    className="text-xs text-red-400 mt-2"
                  >
                    Remove image
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-2 mt-5 justify-end">
              <button
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-lg border border-zinc-700 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={save}
                disabled={uploading}
                className="px-4 py-2 rounded-lg bg-white text-black text-sm font-medium disabled:opacity-50"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}