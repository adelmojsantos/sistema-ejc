import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Save, ShieldCheck } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { useEncontros } from '../../contexts/EncontroContext';
import { adminAccessService } from '../../services/adminAccessService';
import {
  accessProvisioningService,
  type AccessRule,
  type AccessRuleRole,
  type AccessRuleTeam,
} from '../../services/accessProvisioningService';
import { userFacingError } from '../../utils/userFacingError';
import './EncounterAccessProvisioningPage.css';

type RuleSelection = Record<string, string[]>;

const ROLE_LABELS: Record<AccessRuleRole, string> = {
  coordenador: 'Coordenadores',
  integrante: 'Integrantes',
};

function ruleKey(teamId: string, role: AccessRuleRole) {
  return `${teamId}:${role}`;
}

function rulesToSelection(rules: AccessRule[]): RuleSelection {
  const selection: RuleSelection = {};
  for (const rule of rules) {
    const key = ruleKey(rule.equipe_id, rule.papel);
    selection[key] = [...(selection[key] ?? []), rule.grupo_id];
  }
  return selection;
}

export function EncounterAccessProvisioningPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { encontros, encontroSelecionadoId } = useEncontros();
  const requestedEncounterId = searchParams.get('encontro');
  const [encontroId, setEncontroId] = useState(requestedEncounterId || encontroSelecionadoId);
  const [teams, setTeams] = useState<AccessRuleTeam[]>([]);
  const [groups, setGroups] = useState<Array<{ id: string; nome: string }>>([]);
  const [ruleSelection, setRuleSelection] = useState<RuleSelection>({});
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [savingRules, setSavingRules] = useState(false);
  const matrixRequestRef = useRef(0);

  useEffect(() => {
    if (!encontroId && encontroSelecionadoId) setEncontroId(encontroSelecionadoId);
  }, [encontroId, encontroSelecionadoId]);

  const loadMatrix = useCallback(async () => {
    if (!encontroId) return;
    const requestId = ++matrixRequestRef.current;
    setLoadingMatrix(true);
    try {
      const [loadedTeams, loadedGroups, loadedPermissions, loadedRelations, loadedRules] = await Promise.all([
        accessProvisioningService.listTeams(encontroId),
        adminAccessService.listGrupos(),
        adminAccessService.listPermissoes(),
        adminAccessService.listGrupoPermissoes(),
        accessProvisioningService.listRules(encontroId),
      ]);
      if (requestId !== matrixRequestRef.current) return;
      const adminPermissionId = loadedPermissions.find(permission => permission.chave === 'modulo_admin')?.id;
      const administrativeGroupIds = new Set(
        loadedRelations
          .filter(relation => relation.permissao_id === adminPermissionId)
          .map(relation => relation.grupo_id),
      );
      setTeams(loadedTeams);
      setGroups(loadedGroups.filter(group => !administrativeGroupIds.has(group.id)));
      setRuleSelection(rulesToSelection(loadedRules));
    } catch (error: unknown) {
      if (requestId !== matrixRequestRef.current) return;
      toast.error(userFacingError(error, 'Não foi possível carregar a configuração de acessos.'));
    } finally {
      if (requestId === matrixRequestRef.current) setLoadingMatrix(false);
    }
  }, [encontroId]);

  useEffect(() => {
    if (!encontroId) return;
    void loadMatrix();
  }, [encontroId, loadMatrix]);

  const toggleRule = (teamId: string, role: AccessRuleRole, groupId: string) => {
    const key = ruleKey(teamId, role);
    setRuleSelection(current => {
      const groupIds = current[key] ?? [];
      return {
        ...current,
        [key]: groupIds.includes(groupId)
          ? groupIds.filter(id => id !== groupId)
          : [...groupIds, groupId],
      };
    });
  };

  const handleSaveRules = async () => {
    if (!encontroId) return;
    const rules: AccessRule[] = [];
    for (const team of teams) {
      for (const role of ['coordenador', 'integrante'] as const) {
        for (const groupId of ruleSelection[ruleKey(team.id, role)] ?? []) {
          rules.push({ equipe_id: team.id, papel: role, grupo_id: groupId });
        }
      }
    }

    setSavingRules(true);
    try {
      const saved = await accessProvisioningService.replaceRules(encontroId, rules);
      toast.success(`${saved} definição(ões) de acesso salva(s).`);
    } catch (error: unknown) {
      toast.error(userFacingError(error, 'Não foi possível salvar a configuração de acessos.'));
    } finally {
      setSavingRules(false);
    }
  };

  const selectedEncounter = encontros.find(encounter => encounter.id === encontroId);

  return (
    <div className="container" style={{ paddingBottom: '2rem' }}>
      <div className="page-header" style={{ gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <button type="button" className="btn-text" onClick={() => navigate('/admin/usuarios')} style={{ padding: 0, marginBottom: '0.55rem' }}>
            <ArrowLeft size={16} /> Voltar para usuários
          </button>
          <h1 className="page-title" style={{ fontSize: '1.5rem' }}>
            <ShieldCheck size={22} style={{ marginRight: '0.45rem', verticalAlign: 'middle' }} />
            Configurar acessos por equipe
          </h1>
          <p className="text-muted" style={{ margin: '0.35rem 0 0' }}>
            Escolha quais perfis coordenadores e integrantes de cada equipe poderão receber.
          </p>
        </div>
        <div style={{ marginLeft: 'auto', minWidth: 'min(300px, 100%)' }}>
          <label className="form-label" htmlFor="access-encounter">Encontro</label>
          <select id="access-encounter" className="form-input" value={encontroId} onChange={event => setEncontroId(event.target.value)}>
            {encontros.map(encounter => (
              <option key={encounter.id} value={encounter.id}>{encounter.nome || encounter.edicao || encounter.tema}</option>
            ))}
          </select>
        </div>
      </div>

      <section className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Perfis permitidos por função</h2>
            <p className="text-muted" style={{ margin: '0.35rem 0 0', fontSize: '0.86rem' }}>
              Perfil vazio significa que aquela função da equipe não precisa acessar o sistema.
              Perfis administrativos permanecem disponíveis somente na concessão individual.
            </p>
          </div>
          <button type="button" className="btn-primary" onClick={handleSaveRules} disabled={!encontroId || savingRules || loadingMatrix}>
            <Save size={16} /> {savingRules ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>

        {loadingMatrix ? (
          <p className="text-muted">Carregando equipes e perfis...</p>
        ) : teams.length === 0 ? (
          <div className="empty-state" style={{ marginTop: '1rem' }}>Nenhuma equipe possui integrantes em {selectedEncounter?.nome || 'este encontro'}.</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.75rem', marginTop: '1rem' }}>
            {teams.map(team => (
              <article key={team.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1rem', background: 'var(--surface-1)' }}>
                <strong style={{ display: 'block', marginBottom: '0.75rem' }}>{team.nome}</strong>
                <div className="team-access-role-grid">
                  {(['coordenador', 'integrante'] as const).map(role => (
                    <fieldset key={role} className="team-access-role-column">
                      <legend style={{ fontSize: '0.78rem', color: 'var(--muted-text)', fontWeight: 700, marginBottom: '0.45rem' }}>{ROLE_LABELS[role]}</legend>
                      <div className="team-access-profile-list">
                        {groups.map(group => {
                          const checked = (ruleSelection[ruleKey(team.id, role)] ?? []).includes(group.id);
                          return (
                            <label
                              key={group.id}
                              className={`team-access-profile${checked ? ' team-access-profile--selected' : ''}`}
                            >
                              <input type="checkbox" checked={checked} onChange={() => toggleRule(team.id, role, group.id)} />
                              <span>{group.nome}</span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
