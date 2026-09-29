import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      .select('id, role, status')
      .eq('id', userId)
      .single()
    if (targetError || !target) return Response.json({ error: 'Rider profile was not found.' }, { status: 404, headers: corsHeaders })
    if (target.role === 'admin' || target.role === 'superadmin') {
      return Response.json({ error: 'Administrator accounts cannot be deleted from this screen.' }, { status: 403, headers: corsHeaders })
    }

    // Purge rider-owned rows, including the motorcycle and dependent history,
    // atomically so a database failure cannot leave a partial deletion.
    const { error: dataDeleteError } = await adminClient.rpc('admin_delete_rider_data', { target_user_id: userId })
    if (dataDeleteError) {
      return Response.json({ error: `Could not delete the rider and linked data: ${dataDeleteError.message}` }, { status: 400, headers: corsHeaders })
    }

    const { error: authDeleteError } = await adminClient.auth.admin.deleteUser(userId)
    if (authDeleteError) {
      return Response.json({ error: `Rider profile and linked data were deleted, but the Auth account could not be deleted: ${authDeleteError.message}` }, { status: 500, headers: corsHeaders })
    }

    return Response.json({ success: true }, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected server error.'
    return Response.json({ error: message }, { status: 500, headers: corsHeaders })
  }
})
