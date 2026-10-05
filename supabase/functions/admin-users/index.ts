import { createClient } from '@supabase/supabase-js';
import {
  hasAccessInContext,
  matchesContextMembershipFilters,
  matchesPersonLinkScope,
  matchesUserSearch,
  type AdminUserAccessScope,
  type AdminUserPersonLinkScope,
} from './listFilters.ts';

type UserRole = 'admin' | 'secretaria' | 'visitacao' | 'coordenador' | 'viewer';

interface UserGrupoVinculo {
  grupo_id: string;
  encontro_id: string | null;
}

interface EnrichedUser {
  id: string;
  email: string;
  pessoaId: string | null;
  pessoaVinculo: 'explicit' | 'email_fallback' | 'none';
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

interface ConfiguredAccessCandidate {
  participacao_id: string;
  pessoa_id: string;
  nome_completo: string;
  email: string | null;
  equipe_id: string;
  equipe_nome: string;
  papel: 'coordenador' | 'integrante';
  grupo_ids: string[];
  grupos_nomes: string[];
  user_id: string | null;
  pessoa_vinculada: boolean;
  grupos_pendentes_ids: string[];
  status: 'sem_email' | 'sem_usuario' | 'sem_vinculo' | 'perfis_pendentes' | 'pronto' | 'conflito_vinculo';
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
    .select('id, email, pessoa_id, temporary_password');

  if (profilesError) {
    throw new Error('Não foi possível consultar os acessos existentes.');
  }

  const profileIndex = indexProfilesByIdentity(profiles ?? []);

  const acessos = (pessoas ?? []).map((pessoa) => {
    const email = pessoa.email?.trim() || null;
    const profile = profileIndex.find(pessoa.id, email);

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

function normalizeEmail(email: string | null | undefined) {
  return email?.trim().toLowerCase() || '';
}

function indexProfilesByIdentity(profiles: Array<{ id: string; email: string; pessoa_id?: string | null }>) {
  const byPersonId = new Map<string, (typeof profiles)[number]>();
  const unlinkedByEmail = new Map<string, Array<(typeof profiles)[number]>>();

  for (const profile of profiles) {
    if (profile.pessoa_id) {
      byPersonId.set(profile.pessoa_id, profile);
      continue;
    }
    const email = normalizeEmail(profile.email);
    if (!email) continue;
    const candidates = unlinkedByEmail.get(email) || [];
    candidates.push(profile);
    unlinkedByEmail.set(email, candidates);
  }

  return {
    find(personId: string, email: string | null | undefined) {
      const explicit = byPersonId.get(personId);
      if (explicit) return explicit;
      const candidates = unlinkedByEmail.get(normalizeEmail(email)) || [];
      return candidates.length === 1 ? candidates[0] : null;
    },
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
    .select('id, email, pessoa_id, temporary_password');

  if (profilesError) {
    throw new Error('Não foi possível consultar os acessos existentes.');
  }

  const profileIndex = indexProfilesByIdentity(profiles ?? []);
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
    const profile = profileIndex.find(participacao.pessoa_id, email);

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

async function getConfiguredAccessCandidates(
  adminClient: ReturnType<typeof createClient>,
  encontroId: string,
): Promise<ConfiguredAccessCandidate[]> {
  const { data: rules, error: rulesError } = await adminClient
    .from('equipe_acesso_regras')
    .select('equipe_id, papel, grupo_id, grupos(nome)')
    .eq('encontro_id', encontroId);

  if (rulesError) throw new Error('Não foi possível consultar a configuração de acessos.');
  if (!rules || rules.length === 0) return [];

  const equipeIds = [...new Set(rules.map((rule) => rule.equipe_id))];
  const { data: participacoes, error: participacoesError } = await adminClient
    .from('participacoes')
    .select('id, pessoa_id, equipe_id, coordenador, pessoas(nome_completo, email), equipes(nome)')
    .eq('encontro_id', encontroId)
    .in('equipe_id', equipeIds);

  if (participacoesError) throw new Error('Não foi possível consultar as pessoas elegíveis.');

  const { data: profiles, error: profilesError } = await adminClient
    .from('profiles')
    .select('id, email, pessoa_id');

  if (profilesError) throw new Error('Não foi possível consultar as contas existentes.');

  const profileIndex = indexProfilesByIdentity(profiles ?? []);
  const profilesByEmail = new Map<string, Array<(typeof profiles)[number]>>();
  for (const profile of profiles ?? []) {
    const email = normalizeEmail(profile.email);
    if (!email) continue;
    const matches = profilesByEmail.get(email) ?? [];
    matches.push(profile);
    profilesByEmail.set(email, matches);
  }

  const profileIds = (profiles ?? []).map((profile) => profile.id);
  const { data: memberships, error: membershipsError } = profileIds.length > 0
    ? await adminClient
        .from('usuario_grupos')
        .select('usuario_id, grupo_id')
        .eq('encontro_id', encontroId)
        .in('usuario_id', profileIds)
    : { data: [], error: null };

  if (membershipsError) throw new Error('Não foi possível consultar os perfis já concedidos.');

  const membershipsByUser = new Map<string, Set<string>>();
  for (const membership of memberships ?? []) {
    const current = membershipsByUser.get(membership.usuario_id) ?? new Set<string>();
    current.add(membership.grupo_id);
    membershipsByUser.set(membership.usuario_id, current);
  }

  const rulesByTeamAndRole = new Map<string, Array<{ grupo_id: string; grupo_nome: string }>>();
  for (const rule of rules) {
    const key = `${rule.equipe_id}:${rule.papel}`;
    const group = Array.isArray(rule.grupos) ? rule.grupos[0] : rule.grupos;
    const current = rulesByTeamAndRole.get(key) ?? [];
    if (!current.some((item) => item.grupo_id === rule.grupo_id)) {
      current.push({ grupo_id: rule.grupo_id, grupo_nome: group?.nome ?? 'Perfil sem nome' });
    }
    rulesByTeamAndRole.set(key, current);
  }

  const candidates: ConfiguredAccessCandidate[] = [];
  for (const participation of participacoes ?? []) {
    const papel = participation.coordenador ? 'coordenador' : 'integrante';
    const configuredGroups = rulesByTeamAndRole.get(`${participation.equipe_id}:${papel}`) ?? [];
    if (configuredGroups.length === 0) continue;

    const person = Array.isArray(participation.pessoas) ? participation.pessoas[0] : participation.pessoas;
    const team = Array.isArray(participation.equipes) ? participation.equipes[0] : participation.equipes;
    const email = person?.email?.trim() || null;
    let profile = profileIndex.find(participation.pessoa_id, email);
    let hasIdentityConflict = false;

    if (!profile && email) {
      const emailProfiles = profilesByEmail.get(normalizeEmail(email)) ?? [];
      if (emailProfiles.length === 1) {
        profile = emailProfiles[0];
        hasIdentityConflict = Boolean(profile.pessoa_id && profile.pessoa_id !== participation.pessoa_id);
      }
    }

    const grantedGroups = profile ? membershipsByUser.get(profile.id) ?? new Set<string>() : new Set<string>();
    const grupoIds = configuredGroups.map((group) => group.grupo_id);
    const pendingGroupIds = grupoIds.filter((groupId) => !grantedGroups.has(groupId));
    const pessoaVinculada = profile?.pessoa_id === participation.pessoa_id;

    let status: ConfiguredAccessCandidate['status'];
    if (!email) status = 'sem_email';
    else if (hasIdentityConflict) status = 'conflito_vinculo';
    else if (!profile) status = 'sem_usuario';
    else if (!pessoaVinculada) status = 'sem_vinculo';
    else if (pendingGroupIds.length > 0) status = 'perfis_pendentes';
    else status = 'pronto';

    candidates.push({
      participacao_id: participation.id,
      pessoa_id: participation.pessoa_id,
      nome_completo: person?.nome_completo ?? 'Pessoa sem nome',
      email,
      equipe_id: participation.equipe_id,
      equipe_nome: team?.nome ?? 'Equipe não informada',
      papel,
      grupo_ids: grupoIds,
      grupos_nomes: configuredGroups.map((group) => group.grupo_nome),
      user_id: profile?.id ?? null,
      pessoa_vinculada: pessoaVinculada,
      grupos_pendentes_ids: pendingGroupIds,
      status,
    });
  }

  return candidates.sort((first, second) => {
    const teamComparison = first.equipe_nome.localeCompare(second.equipe_nome, 'pt-BR');
    if (teamComparison !== 0) return teamComparison;
    if (first.papel !== second.papel) return first.papel === 'coordenador' ? -1 : 1;
    return first.nome_completo.localeCompare(second.nome_completo, 'pt-BR');
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
    const publicAppUrl = (Deno.env.get('PUBLIC_APP_URL') || 'https://www.ejccapelinha.com.br')
      .replace(/\/+$/, '');
    const passwordRedirectUrl = `${publicAppUrl}/redefinir-senha`;

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Missing Supabase environment variables' });
    }

    const body = await request.json();
    
    const rawAction = body?.action as string | undefined;
    const action = rawAction?.trim().toLowerCase();

    if (!action) {
      return jsonResponse(400, { error: 'Ação não informada (Missing action)' });
    }

    console.log(`[admin-users] Received action: ${action}`);

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
          pessoa_id: acesso.pessoa_id,
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

    if (action === 'list-configured-access-candidates') {
      const encontroId = String(body?.encontroId ?? '').trim();
      if (!encontroId) return jsonResponse(400, { error: 'encontroId is required' });

      const candidates = await getConfiguredAccessCandidates(adminClient, encontroId);
      return jsonResponse(200, { candidates, total: candidates.length });
    }

    if (action === 'prepare-configured-accesses') {
      const encontroId = String(body?.encontroId ?? '').trim();
      const participacaoIds = Array.isArray(body?.participacaoIds)
        ? [...new Set(body.participacaoIds.map((id: unknown) => String(id)))]
        : [];

      if (!encontroId || participacaoIds.length === 0) {
        return jsonResponse(400, { error: 'Selecione ao menos uma pessoa para liberar os acessos.' });
      }

      const candidates = await getConfiguredAccessCandidates(adminClient, encontroId);
      const selectedCandidates = candidates.filter((candidate) => participacaoIds.includes(candidate.participacao_id));
      if (selectedCandidates.length !== participacaoIds.length) {
        return jsonResponse(400, { error: 'A seleção contém uma pessoa que não corresponde mais à configuração de acessos.' });
      }

      const results = [];
      for (const candidate of selectedCandidates) {
        if (!candidate.email) {
          results.push({
            ...candidate,
            success: false,
            created: false,
            linked: false,
            granted: 0,
            message: 'Cadastre um e-mail para esta pessoa antes de liberar o acesso.',
          });
          continue;
        }
        if (candidate.status === 'conflito_vinculo') {
          results.push({
            ...candidate,
            success: false,
            created: false,
            linked: false,
            granted: 0,
            message: 'O e-mail pertence a uma conta vinculada a outra pessoa.',
          });
          continue;
        }

        let userId = candidate.user_id;
        let created = false;
        let linked = candidate.pessoa_vinculada;

        if (!userId) {
          const email = normalizeEmail(candidate.email);
          const { data: createdUser, error: createUserError } =
            await adminClient.auth.admin.inviteUserByEmail(email, { redirectTo: passwordRedirectUrl });

          if (createUserError || !createdUser.user) {
            results.push({
              ...candidate,
              success: false,
              created: false,
              linked: false,
              granted: 0,
              message: createUserError?.message ?? 'Não foi possível criar a conta.',
            });
            continue;
          }

          userId = createdUser.user.id;
          created = true;
          const { error: profileError } = await adminClient.from('profiles').upsert({
            id: userId,
            email,
            pessoa_id: candidate.pessoa_id,
            role: 'viewer',
            temporary_password: true,
          });

          if (profileError) {
            results.push({
              ...candidate,
              user_id: userId,
              success: false,
              created,
              linked: false,
              granted: 0,
              message: 'A conta foi criada, mas não foi possível vinculá-la à pessoa.',
            });
            continue;
          }
          linked = true;
        } else if (!linked) {
          const { data: linkedProfile, error: linkError } = await adminClient
            .from('profiles')
            .update({ pessoa_id: candidate.pessoa_id })
            .eq('id', userId)
            .is('pessoa_id', null)
            .select('id')
            .maybeSingle();

          if (linkError || !linkedProfile) {
            results.push({
              ...candidate,
              success: false,
              created,
              linked: false,
              granted: 0,
              message: 'Não foi possível vincular a conta à pessoa.',
            });
            continue;
          }
          const { error: auditError } = await adminClient.from('profile_pessoa_vinculo_auditoria').insert({
            profile_id: userId,
            pessoa_id_anterior: null,
            pessoa_id_novo: candidate.pessoa_id,
            alterado_por: requesterId,
          });
          if (auditError) {
            results.push({
              ...candidate,
              success: false,
              created,
              linked: true,
              granted: 0,
              message: 'A conta foi vinculada, mas a auditoria falhou. Revise antes de conceder os perfis.',
            });
            continue;
          }
          linked = true;
        }

        let granted = 0;
        if (candidate.grupos_pendentes_ids.length > 0) {
          const payload = candidate.grupos_pendentes_ids.map((grupoId) => ({
            usuario_id: userId,
            grupo_id: grupoId,
            encontro_id: encontroId,
          }));
          const { error: grantError } = await adminClient.from('usuario_grupos').insert(payload);
          if (grantError) {
            results.push({
              ...candidate,
              success: false,
              created,
              linked,
              granted: 0,
              message: 'A conta foi preparada, mas não foi possível conceder todos os perfis.',
            });
            continue;
          }
          granted = payload.length;
        }

        results.push({
          ...candidate,
          user_id: userId,
          success: true,
          created,
          linked,
          granted,
        });
      }

      return jsonResponse(200, { results });
    }

    if (action === 'update-person-email') {
      const pessoaId = String(body?.pessoaId ?? '').trim();
      const email = normalizeEmail(body?.email);

      if (!pessoaId || !email) {
        return jsonResponse(400, { error: 'Pessoa e e-mail são obrigatórios.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return jsonResponse(400, { error: 'Informe um e-mail válido.' });
      }

      const { data: selectedPerson, error: selectedPersonError } = await adminClient
        .from('pessoas')
        .select('id, nome_completo')
        .eq('id', pessoaId)
        .maybeSingle();

      if (selectedPersonError || !selectedPerson) {
        return jsonResponse(404, { error: 'Pessoa não encontrada.' });
      }

      const [{ data: peopleWithEmail, error: peopleError }, { data: profilesWithEmail, error: profilesError }] = await Promise.all([
        adminClient.from('pessoas').select('id, email').not('email', 'is', null),
        adminClient.from('profiles').select('id, email, pessoa_id').not('email', 'is', null),
      ]);

      if (peopleError || profilesError) {
        return jsonResponse(500, { error: 'Não foi possível validar o e-mail informado.' });
      }

      const conflictingPerson = (peopleWithEmail ?? []).find(
        (person) => person.id !== pessoaId && normalizeEmail(person.email) === email,
      );
      if (conflictingPerson) {
        return jsonResponse(409, { error: 'Este e-mail já está cadastrado para outra pessoa.' });
      }

      const conflictingProfile = (profilesWithEmail ?? []).find(
        (profile) => normalizeEmail(profile.email) === email
          && profile.pessoa_id
          && profile.pessoa_id !== pessoaId,
      );
      if (conflictingProfile) {
        return jsonResponse(409, { error: 'Este e-mail já pertence a uma conta vinculada a outra pessoa.' });
      }

      const { data: updatedPerson, error: updateError } = await adminClient
        .from('pessoas')
        .update({ email })
        .eq('id', pessoaId)
        .select('id, nome_completo, email')
        .single();

      if (updateError) {
        return jsonResponse(500, { error: 'Não foi possível salvar o e-mail.' });
      }

      return jsonResponse(200, { person: updatedPerson });
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
            pessoa_id: coordenador.pessoa_id,
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
      const targetEncontroId = body?.targetEncontroId ? String(body.targetEncontroId) : null;
      // Mantém clientes antigos compatíveis; a interface atual envia explicitamente "with".
      const requestedAccessScope = String(body?.accessScope ?? 'all');
      const accessScope: AdminUserAccessScope = ['with', 'without', 'all'].includes(requestedAccessScope)
        ? requestedAccessScope as AdminUserAccessScope
        : 'all';
      const requestedPersonLinkScope = String(body?.personLinkScope ?? 'all');
      const personLinkScope: AdminUserPersonLinkScope = ['linked', 'unlinked', 'all'].includes(requestedPersonLinkScope)
        ? requestedPersonLinkScope as AdminUserPersonLinkScope
        : 'all';

      const { data, error } = await adminClient
        .from('profiles')
        .select('id, email, pessoa_id, role, temporary_password, created_at')
        .order('email', { ascending: true });

      if (error) return jsonResponse(500, { error: 'Failed to list users' });

      const profiles = data ?? [];
      const userIds = profiles.map((u) => u.id);

      const { data: ugData, error: ugError } = await adminClient
        .from('usuario_grupos')
        .select('usuario_id, grupo_id, encontro_id')
        .in('usuario_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      if (ugError) return jsonResponse(500, { error: 'Failed to list user groups' });

      const { data: pessoasData, error: pessoasError } = await adminClient
        .from('pessoas')
        .select('id, email, nome_completo, participacoes(encontro_id, equipes(nome))');

      if (pessoasError) return jsonResponse(500, { error: 'Failed to list linked people' });

      const ugMap = new Map<string, UserGrupoVinculo[]>();
      for (const ug of ugData || []) {
        if (!ugMap.has(ug.usuario_id)) ugMap.set(ug.usuario_id, []);
        ugMap.get(ug.usuario_id)!.push({ grupo_id: ug.grupo_id, encontro_id: ug.encontro_id });
      }

      type PersonInfo = { id: string; nome: string; encontrosIds: string[]; equipesNomes: Record<string, string> };
      const pessoasById = new Map<string, PersonInfo>();
      const pessoasByEmail = new Map<string, PersonInfo[]>();
      for (const pessoa of pessoasData || []) {
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

        const personInfo: PersonInfo = {
          id: pessoa.id,
          nome: pessoa.nome_completo,
          encontrosIds,
          equipesNomes,
        };
        pessoasById.set(pessoa.id, personInfo);

        const normalizedEmail = normalizeEmail(pessoa.email);
        if (normalizedEmail) {
          const candidates = pessoasByEmail.get(normalizedEmail) || [];
          candidates.push(personInfo);
          pessoasByEmail.set(normalizedEmail, candidates);
        }
      }

      const enrichedUsers: EnrichedUser[] = profiles.map((profile) => {
        const explicitPerson = profile.pessoa_id ? pessoasById.get(profile.pessoa_id) : undefined;
        const fallbackCandidates = profile.pessoa_id
          ? []
          : (pessoasByEmail.get(normalizeEmail(profile.email)) || []);
        const fallbackPerson = fallbackCandidates.length === 1 ? fallbackCandidates[0] : undefined;
        const pessoaInfo = explicitPerson || fallbackPerson;
        return {
          id: profile.id,
          email: profile.email,
          pessoaId: pessoaInfo?.id || null,
          pessoaVinculo: explicitPerson ? 'explicit' : fallbackPerson ? 'email_fallback' : 'none',
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
      const totalWithTargetAccess = enrichedUsers.filter(
        (user) => hasAccessInContext(user, targetEncontroId),
      ).length;

      const filteredUsers = enrichedUsers.filter((user) => {
        if (!matchesContextMembershipFilters(user, { targetEncontroId, accessScope, grupoId })) return false;
        if (!matchesPersonLinkScope(user, personLinkScope)) return false;
        if (encontroId !== 'all' && !user.encontrosIds.includes(encontroId)) return false;
        if (tempPassword !== 'all') {
          const wantsTemporary = tempPassword === 'sim';
          if (user.temporary_password !== wantsTemporary) return false;
        }
        if (search) {
          const equipeEncontroId = encontroId !== 'all' ? encontroId : targetEncontroId;
          if (!matchesUserSearch(user, search, equipeEncontroId)) return false;
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
      const pessoaId = body?.pessoaId as string | undefined;
      const role = body?.role as UserRole | undefined;

      if (!rawEmail || !pessoaId || !role) {
        return jsonResponse(400, { error: 'email, pessoaId and role are required' });
      }

      const email = rawEmail.trim().toLowerCase();
      const { data: selectedPerson, error: selectedPersonError } = await adminClient
        .from('pessoas')
        .select('id, email')
        .eq('id', pessoaId)
        .maybeSingle();

      if (selectedPersonError || !selectedPerson) {
        return jsonResponse(400, { error: 'Pessoa selecionada não foi encontrada.' });
      }

      if (normalizeEmail(selectedPerson.email) !== email) {
        return jsonResponse(400, {
          error: 'O e-mail informado não corresponde à pessoa selecionada. Atualize o cadastro e tente novamente.'
        });
      }

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
        pessoa_id: pessoaId,
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
          pessoaId,
          pessoaVinculo: 'explicit',
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
          password: `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`,
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
          password: `${crypto.randomUUID().replaceAll('-', '')}${crypto.randomUUID().replaceAll('-', '')}`,
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
