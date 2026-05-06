import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminKey = secretKey || serviceRoleKey

  if (!url || !adminKey) {
    throw new Error(
      'Missing Supabase credentials. Set SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  return createClient<Database>(url, adminKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
