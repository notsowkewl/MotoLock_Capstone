import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authorization = request.headers.get('Authorization')
    if (!authorization?.startsWith('Bearer ')) {
      return Response.json({ error: 'You must be signed in as an administrator.' }, { status: 401, headers: corsHeaders })
    }

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const accessToken = authorization.replace('Bearer ', '')
    const { data: { user: requester }, error: requesterError } = await adminClient.auth.getUser(accessToken)
    if (requesterError || !requester) {
      return Response.json({ error: 'Your administrator session is invalid.' }, { status: 401, headers: corsHeaders })
    }

    const { data: requesterProfile } = await adminClient
      .from('users')
      .select('role')
      .eq('email', requester.email)
      .single()
    if (!['admin', 'superadmin'].includes(requesterProfile?.role)) {
      return Response.json({ error: 'Only administrators can delete rider accounts.' }, { status: 403, headers: corsHeaders })
    }

    const { userId } = await request.json()
    if (!userId) return Response.json({ error: 'A user ID is required.' }, { status: 400, headers: corsHeaders })

    const { data: target, error: targetError } = await adminClient
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .single()
    if (targetError || !target) return Response.json({ error: 'Rider profile was not found.' }, { status: 404, headers: corsHeaders })
    if (target.role === 'admin' || target.role === 'superadmin') {
      return Response.json({ error: 'Administrator accounts cannot be deleted from this screen.' }, { status: 403, headers: corsHeaders })
    }

    // The profile is removed first because this project links its public users
    // table to auth.users. Existing foreign-key rules handle linked rider data.
    const { error: profileDeleteError } = await adminClient.from('users').delete().eq('id', userId)
    if (profileDeleteError) return Response.json({ error: profileDeleteError.message }, { status: 400, headers: corsHeaders })

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      return Response.json({ error: `Profile deleted, but the Auth account could not be deleted: ${authDeleteError.message}` }, { status: 500, headers: corsHeaders })
    }

    return Response.json({ success: true }, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return Response.json({ error: message }, { status: 500, headers: corsHeaders })
  }
})
