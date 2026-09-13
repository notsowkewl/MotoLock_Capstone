import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return Response.json({ error: 'You must be signed in as an administrator.' }, { status: 401, headers: corsHeaders })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const accessToken = authorization.replace('Bearer ', '')
    const { data: { user: requester }, error: requesterError } = await adminClient.auth.getUser(accessToken)
    if (requesterError || !requester) {
      return Response.json({ error: 'Your administrator session is invalid.' }, { status: 401, headers: corsHeaders })
    }

    const { data: requesterProfile, error: profileError } = await adminClient
      .from('users')
      .select('role')
      .eq('email', requester.email)
      .single()

    if (profileError || !['admin', 'superadmin'].includes(requesterProfile?.role)) {
      return Response.json({ error: 'Only administrators can create rider accounts.' }, { status: 403, headers: corsHeaders })
    }

    const { fullName, email, password, role = 'rider' } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!fullName?.trim() || !normalizedEmail || !password) {
      return Response.json({ error: 'Full name, email, and password are required.' }, { status: 400, headers: corsHeaders })
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters long.' }, { status: 400, headers: corsHeaders })
    }

    if (role === 'admin' && requesterProfile.role !== 'superadmin') {
      return Response.json({ error: 'Only a superadmin can create an administrator account.' }, { status: 403, headers: corsHeaders })
    }

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: false,
      user_metadata: { fullName: fullName.trim() },
    })

    if (authError || !authData.user) {
      return Response.json({ error: authError?.message || 'Unable to create the login account.' }, { status: 400, headers: corsHeaders })
    }

    const { data: riderProfile, error: insertError } = await adminClient
      .from('users')
      .insert({
        id: authData.user.id,
        name: fullName.trim(),
        email: normalizedEmail,
        password_hash: 'supabase-auth-managed',
        role,
      })
      .select()
      .single()

    if (insertError) {
      await adminClient.auth.admin.deleteUser(authData.user.id)
      return Response.json({ error: insertError.message }, { status: 400, headers: corsHeaders })
    }

    return Response.json({ user: riderProfile }, { status: 201, headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return Response.json({ error: message }, { status: 500, headers: corsHeaders })
  }
})
