import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import {
  ArrowRight,
  Check,
  Crown,
  History,
  Plus,
  RefreshCcw,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { LiveSearchSelect } from '../../components/ui/LiveSearchSelect';
import { Modal } from '../../components/ui/Modal';
import { PageHeader } from '../../components/ui/PageHeader';
import { dirigenciaService } from '../../services/dirigenciaService';
import type {
  Dirigencia,
  DirigenciaEvento,
  DirigenciaIndicacao,
  DirigenciaMembro,
  IndicacaoStatus,
  IndicacaoTipo,
} from '../../types/dirigencia';
import type { Pessoa } from '../../types/pessoa';
import './DirigenciaPage.css';

type PersonSelectPurpose = 'membro' | 'indicacao';

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Não foi possível concluir a ação.';
}

function formatDate(value: string | null): string {
  if (!value) return 'Não informado';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function DirigenciaPage() {
  const [dirigencias, setDirigencias] = useState<Dirigencia[]>([]);
  const [membrosAtuais, setMembrosAtuais] = useState<DirigenciaMembro[]>([]);
  const [indicacoes, setIndicacoes] = useState<DirigenciaIndicacao[]>([]);
  const [eventos, setEventos] = useState<DirigenciaEvento[]>([]);
  const [eventosCompletos, setEventosCompletos] = useState<DirigenciaEvento[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [pickerPurpose, setPickerPurpose] = useState<PersonSelectPurpose | null>(null);
  const [nomeNovaGestao, setNomeNovaGestao] = useState('');
  const [nomeGestaoInicial, setNomeGestaoInicial] = useState('');
  const [pessoaIndicada, setPessoaIndicada] = useState<Pessoa | null>(null);
  const [indicadorMembroId, setIndicadorMembroId] = useState('');
  const [indicacaoTipo, setIndicacaoTipo] = useState<IndicacaoTipo>('regular');
  const [motivoIndicacao, setMotivoIndicacao] = useState('');
  const [confirmActivation, setConfirmActivation] = useState(false);
  const [saidaTarget, setSaidaTarget] = useState<DirigenciaMembro | null>(null);

  const atual = dirigencias.find((item) => item.status === 'ativa') ?? null;
  const proxima = dirigencias.find((item) => item.status === 'indicacao') ?? null;
  const encerradas = dirigencias.filter((item) => item.status === 'encerrada');
  const membrosAtivos = membrosAtuais.filter((item) => item.ativo);
  const indicadoresRegularesUsados = new Set(
    indicacoes
      .filter((item) => item.tipo === 'regular' && item.indicador_membro_id)
      .map((item) => item.indicador_membro_id)
  );
  const membrosElegiveisParaIndicacao = indicacaoTipo === 'regular'
    ? membrosAtivos.filter((membro) => !indicadoresRegularesUsados.has(membro.id))
    : membrosAtivos;
  const fetchPessoas = useCallback((search: string) => dirigenciaService.buscarPessoas(search), []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextDirigencias = await dirigenciaService.listar();
      const nextAtual = nextDirigencias.find((item) => item.status === 'ativa') ?? null;
      const nextProxima = nextDirigencias.find((item) => item.status === 'indicacao') ?? null;

      const [nextMembros, nextIndicacoes, nextEventos] = await Promise.all([
        nextAtual ? dirigenciaService.listarMembros(nextAtual.id) : Promise.resolve([]),
        nextProxima ? dirigenciaService.listarIndicacoes(nextProxima.id) : Promise.resolve([]),
        nextProxima
          ? dirigenciaService.listarEventos(nextProxima.id, 5)
          : nextAtual
            ? dirigenciaService.listarEventos(nextAtual.id, 5)
            : Promise.resolve([]),
      ]);

      setDirigencias(nextDirigencias);
      setMembrosAtuais(nextMembros);
      setIndicacoes(nextIndicacoes);
      setEventos(nextEventos);
      const nextIndicadoresRegularesUsados = new Set(
        nextIndicacoes
          .filter((item) => item.tipo === 'regular' && item.indicador_membro_id)
          .map((item) => item.indicador_membro_id)
      );
      const nextIndicadorDisponivel = nextMembros.find(
        (item) => item.ativo && !nextIndicadoresRegularesUsados.has(item.id)
      )?.id ?? '';

      setIndicadorMembroId((current) =>
        current && !nextIndicadoresRegularesUsados.has(current)
          ? current
          : nextIndicadorDisponivel
      );
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const execute = async (action: () => Promise<void>, successMessage: string) => {
    setSaving(true);
    try {
      await action();
      toast.success(successMessage);
      await load();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleCreateInitial = async () => {
    if (!nomeGestaoInicial.trim()) return;
    await execute(
      () => dirigenciaService.criar(nomeGestaoInicial.trim(), 'ativa'),
      'Dirigência atual cadastrada.'
    );
    setNomeGestaoInicial('');
  };

  const handleCreateNext = async () => {
    if (!nomeNovaGestao.trim()) return;
    await execute(
      () => dirigenciaService.criar(nomeNovaGestao.trim(), 'indicacao'),
      'Período de indicações iniciado.'
    );
    setNomeNovaGestao('');
  };

  const handlePersonSelected = async (pessoa: Pessoa) => {
    setPickerPurpose(null);

    if (pickerPurpose === 'membro' && atual) {
      await execute(
        () => dirigenciaService.adicionarMembro(atual.id, pessoa.id),
        `${pessoa.nome_completo} agora faz parte da dirigência.`
      );
      return;
    }

    setPessoaIndicada(pessoa);
  };

  const handleIndicar = async () => {
    if (!proxima || !pessoaIndicada || (indicacaoTipo === 'regular' && !indicadorMembroId)) return;
    await execute(
      () =>
        dirigenciaService.indicar({
          dirigenciaDestinoId: proxima.id,
          indicadorMembroId,
          indicadoPessoaId: pessoaIndicada.id,
          tipo: indicacaoTipo,
          motivo: motivoIndicacao,
        }),
      'Indicação registrada.'
    );
    setPessoaIndicada(null);
    setIndicacaoTipo('regular');
    setMotivoIndicacao('');
    setPickerPurpose(null);
  };

  const handleCancelIndicacao = () => {
    setPickerPurpose(null);
    setPessoaIndicada(null);
    setIndicacaoTipo('regular');
    setMotivoIndicacao('');
  };

  const handleIndicacaoTipoChange = (tipo: IndicacaoTipo) => {
    setIndicacaoTipo(tipo);
    if (tipo === 'adicional') {
      setIndicadorMembroId('');
    } else if (indicadoresRegularesUsados.has(indicadorMembroId)) {
      setIndicadorMembroId('');
    }
  };

  const handleStatus = async (indicacao: DirigenciaIndicacao, status: IndicacaoStatus) => {
    await execute(
      () => dirigenciaService.atualizarStatusIndicacao(indicacao.id, status),
      status === 'selecionada' ? 'Pessoa selecionada para a nova dirigência.' : 'Seleção atualizada.'
    );
  };

  const handleOpenHistorico = async () => {
    const dirigenciaId = proxima?.id ?? atual?.id;
    if (!dirigenciaId) return;

    setHistoricoAberto(true);
    setLoadingHistorico(true);
    try {
      setEventosCompletos(await dirigenciaService.listarEventos(dirigenciaId));
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoadingHistorico(false);
    }
  };

  if (loading) {
    return <div className="container"><div className="empty-state">Carregando dirigência...</div></div>;
  }

  return (
    <div className="container dirigencia-page">
      <PageHeader
        title="Dirigência"
        subtitle="Administração e sucessão"
        backPath="/dashboard"
      />

      {!atual && (
        <section className="card dirigencia-bootstrap">
          <Crown size={34} />
          <div>
            <h2>Cadastre a dirigência atual</h2>
            <p>Esse primeiro cadastro estabelece quem conduz a administração do sistema hoje.</p>
          </div>
          <div className="dirigencia-inline-form">
            <input
              className="form-input"
              value={nomeGestaoInicial}
              onChange={(event) => setNomeGestaoInicial(event.target.value)}
              placeholder="Ex.: Dirigência 2025–2027"
            />
            <button className="btn-primary" type="button" disabled={saving || !nomeGestaoInicial.trim()} onClick={handleCreateInitial}>
              Criar dirigência atual
            </button>
          </div>
        </section>
      )}

      {atual && (
        <section className="card dirigencia-section">
          <div className="dirigencia-section__header">
            <div>
              <span className="dirigencia-kicker"><ShieldCheck size={15} /> Dirigência atual</span>
              <h2>{atual.nome}</h2>
              <p>Todos os membros ativos possuem o mesmo nível de administração.</p>
            </div>
            <button className="btn-primary common-button" type="button" onClick={() => setPickerPurpose('membro')}>
              <UserPlus size={20} /> Adicionar membro
            </button>
          </div>

          {pickerPurpose === 'membro' && (
            <div className="dirigencia-select-shell">
              <div className="dirigencia-select-shell__top">
                <div>
                  <strong>Adicionar dirigente</strong>
                  <p>Busque uma pessoa já cadastrada pelo nome ou e-mail.</p>
                </div>
                <button type="button" className="icon-btn" onClick={() => setPickerPurpose(null)} aria-label="Fechar">
                  <X size={18} />
                </button>
              </div>
              <LiveSearchSelect<Pessoa>
                value=""
                onChange={(_, pessoa) => pessoa && handlePersonSelected(pessoa)}
                fetchData={fetchPessoas}
                getOptionLabel={(pessoa) => pessoa.nome_completo}
                getOptionValue={(pessoa) => pessoa.id}
                renderOption={(pessoa) => (
                  <div className="dirigencia-select-option">
                    <strong>{pessoa.nome_completo}</strong>
                    <small>{pessoa.email || 'Sem e-mail cadastrado'}</small>
                  </div>
                )}
                placeholder="Selecione uma pessoa..."
                pageSize={12}
              />
            </div>
          )}

          <motion.div
            className="dirigencia-member-grid"
            initial="hidden"
            animate="visible"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.06,
                },
              },
            }}
          >
            {membrosAtivos.length === 0 && <div className="empty-state">Adicione os membros da dirigência atual.</div>}
            {membrosAtivos.map((membro) => (
              <motion.article
                className="dirigencia-member"
                key={membro.id}
                layout
                variants={{
                  hidden: { opacity: 0, y: 12 },
                  visible: { opacity: 1, y: 0 },
                }}
                whileHover={{ y: -4, boxShadow: 'var(--shadow-md)' }}
                whileTap={{ scale: 0.99 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
              >
                <div>
                  <strong>{membro.pessoas.nome_completo}</strong>
                  <small>{membro.pessoas.email || 'Sem e-mail cadastrado'}</small>
                </div>
                <button
                  type="button"
                  className="icon-btn dirigencia-member__remove"
                  onClick={() => setSaidaTarget(membro)}
                  title="Registrar saída"
                  aria-label={`Registrar saída de ${membro.pessoas.nome_completo}`}
                >
                  <UserMinus size={17} />
                  Registrar saída
                </button>
              </motion.article>
            ))}
          </motion.div>
        </section>
      )}

      {atual && !proxima && (
        <section className="card dirigencia-start-next">
          <div>
            <span className="dirigencia-kicker"><Users size={20} /> Próxima dirigência</span>
            <h2>Iniciar período de indicações</h2>
            <small className='small-text'>Abra a próxima gestão para registrar os sucessores indicados pelos dirigentes atuais.</small>
          </div>
          <div className="dirigencia-inline-form">
            <input
              className="form-input"
              value={nomeNovaGestao}
              onChange={(event) => setNomeNovaGestao(event.target.value)}
              placeholder="Ex.: Dirigência 2028–2030"
            />
            <button className="btn-primary" type="button" disabled={saving || !nomeNovaGestao.trim()} onClick={handleCreateNext}>
              Iniciar indicações
            </button>
          </div>
        </section>
      )}

      {atual && proxima && (
        <section className="card dirigencia-section">
          <div className="dirigencia-section__header">
            <div>
              <span className="dirigencia-kicker"><ArrowRight size={20} /> Próxima dirigência</span>
              <h2>{proxima.nome}</h2>
              <p>
                {proxima.indicacoes_finalizadas_em
                  ? 'Indicações finalizadas. Confira a composição antes de ativar a nova dirigência.'
                  : 'Registre os nomes indicados e marque quem fará parte da próxima gestão.'}
              </p>
            </div>
            {!proxima.indicacoes_finalizadas_em && (
              <button className="btn-primary" type="button" onClick={() => setPickerPurpose('indicacao')}>
                <Plus size={17} /> Nova indicação
              </button>
            )}
          </div>

          {pickerPurpose === 'indicacao' && !proxima.indicacoes_finalizadas_em && (
            <div className="dirigencia-indication-form">
              <label>
                <span className="dirigencia-form-label">Tipo</span>
                <select className="form-input" value={indicacaoTipo} onChange={(event) => handleIndicacaoTipoChange(event.target.value as IndicacaoTipo)}>
                  <option value="regular">Indicação regular</option>
                  <option value="adicional">Indicação adicional</option>
                </select>
              </label>
              <label>
                <span className="dirigencia-form-label">
                  Indicado por {indicacaoTipo === 'adicional' && '(opcional)'}
                </span>
                <select className="form-input" value={indicadorMembroId} onChange={(event) => setIndicadorMembroId(event.target.value)}>
                  <option value="">{indicacaoTipo === 'adicional' ? 'Consenso da dirigência' : 'Selecione...'}</option>
                  {membrosElegiveisParaIndicacao.map((membro) => (
                    <option key={membro.id} value={membro.id}>{membro.pessoas.nome_completo}</option>
                  ))}
                </select>
              </label>
              <label className="dirigencia-indication-form__person">
                <span className="dirigencia-form-label">Pessoa indicada</span>
                <LiveSearchSelect<Pessoa>
                  value={pessoaIndicada?.id ?? ''}
                  onChange={(_, pessoa) => setPessoaIndicada(pessoa)}
                  fetchData={fetchPessoas}
                  getOptionLabel={(pessoa) => pessoa.nome_completo}
                  getOptionValue={(pessoa) => pessoa.id}
                  renderOption={(pessoa) => (
                    <div className="dirigencia-select-option">
                      <strong>{pessoa.nome_completo}</strong>
                      <small>{pessoa.email || 'Sem e-mail cadastrado'}</small>
                    </div>
                  )}
                  placeholder="Selecione uma pessoa..."
                  pageSize={12}
                  initialOptions={pessoaIndicada ? [pessoaIndicada] : []}
                />
              </label>
              {indicacaoTipo === 'adicional' && (
                <label className="dirigencia-indication-form__reason">
                  <span className="dirigencia-form-label">Motivo</span>
                  <input className="form-input" value={motivoIndicacao} onChange={(event) => setMotivoIndicacao(event.target.value)} placeholder="Ex.: reposição após saída" />
                </label>
              )}
              <div className="dirigencia-indication-form__actions">
                <button className="btn-secondary" type="button" onClick={handleCancelIndicacao}>Cancelar</button>
                <button className="btn-primary" type="button" disabled={saving || !pessoaIndicada || (indicacaoTipo === 'regular' && !indicadorMembroId)} onClick={handleIndicar}>Registrar indicação</button>
              </div>
            </div>
          )}

          <div className="dirigencia-indications">
            {indicacoes.length === 0 && <div className="empty-state">Nenhuma indicação registrada ainda.</div>}
            {indicacoes.map((indicacao) => (
              <article className={`dirigencia-indication is-${indicacao.status}`} key={indicacao.id}>
                <div>
                  <strong>{indicacao.indicado.nome_completo}</strong>
                  <small>{indicacao.indicador ? `Indicado por ${indicacao.indicador.pessoas.nome_completo}` : 'Indicação adicional por consenso'}</small>
                </div>
                <div className="dirigencia-indication__meta">
                  <span className={`dirigencia-tag is-${indicacao.tipo}`}>{indicacao.tipo === 'regular' ? 'Regular' : 'Adicional'}</span>
                  <span className={`dirigencia-tag is-${indicacao.status}`}>{indicacao.status}</span>
                </div>
                {!proxima.indicacoes_finalizadas_em && (
                  <div className="dirigencia-indication__actions">
                    <button type="button" className="icon-btn" title="Selecionar" onClick={() => handleStatus(indicacao, 'selecionada')}>
                      <Check size={17} />
                    </button>
                    <button type="button" className="icon-btn" title="Descartar" onClick={() => handleStatus(indicacao, 'descartada')}>
                      <X size={17} />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>

          <div className="dirigencia-section__footer">
            {!proxima.indicacoes_finalizadas_em ? (
              <button className="btn-primary" type="button" disabled={saving || !indicacoes.some((item) => item.status === 'selecionada')} onClick={() => execute(() => dirigenciaService.finalizarIndicacoes(proxima.id), 'Indicações finalizadas para conferência.')}>
                <Check size={17} /> Finalizar indicações
              </button>
            ) : (
              <>
                <button className="btn-secondary" type="button" disabled={saving} onClick={() => execute(() => dirigenciaService.reabrirIndicacoes(proxima.id), 'Indicações reabertas para ajustes.')}>
                  <RefreshCcw size={17} /> Reabrir indicações
                </button>
                <button className="btn-primary" type="button" disabled={saving} onClick={() => setConfirmActivation(true)}>
                  <Crown size={17} /> Ativar nova dirigência
                </button>
              </>
            )}
          </div>
        </section>
      )}

      {(encerradas.length > 0 || eventos.length > 0) && (
        <section className="card dirigencia-history">
          <div className="dirigencia-section__header">
            <div>
              <span className="dirigencia-kicker"><History size={20} /> Histórico</span>
              <h2>Registro administrativo</h2>
              <p>Últimos 5 registros da gestão em acompanhamento.</p>
            </div>
            <button className="btn-secondary common-button" type="button" onClick={handleOpenHistorico}>
              <History size={20} />histórico completo
            </button>
          </div>
          {encerradas.length > 0 && (
            <div className="dirigencia-history__past">
              {encerradas.map((item) => (
                <span key={item.id}><strong>{item.nome}</strong> · encerrada em {formatDate(item.encerrada_em)}</span>
              ))}
            </div>
          )}
          <div className="dirigencia-timeline">
            {eventos.map((evento) => (
              <div key={evento.id}>
                <span>{formatDateTime(evento.created_at)} · por {evento.executado_por_nome}</span>
                <p>{evento.descricao}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={!!saidaTarget}
        title="Registrar saída"
        message={`Remover ${saidaTarget?.pessoas.nome_completo} da dirigência atual? O acesso administrativo será revogado imediatamente.`}
        confirmText="Registrar saída"
        isDestructive
        isLoading={saving}
        onCancel={() => setSaidaTarget(null)}
        onConfirm={async () => {
          if (!saidaTarget) return;
          await execute(() => dirigenciaService.registrarSaida(saidaTarget.id), 'Saída registrada.');
          setSaidaTarget(null);
        }}
      />

      <ConfirmDialog
        isOpen={confirmActivation}
        title="Confirmar nova dirigência"
        message="Ao ativar a nova dirigência, seus membros receberão acesso administrativo e a dirigência atual será encerrada. Deseja continuar?"
        confirmText="Ativar nova dirigência"
        isLoading={saving}
        onCancel={() => setConfirmActivation(false)}
        onConfirm={async () => {
          if (!proxima) return;
          await execute(() => dirigenciaService.ativar(proxima.id), 'Nova dirigência ativada.');
          setConfirmActivation(false);
        }}
      />

      <Modal
        isOpen={historicoAberto}
        onClose={() => setHistoricoAberto(false)}
        title="Histórico completo da dirigência"
        maxWidth="720px"
      >
        <div className="dirigencia-history-modal">
          {loadingHistorico && <div className="empty-state">Carregando histórico...</div>}
          {!loadingHistorico && eventosCompletos.length === 0 && (
            <div className="empty-state">Nenhum registro administrativo encontrado.</div>
          )}
          {!loadingHistorico && eventosCompletos.length > 0 && (
            <div className="dirigencia-timeline">
              {eventosCompletos.map((evento) => (
                <div key={evento.id}>
                  <span>{formatDateTime(evento.created_at)} · por {evento.executado_por_nome}</span>
                  <p>{evento.descricao}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
