import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowLeft,
    FileText,
    Home,
    Menu,
    Moon,
    ScrollText,
    Sun,
    User,
    Users
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { quadranteService, type QuadranteData } from '../../services/quadranteService';
import { quadrantePdfService } from '../../services/quadrantePdfService';

// Import Google Fonts
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

interface EncontroInfo {
    id: string;
    nome: string;
    tema: string | null;
    quadrante_pin: string | null;
    quadrante_ativo: boolean;
}

// --- Sub-componente para Cartões de Participantes ---
function ParticipantCard({ item, index }: { item: QuadranteData; index: number }) {
    const { theme } = useTheme();
    
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`participant-card ${theme === 'dark' ? 'dark' : ''}`}
        >
            <div className="card-photo-wrapper">
                {item.foto_url ? (
                    <img src={item.foto_url} alt={item.pessoas?.nome_completo} loading="lazy" />
                ) : (
                    <div className="photo-placeholder">
                        <User size={32} />
                    </div>
                )}
            </div>
            <div className="card-info">
                <h3>{item.pessoas?.nome_completo || 'Sem Nome'}</h3>
                {item.equipes && <span className="team-tag">{item.equipes.nome}</span>}
            </div>
        </motion.div>
    );
}

export function QuadrantePage() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<QuadranteData[]>([]);
    const [search] = useState('');
    const [encontro, setEncontro] = useState<EncontroInfo | null>(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [activeSection, setActiveSection] = useState<string>('');

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 90);
        };

        // Observer para detectar seção ativa
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const id = entry.target.id;
                    const sectionName = entry.target.getAttribute('data-section-name');
                    if (sectionName) setActiveSection(sectionName);
                    else if (id === 'inicio') setActiveSection('');
                }
            });
        }, { threshold: 0.2, rootMargin: '-80px 0px -50% 0px' });

        document.querySelectorAll('section[id]').forEach(section => {
            observer.observe(section);
        });

        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            observer.disconnect();
        };
    }, []);

    useEffect(() => {
        async function loadQuadrante() {
            if (!token) return;
            const pin = sessionStorage.getItem(`q_auth_${token}`);

            try {
                const { data: eData } = await supabase
                    .from('encontros')
                    .select('id, nome, tema, quadrante_pin, quadrante_ativo')
                    .eq('quadrante_token', token)
                    .single();

                if (!eData) throw new Error('Encontro não encontrado');

                if (!eData.quadrante_ativo) {
                    toast.error('Este Quadrante ainda não foi publicado pelo administrador.', { duration: 5000 });
                    setEncontro(eData);
                    setLoading(false);
                    return;
                }

                setEncontro(eData);

                if (eData.quadrante_pin && !pin) {
                    navigate(`/q/${token}`);
                    return;
                }

                const quadranteData = await quadranteService.obterDados(token);
                setData(quadranteData);
            } catch (error) {
                console.error('Erro ao carregar quadrante:', error);
                toast.error('Não foi possível carregar os dados.');
            } finally {
                setLoading(false);
            }
        }

        loadQuadrante();
    }, [token, navigate]);

    // Organizar dados por seções
    const { encontristasPorCirculo, encontreirosPorEquipe } = useMemo(() => {
        const term = search.toLowerCase();
        const filtered = data.filter(item =>
            item.pessoas?.nome_completo?.toLowerCase().includes(term)
        ).sort((a, b) => (a.pessoas?.nome_completo || '').localeCompare(b.pessoas?.nome_completo || ''));

        // Agrupar Encontristas por Círculo
        const encCirculo: Record<string, QuadranteData[]> = {};
        filtered.filter(item => item.participante).forEach(item => {
            const circleName = item.circulo_participacao?.[0]?.circulos.nome || 'Sem Círculo';
            if (!encCirculo[circleName]) encCirculo[circleName] = [];
            encCirculo[circleName].push(item);
        });

        // Agrupar Encontreiros por Equipe
        const encEquipe: Record<string, QuadranteData[]> = {};
        filtered.filter(item => !item.participante).forEach(item => {
            const teamName = item.equipes?.nome || 'Equipe Geral';
            if (!encEquipe[teamName]) encEquipe[teamName] = [];
            encEquipe[teamName].push(item);
        });

        return {
            encontristasPorCirculo: Object.entries(encCirculo).sort(([a], [b]) => a.localeCompare(b)),
            encontreirosPorEquipe: Object.entries(encEquipe).sort(([a], [b]) => a.localeCompare(b))
        };
    }, [data, search]);

    // Helper para gerar IDs seguros
    const slugify = (text: string) => text.toString().toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');

    const scrollToSection = (id: string) => {
        // Espera o layout estabilizar (caso o usuário tenha fechado manualmente antes)
        const element = document.getElementById(id);
        if (element) {
            const headerOffset = 80;
            const elementPosition = element.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });

            // Fecha o sidebar automaticamente APENAS no mobile/tablet ao navegar
            if (window.innerWidth <= 1024) {
                setSidebarOpen(false);
            }
        }
    };

    const [exporting, setExporting] = useState(false);

    const handleExportPDF = async () => {
        if (!encontro) return;
        setExporting(true);
        const loadingToast = toast.loading('Gerando Quadrante PDF...');

        try {
            await quadrantePdfService.generateYearbook(
                { id: encontro.id, nome: encontro.nome, tema: encontro.tema },
                data
            );
            toast.success('Quadrante PDF gerado com sucesso!', { id: loadingToast });
        } catch (error) {
            console.error('Erro ao gerar PDF:', error);
            toast.error('Erro ao gerar o PDF. Tente novamente.', { id: loadingToast });
        } finally {
            setExporting(false);
        }
    };

    if (loading) {
        return (
            <div className="loading-screen" style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#020617',
                color: 'white',
                zIndex: 9999,
                fontFamily: 'sans-serif'
            }}>
                <style>{`
                    .spinner-pdf {
                        width: 50px;
                        height: 50px;
                        border: 3px solid rgba(59, 130, 246, 0.2);
                        border-top-color: #3b82f6;
                        border-radius: 50%;
                        animation: spin-loading 1s linear infinite;
                        margin-bottom: 1.5rem;
                        filter: drop-shadow(0 0 10px rgba(59, 130, 246, 0.5));
                    }
                    @keyframes spin-loading {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
                <div className="spinner-pdf"></div>
                <p style={{ letterSpacing: '0.2em', fontSize: '0.8rem', fontWeight: 600, opacity: 0.6 }}>PREPARANDO QUADRANTE...</p>
            </div>
        );
    }

    return (
        <div className={`quadrante-spa-container ${theme === 'dark' ? 'dark-mode' : ''}`}>
            {/* Sidebar Navigation */}
            <aside className={`spa-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <button onClick={() => setSidebarOpen(false)} className="close-sidebar-btn" title="Fechar menu" style={{ gap: '0.5rem' }}>
                        <ArrowLeft size={18} /> Fechar
                    </button>
                </div>

                <nav className="sidebar-nav">
                    <button onClick={() => scrollToSection('inicio')} className="nav-item">
                        <Home size={18} /> Início
                    </button>
                    <div className="nav-group">
                        <button onClick={() => scrollToSection('encontristas')} className="nav-item">
                            <Users size={18} /> Encontristas
                        </button>
                        <div className="sub-menu">
                            {encontristasPorCirculo.map(([circle]) => (
                                <button
                                    key={circle}
                                    onClick={() => scrollToSection(`circulo-${slugify(circle)}`)}
                                    className="nav-item sub-item"
                                >
                                    {circle}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="nav-group">
                        <button
                            className="nav-item"
                            onClick={() => scrollToSection('encontreiros')}
                        >
                            <ScrollText size={20} style={{ minWidth: '20px' }} /> Encontreiros
                        </button>
                        <div className="sub-menu">
                            {encontreirosPorEquipe.map(([team]) => (
                                <button
                                    key={team}
                                    onClick={() => scrollToSection(`equipe-${slugify(team)}`)}
                                    className="nav-item sub-item"
                                >
                                    {team}
                                </button>
                            ))}
                        </div>
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <button onClick={toggleTheme} className="theme-toggle-btn">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                    </button>
                    <button
                        onClick={handleExportPDF}
                        className="nav-item pdf-export-btn"
                        disabled={exporting}
                    >
                        <FileText size={18} /> {exporting ? 'Gerando...' : 'Exportar Quadrante (PDF)'}
                    </button>
                    <button onClick={() => navigate('/login')} className="exit-btn">
                        <ArrowLeft size={18} /> Sair
                    </button>
                </div>
            </aside>

            {/* Header Overlay (Mobile & Desktop when Sidebar Closed) */}
            <div className={`mobile-header ${!sidebarOpen ? 'visible' : ''}`}>
                <button onClick={() => setSidebarOpen(true)} className="menu-btn">
                    <Menu size={24} style={{ width: 24, height: 24, flexShrink: 0 }} />
                </button>
                <h1 className={scrolled ? 'visible' : ''}>
                    {encontro?.nome}
                    {activeSection && <span className="section-dot">•</span>}
                    {activeSection && <span className="active-section-name">{activeSection}</span>}
                </h1>
                <button onClick={toggleTheme} className="menu-btn">
                    {theme === 'dark' ?
                        <Sun size={20} style={{ width: 20, height: 20, flexShrink: 0 }} /> :
                        <Moon size={20} style={{ width: 20, height: 20, flexShrink: 0 }} />
                    }
                </button>
            </div>

            {/* Content Area */}
            <main className={`spa-main-content ${sidebarOpen ? 'sidebar-open' : ''}`}>
                {/* Hero Section */}
                <section id="inicio" className="hero-section" data-section-name="">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="hero-card"
                    >
                        <span className="tag">QUADRANTE</span>
                        <h1>{encontro?.nome}</h1>
                        <p>{encontro?.tema || 'Bem-vindo ao registro visual de nossa jornada.'}</p>

                        {/* <div className="hero-search">
                            <Search size={20} />
                            <input
                                type="text"
                                placeholder="Quem você está procurando?"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div> */}

                        <div className="stats-pills">
                            <div className="pill"><strong>{data.filter(i => i.participante).length}</strong> Encontristas</div>
                            <div className="pill"><strong>{data.length - data.filter(i => i.participante).length}</strong> Encontreiros</div>
                        </div>
                    </motion.div>
                </section>

                {/* Encontristas Sections grouped by Circle */}
                <div id="encontristas" style={{ paddingBottom: '1px' }}></div>
                {encontristasPorCirculo.map(([circle, members]) => (
                    <section key={circle} id={`circulo-${slugify(circle)}`} className="content-section" data-section-name={circle}>
                        <div className="section-header">
                            <h2><Users size={24} /> {circle}</h2>
                            <div className="divider"></div>
                        </div>

                        <div className="quadrante-grid">
                            {members.map((item, idx) => (
                                <ParticipantCard key={item.id} item={item} index={idx} />
                            ))}
                        </div>
                    </section>
                ))}

                {/* Encontreiros Sections (Team Layout 50/50) */}
                <div id="encontreiros" style={{ paddingBottom: '1px' }}></div>
                {encontreirosPorEquipe.map(([team, members]) => (
                    <section key={team} id={`equipe-${slugify(team)}`} className="content-team-section" data-section-name={team}>
                        <div className="team-layout">
                            <div className="team-visual">
                                <div className="team-photo-container">
                                    {members[0]?.equipes?.foto_url ? (
                                        <img 
                                            src={members[0].equipes.foto_url} 
                                            alt={team} 
                                            loading="lazy" 
                                            style={{ objectPosition: `center ${members[0].equipes.foto_posicao_y ?? 50}%` }}
                                        />
                                    ) : (
                                        <div className="team-photo-stub">
                                            <Users size={60} />
                                            <span>Foto da Equipe</span>
                                        </div>
                                    )}
                                    {/* <div className="team-badge">{team}</div> */}
                                </div>
                            </div>

                            <div className="team-members-list">
                                <div className="list-header">
                                    <h3>{team}</h3>
                                    <div className="line"></div>
                                </div>
                                <ol className="numbered-list">
                                    {members
                                        .sort((a, b) => a.pessoas.nome_completo.localeCompare(b.pessoas.nome_completo))
                                        .map((member, mIdx) => (
                                            <li key={member.id} className="member-item">
                                                <span className="number">{(mIdx + 1).toString().padStart(2, '0')}</span>
                                                <span className="name">{member.pessoas.nome_completo}</span>
                                            </li>
                                        ))
                                    }
                                </ol>
                            </div>
                        </div>
                    </section>
                ))}

                <footer className="spa-footer">
                    <p>© {new Date().getFullYear()} EJC • Capelinha</p>
                </footer>
            </main>

            {/* Sidebar Overlay for Mobile */}
            <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="sidebar-overlay"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>

            <style>{`
                :root {
                    --bg-color: #f8fafc;
                    --text-color: #0f172a;
                    --sidebar-bg: #ffffff;
                    --card-bg: #ffffff;
                    --border-color: #e2e8f0;
                    --primary-color: #2563eb;
                    --hero-gradient: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
                    --glass-bg: rgba(255, 255, 255, 0.7);
                    --glass-border: rgba(255, 255, 255, 0.4);
                    --font-main: 'Outfit', sans-serif;
                }

                .dark-mode {
                    --bg-color: #020617;
                    --text-color: #f8fafc;
                    --sidebar-bg: #0b0f1a;
                    --card-bg: #0f172a;
                    --border-color: #1e293b;
                    --primary-color: #3b82f6;
                    --hero-gradient: linear-gradient(135deg, #0f172a 0%, #020617 100%);
                    --glass-bg: rgba(15, 23, 42, 0.7);
                    --glass-border: rgba(255, 255, 255, 0.05);
                }

                * {
                    font-family: var(--font-main);
                }

                .quadrante-spa-container {
                    display: flex;
                    min-height: 100vh;
                    background: var(--bg-color);
                    color: var(--text-color);
                    transition: all 0.3s ease;
                }

                /* Sidebar Styles */
                .spa-sidebar {
                    width: 280px;
                    background: var(--sidebar-bg);
                    border-right: 1px solid var(--border-color);
                    position: fixed;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    z-index: 1000;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    transform: translateX(-100%);
                }

                .spa-sidebar.open {
                    transform: translateX(0);
                }

                .sidebar-header {
                    padding: 1.5rem;
                    border-bottom: 1px solid var(--border-color);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .brand {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    font-weight: 800;
                    font-size: 1.1rem;
                }

                .brand .icon {
                    width: 32px;
                    height: 32px;
                    background: var(--primary-color);
                    color: white;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .close-sidebar-btn {
                    padding: 0.5rem 1rem;
                    background: var(--border-color);
                    border: none;
                    color: var(--text-color);
                    cursor: pointer;
                    opacity: 1;
                    border-radius: 8px;
                    transition: 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 0.85rem;
                    font-weight: 600;
                }

                .close-sidebar-btn:hover {
                    background: #ef4444;
                    color: white;
                }

                .sidebar-nav {
                    flex: 1;
                    padding: 1.5rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .nav-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    border-radius: 10px;
                    border: none;
                    background: transparent;
                    color: var(--text-color);
                    font-weight: 600;
                    font-size: 0.9rem;
                    cursor: pointer;
                    text-align: left;
                    transition: 0.2s;
                }

                .nav-item:hover {
                    background: var(--primary-color);
                    color: white;
                    transform: translateX(4px);
                }

                .nav-group {
                    display: flex;
                    flex-direction: column;
                }

                .sub-menu {
                    display: flex;
                    flex-direction: column;
                    border-left: 2px solid var(--border-color);
                    margin-left: 1.8rem;
                    margin-top: 0.25rem;
                    padding-left: 0.5rem;
                }

                .sub-item {
                    font-size: 0.8rem;
                    padding: 0.5rem 1rem;
                    opacity: 0.8;
                }

                .sidebar-footer {
                    padding: 1.5rem;
                    border-top: 1px solid var(--border-color);
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .theme-toggle-btn, .exit-btn, .pdf-export-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    border-radius: 10px;
                    border: 1px solid var(--border-color);
                    background: var(--card-bg);
                    color: var(--text-color);
                    font-weight: 600;
                    cursor: pointer;
                    font-size: 0.85rem;
                    transition: 0.2s;
                    width: 100%;
                    text-align: left;
                }

                .pdf-export-btn {
                    color: var(--primary-color);
                    border-color: color-mix(in srgb, var(--primary-color) 30%, transparent);
                    background: color-mix(in srgb, var(--primary-color) 5%, transparent);
                    margin-bottom: 0.5rem;
                }

                .pdf-export-btn:hover:not(:disabled) {
                    background: var(--primary-color);
                    color: white;
                }

                .pdf-export-btn:disabled {
                    opacity: 0.5;
                    cursor: wait;
                }

                .exit-btn:hover {
                    background: #ef4444;
                    color: white;
                    border-color: #ef4444;
                }

                /* Main Content Styles */
                .spa-main-content {
                    flex: 1;
                    margin-left: 0;
                    padding: 0;
                    padding-top: 64px; /* Adicionado padding para o header colapsado */
                    scroll-behavior: smooth;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .spa-main-content.sidebar-open {
                    margin-left: 280px;
                    padding-top: 0;
                }

                /* Sub-menu Styles */
                .sub-menu {
                    padding-left: 3rem;
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                    margin-bottom: 0.5rem;
                }

                .sub-item {
                    font-size: 0.8rem !important;
                    padding: 0.4rem 0.75rem !important;
                    opacity: 0.6;
                    background: transparent !important;
                    border: none !important;
                }

                .sub-item:hover {
                    opacity: 1;
                    color: var(--primary-color) !important;
                }

                @media (max-width: 1024px) {
                    .spa-main-content.sidebar-open {
                        margin-left: 0;
                    }
                }

                .hero-section {
                    min-height: 50vh;
                    background: var(--hero-gradient);
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem 2rem;
                    text-align: center;
                }

                .hero-card {
                    max-width: 700px;
                    width: 100%;
                }

                .hero-card .tag {
                    background: var(--primary-color);
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 0.7rem;
                    font-weight: 800;
                    letter-spacing: 0.1em;
                    margin-bottom: 1.5rem;
                    display: inline-block;
                }

                .hero-card h1 {
                    font-size: clamp(2rem, 5vw, 3.5rem);
                    margin: 0 0 1rem;
                    color: white;
                }

                .hero-card p {
                    font-size: 1.6rem;
                    opacity: 0.9;
                    margin-bottom: 2.5rem;
                    font-style: italic;
                    font-weight: 300;
                    letter-spacing: 0.02em;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.3);
                }

                .hero-search {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    padding: 0.5rem 1.5rem;
                    border-radius: 100px;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    transition: 0.3s;
                }

                .hero-search:focus-within {
                    background: white;
                    color: #0f172a;
                    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3);
                }

                .hero-search input {
                    background: transparent;
                    border: none;
                    color: inherit;
                    width: 100%;
                    padding: 0.75rem 0;
                    font-size: 1.1rem;
                    outline: none;
                }

                .hero-search input::placeholder { color: inherit; opacity: 0.5; }

                .stats-pills {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                }

                .pill {
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 6px 16px;
                    border-radius: 100px;
                    font-size: 0.85rem;
                }

                .content-section {
                    padding: 4rem 5%;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .section-header {
                    margin-bottom: 3rem;
                }

                .section-header h2 {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    font-size: 1.8rem;
                    margin-bottom: 1rem;
                }

                .section-header .divider {
                    height: 4px;
                    width: 60px;
                    background: var(--primary-color);
                    border-radius: 2px;
                }

                .content-team-section {
                    padding: 4rem 5%;
                    max-width: 1400px;
                    margin: 0 auto;
                }

                .team-layout {
                    display: flex;
                    flex-direction: column;
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 30px;
                    overflow: hidden;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.05);
                    max-width: 1200px;
                    margin: 0 auto;
                }

                @media (max-width: 900px) {
                    .team-layout { grid-template-columns: 1fr; gap: 0; }
                    .content-team-section { padding: 2rem 1rem; }
                }

                .team-visual {
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    max-height: 500px;
                    position: relative;
                }

                @media (max-width: 900px) {
                    .team-visual { 
                        aspect-ratio: 4 / 3;
                    }
                }

                .team-photo-container {
                    width: 100%;
                    height: 100%;
                    position: relative;
                }

                .team-photo-container img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .team-photo-stub {
                    width: 100%;
                    height: 100%;
                    background: radial-gradient(circle at center, #1e293b, #020617);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 1.5rem;
                    color: var(--primary-color);
                }

                .team-photo-stub svg {
                    opacity: 0.2;
                    filter: drop-shadow(0 0 20px var(--primary-color));
                }

                .team-photo-stub span {
                    font-size: 0.9rem;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    opacity: 0.4;
                    color: white;
                }

                .team-badge {
                    position: absolute;
                    top: 2rem;
                    left: 2rem;
                    background: rgba(59, 130, 246, 0.1);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(59, 130, 246, 0.3);
                    color: white;
                    padding: 8px 18px;
                    border-radius: 12px;
                    font-weight: 700;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                    z-index: 10;
                }

                .team-members-list {
                    padding: 3rem;
                    display: flex;
                    flex-direction: column;
                }

                @media (max-width: 640px) {
                    .team-members-list { padding: 2rem 1.5rem; }
                }

                .list-header {
                    margin-bottom: 2rem;
                }

                .list-header h3 {
                    font-size: 1.5rem;
                    margin: 0 0 0.5rem 0;
                    font-weight: 800;
                }

                .list-header .line {
                    height: 4px;
                    width: 40px;
                    background: var(--primary-color);
                    border-radius: 2px;
                }

                .numbered-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 1rem;
                }

                @media (max-width: 1200px) {
                    .numbered-list { grid-template-columns: repeat(3, 1fr); }
                }

                @media (max-width: 900px) {
                    .numbered-list { grid-template-columns: repeat(2, 1fr); }
                }

                @media (max-width: 600px) {
                    .numbered-list { grid-template-columns: 1fr; }
                }

                .quadrante-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
                    gap: 1.5rem;
                    padding: 0;
                    margin-bottom: 3rem;
                }

                .member-item {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    padding: 1rem 1.25rem;
                    background: var(--glass-bg);
                    border: 1px solid var(--glass-border);
                    border-radius: 16px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .member-item:hover {
                    background: var(--card-bg);
                    border-color: var(--primary-color);
                    transform: translateY(-3px) scale(1.02);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.1);
                }

                .member-item .number {
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(59, 130, 246, 0.1);
                    border-radius: 8px;
                    font-weight: 800;
                    font-size: 0.75rem;
                    color: var(--primary-color);
                }

                .member-item .name {
                    font-weight: 500;
                    font-size: 0.95rem;
                    letter-spacing: -0.01em;
                }

                .spa-footer {
                    padding: 4rem 2rem;
                    text-align: center;
                    font-size: 0.85rem;
                    opacity: 0.5;
                    border-top: 1px solid var(--border-color);
                }

                /* Mobile Floating Header Styles */
                .mobile-header {
                    display: flex;
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 64px;
                    background: color-mix(in srgb, var(--bg-color) 85%, transparent);
                    backdrop-filter: blur(20px) saturate(180%);
                    -webkit-backdrop-filter: blur(20px) saturate(180%);
                    border-bottom: 1px solid var(--border-color);
                    z-index: 900;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 1rem;
                    transform: translateY(-100%);
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 4px 30px rgba(0, 0, 0, 0.03);
                }

                .mobile-header.visible {
                    transform: translateY(0);
                }

                .mobile-header h1 {
                    font-size: 1.1rem;
                    font-weight: 800;
                    margin: 0;
                    max-width: 200px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    letter-spacing: -0.02em;
                    background: linear-gradient(to bottom, var(--text-color), color-mix(in srgb, var(--text-color) 70%, transparent));
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    opacity: 0;
                    transform: translateY(10px);
                    transition: all 0.4s ease;
                }

                .mobile-header h1.visible {
                    opacity: 1;
                    transform: translateY(0);
                }

                .active-section-name {
                    font-size: 0.9rem;
                    font-weight: 500;
                    opacity: 0.7;
                    color: var(--text-color);
                    -webkit-text-fill-color: initial;
                }

                .section-dot {
                    margin: 0 0.5rem;
                    opacity: 0.3;
                    font-weight: 300;
                    -webkit-text-fill-color: initial;
                }

                .menu-btn {
                    width: 44px;
                    height: 44px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid var(--border-color);
                    color: var(--text-color);
                    cursor: pointer;
                    border-radius: 14px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    backdrop-filter: blur(8px);
                }

                .dark-mode .menu-btn {
                    background: rgba(0, 0, 0, 0.2);
                }

                .menu-btn:hover {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                    transform: translateY(-2px);
                    box-shadow: 0 8px 20px rgba(37, 99, 235, 0.3);
                }

                .menu-btn svg {
                    width: 24px !important;
                    height: 24px !important;
                    flex-shrink: 0 !important;
                    display: block;
                }

                .sidebar-overlay {
                    display: none;
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                    z-index: 950;
                }

                .loading-screen {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    background: var(--bg-color);
                }

                .loading-content {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 1.5rem;
                }

                .spinner {
                    width: 50px;
                    height: 50px;
                    border: 3px solid color-mix(in srgb, var(--primary-color) 20%, transparent);
                    border-top-color: var(--primary-color);
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    filter: drop-shadow(0 0 10px var(--primary-color));
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }

                /* Participant Cards Styles */
                .participant-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 20px;
                    overflow: hidden;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    flex-direction: column;
                }

                .participant-card:hover {
                    transform: translateY(-8px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    border-color: var(--primary-color);
                }

                .card-photo-wrapper {
                    aspect-ratio: 1/1;
                    background: color-mix(in srgb, var(--primary-color) 5%, transparent);
                    overflow: hidden;
                    position: relative;
                }

                .card-photo-wrapper img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .photo-placeholder {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--text-color);
                    opacity: 0.2;
                }

                .card-info {
                    padding: 1.25rem;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .card-info h3 {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                    line-height: 1.2;
                }

                .team-tag {
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    background: var(--primary-color);
                    color: white;
                    padding: 2px 8px;
                    border-radius: 6px;
                    align-self: center;
                    letter-spacing: 0.05em;
                }

                @media (max-width: 1024px) {
                    .spa-main-content { padding-top: 64px; }
                    .mobile-header { display: flex; transform: translateY(0); }
                    .sidebar-overlay { display: block; }
                }

                @media (max-width: 640px) {
                    .quadrante-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 1rem;
                    }
                    .hero-section { padding: 3rem 1rem; }
                    .stats-pills { flex-direction: column; align-items: center; gap: 0.5rem; }
                }
            `}</style>
        </div>
    );
}

// --- Fim do QuadrantePage ---
