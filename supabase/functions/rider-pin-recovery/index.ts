import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { processPinRecovery } from '../_shared/pin-recovery.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: corsHeaders })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON request.' }, { status: 400, headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return Response.json({ error: 'PIN recovery is not configured.' }, { status: 503, headers: corsHeaders })
  }

  const recoveryClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const result = await processPinRecovery(payload, {
    allowAttempt: async (email, action) => {
      const emailHash = await hashEmail(email)
      const { data, error } = await adminClient.rpc('allow_rider_pin_recovery_attempt', {
        email_hash: emailHash,
        attempt_kind: action,
      })
      if (error) throw error
      return data === true
    },
    sendRecoveryCode: async (email) => {
      const { error } = await recoveryClient.auth.resetPasswordForEmail(email)
      if (error) throw error
    },
    verifyRecoveryCode: async (email, code) => {
      const { data, error } = await recoveryClient.auth.verifyOtp({ email, token: code, type: 'recovery' })
      if (error || !data.user) throw new Error('Recovery verification failed.')
      const { data: profileId, error: profileError } = await recoveryClient.rpc('motolock_reader_profile_id')
      if (profileError || typeof profileId !== 'string') throw new Error('Rider profile was not found.')
      return profileId
    },
    replacePin: async (profileId, pin) => {
      const { error } = await adminClient.rpc('admin_reset_rider_security_pin', {
        target_user_id: profileId,
        new_pin: pin,
      })
      if (error) throw error
    },
  })

  return Response.json(result.body, { status: result.status, headers: corsHeaders })
})

async function hashEmail(email: string): Promise<string> {
  const bytes = new TextEncoder().encode(email)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
