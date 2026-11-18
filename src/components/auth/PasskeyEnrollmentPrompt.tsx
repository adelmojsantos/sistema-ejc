import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { ConfirmDialog } from '../ConfirmDialog';
import { useAuth } from '../../hooks/useAuth';
import {
    PASSKEY_LOGIN_ENABLED,
    consumePasskeyOfferPending,
    getPasskeyDeviceState,
    hasPlatformAuthenticator,
    isPasskeyCeremonyInterrupted,
    passkeyErrorMessage,
    passkeyService,
    setPasskeyDeviceState
} from '../../services/passkeyService';

/**
 * Após um login com senha, sugere criar uma chave de acesso neste aparelho quando o
 * usuário ainda não possui nenhuma chave de acesso (passkey) e não recusou o convite aqui.
 */
export function PasskeyEnrollmentPrompt() {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [isOpen, setIsOpen] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);

    useEffect(() => {
        if (!PASSKEY_LOGIN_ENABLED || !userId) return;
        if (!consumePasskeyOfferPending()) return;
        if (getPasskeyDeviceState(userId)) return;

        let cancelled = false;

        void (async () => {
            if (!(await hasPlatformAuthenticator())) return;

            try {
                const passkeys = await passkeyService.list();
                if (!cancelled && passkeys.length === 0) setIsOpen(true);
            } catch (error) {
                // O convite é opcional: falhas aqui não devem atrapalhar o uso do sistema.
                console.warn('Não foi possível verificar chaves de acesso cadastradas:', error);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [userId]);

    if (!userId) return null;

    const handleDismiss = () => {
        setPasskeyDeviceState(userId, 'dismissed');
        setIsOpen(false);
    };

    const handleEnroll = async () => {
        setIsRegistering(true);
        try {
            await passkeyService.register();
            setPasskeyDeviceState(userId, 'enrolled');
            toast.success('Chave de acesso criada! No próximo acesso, toque em "Entrar com chave de acesso".');
            setIsOpen(false);
        } catch (error) {
            if (isPasskeyCeremonyInterrupted(error)) {
                setIsOpen(false);
                return;
            }
            toast.error(passkeyErrorMessage(error, 'Não foi possível criar a chave de acesso agora.'));
        } finally {
            setIsRegistering(false);
        }
    };

    return (
        <ConfirmDialog
            isOpen={isOpen}
            title="Criar uma chave de acesso neste aparelho?"
            message={(
                <>
                    <p style={{ margin: '0 0 0.75rem' }}>
                        Nos próximos acessos você entra com a digital, o rosto ou o PIN deste aparelho, sem digitar a senha.
                    </p>
                    <p style={{ margin: 0, color: 'var(--muted-text)', fontSize: '0.875rem' }}>
                        A biometria não é enviada ao sistema. Crie apenas em um aparelho que seja seu. Você pode gerenciar isso depois em Segurança.
                    </p>
                </>
            )}
            confirmText="Criar chave de acesso"
            loadingText="Aguardando confirmação..."
            cancelText="Agora não"
            onConfirm={() => void handleEnroll()}
            onCancel={handleDismiss}
            isLoading={isRegistering}
        />
    );
}
