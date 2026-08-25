import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// ========== CHANGE THESE VALUES ==========
const TABLE = 'orders'               // ← put your real table name here
const DATE_COLUMN = 'created_at'     // ← column that has the date
const RETENTION_DAYS = 90            // keep last 90 days in the database
const ARCHIVE_DIR = 'archives'
// ========================================

async function main() {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
  const cutoffISO = cutoff.toISOString()

  console.log(`Archiving rows from ${TABLE} older than ${cutoffISO}`)

  let allRows = []
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .lt(DATE_COLUMN, cutoffISO)
      .range(from, from + pageSize - 1)

    if (error) {
      console.error('Error fetching data:', error)
      process.exit(1)
    }

    if (!data || data.length === 0) break

    allRows = allRows.concat(data)
    from += pageSize

    if (data.length < pageSize) break
  }

  if (allRows.length === 0) {
    console.log('No rows to archive. Exiting.')
    return
  }

  console.log(`Found ${allRows.length} rows to archive`)

  if (!fs.existsSync(ARCHIVE_DIR)) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true })
  }

  const timestamp = new Date().toISOString().slice(0, 10)
  const filename = path.join(ARCHIVE_DIR, `${TABLE}-${timestamp}.json`)

  fs.writeFileSync(filename, JSON.stringify(allRows, null, 2))
  console.log(`Wrote archive → ${filename}`)

  const { error: deleteError } = await supabase
    .from(TABLE)
    .delete()
    .lt(DATE_COLUMN, cutoffISO)

  if (deleteError) {
    console.error('Error deleting rows:', deleteError)
    process.exit(1)
  }

  console.log(`Successfully deleted ${allRows.length} rows from ${TABLE}`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
