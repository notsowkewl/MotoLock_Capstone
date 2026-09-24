import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const respond = (body: Record<string, unknown>, status = 200) =>
  Response.json(body, { status, headers: corsHeaders })

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405)

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return respond({ error: 'You must be signed in as an administrator.' }, 401)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) return respond({ error: 'Server configuration is incomplete.' }, 500)

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const accessToken = authorization.slice('Bearer '.length)
    const { data: { user: requester }, error: requesterError } = await adminClient.auth.getUser(accessToken)
    if (requesterError || !requester) return respond({ error: 'Your administrator session is invalid.' }, 401)

    const { data: idProfile, error: requesterProfileError } = await adminClient
      .from('users')
      .select('id, role')
      .eq('id', requester.id)
      .maybeSingle()
    if (requesterProfileError) return respond({ error: 'Unable to verify your administrator profile.' }, 500)

    // Some existing admin accounts were linked to Auth by email before the
    // public profile UUID was aligned with auth.users.id. Login accepts that
    // same relationship, so recognize it here as a fallback as well.
    let requesterProfile = idProfile
    if (!requesterProfile && requester.email) {
      const { data: emailProfile, error: emailProfileError } = await adminClient
        .from('users')
        .select('id, role')
        .eq('email', requester.email.toLowerCase())
        .maybeSingle()
      if (emailProfileError) return respond({ error: 'Unable to verify your administrator profile.' }, 500)
      requesterProfile = emailProfile
    }

    if (!['admin', 'superadmin'].includes(requesterProfile?.role)) {
      return respond({ error: 'Only administrators can update accounts.' }, 403)
    }

    const payload = await request.json()
    const userId = typeof payload.userId === 'string' ? payload.userId.trim() : ''
    const fullName = typeof payload.fullName === 'string' ? payload.fullName.trim() : ''
    const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : ''
    const role = payload.role
    if (!userId || !fullName || !email || !['rider', 'admin', 'superadmin'].includes(role)) {
      return respond({ error: 'User, name, email, and a valid role are required.' }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return respond({ error: 'Enter a valid email address.' }, 400)
    }

    const { data: currentProfile, error: currentProfileError } = await adminClient
      .from('users')
      .select('id, name, email, role')
      .eq('id', userId)
      .maybeSingle()
    if (currentProfileError) return respond({ error: currentProfileError.message }, 400)
    if (!currentProfile) return respond({ error: 'This account no longer exists.' }, 404)

    const isSuperadmin = requesterProfile.role === 'superadmin'
    if (!isSuperadmin && (role !== currentProfile.role || currentProfile.role === 'superadmin')) {
      return respond({ error: 'Only a superadmin can change administrator roles.' }, 403)
    }
    if (!isSuperadmin && role === 'superadmin') {
      return respond({ error: 'A superadmin role cannot be assigned here.' }, 403)
    }
    if (!isSuperadmin && userId === requester.id && role !== currentProfile.role) {
      return respond({ error: 'You cannot change your own administrator role.' }, 403)
    }

    const { data: emailOwner, error: emailCheckError } = await adminClient
      .from('users')
      .select('id')
      .eq('email', email)
      .neq('id', userId)
      .maybeSingle()
    if (emailCheckError) return respond({ error: emailCheckError.message }, 400)
    if (emailOwner) return respond({ error: 'Another account already uses this email address.' }, 409)

    const { data: authResult, error: authLookupError } = await adminClient.auth.admin.getUserById(userId)
    const authUser = authResult?.user
    // Reporting and imported rider profiles can exist without an Auth user.
    // Treat Auth's 404 as a profile-only account; other lookup errors still
    // need to stop the update so we don't leave Auth and public data divergent.
    if (authLookupError && authLookupError.status !== 404 && authLookupError.code !== 'user_not_found') {
      return respond({ error: authLookupError.message }, 400)
    }

    // Seeded reporting fixtures may have a public profile without an Auth user.
    // When an Auth user exists, keep its email and name metadata in sync.
    let authWasUpdated = false
    if (authUser) {
      const metadata = authUser.user_metadata || {}
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(userId, {
        email,
        user_metadata: { ...metadata, full_name: fullName, fullName },
      })
      if (authUpdateError) return respond({ error: authUpdateError.message }, 400)
      authWasUpdated = true
    }

    const { data: updatedProfile, error: updateError } = await adminClient
      .from('users')
      .update({ name: fullName, email, role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('id, name, email, role, status, created_at, updated_at')
      .single()
    if (updateError) {
      if (authWasUpdated && authUser) {
        await adminClient.auth.admin.updateUserById(userId, {
          email: authUser.email,
          user_metadata: authUser.user_metadata || {},
        })
      }
      return respond({ error: updateError.message }, 400)
    }

    return respond({ user: updatedProfile })
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : 'Unexpected server error.' }, 500)
  }
})
