interface ExistingProfile {
  id: string;
  email: string;
  pessoa_id: string | null;
}

export function normalizeGroupIds(value: unknown): string[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return [];

  return [...new Set(
    value
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean),
  )];
}

export function individualAccessConflict(
  pessoaId: string,
  profileForPerson: ExistingProfile | null,
  profilesForEmail: ExistingProfile[],
): string | null {
  if (profileForPerson) {
    return 'Esta pessoa já possui uma conta. Abra os detalhes da conta existente para ajustar seus acessos.';
  }

  const profileForEmail = profilesForEmail[0];
  if (!profileForEmail) return null;

  if (profileForEmail.pessoa_id === pessoaId) {
    return 'Esta pessoa já possui uma conta. Abra os detalhes da conta existente para ajustar seus acessos.';
  }

  if (profileForEmail.pessoa_id) {
    return 'Este e-mail já pertence a uma conta vinculada a outra pessoa.';
  }

  return 'Já existe uma conta com este e-mail sem pessoa vinculada. Vincule a conta existente antes de conceder os acessos.';
}

export function profileFailureMessage(errorCode: string | undefined): string {
  if (errorCode === '23505') {
    return 'A pessoa ou o e-mail foram vinculados por outra conta durante a criação. Revise a conta existente e tente novamente.';
  }

  if (errorCode === '23503') {
    return 'A pessoa selecionada não está mais disponível. Atualize a página e tente novamente.';
  }

  return 'Não foi possível vincular a nova conta à pessoa. Nenhuma conta foi mantida; tente novamente.';
}
