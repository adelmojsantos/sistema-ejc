import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { Fingerprint, KeyRound, LogOut, Pencil, Trash2 } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import {
    PASSKEY_LOGIN_ENABLED,
    browserSupportsPasskeys,
    isPasskeyCeremonyInterrupted,
    passkeyErrorMessage,
    passkeyService,
    setPasskeyDeviceState,
    type PasskeyItem
} from '../services/passkeyService';
import { userFacingError } from '../utils/userFacingError';
import { authService } from '../services/authService';
import { SESSION_IDLE_TIMEOUT_MS, SESSION_MAX_AGE_MS } from '../utils/sessionPolicy';

const IDLE_TIMEOUT_HOURS = Math.round(SESSION_IDLE_TIMEOUT_MS / (60 * 60 * 1000));
const MAX_AGE_DAYS = Math.round(SESSION_MAX_AGE_MS / (24 * 60 * 60 * 1000));

const cardStyle = {
    background: 'var(--surface-1)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '1.25rem',
    boxShadow: 'var(--shadow-sm)',
} as const;

function formatDateTime(value?: string): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function SecurityPage() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const supported = browserSupportsPasskeys();
    const [passkeys, setPasskeys] = useState<PasskeyItem[]>([]);
    const [loading, setLoading] = useState(PASSKEY_LOGIN_ENABLED);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [registering, setRegistering] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState('');
    const [savingName, setSavingName] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<PasskeyItem | null>(null);
    const [removing, setRemoving] = useState(false);
    const [confirmSignOutAll, setConfirmSignOutAll] = useState(false);
    const [signingOutAll, setSigningOutAll] = useState(false);

    const loadPasskeys = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            setPasskeys(await passkeyService.list());
        } catch (error) {
            setLoadError(userFacingError(error, 'Não foi possível carregar as chaves de acesso.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (PASSKEY_LOGIN_ENABLED) void loadPasskeys();
    }, [loadPasskeys]);

    const handleRegister = async () => {
        setRegistering(true);
        try {
            await passkeyService.register();
            if (user) setPasskeyDeviceState(user.id, 'enrolled');
            toast.success('Chave de acesso criada neste aparelho.');
            await loadPasskeys();
        } catch (error) {
            if (!isPasskeyCeremonyInterrupted(error)) {
                toast.error(passkeyErrorMessage(error, 'Não foi possível criar a chave de acesso agora.'));
            }
        } finally {
            setRegistering(false);
        }
    };

    const handleSaveName = async (passkeyId: string) => {
        const name = editingName.trim();
        if (!name) {
            toast.error('Informe um nome para identificar o aparelho.');
            return;
        }

        setSavingName(true);
        try {
            const updated = await passkeyService.rename(passkeyId, name);
            setPasskeys((current) => current.map((item) => (item.id === passkeyId ? { ...item, ...updated } : item)));
            setEditingId(null);
        } catch (error) {
            toast.error(userFacingError(error, 'Não foi possível renomear a chave de acesso.'));
        } finally {
            setSavingName(false);
        }
    };

    const handleRemove = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            await passkeyService.remove(removeTarget.id);
            setPasskeys((current) => current.filter((item) => item.id !== removeTarget.id));
            toast.success('Chave de acesso removida.');
            setRemoveTarget(null);
        } catch (error) {
            toast.error(userFacingError(error, 'Não foi possível remover a chave de acesso.'));
        } finally {
            setRemoving(false);
        }
    };

    const handleSignOutAll = async () => {
        setSigningOutAll(true);
        try {
            await authService.signOutAllDevices();
            navigate('/login', { replace: true });
        } catch (error) {
            toast.error(userFacingError(error, 'Não foi possível encerrar as sessões. Tente novamente.'));
            setSigningOutAll(false);
        }
    };

    return (
        <div style={{ padding: '0 1rem', maxWidth: '760px' }}>
            <PageHeader title="Segurança" subtitle="MINHA CONTA" backPath="/dashboard" />

            <div style={{ display: 'grid', gap: '1.25rem', marginTop: '1.5rem', marginBottom: '3rem' }}>
                {PASSKEY_LOGIN_ENABLED && (
                    <section style={cardStyle} aria-labelledby="security-passkeys-title">
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                            <Fingerprint size={24} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--primary-color)' }} />
                            <div>
                                <h2 id="security-passkeys-title" style={{ fontSize: '1.125rem', margin: '0 0 0.25rem' }}>Chaves de acesso</h2>
                                <p style={{ margin: 0, color: 'var(--muted-text)', fontSize: '0.875rem' }}>
                                    Com uma chave de acesso você entra usando a digital, o rosto ou o PIN do aparelho, sem digitar a senha.
                                    A biometria fica no aparelho e não é enviada ao sistema. Crie chaves apenas em aparelhos que sejam seus.
                                </p>
                            </div>
                        </div>

                        {supported ? (
                            <button
                                type="button"
                                className="btn-primary"
                                onClick={() => void handleRegister()}
                                disabled={registering}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}
                            >
                                <Fingerprint size={18} aria-hidden="true" />
                                {registering ? 'Aguardando confirmação...' : 'Criar chave de acesso neste aparelho'}
                            </button>
                        ) : (
                            <p style={{ margin: '0 0 1.25rem', fontSize: '0.875rem' }}>
                                Este navegador não oferece chaves de acesso. Você pode criar uma pelo navegador do seu celular.
                            </p>
                        )}

                        <h3 style={{ fontSize: '0.9375rem', margin: '0 0 0.75rem' }}>Aparelhos com chave de acesso</h3>

                        {loading && <p style={{ margin: 0, color: 'var(--muted-text)' }}>Carregando...</p>}

                        {!loading && loadError && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center' }}>
                                <span className="error-message" style={{ margin: 0 }}>{loadError}</span>
                                <button type="button" className="btn-secondary" onClick={() => void loadPasskeys()}>
                                    Tentar novamente
                                </button>
                            </div>
                        )}

                        {!loading && !loadError && passkeys.length === 0 && (
                            <p style={{ margin: 0, color: 'var(--muted-text)', fontSize: '0.875rem' }}>
                                Nenhuma chave de acesso criada ainda.
                            </p>
                        )}

                        {!loading && !loadError && passkeys.length > 0 && (
                            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.75rem' }}>
                                {passkeys.map((item) => (
                                    <li
                                        key={item.id}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '12px',
                                            padding: '0.875rem 1rem',
                                            display: 'flex',
                                            flexWrap: 'wrap',
                                            gap: '0.75rem',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}
                                    >
                                        {editingId === item.id ? (
                                            <form
                                                onSubmit={(event) => {
                                                    event.preventDefault();
                                                    void handleSaveName(item.id);
                                                }}
                                                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', flex: '1 1 260px' }}
                                            >
                                                <label className="sr-only" htmlFor={`passkey-name-${item.id}`}>Nome do aparelho</label>
                                                <input
                                                    id={`passkey-name-${item.id}`}
                                                    className="form-input"
                                                    value={editingName}
                                                    maxLength={120}
                                                    onChange={(event) => setEditingName(event.target.value)}
                                                    style={{ flex: '1 1 160px', minWidth: 0 }}
                                                    autoFocus
                                                />
                                                <button type="submit" className="btn-primary" disabled={savingName}>
                                                    {savingName ? 'Salvando...' : 'Salvar'}
                                                </button>
                                                <button type="button" className="btn-secondary" onClick={() => setEditingId(null)} disabled={savingName}>
                                                    Cancelar
                                                </button>
                                            </form>
                                        ) : (
                                            <>
                                                <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                                                    <strong style={{ display: 'block', overflowWrap: 'anywhere' }}>
                                                        {item.friendly_name || 'Aparelho sem nome'}
                                                    </strong>
                                                    <span style={{ color: 'var(--muted-text)', fontSize: '0.8125rem' }}>
                                                        Cadastrada em {formatDateTime(item.created_at)} · Último uso: {formatDateTime(item.last_used_at)}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button
                                                        type="button"
                                                        className="btn-secondary"
                                                        onClick={() => {
                                                            setEditingId(item.id);
                                                            setEditingName(item.friendly_name ?? '');
                                                        }}
                                                        aria-label={`Renomear ${item.friendly_name || 'aparelho'}`}
                                                        title="Renomear"
                                                    >
                                                        <Pencil size={16} aria-hidden="true" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-secondary"
                                                        onClick={() => setRemoveTarget(item)}
                                                        aria-label={`Remover ${item.friendly_name || 'aparelho'}`}
                                                        title="Remover"
                                                    >
                                                        <Trash2 size={16} aria-hidden="true" />
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                )}

                <section style={cardStyle} aria-labelledby="security-password-title">
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: '1 1 260px' }}>
                            <KeyRound size={24} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--primary-color)' }} />
                            <div>
                                <h2 id="security-password-title" style={{ fontSize: '1.125rem', margin: '0 0 0.25rem' }}>Senha</h2>
                                <p style={{ margin: 0, color: 'var(--muted-text)', fontSize: '0.875rem' }}>
                                    A senha continua valendo como forma de acesso. Por segurança, a sessão é encerrada após {IDLE_TIMEOUT_HOURS} horas sem uso ou {MAX_AGE_DAYS} dias após o login.
                                </p>
                            </div>
                        </div>
                        <button type="button" className="btn-secondary" onClick={() => navigate('/alterar-senha')}>
                            Alterar senha
                        </button>
                    </div>
                </section>

                <section style={cardStyle} aria-labelledby="security-sessions-title">
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', flex: '1 1 260px' }}>
                            <LogOut size={24} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--primary-color)' }} />
                            <div>
                                <h2 id="security-sessions-title" style={{ fontSize: '1.125rem', margin: '0 0 0.25rem' }}>Aparelhos conectados</h2>
                                <p style={{ margin: 0, color: 'var(--muted-text)', fontSize: '0.875rem' }}>
                                    "Sair" encerra apenas este aparelho. Se perdeu um celular ou entrou em um aparelho de outra pessoa, encerre todas as sessões.
                                </p>
                            </div>
                        </div>
                        <button type="button" className="btn-secondary" onClick={() => setConfirmSignOutAll(true)}>
                            Sair de todos os aparelhos
                        </button>
                    </div>
                </section>
            </div>

            <ConfirmDialog
                isOpen={confirmSignOutAll}
                title="Sair de todos os aparelhos?"
                message="Todas as sessões abertas, inclusive esta, serão encerradas. Será preciso entrar novamente em cada aparelho. As chaves de acesso continuam cadastradas."
                confirmText="Sair de todos"
                loadingText="Encerrando..."
                onConfirm={() => void handleSignOutAll()}
                onCancel={() => setConfirmSignOutAll(false)}
                isLoading={signingOutAll}
                isDestructive
            />

            <ConfirmDialog
                isOpen={!!removeTarget}
                title="Remover chave de acesso?"
                message={`O aparelho "${removeTarget?.friendly_name || 'sem nome'}" não poderá mais entrar com chave de acesso. O acesso por senha continua funcionando.`}
                confirmText="Remover"
                loadingText="Removendo..."
                onConfirm={() => void handleRemove()}
                onCancel={() => setRemoveTarget(null)}
                isLoading={removing}
                isDestructive
            />
        </div>
    );
}
