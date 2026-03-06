import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type UserRole = 'admin' | 'secretaria' | 'visitacao' | 'viewer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function generateTemporaryPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const randomValues = crypto.getRandomValues(new Uint32Array(length));

  return Array.from(randomValues)
    .map((value) => chars[value % chars.length])
    .join('');
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse(500, { error: 'Missing Supabase environment variables' });
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing authorization header' });
    }

    const jwt = authHeader.replace('Bearer ', '');

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    const { data: authUserData, error: authUserError } = await adminClient.auth.getUser(jwt);
    if (authUserError || !authUserData.user) {
      return jsonResponse(401, { error: 'Invalid token' });
    }

    const requesterId = authUserData.user.id;

    const { data: requesterProfile, error: requesterProfileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', requesterId)
      .maybeSingle();

    if (requesterProfileError) {
      return jsonResponse(500, { error: 'Failed to validate requester role' });
    }

    if (!requesterProfile || requesterProfile.role !== 'admin') {
      return jsonResponse(403, { error: 'Admin role required' });
    }

    const body = await request.json();
    const action = body?.action as string | undefined;

    if (!action) {
      return jsonResponse(400, { error: 'Missing action' });
    }

    if (action === 'list') {
      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email, role, temporary_password, created_at')
        .order('email', { ascending: true });

      if (error) return jsonResponse(500, { error: 'Failed to list users' });
      return jsonResponse(200, { users: data ?? [] });
    }

    if (action === 'create') {
      const email = body?.email as string | undefined;
      const role = body?.role as UserRole | undefined;

      if (!email || !role) {
        return jsonResponse(400, { error: 'email and role are required' });
      }

      const temporaryPassword = generateTemporaryPassword();
      const { data: createdUser, error: createUserError } = await adminClient.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true
      });

      if (createUserError || !createdUser.user) {
        return jsonResponse(400, { error: createUserError?.message ?? 'Failed to create user' });
      }

      const { error: upsertError } = await adminClient.from('profiles').upsert({
        id: createdUser.user.id,
        email,
        role,
        temporary_password: true
      });

      if (upsertError) {
        return jsonResponse(500, { error: 'User created but failed to save profile' });
      }

      return jsonResponse(200, {
        user: {
          id: createdUser.user.id,
          email,
          role,
          temporary_password: true,
          created_at: createdUser.user.created_at
        },
        temporaryPassword
      });
    }

    if (action === 'update-role') {
      const userId = body?.userId as string | undefined;
      const role = body?.role as UserRole | undefined;

      if (!userId || !role) {
        return jsonResponse(400, { error: 'userId and role are required' });
      }

      const { error } = await adminClient
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      if (error) return jsonResponse(500, { error: 'Failed to update role' });
      return jsonResponse(200, { success: true });
    }

    if (action === 'reset-password') {
      const userId = body?.userId as string | undefined;
      if (!userId) {
        return jsonResponse(400, { error: 'userId is required' });
      }

      const temporaryPassword = generateTemporaryPassword();
      const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
        password: temporaryPassword
      });

      if (updateError) {
        return jsonResponse(400, { error: updateError.message });
      }

      const { data: updatedProfile, error: profileError } = await adminClient
        .from('profiles')
        .update({ temporary_password: true })
        .eq('id', userId)
        .select('id, email, role, temporary_password, created_at')
        .single();

      if (profileError || !updatedProfile) {
        return jsonResponse(500, { error: 'Password reset but profile update failed' });
      }

      return jsonResponse(200, {
        user: updatedProfile,
        temporaryPassword
      });
    }

    return jsonResponse(400, { error: 'Unsupported action' });
  } catch (error) {
    console.error(error);
    return jsonResponse(500, { error: 'Unexpected error' });
  }
});

