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

interface FolderCoordinatorAccessItem {
  participacao_id: string;
  pessoa_id: string;
  nome_completo: string;
  email: string | null;
  equipe_id: string | null;
  equipe_nome: string | null;
  user_id: string | null;
  possui_usuario: boolean;
  possui_perfil: boolean;
  temporary_password: boolean | null;
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

async function getDirigenciaAccessStatus(adminClient: ReturnType<typeof createClient>, dirigenciaId: string) {
  const { data: dirigencia, error: dirigenciaError } = await adminClient
    .from('dirigencias')
    .select('id, status, indicacoes_finalizadas_em')
    .eq('id', dirigenciaId)
    .maybeSingle();

  if (dirigenciaError || !dirigencia) {
    throw new Error('Dirigência não encontrada.');
  }

  const { data: indicacoes, error: indicacoesError } = await adminClient
    .from('dirigencia_indicacoes')
    .select('indicado_pessoa_id')
    .eq('dirigencia_destino_id', dirigenciaId)
    .eq('status', 'selecionada');

  if (indicacoesError) {
    throw new Error('Não foi possível consultar os integrantes selecionados.');
  }

  const pessoaIds = (indicacoes ?? []).map((indicacao) => indicacao.indicado_pessoa_id);
  const { data: pessoas, error: pessoasError } = pessoaIds.length > 0
    ? await adminClient
        .from('pessoas')
        .select('id, nome_completo, email')
        .in('id', pessoaIds)
        .order('nome_completo')
    : { data: [], error: null };

  if (pessoasError) {
    throw new Error('Não foi possível consultar os dados das pessoas selecionadas.');
  }

  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, email, temporary_password');

  if (profilesError) {
    throw new Error('Não foi possível consultar os acessos existentes.');
  }

  const profilesByEmail = new Map(
    (profiles ?? []).map((profile) => [profile.email.toLowerCase(), profile])
  );

  const acessos = (pessoas ?? []).map((pessoa) => {
    const email = pessoa.email?.trim() || null;
    const profile = email ? profilesByEmail.get(email.toLowerCase()) : null;

    return {
      pessoa_id: pessoa.id,
      nome_completo: pessoa.nome_completo,
      email,
      possui_acesso: !!profile,
      temporary_password: profile?.temporary_password ?? null,
    };
  });

  return {
    dirigencia,
    acessos,
    todos_prontos: acessos.length > 0 && acessos.every((acesso) => acesso.possui_acesso),
    pendentes: acessos.filter((acesso) => !acesso.possui_acesso).length,
    sem_email: acessos.filter((acesso) => !acesso.email).length,
  };
}

async function getFolderCoordinatorsAccessStatus(
  adminClient: ReturnType<typeof createClient>,
  encontroId: string,
  grupoId?: string | null
) {
  const { data: participacoes, error: participacoesError } = await adminClient
    .from('participacoes')
    .select('id, pessoa_id, equipe_id, pessoas(nome_completo, email), equipes(nome)')
    .eq('encontro_id', encontroId)
    .eq('coordenador', true);

  if (participacoesError) {
    throw new Error('Não foi possível consultar os coordenadores do encontro.');
  }

  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, email, temporary_password');

  if (profilesError) {
    throw new Error('Não foi possível consultar os acessos existentes.');
  }

  const profilesByEmail = new Map(
    (profiles ?? []).map((profile) => [profile.email.toLowerCase(), profile])
  );
  const profileIds = (profiles ?? []).map((profile) => profile.id);

  const { data: userGroups, error: userGroupsError } = profileIds.length > 0 && grupoId
    ? await adminClient
        .from('usuario_grupos')
        .select('usuario_id, grupo_id, encontro_id')
        .in('usuario_id', profileIds)
        .eq('grupo_id', grupoId)
        .eq('encontro_id', encontroId)
    : { data: [], error: null };

  if (userGroupsError) {
    throw new Error('Não foi possível consultar os perfis dos coordenadores.');
  }

  const grantedUserIds = new Set((userGroups ?? []).map((userGroup) => userGroup.usuario_id));

  const coordenadores: FolderCoordinatorAccessItem[] = (participacoes ?? []).map((participacao) => {
    const pessoa = Array.isArray(participacao.pessoas) ? participacao.pessoas[0] : participacao.pessoas;
    const equipe = Array.isArray(participacao.equipes) ? participacao.equipes[0] : participacao.equipes;
    const email = pessoa?.email?.trim() || null;
    const profile = email ? profilesByEmail.get(email.toLowerCase()) : null;

    return {
      participacao_id: participacao.id,
      pessoa_id: participacao.pessoa_id,
      nome_completo: pessoa?.nome_completo || 'Pessoa sem nome',
      email,
      equipe_id: participacao.equipe_id,
      equipe_nome: equipe?.nome || null,
      user_id: profile?.id || null,
      possui_usuario: !!profile,
      possui_perfil: !!profile && (!grupoId || grantedUserIds.has(profile.id)),
      temporary_password: profile?.temporary_password ?? null,
    };
  }).sort((a, b) => {
    const equipeCompare = (a.equipe_nome || '').localeCompare(b.equipe_nome || '', 'pt-BR');
    if (equipeCompare !== 0) return equipeCompare;
    return a.nome_completo.localeCompare(b.nome_completo, 'pt-BR');
  });

  return {
    coordenadores,
    total: coordenadores.length,
    semEmail: coordenadores.filter((coordenador) => !coordenador.email).length,
    semUsuario: coordenadores.filter((coordenador) => coordenador.email && !coordenador.possui_usuario).length,
    semPerfil: coordenadores.filter((coordenador) => coordenador.email && (!coordenador.possui_usuario || !coordenador.possui_perfil)).length,
  };
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
    const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') || 'https://ejc-capelinha.vercel.app')
      .replace(/\/+$/, '');
    const passwordRedirectUrl = `${publicAppUrl}/redefinir-senha`;

    if (!supabaseUrl || !serviceRoleKey) {
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

    const { data: requesterIsAdmin, error: requesterProfileError } = await adminClient
      .rpc('is_admin', { check_user: requesterId });

    if (requesterProfileError) {
      return jsonResponse(500, { error: 'Failed to validate requester role' });
    }

    if (!requesterIsAdmin) {
      return jsonResponse(403, { error: 'Admin role required' });
    }

    if (action === 'dirigencia-access-status') {
      const dirigenciaId = body?.dirigenciaId as string | undefined;
      if (!dirigenciaId) {
        return jsonResponse(400, { error: 'dirigenciaId is required' });
      }

      return jsonResponse(200, await getDirigenciaAccessStatus(adminClient, dirigenciaId));
    }

    if (action === 'prepare-dirigencia-accesses') {
      const dirigenciaId = body?.dirigenciaId as string | undefined;
      if (!dirigenciaId) {
        return jsonResponse(400, { error: 'dirigenciaId is required' });
      }

      const status = await getDirigenciaAccessStatus(adminClient, dirigenciaId);
      if (status.dirigencia.status !== 'indicacao' || !status.dirigencia.indicacoes_finalizadas_em) {
        return jsonResponse(400, { error: 'Finalize as indicações antes de preparar os acessos.' });
      }

      const semEmail = status.acessos.filter((acesso) => !acesso.email);
      if (semEmail.length > 0) {
        return jsonResponse(400, {
          error: `Cadastre um e-mail antes de criar os acessos para: ${semEmail.map((item) => item.nome_completo).join(', ')}.`
        });
      }

      const pendentes = status.acessos.filter((acesso) => !acesso.possui_acesso);
      for (const acesso of pendentes) {
        const email = (acesso.email as string).trim().toLowerCase();
        const { data: createdUser, error: createUserError } =
          await adminClient.auth.admin.inviteUserByEmail(email, {
            redirectTo: passwordRedirectUrl,
          });

        if (createUserError || !createdUser.user) {
          return jsonResponse(400, {
            error: `Não foi possível criar o acesso de ${acesso.nome_completo}: ${createUserError?.message ?? 'erro desconhecido'}.`
          });
        }

        const { error: upsertError } = await adminClient.from('profiles').upsert({
          id: createdUser.user.id,
          email,
          role: 'viewer',
          temporary_password: true,
        });

        if (upsertError) {
          return jsonResponse(500, {
            error: `O usuário de ${acesso.nome_completo} foi criado, mas não foi possível salvar o perfil.`
          });
        }
      }

      if (pendentes.length > 0) {
        await adminClient.from('dirigencia_eventos').insert({
          dirigencia_id: dirigenciaId,
          tipo: 'acessos_preparados',
          descricao: `${pendentes.length} acesso(s) da próxima dirigência foram preparados.`,
          executado_por: requesterId,
        });
      }

      return jsonResponse(200, {
        ...(await getDirigenciaAccessStatus(adminClient, dirigenciaId)),
        criados: pendentes.length,
      });
    }

    if (action === 'list-folder-coordinators') {
      const encontroId = body?.encontroId as string | undefined;
      const grupoId = body?.grupoId as string | null | undefined;

      if (!encontroId) {
        return jsonResponse(400, { error: 'encontroId is required' });
      }

      return jsonResponse(200, await getFolderCoordinatorsAccessStatus(adminClient, encontroId, grupoId));
    }

    if (action === 'prepare-folder-coordinators') {
      const encontroId = body?.encontroId as string | undefined;
      const grupoId = body?.grupoId as string | undefined;

      if (!encontroId || !grupoId) {
        return jsonResponse(400, { error: 'encontroId and grupoId are required' });
      }

      const status = await getFolderCoordinatorsAccessStatus(adminClient, encontroId, grupoId);
      const results = [];

      for (const coordenador of status.coordenadores) {
        if (!coordenador.email) {
          results.push({
            ...coordenador,
            created: false,
            granted: false,
            success: false,
            message: 'Cadastre um e-mail para esta pessoa antes de preparar o acesso.',
          });
          continue;
        }

        let userId = coordenador.user_id;
        let created = false;

        if (!userId) {
          const normalizedEmail = coordenador.email.trim().toLowerCase();
          const { data: createdUser, error: createUserError } =
            await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
              redirectTo: passwordRedirectUrl,
            });

          if (createUserError || !createdUser.user) {
            results.push({
              ...coordenador,
              created: false,
              granted: false,
              success: false,
              message: createUserError?.message ?? 'Não foi possível criar o usuário.',
            });
            continue;
          }

          userId = createdUser.user.id;
          created = true;

          const { error: upsertError } = await adminClient.from('profiles').upsert({
            id: userId,
            email: normalizedEmail,
            role: 'viewer',
            temporary_password: true,
          });

          if (upsertError) {
            results.push({
              ...coordenador,
              user_id: userId,
              created,
              granted: false,
              success: false,
              message: 'Usuário criado, mas não foi possível salvar o perfil.',
            });
            continue;
          }
        }

        let granted = false;
        if (!coordenador.possui_perfil || created) {
          const { data: existingGroups, error: existingGroupError } = await adminClient
            .from('usuario_grupos')
            .select('usuario_id')
            .eq('usuario_id', userId)
            .eq('grupo_id', grupoId)
            .eq('encontro_id', encontroId)
            .limit(1);

          if (existingGroupError) {
            results.push({
              ...coordenador,
              user_id: userId,
              created,
              granted: false,
              success: false,
              message: 'Não foi possível validar o perfil atual.',
            });
            continue;
          }

          if (!existingGroups || existingGroups.length === 0) {
            const { error: insertGroupError } = await adminClient
              .from('usuario_grupos')
              .insert([{ usuario_id: userId, grupo_id: grupoId, encontro_id: encontroId }]);

            if (insertGroupError) {
              results.push({
                ...coordenador,
                user_id: userId,
                created,
                granted: false,
                success: false,
                message: 'Não foi possível atribuir o perfil de coordenador.',
              });
              continue;
            }
            granted = true;
          }
        }

        results.push({
          ...coordenador,
          user_id: userId,
          possui_usuario: true,
          possui_perfil: true,
          created,
          granted,
          success: true,
        });
      }

      return jsonResponse(200, {
        results,
        created: results.filter((result) => result.success && result.created).length,
        granted: results.filter((result) => result.success && result.granted).length,
        skipped: results.filter((result) => result.success && !result.created && !result.granted).length,
      });
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
      const rawEmail = body?.email as string | undefined;
      const role = body?.role as UserRole | undefined;

      if (!rawEmail || !role) {
        return jsonResponse(400, { error: 'email and role are required' });
      }

      const email = rawEmail.trim().toLowerCase();
      const { data: createdUser, error: createUserError } =
        await adminClient.auth.admin.inviteUserByEmail(email, {
          redirectTo: passwordRedirectUrl,
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
        invitationSent: true
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
        .select('id, email, role, temporary_password, created_at')
        .eq('id', userId)
        .single();

      if (fetchError || !profile?.email) {
        return jsonResponse(404, { error: 'User profile not found' });
      }

      if (profile.temporary_password) {
        const { error: invalidateError } = await adminClient.auth.admin.updateUserById(userId, {
          password: `${crypto.randomUUID()}-${crypto.randomUUID()}`,
        });

        if (invalidateError) {
          return jsonResponse(400, { error: 'Não foi possível invalidar a senha temporária anterior.' });
        }
      }

      const { error: resetError } = await adminClient.auth.resetPasswordForEmail(profile.email, {
        redirectTo: passwordRedirectUrl,
      });

      if (resetError) {
        return jsonResponse(400, { error: resetError.message });
      }

      return jsonResponse(200, {
        user: profile,
        recoveryEmailSent: true
      });
    }

    if (action === 'secure-pending-passwords') {
      const { data: pendingProfiles, error: pendingError } = await adminClient
        .from('profiles')
        .select('id, email')
        .eq('temporary_password', true)
        .order('created_at');

      if (pendingError) {
        return jsonResponse(500, { error: 'Não foi possível consultar os primeiros acessos pendentes.' });
      }

      let invalidated = 0;
      let recoveryEmailsSent = 0;
      let failed = 0;

      for (const profile of pendingProfiles ?? []) {
        const { error: invalidateError } = await adminClient.auth.admin.updateUserById(profile.id, {
          password: `${crypto.randomUUID()}-${crypto.randomUUID()}`,
        });

        if (invalidateError) {
          failed += 1;
          continue;
        }

        invalidated += 1;
        const { error: recoveryError } = await adminClient.auth.resetPasswordForEmail(profile.email, {
          redirectTo: passwordRedirectUrl,
        });

        if (recoveryError) {
          failed += 1;
          continue;
        }

        recoveryEmailsSent += 1;
      }

      return jsonResponse(200, {
        total: pendingProfiles?.length ?? 0,
        invalidated,
        recoveryEmailsSent,
        failed,
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
