import { createClient } from '@supabase/supabase-js';

type UserRole = 'admin' | 'secretaria' | 'visitacao' | 'coordenador' | 'viewer';

interface UserGrupoVinculo {
  grupo_id: string;
  encontro_id: string | null;
}

interface EnrichedUser {
  id: string;
  email: string;
  role?: string;
  temporary_password: boolean;
  created_at: string;
  grupos: UserGrupoVinculo[];
  nome?: string;
  encontrosIds: string[];
  equipesNomes: Record<string, string>;
}

interface PersonSearchItem {
  id: string;
  nome_completo: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  comunidade: string | null;
}

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
// @ts-nocheck
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

    const body = await request.json();
    console.log(`[admin-users] Received request:`, body);
    
    const rawAction = body?.action as string | undefined;
    const action = rawAction?.trim().toLowerCase();

    if (!action) {
      return jsonResponse(400, { error: 'Ação não informada (Missing action)' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });

    // Public actions (No admin check required)
    if (action === 'public-reset') {
      const email = body?.email as string | undefined;
      if (!email) {
        return jsonResponse(400, { error: 'email is required' });
      }

      const { data: profile, error: profileError } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('email', email)
        .maybeSingle();

      if (profileError || !profile) {
        return jsonResponse(404, { error: 'Usuário não encontrado com este e-mail.' });
      }

      const temporaryPassword = profile.email;
      const { error: updateError } = await adminClient.auth.admin.updateUserById(profile.id, {
        password: temporaryPassword
      });

      if (updateError) {
        return jsonResponse(400, { error: updateError.message });
      }

      await adminClient
        .from('profiles')
        .update({ temporary_password: true })
        .eq('id', profile.id);

      return jsonResponse(200, { success: true });
    }

    // Admin protected actions
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse(401, { error: 'Missing authorization header' });
    }

    const jwt = authHeader.replace('Bearer ', '');
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

    if (action === 'list') {
      const page = Math.max(Number(body?.page ?? 0), 0);
      const pageSize = Math.min(Math.max(Number(body?.pageSize ?? 20), 5), 100);
      const search = String(body?.search ?? '').trim().toLowerCase();
      const grupoId = String(body?.grupoId ?? 'all');
      const encontroId = String(body?.encontroId ?? 'all');
      const tempPassword = String(body?.tempPassword ?? 'all');

      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email, role, temporary_password, created_at')
        .order('email', { ascending: true });

      if (error) return jsonResponse(500, { error: 'Failed to list users' });

      const profiles = data ?? [];
      const userIds = profiles.map((u) => u.id);
      const emails = profiles.map((u) => u.email?.toLowerCase()).filter(Boolean);

      const { data: ugData, error: ugError } = await adminClient
        .from('usuario_grupos')
        .select('usuario_id, grupo_id, encontro_id')
        .in('usuario_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      if (ugError) return jsonResponse(500, { error: 'Failed to list user groups' });

      const { data: pessoasData, error: pessoasError } = await adminClient
        .from('pessoas')
        .select('email, nome_completo, participacoes(encontro_id, equipes(nome))')
        .in('email', emails.length > 0 ? emails : ['']);

      if (pessoasError) return jsonResponse(500, { error: 'Failed to list linked people' });

      const ugMap = new Map<string, UserGrupoVinculo[]>();
      for (const ug of ugData || []) {
        if (!ugMap.has(ug.usuario_id)) ugMap.set(ug.usuario_id, []);
        ugMap.get(ug.usuario_id)!.push({ grupo_id: ug.grupo_id, encontro_id: ug.encontro_id });
      }

      const pessoasMap = new Map<string, { nome: string; encontrosIds: string[]; equipesNomes: Record<string, string> }>();
      for (const pessoa of pessoasData || []) {
        if (!pessoa.email) continue;
        const participacoes = (pessoa.participacoes || []) as {
          encontro_id: string;
          equipes: { nome: string }[] | { nome: string } | null;
        }[];
        const equipesNomes: Record<string, string> = {};
        const encontrosIds: string[] = [];

        for (const participacao of participacoes) {
          if (participacao.encontro_id) encontrosIds.push(participacao.encontro_id);
          const equipe = Array.isArray(participacao.equipes) ? participacao.equipes[0] : participacao.equipes;
          if (participacao.encontro_id && equipe?.nome) {
            equipesNomes[participacao.encontro_id] = equipe.nome;
          }
        }

        pessoasMap.set(pessoa.email.toLowerCase(), {
          nome: pessoa.nome_completo,
          encontrosIds,
          equipesNomes,
        });
      }

      const enrichedUsers: EnrichedUser[] = profiles.map((profile) => {
        const pessoaInfo = pessoasMap.get(profile.email.toLowerCase());
        return {
          id: profile.id,
          email: profile.email,
          role: profile.role,
          temporary_password: profile.temporary_password,
          created_at: profile.created_at,
          grupos: ugMap.get(profile.id) || [],
          nome: pessoaInfo?.nome,
          encontrosIds: pessoaInfo?.encontrosIds || [],
          equipesNomes: pessoaInfo?.equipesNomes || {},
        };
      });

      const totalUsers = enrichedUsers.length;
      const totalTemporaryPassword = enrichedUsers.filter((u) => u.temporary_password).length;
      const totalWithoutPerson = enrichedUsers.filter((u) => !u.nome).length;
      const totalWithTargetAccess = body?.targetEncontroId
        ? enrichedUsers.filter((u) => u.grupos.some((g) => g.encontro_id === body.targetEncontroId)).length
        : enrichedUsers.filter((u) => u.grupos.some((g) => g.encontro_id === null)).length;

      const filteredUsers = enrichedUsers.filter((user) => {
        if (grupoId !== 'all' && !user.grupos.some((g) => g.grupo_id === grupoId)) return false;
        if (encontroId !== 'all' && !user.encontrosIds.includes(encontroId)) return false;
        if (tempPassword !== 'all') {
          const wantsTemporary = tempPassword === 'sim';
          if (user.temporary_password !== wantsTemporary) return false;
        }
        if (search) {
          const searchable = [
            user.email,
            user.nome ?? '',
            ...Object.values(user.equipesNomes || {}),
          ].join(' ').toLowerCase();
          if (!searchable.includes(search)) return false;
        }
        return true;
      });

      const total = filteredUsers.length;
      const pageStart = page * pageSize;
      const paginatedUsers = filteredUsers.slice(pageStart, pageStart + pageSize);

      return jsonResponse(200, {
        users: paginatedUsers,
        total,
        page,
        pageSize,
        summary: {
          totalUsers,
          totalTemporaryPassword,
          totalWithoutPerson,
          totalWithTargetAccess,
          filteredTotal: total,
        },
      });
    }

    if (action === 'search-people') {
      const search = String(body?.search ?? '').trim();
      const page = Math.max(Number(body?.page ?? 0), 0);
      const pageSize = Math.min(Math.max(Number(body?.pageSize ?? 20), 5), 50);
      const from = page * pageSize;
      const to = from + pageSize - 1;

      let query = adminClient
        .from('pessoas')
        .select('id, nome_completo, cpf, email, telefone, comunidade')
        .order('nome_completo', { ascending: true })
        .range(from, to);

      if (search) {
        query = query.or(
          `nome_completo.ilike.%${search}%,cpf.ilike.%${search}%,email.ilike.%${search}%,telefone.ilike.%${search}%,comunidade.ilike.%${search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        return jsonResponse(500, { error: 'Failed to search people', details: error.message });
      }

      return jsonResponse(200, { people: (data ?? []) as PersonSearchItem[] });
    }

    if (action === 'create') {
      const email = body?.email as string | undefined;
      const role = body?.role as UserRole | undefined;

      if (!email || !role) {
        return jsonResponse(400, { error: 'email and role are required' });
      }

      const temporaryPassword = email;
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

      const { data: profile, error: fetchError } = await adminClient
        .from('profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (fetchError || !profile?.email) {
        return jsonResponse(404, { error: 'User profile not found' });
      }

      const temporaryPassword = profile.email;
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

    if (action === 'delete') {
      const userId = body?.userId as string | undefined;
      if (!userId) {
        return jsonResponse(400, { error: 'userId is required' });
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        return jsonResponse(400, { error: deleteError.message });
      }

      return jsonResponse(200, { success: true });
    }

    return jsonResponse(400, { error: `Ação não suportada ou não reconhecida: "${action}"` });
  } catch (error) {
    console.error(`[admin-users] Unexpected error:`, error);
    return jsonResponse(500, { error: 'Unexpected error', details: error?.message });
  }
});
