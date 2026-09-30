import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const respond = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders })

const selectColumns: Record<string, string> = {
  // Descriptor values are used only to compute enrollment flags; never return the biometric data.
  users: 'id, name, email, role, status, face_descriptor, helmet_descriptor, created_at, updated_at',
  devices: '*',
  motorcycles: '*',
  ride_history: '*',
  emergency_contacts: '*',
  audit_logs: '*',
  system_settings: '*',
}

const allowedSettings = new Set([
  'org_name', 'org_tagline', 'org_address', 'org_timezone', 'org_language',
  'maintenance_mode', 'allow_registrations', 'auto_log_cleanup', 'session_timeout',
  'failed_sobriety_alert', 'override_event_alert', 'critical_alert_escalation',
  'alcohol_threshold', 'date_format', 'time_format', 'auto_sync_time',
  'password_policy', 'two_factor_auth', 'login_attempt_limit', 'lockout_duration',
  'lockout_limit', 'scan_interval', 'bluetooth_timeout', 'auto_reconnect',
])

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) return respond({ error: 'Sign in as an administrator.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return respond({ error: 'Server configuration is incomplete.' }, 500)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const accessToken = authorization.slice('Bearer '.length)
    const { data: { user: requester }, error: authError } = await adminClient.auth.getUser(accessToken)
    if (authError || !requester) return respond({ error: 'Your session is invalid.' }, 401)

    let { data: profile, error: profileError } = await adminClient
      .from('users').select('id, name, email, role')
      .eq('id', requester.id).maybeSingle()
    if (!profile && !profileError && requester.email) {
      const result = await adminClient.from('users').select('id, name, email, role')
        .ilike('email', requester.email).maybeSingle()
      profile = result.data
      profileError = result.error
    }
    if (profileError) return respond({ error: 'Unable to verify administrator access.' }, 500)
    if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
      return respond({ error: 'Only administrators can access this data.' }, 403)
    }

    const payload = await request.json()
    const action = payload?.action

    if (action === 'profile') {
      return respond({ profile })
    }

    if (action === 'select') {
      const table = typeof payload.table === 'string' ? payload.table : ''
      const columns = selectColumns[table]
      if (!columns || table === 'pins') return respond({ error: 'This table is not available to the admin dashboard.' }, 400)
      const pageSize = 1000
      const offset = Number.isSafeInteger(payload.offset) && payload.offset >= 0 ? payload.offset : 0
      const orderBy = typeof payload.orderBy === 'string' && /^[a-z][a-z0-9_]*$/i.test(payload.orderBy)
        ? payload.orderBy
        : 'id'
      const { data, error } = await adminClient.from(table).select(columns)
        .order(orderBy, { ascending: true }).range(offset, offset + pageSize - 1)
      if (error) return respond({ error: error.message }, 400)
      const rows = (data || []).map((row: Record<string, unknown>) => {
        if (table !== 'users') return row
        const { face_descriptor, helmet_descriptor, ...safeProfile } = row
        return {
          ...safeProfile,
          face_enrolled: face_descriptor !== null && face_descriptor !== undefined,
          helmet_enrolled: helmet_descriptor !== null && helmet_descriptor !== undefined,
        }
      })
      return respond({ rows, hasMore: rows.length === pageSize })
    }

    if (action === 'insert-audit') {
      const actionType = typeof payload.action_type === 'string' ? payload.action_type.trim() : ''
      if (!actionType || actionType.length > 120) return respond({ error: 'A valid audit action is required.' }, 400)
      const actionDetails = payload.action_details && typeof payload.action_details === 'object' && !Array.isArray(payload.action_details)
        ? payload.action_details
        : {}
      const { data, error } = await adminClient.from('audit_logs').insert({
        user_id: profile.id,
        action_type: actionType,
        action_details: actionDetails,
        created_at: new Date().toISOString(),
      }).select('id, user_id, action_type, action_details, created_at').single()
      if (error) return respond({ error: error.message }, 400)
      return respond({ row: data })
    }

    if (action === 'save-setting') {
      const key = typeof payload.setting_key === 'string' ? payload.setting_key.trim() : ''
      if (!allowedSettings.has(key)) return respond({ error: 'This setting cannot be changed from the admin dashboard.' }, 400)
      if (!['admin', 'superadmin'].includes(profile.role)) return respond({ error: 'Only administrators can change settings.' }, 403)
      const value = typeof payload.setting_value === 'string' ? payload.setting_value : String(payload.setting_value ?? '')
      const { error } = await adminClient.from('system_settings').upsert({
        setting_key: key,
        setting_value: value,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'setting_key' })
      if (error) return respond({ error: error.message }, 400)
      return respond({ success: true })
    }

    return respond({ error: 'Unknown admin data action.' }, 400)
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500)
  }
})
