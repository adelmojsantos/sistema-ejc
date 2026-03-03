import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ConfirmDialog } from './ConfirmDialog';

export function Header() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
    const [isSigningOut, setIsSigningOut] = useState(false);
    const { theme, toggleTheme } = useTheme();
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleSignOutConfirm = async () => {
        setIsSigningOut(true);
        try {
            await signOut();
            navigate('/login');
        } catch (error) {
            console.error("Failed to sign out", error);
        } finally {
            setIsSigningOut(false);
            setIsSignOutModalOpen(false);
        }
    };

    const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);

    const NavItems = () => (
        <>
            <Link to="/" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Início</Link>
            <Link to="/inscricao" className="nav-link" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }} onClick={() => setIsMobileMenuOpen(false)}>Inscrição</Link>
            <Link to="/secretaria" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Secretaria</Link>
            <Link to="/cadastros/montagem-visitacao" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Visitação</Link>
            <Link to="/cadastros/montagem-circulos" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Círculos</Link>
            <Link to="/cadastros" className="nav-link" onClick={() => setIsMobileMenuOpen(false)}>Cadastros</Link>
        </>
    );

    return (
        <header className="header">
            <div className="container flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/" className="flex items-center gap-2" style={{ textDecoration: 'none', color: 'var(--text-color)' }}>
                        {/* <LogoImage height='50rem' width='auto' /> */}
                        <span style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '0.05em' }}>EJC - Capelinha</span>
                    </Link>

                </div>

                {/* Desktop Navigation */}
                <nav className="nav-links">
                    <NavItems />
                    <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-color)', margin: '0 0.5rem' }} />
                    <button
                        onClick={toggleTheme}
                        className="mobile-menu-btn"
                        aria-label="Toggle theme"
                    >
                        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                    <button
                        onClick={() => setIsSignOutModalOpen(true)}
                        className="mobile-menu-btn"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}
                        title="Sair"
                    >
                        <LogOut size={20} />
                    </button>
                </nav>

                {/* Mobile menu and theme toggle */}
                <div className="flex items-center gap-2 mobile-controls-container">
                    <style>{`
            @media (min-width: 768px) {
              .mobile-controls-container { display: none !important; }
            }
          `}</style>
                    <button onClick={toggleTheme} className="mobile-menu-btn" aria-label="Toggle theme">
                        {theme === 'dark' ? <Sun size={24} /> : <Moon size={24} />}
                    </button>
                    <button onClick={toggleMobileMenu} className="mobile-menu-btn" aria-label="Menu">
                        {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            {isMobileMenuOpen && (
                <nav className="mobile-nav mobile-controls-container">
                    <NavItems />
                    <button
                        onClick={() => setIsSignOutModalOpen(true)}
                        className="nav-link"
                        style={{ background: 'none', border: 'none', textAlign: 'left', padding: 0, display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontSize: '1rem', marginTop: '0.5rem' }}
                    >
                        <LogOut size={20} /> Sair
                    </button>
                </nav>
            )}

            <ConfirmDialog
                isOpen={isSignOutModalOpen}
                title="Sair do sistema"
                message="Tem certeza que quer desconectar sua conta?"
                confirmText="Sair"
                cancelText="Cancelar"
                onConfirm={handleSignOutConfirm}
                onCancel={() => setIsSignOutModalOpen(false)}
                isLoading={isSigningOut}
                isDestructive={true}
            />
        </header>
    );
}
