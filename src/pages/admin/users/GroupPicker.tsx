import type { AdminGroup } from './usersAdminModel';

interface GroupPickerProps {
    grupos: AdminGroup[];
    groupModules: Record<string, string[]>;
    selectedIds: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}

/** Lista de perfis com a descrição e os módulos que cada um libera. */
export function GroupPicker({ grupos, groupModules, selectedIds, onChange, disabled = false }: GroupPickerProps) {
    const toggle = (grupoId: string) => {
        onChange(selectedIds.includes(grupoId)
            ? selectedIds.filter(id => id !== grupoId)
            : [...selectedIds, grupoId]);
    };

    if (grupos.length === 0) return <p className="text-muted">Nenhum perfil cadastrado em “Grupos e Acessos”.</p>;

    return (
        <div className="users-group-list">
            {grupos.map(grupo => {
                const active = selectedIds.includes(grupo.id);
                const modules = groupModules[grupo.id] || [];
                return (
                    <label key={grupo.id} className={`users-group${active ? ' users-group--active' : ''}`}>
                        <input type="checkbox" checked={active} disabled={disabled} onChange={() => toggle(grupo.id)} />
                        <span className="users-group__body">
                            <strong>{grupo.nome}</strong>
                            {grupo.descricao && <small>{grupo.descricao}</small>}
                            {modules.length > 0 && (
                                <small className="users-group__modules">
                                    Libera: {modules.slice(0, 6).join(', ')}{modules.length > 6 ? ` e mais ${modules.length - 6}` : ''}
                                </small>
                            )}
                        </span>
                    </label>
                );
            })}
        </div>
    );
}
