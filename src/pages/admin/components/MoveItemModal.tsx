import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Folder, ChevronRight, ChevronDown, Check, Loader, Home } from 'lucide-react';
import { bibliotecaService, type BibliotecaPasta } from '../../../services/bibliotecaService';

interface MoveItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onMove: (targetFolderId: string | null) => Promise<void>;
    itemName: string;
    itemType: 'pasta' | 'arquivo';
    currentFolderId: string | null;
    itemIdToMove: string; // Used to prevent moving a folder inside itself
}

interface FolderNode extends BibliotecaPasta {
    children?: FolderNode[];
    isExpanded?: boolean;
    isLoaded?: boolean;
}

export function MoveItemModal({ isOpen, onClose, onMove, itemName, itemType, currentFolderId, itemIdToMove }: MoveItemModalProps) {
    const [rootFolders, setRootFolders] = useState<FolderNode[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedFolderId, setSelectedFolderId] = useState<string | null>(currentFolderId);
    const [isMoving, setIsMoving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedFolderId(currentFolderId);
            loadRootFolders();
        }
    }, [isOpen, currentFolderId]);

    const loadRootFolders = async () => {
        setLoading(true);
        try {
            const pastas = await bibliotecaService.listarPastas(null);
            // Don't show the folder being moved in the tree
            const filtered = pastas.filter(p => p.id !== itemIdToMove);
            setRootFolders(filtered.map(p => ({ ...p, isExpanded: false, isLoaded: false })));
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadChildren = async (folder: FolderNode, tree: FolderNode[]): Promise<FolderNode[]> => {
        if (folder.isLoaded) {
            return tree.map(node => {
                if (node.id === folder.id) return { ...node, isExpanded: !node.isExpanded };
                if (node.children) return { ...node, children: loadChildrenSync(folder, node.children) };
                return node;
            });
        }

        const children = await bibliotecaService.listarPastas(folder.id);
        const filteredChildren = children.filter(p => p.id !== itemIdToMove);

        return tree.map(node => {
            if (node.id === folder.id) {
                return { ...node, children: filteredChildren.map(p => ({ ...p, isExpanded: false, isLoaded: false })), isExpanded: true, isLoaded: true };
            }
            if (node.children) {
                return { ...node, children: updateTreeWithChildren(folder.id, filteredChildren, node.children) };
            }
            return node;
        });
    };

    const loadChildrenSync = (targetFolder: FolderNode, tree: FolderNode[]): FolderNode[] => {
        return tree.map(node => {
            if (node.id === targetFolder.id) return { ...node, isExpanded: !node.isExpanded };
            if (node.children) return { ...node, children: loadChildrenSync(targetFolder, node.children) };
            return node;
        });
    };

    const updateTreeWithChildren = (parentId: string, children: BibliotecaPasta[], tree: FolderNode[]): FolderNode[] => {
        return tree.map(node => {
            if (node.id === parentId) {
                return { ...node, children: children.map(p => ({ ...p, isExpanded: false, isLoaded: false })), isExpanded: true, isLoaded: true };
            }
            if (node.children) {
                return { ...node, children: updateTreeWithChildren(parentId, children, node.children) };
            }
            return node;
        });
    };

    const handleToggleExpand = async (folder: FolderNode, e: React.MouseEvent) => {
        e.stopPropagation();
        const newTree = await loadChildren(folder, rootFolders);
        setRootFolders(newTree);
    };

    const handleMove = async () => {
        if (selectedFolderId === currentFolderId) {
            onClose();
            return;
        }
        setIsMoving(true);
        try {
            await onMove(selectedFolderId);
            onClose();
        } finally {
            setIsMoving(false);
        }
    };

    const renderTree = (nodes: FolderNode[], level = 0) => {
        return nodes.map(node => (
            <div key={node.id}>
                <div 
                    className={`folder-tree-node ${selectedFolderId === node.id ? 'selected' : ''}`}
                    style={{ paddingLeft: `${level * 1.5}rem` }}
                    onClick={() => setSelectedFolderId(node.id)}
                >
                    <button 
                        className="expand-btn" 
                        onClick={(e) => handleToggleExpand(node, e)}
                        style={{ visibility: 'visible' }} // We could check if it has children, but for laziness we always show arrow initially
                    >
                        {node.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <Folder size={18} color="#64748b" style={{ marginRight: '0.5rem' }} />
                    <span className="folder-name">{node.nome}</span>
                    {selectedFolderId === node.id && <Check size={16} color="var(--primary-color)" style={{ marginLeft: 'auto' }} />}
                </div>
                {node.isExpanded && node.children && (
                    <div className="folder-children">
                        {node.children.length === 0 ? (
                            <div style={{ paddingLeft: `${(level + 1) * 1.5}rem`, padding: '0.5rem 0 0.5rem 2rem', fontSize: '0.8rem', color: 'var(--muted-text)' }}>
                                Pasta vazia
                            </div>
                        ) : (
                            renderTree(node.children, level + 1)
                        )}
                    </div>
                )}
            </div>
        ));
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Mover ${itemType === 'pasta' ? 'Pasta' : 'Arquivo'}`}
            maxWidth="500px"
        >
            <div style={{ marginBottom: '1rem', color: 'var(--text-color)', fontSize: '0.95rem' }}>
                Selecione o destino para <strong>{itemName}</strong>:
            </div>

            <div className="tree-container" style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                maxHeight: '300px',
                overflowY: 'auto',
                backgroundColor: 'var(--surface-1)',
                padding: '0.5rem'
            }}>
                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                        <Loader className="animate-spin" size={24} color="var(--primary-color)" />
                    </div>
                ) : (
                    <>
                        <div 
                            className={`folder-tree-node ${selectedFolderId === null ? 'selected' : ''}`}
                            onClick={() => setSelectedFolderId(null)}
                        >
                            <Home size={18} color="var(--primary-color)" style={{ marginRight: '0.5rem', marginLeft: '1.5rem' }} />
                            <span className="folder-name" style={{ fontWeight: 600 }}>Início (Raiz)</span>
                            {selectedFolderId === null && <Check size={16} color="var(--primary-color)" style={{ marginLeft: 'auto' }} />}
                        </div>
                        {renderTree(rootFolders)}
                    </>
                )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button type="button" className="btn-cancel" onClick={onClose} disabled={isMoving}>Cancelar</button>
                <button type="button" className="btn-primary" onClick={handleMove} disabled={isMoving}>
                    {isMoving ? <Loader className="animate-spin" size={16} /> : 'Mover para cá'}
                </button>
            </div>

            <style>{`
                .folder-tree-node {
                    display: flex;
                    align-items: center;
                    padding: 0.5rem;
                    cursor: pointer;
                    border-radius: 6px;
                    transition: background-color 0.2s;
                }
                .folder-tree-node:hover {
                    background-color: var(--bg-color);
                }
                .folder-tree-node.selected {
                    background-color: rgba(37, 99, 235, 0.1);
                }
                .expand-btn {
                    background: none;
                    border: none;
                    padding: 0.2rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--muted-text);
                }
                .expand-btn:hover {
                    color: var(--text-color);
                }
                .folder-name {
                    font-size: 0.95rem;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            `}</style>
        </Modal>
    );
}
