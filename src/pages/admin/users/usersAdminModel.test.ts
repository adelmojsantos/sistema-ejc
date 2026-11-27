import { describe, expect, it } from 'vitest';
import type { AdminUserListItem } from '../../../services/adminUserService';
import {
    getContextGroupIds,
    getContextTeam,
    getTeamMemberAccessState,
    getUserChecklist,
    getUserListViews,
    getUserSituation,
    viewToQuery,
} from './usersAdminModel';

function makeUser(overrides: Partial<AdminUserListItem> = {}): AdminUserListItem {
    return {
        id: 'user-1',
        email: 'maria@example.test',
        pessoaId: 'pessoa-1',
        pessoaVinculo: 'explicit',
        temporary_password: false,
        created_at: '2026-01-10T12:00:00Z',
        grupos: [],
        nome: 'Maria',
        encontrosIds: ['atual'],
        equipesNomes: { anterior: 'Cozinha', atual: 'Liturgia' },
        ...overrides,
    };
}

describe('perfis restritos ao encontro selecionado', () => {
    const user = makeUser({
        grupos: [
            { grupo_id: 'secretaria', encontro_id: 'atual' },
            { grupo_id: 'cozinha', encontro_id: 'anterior' },
            { grupo_id: 'admin', encontro_id: null },
        ],
    });

    it('não mistura perfis de outros encontros nem permanentes', () => {
        expect(getContextGroupIds(user, 'atual')).toEqual(['secretaria']);
        expect(getContextGroupIds(user, 'anterior')).toEqual(['cozinha']);
        expect(getContextGroupIds(user, null)).toEqual(['admin']);
    });

    it('mostra só a equipe do encontro selecionado', () => {
        expect(getContextTeam(user, 'atual')).toBe('Liturgia');
        expect(getContextTeam(user, 'outro')).toBeNull();
        expect(getContextTeam(user, null)).toBeNull();
    });

    it('trata como sem acesso quem só tem perfil em encontro anterior', () => {
        expect(getUserSituation(user, 'outro')).toBe('sem_acesso');
    });
});

describe('getUserSituation', () => {
    const withAccess = [{ grupo_id: 'g', encontro_id: 'atual' }];

    it('prioriza o primeiro acesso pendente', () => {
        expect(getUserSituation(makeUser({ grupos: withAccess, temporary_password: true, pessoaVinculo: 'none' }), 'atual')).toBe('primeiro_acesso');
    });

    it('aponta vínculo pendente quando a pessoa foi achada só pelo e-mail', () => {
        expect(getUserSituation(makeUser({ grupos: withAccess, pessoaVinculo: 'email_fallback' }), 'atual')).toBe('vinculo');
    });

    it('considera ativo quem tem perfil, senha e vínculo', () => {
        expect(getUserSituation(makeUser({ grupos: withAccess }), 'atual')).toBe('ativo');
    });
});

describe('getUserChecklist', () => {
    it('lista o que falta para a conta funcionar no encontro', () => {
        const checklist = getUserChecklist(
            makeUser({ temporary_password: true, pessoaVinculo: 'email_fallback' }),
            'atual',
            '52º EJC',
        );

        expect(checklist.map(item => [item.id, item.state])).toEqual([
            ['conta', 'done'],
            ['pessoa', 'warning'],
            ['senha', 'pending'],
            ['perfil', 'pending'],
        ]);
        expect(checklist[3].label).toBe('Perfil em 52º EJC');
    });
});

describe('visões da lista', () => {
    it('mapeia cada atalho para os filtros do backend', () => {
        expect(viewToQuery('com_acesso')).toEqual({ accessScope: 'with', tempPassword: 'all', personLinkScope: 'all' });
        expect(viewToQuery('primeiro_acesso')).toEqual({ accessScope: 'with', tempPassword: 'sim', personLinkScope: 'all' });
        expect(viewToQuery('sem_pessoa')).toEqual({ accessScope: 'with', tempPassword: 'all', personLinkScope: 'unlinked' });
        expect(viewToQuery('sem_acesso')).toEqual({ accessScope: 'without', tempPassword: 'all', personLinkScope: 'all' });
        expect(viewToQuery('todas')).toEqual({ accessScope: 'all', tempPassword: 'all', personLinkScope: 'all' });
    });

    it('calcula os contadores e tolera backend sem os novos campos', () => {
        const views = getUserListViews({
            totalUsers: 120,
            totalTemporaryPassword: 30,
            totalWithoutPerson: 4,
            totalWithTargetAccess: 45,
            filteredTotal: 45,
        }, false);

        expect(views.map(view => [view.id, view.count])).toEqual([
            ['com_acesso', 45],
            ['primeiro_acesso', null],
            ['sem_pessoa', null],
            ['sem_acesso', 75],
            ['todas', 120],
        ]);
    });
});

describe('getTeamMemberAccessState', () => {
    const account = makeUser({ id: 'conta-1', grupos: [{ grupo_id: 'pasta', encontro_id: 'atual' }, { grupo_id: 'liturgia', encontro_id: 'anterior' }] });

    it('pede e-mail para quem não tem conta nem e-mail', () => {
        expect(getTeamMemberAccessState({ pessoa_id: 'outra', email: null }, [account], 'atual', ['pasta'])).toEqual({ kind: 'sem_email' });
    });

    it('cria conta para quem tem e-mail e ainda não tem conta', () => {
        expect(getTeamMemberAccessState({ pessoa_id: 'outra', email: 'nova@example.test' }, [account], 'atual', ['pasta'])).toEqual({ kind: 'criar_conta' });
    });

    it('concede só os perfis que faltam neste encontro para quem já tem conta', () => {
        expect(getTeamMemberAccessState({ pessoa_id: 'pessoa-1', email: null }, [account], 'atual', ['pasta', 'liturgia'])).toEqual({
            kind: 'conceder',
            userId: 'conta-1',
            missingGroupIds: ['liturgia'],
        });
    });

    it('reconhece a conta pelo e-mail e marca como completo quando já tem tudo', () => {
        expect(getTeamMemberAccessState({ pessoa_id: 'sem-vinculo', email: 'MARIA@example.test' }, [account], 'atual', ['pasta'])).toEqual({
            kind: 'completo',
            userId: 'conta-1',
        });
    });
});
