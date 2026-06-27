import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowLeft,
    Printer,
    Home,
    Menu,
    Moon,
    ScrollText,
    Sun,
    User,
    Users,
    Mic2,
    Music,
    ExternalLink
} from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-hot-toast';
import { useNavigate, useParams } from 'react-router-dom';
import { useTheme } from '../../contexts/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { quadranteService, type QuadranteData } from '../../services/quadranteService';
import { palestraService } from '../../services/palestraService';
import { recreacaoService } from '../../services/recreacaoService';
import type { Palestra } from '../../types/palestra';
import type { RecreacaoQuadranteDados } from '../../types/recreacao';
import { quadranteVisibilityDefault, type QuadranteVisibilityConfig } from '../../types/encontro';
import logoCapelinha from '../../assets/logo_capelinha.png';

// Import Google Fonts
const fontLink = document.createElement('link');
fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap';
fontLink.rel = 'stylesheet';
document.head.appendChild(fontLink);

interface EncontroInfo {
    id: string;
    nome: string;
    tema: string | null;
    data_inicio: string | null;
    data_fim: string | null;
    local: string | null;
    edicao: number | null;
    quadrante_ativo: boolean;
    logo_url: string | null;
    simbologia_texto: string | null;
    tematica_texto: string | null;
    musica: string | null;
    musica_letra: string | null;
    link_youtube: string | null;
    link_musica: string | null;
    quadrante_visibilidade: QuadranteVisibilityConfig | null;
}

function getOptimizedImageUrl(url: string | null | undefined, width: number, height?: number): string {
    if (!url) return '';
    if (url.includes('/storage/v1/object/public/')) {
        const baseUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
        const params = new URLSearchParams();
        params.set('width', width.toString());
        if (height) params.set('height', height.toString());
        params.set('resize', 'cover');
        params.set('quality', '80');
        return `${baseUrl}?${params.toString()}`;
    }
    return url;
}

// --- Sub-componente para Cartões de Participantes ---
function ParticipantCard({ item }: { item: QuadranteData }) {
    const { theme } = useTheme();
    const originalUrl = item.foto_url || '';
    const optimizedUrl = getOptimizedImageUrl(originalUrl, 200, 250);

    return (
        <div className={`participant-card ${theme === 'dark' ? 'dark' : ''}`}>
            <div className="card-photo-wrapper">
                {item.foto_url ? (
                    <img 
                        src={optimizedUrl} 
                        alt={item.pessoas?.nome_completo} 
                        loading="eager" 
                        onError={(e) => {
                            if (e.currentTarget.src !== originalUrl) {
                                e.currentTarget.src = originalUrl;
                            }
                        }}
                        style={{ objectPosition: `center ${item.foto_posicao_y ?? 50}%` }}
                    />
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
        </div>
    );
}

function formatarDatasEncontro(inicioStr?: string | null, fimStr?: string | null) {
    if (!inicioStr || !fimStr) return '';
    
    const meses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    
    const parseDate = (str: string) => {
        const parts = str.split('-');
        return {
            ano: parseInt(parts[0], 10),
            mes: parseInt(parts[1], 10) - 1,
            dia: parseInt(parts[2], 10)
        };
    };
    
    try {
        const inicio = parseDate(inicioStr);
        const fim = parseDate(fimStr);
        
        if (inicio.mes === fim.mes && inicio.ano === fim.ano) {
            if (fim.dia - inicio.dia === 2) {
                return `${inicio.dia}, ${inicio.dia + 1} e ${fim.dia} de ${meses[inicio.mes]} de ${inicio.ano}`;
            }
            return `${inicio.dia} a ${fim.dia} de ${meses[inicio.mes]} de ${inicio.ano}`;
        }
        
        return `${inicio.dia} de ${meses[inicio.mes]} a ${fim.dia} de ${meses[fim.mes]} de ${inicio.ano}`;
    } catch (e) {
        console.error('Erro ao formatar datas:', e);
        return '';
    }
}

function isEquipeRecreacaoInfantil(nome: string) {
    const normalized = nome
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\./g, '')
        .trim();

    return normalized === 'recreacao infantil' || normalized === 'recreacao inf';
}

function formatarResponsavelQuadrante(
    responsavel?: { pessoas?: { nome_completo?: string | null }; equipes?: { nome?: string | null } } | null
) {
    const nome = responsavel?.pessoas?.nome_completo?.trim();
    if (!nome) return null;

    const equipe = responsavel?.equipes?.nome?.trim();
    return equipe ? `${nome} · ${equipe}` : nome;
}


export function QuadrantePage({ isAdminView = false }: { isAdminView?: boolean }) {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { theme, toggleTheme } = useTheme();
    const { session, loading: authLoading, hasPermission } = useAuth();

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<QuadranteData[]>([]);
    const [criancasRecreacao, setCriancasRecreacao] = useState<RecreacaoQuadranteDados[]>([]);
    const [search] = useState('');
    const [encontro, setEncontro] = useState<EncontroInfo | null>(null);
    const [palestras, setPalestras] = useState<Palestra[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(() => window.matchMedia('(min-width: 1025px)').matches);
    const [scrolled, setScrolled] = useState(false);
    const [activeSection, setActiveSection] = useState<string>('');
    const [printOptimized, setPrintOptimized] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.get('print') === 'true';
    });
    const printRef = useRef<HTMLDivElement>(null);
    const handlePrint = useReactToPrint({
        contentRef: printRef,
        documentTitle: `Quadrante - ${encontro?.nome || 'EJC'}`,
        pageStyle: `
            @page {
                size: A4 portrait;
                margin: 0;
            }
        `,
        onBeforePrint: async () => {
            flushSync(() => setPrintOptimized(true));
            await waitForPrintReady(printRef.current);
        },
        onAfterPrint: () => {
            const params = new URLSearchParams(window.location.search);
            if (params.get('print') === 'true') {
                window.close();
                return;
            }
            setPrintOptimized(false);
        },
    });

    useEffect(() => {
        if (printOptimized) return;

        const handleScroll = () => {
            setScrolled(window.scrollY > 90);
        };

        const handleResize = () => {
            if (window.matchMedia('(max-width: 1024px)').matches) {
                setSidebarOpen(false);
            }
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
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
            observer.disconnect();
        };
    }, [printOptimized]);

    useEffect(() => {
        async function loadQuadrante() {
            if (authLoading) return;
            if (!token) return;
            const pin = sessionStorage.getItem(`q_auth_${token}`);

            try {
                const isAdmin = !!session && hasPermission('modulo_admin');

                // Se for a rota admin, mas o usuário NÃO estiver logado como tal, manda pro fluxo público
                if (isAdminView && !isAdmin) {
                    navigate(`/q/${token}${window.location.search}`);
                    return;
                }

                const publicInfo = await quadranteService.obterInfoPublica(token);

                if (!publicInfo) throw new Error('Encontro não encontrado');

                // Bypass Admin: Se estiver logado, ignora as restrições de PIN e Ativo
                if (!isAdmin) {
                    if (!publicInfo.quadrante_ativo) {
                        toast.error('Este Quadrante ainda não foi publicado pelo administrador.', { duration: 5000 });
                        setLoading(false);
                        return;
                    }

                    if (publicInfo.tem_pin && !pin) {
                        navigate(`/q/${token}${window.location.search}`);
                        return;
                    }
                } else if (!publicInfo.quadrante_ativo) {
                    toast('Modo Visualização (Administrador)', { icon: '🛡️' });
                }

                const { data: eData } = await supabase
                    .from('encontros')
                    .select('id, nome, tema, data_inicio, data_fim, local, edicao, quadrante_ativo, logo_url, simbologia_texto, tematica_texto, musica, musica_letra, link_youtube, link_musica, quadrante_visibilidade')
                    .eq('quadrante_token', token)
                    .single();

                if (!eData) throw new Error('Encontro não encontrado');

                setEncontro({
                    ...eData,
                    quadrante_visibilidade: {
                        ...quadranteVisibilityDefault,
                        ...(eData.quadrante_visibilidade || {})
                    }
                });

                const [quadranteData, palestrasData, criancasData] = await Promise.all([
                    quadranteService.obterDados(token, isAdmin),
                    palestraService.listarPorEncontro(eData.id),
                    recreacaoService.listarQuadrantePorEncontro(eData.id)
                ]);

                setData(quadranteData);
                setPalestras(palestrasData);
                setCriancasRecreacao(criancasData);
            } catch (error) {
                console.error('Erro ao carregar quadrante:', error);
                toast.error('Não foi possível carregar os dados.');
            } finally {
                setLoading(false);
            }
        }

        loadQuadrante();
    }, [authLoading, hasPermission, isAdminView, navigate, session, token]);

    useEffect(() => {
        if (!loading && encontro && data.length > 0) {
            const params = new URLSearchParams(window.location.search);
            if (isAdminView && params.get('print') === 'true') {
                const timer = setTimeout(() => {
                    handlePrint();
                }, 1500);
                return () => clearTimeout(timer);
            }
        }
    }, [loading, encontro, data, handlePrint, isAdminView]);

    const visibility = encontro?.quadrante_visibilidade || quadranteVisibilityDefault;

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

    if (loading) {
        return (
            <div className="loading-screen" style={{
                position: 'fixed',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: theme === 'dark' ? '#020617' : '#f8fafc',
                color: theme === 'dark' ? '#f8fafc' : '#0f172a',
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
            {!printOptimized && <aside className={`spa-sidebar ${sidebarOpen ? 'open' : ''}`}>
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
                        <div className="nav-item-label" style={{ fontSize: '0.7rem', opacity: 0.5, letterSpacing: '0.1em', fontWeight: 800, padding: '0.5rem 1rem' }}>CONTEÚDO</div>
                        {visibility.simbologia && (
                            <button onClick={() => scrollToSection('simbologia')} className="nav-item sub-item">
                                Simbologia
                            </button>
                        )}
                        {visibility.tematica && (
                            <button onClick={() => scrollToSection('tematica')} className="nav-item sub-item">
                                Temática
                            </button>
                        )}
                        {visibility.musica && (
                            <button onClick={() => scrollToSection('musica')} className="nav-item sub-item">
                                Música Tema
                            </button>
                        )}
                    </div>

                    {visibility.encontristas && (
                        <div className="nav-group">
                            <button onClick={() => scrollToSection('encontristas')} className="nav-item">
                                <Users size={18} /> Encontristas
                            </button>
                        </div>
                    )}

                    {visibility.encontreiros && (
                        <div className="nav-group">
                            <button
                                className="nav-item"
                                onClick={() => scrollToSection('encontreiros')}
                            >
                                <ScrollText size={20} style={{ minWidth: '20px' }} /> Encontreiros
                            </button>
                        </div>
                    )}

                    {visibility.palestras && (
                        <div className="nav-group">
                            <button
                                className="nav-item"
                                onClick={() => scrollToSection('palestras')}
                            >
                                <Mic2 size={20} style={{ minWidth: '20px' }} /> Palestras
                            </button>
                        </div>
                    )}
                </nav>

                <div className="sidebar-footer">
                    <button onClick={toggleTheme} className="theme-toggle-btn">
                        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                        <span>Tema {theme === 'dark' ? 'Claro' : 'Escuro'}</span>
                    </button>
                    {isAdminView && (
                        <button
                            onClick={handlePrint}
                            className="nav-item pdf-export-btn"
                        >
                            <Printer size={18} /> Imprimir / Salvar PDF
                        </button>
                    )}
                    <button onClick={() => navigate('/login')} className="exit-btn">
                        <ArrowLeft size={18} /> Sair
                    </button>
                </div>
            </aside>}

            {/* Header Overlay (Mobile & Desktop when Sidebar Closed) */}
            {!printOptimized && <div className={`mobile-header ${!sidebarOpen ? 'visible' : ''}`}>
                <button onClick={() => setSidebarOpen(true)} className="menu-btn">
                    <Menu size={24} style={{ width: 24, height: 24, flexShrink: 0 }} />
                </button>
                <h1 className={scrolled ? 'visible' : ''}>
                    {encontro?.nome}
                    {activeSection && <span className="section-dot">•</span>}
                    {activeSection && <span className="active-section-name">{activeSection}</span>}
                </h1>
                <button onClick={toggleTheme} className="menu-btn">
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
            </div>}

            {/* Content Area */}
            <main ref={printRef} className={`spa-main-content ${!printOptimized && sidebarOpen ? 'sidebar-open' : ''}`}>
                {/* Hero Section */}
                <section id="inicio" className="hero-section" data-section-name="">
                    <div className="hero-card">
                        {/* Cabeçalho da Capa estilo Paróquia */}
                        <div className="capa-header">
                            <div className="capa-header-logo-left">
                                <img src={logoCapelinha} alt="Paróquia Nossa Senhora Aparecida" />
                            </div>
                            <div className="capa-header-center">
                                <h2>PARÓQUIA NOSSA SENHORA APARECIDA</h2>
                                <h3>{encontro?.local || 'CAPELINHA - FRANCA / SP'}</h3>
                            </div>
                            <div className="capa-header-logo-right">
                                <img src="/logo-ejc.jpg" alt="EJC" onError={(e) => e.currentTarget.src = '/logo-ejc-recriado.png'} />
                            </div>
                        </div>

                        {/* Título e Tema separados abaixo do header */}
                        <div className="capa-titulos">
                            <div className="capa-edicao">
                                {encontro?.edicao ? `${encontro.edicao}° E.J.C` : encontro?.nome}
                            </div>
                            {encontro?.tema && (
                                <div className="capa-tema">
                                    “{encontro.tema}”
                                </div>
                            )}
                        </div>

                        {/* Imagem Centralizada Grande da Arte do Tema */}
                        {encontro?.logo_url && (
                            <div className="capa-central-logo">
                                <img 
                                    src={getOptimizedImageUrl(encontro.logo_url, 600, 600)} 
                                    alt="Arte do Tema" 
                                    onError={(e) => {
                                        const orig = encontro.logo_url;
                                        if (orig && e.currentTarget.src !== orig) {
                                            e.currentTarget.src = orig;
                                        }
                                    }}
                                />
                            </div>
                        )}

                        {/* Datas do Encontro */}
                        <div className="capa-footer-dates">
                            {formatarDatasEncontro(encontro?.data_inicio, encontro?.data_fim)}
                        </div>

                        {/* Estatísticas (visível apenas na tela, oculta no print) */}
                        <div className="stats-pills no-print">
                            <div className="pill"><strong>{data.filter(i => i.participante).length}</strong> Encontristas</div>
                            <div className="pill"><strong>{data.length - data.filter(i => i.participante).length}</strong> Encontreiros</div>
                        </div>
                    </div>
                </section>

                {visibility.simbologia && (
                    <section id="simbologia" className="content-editorial-section section-band section-band-base section-simbologia" data-section-name="Simbologia">
                        <div className="section-print-wrapper">
                            <div className="editorial-container">
                                <div className="editorial-visual">
                                    <div className="simbol-logo">
                                        <img src="/logo-ejc.jpg" alt="Símbolo EJC" onError={(e) => e.currentTarget.src = '/logo-ejc-recriado.png'} />
                                    </div>
                                </div>
                                <div className="editorial-content">
                                    <div className="section-header">
                                        <h2>Simbologia</h2>
                                        <div className="divider"></div>
                                    </div>
                                    <div className="editorial-text rich-editorial-output" dangerouslySetInnerHTML={{ __html: encontro?.simbologia_texto || '' }} />
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Temática do Encontro */}
                {visibility.tematica && (
                    <section id="tematica" className="content-editorial-section reverse section-band section-band-alt section-tematica" data-section-name="Temática">
                        <div className="section-print-wrapper">
                            <div className="editorial-container">
                                <div className="editorial-visual">
                                    {encontro?.logo_url ? (
                                        <img 
                                            src={getOptimizedImageUrl(encontro.logo_url, 600, 600)} 
                                            alt="Logo Tema" 
                                            className="theme-logo" 
                                            onError={(e) => {
                                                const orig = encontro.logo_url;
                                                if (orig && e.currentTarget.src !== orig) {
                                                    e.currentTarget.src = orig;
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="logo-stub">EJC</div>
                                    )}
                                </div>
                                <div className="editorial-content">
                                    <div className="section-header">
                                        <h2>{encontro?.tema || 'Temática'}</h2>
                                        <div className="divider"></div>
                                    </div>
                                    <div
                                        className="editorial-text rich-editorial-output"
                                        dangerouslySetInnerHTML={{ __html: encontro?.tematica_texto || '<p>As referências e inspirações que deram vida ao tema deste encontro.</p>' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Música Tema */}
                {visibility.musica && (
                    <section id="musica" className="content-music-section section-band section-band-strong" data-section-name="Música">
                        <div className="section-print-wrapper">
                            <div className="music-container">
                                <div className="music-header">
                                    <Music size={40} className="music-icon" />
                                    <h2>Música Tema</h2>
                                    {encontro?.musica && <h3>{encontro.musica}</h3>}
                                    <div className="music-links">
                                        {encontro?.link_musica && (
                                            <a href={encontro.link_musica} target="_blank" rel="noopener noreferrer" className="music-link-btn">
                                                <Music size={16} /> Ouvir Música
                                            </a>
                                        )}
                                        {encontro?.link_youtube && (
                                            <a href={encontro.link_youtube} target="_blank" rel="noopener noreferrer" className="music-link-btn yt">
                                                <ExternalLink size={16} /> Vídeo no YouTube
                                            </a>
                                        )}
                                    </div>
                                </div>
                                <div className="lyrics-wrapper">
                                    <div
                                        className="lyrics-content rich-editorial-output"
                                        dangerouslySetInnerHTML={{ __html: encontro?.musica_letra || '<p class="opacity-50 italic">Letra da música não cadastrada.</p>' }}
                                    />
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Encontristas Sections grouped by Circle */}
                {visibility.encontristas && <div id="encontristas" className="no-print" style={{ paddingBottom: '1px' }}></div>}
                {visibility.encontristas && (
                    <section className="section-sub-cover print-only">
                        <div className="section-print-wrapper">
                            <div className="sub-cover-content">
                                <h1 className="sub-cover-title">Encontristas</h1>
                                <div className="sub-cover-divider"></div>
                            </div>
                        </div>
                    </section>
                )}
                {visibility.encontristas && encontristasPorCirculo.map(([circle, members], sectionIndex) => {
                    const firstMember = members[0];
                    const circuloImagemUrl = firstMember?.circulo_participacao?.[0]?.circulos?.imagem_url;
                    const mediadoresFotoUrl = firstMember?.circulo_mediadores_foto?.foto_url;
                    const mediadoresFotoPosY = firstMember?.circulo_mediadores_foto?.foto_posicao_y ?? 50;

                    return (
                        <section key={circle} id={`circulo-${slugify(circle)}`} className={`content-section section-band ${sectionIndex % 2 === 0 ? 'section-band-base' : 'section-band-alt'}`} data-section-name={circle}>
                            <div className="section-print-wrapper">
                                {circuloImagemUrl || (visibility.fotosMediadores && mediadoresFotoUrl) ? (
                                    <div className="circulo-banner">
                                        {circuloImagemUrl && (
                                            <div className="circulo-banner-logo">
                                                <img 
                                                    src={getOptimizedImageUrl(circuloImagemUrl, 250, 250)} 
                                                    alt={`Logo ${circle}`} 
                                                    loading="eager" 
                                                    decoding="async" 
                                                    onError={(e) => {
                                                        if (e.currentTarget.src !== circuloImagemUrl) {
                                                            e.currentTarget.src = circuloImagemUrl;
                                                        }
                                                    }}
                                                />
                                            </div>
                                        )}
                                        <div className="circulo-banner-title-box">
                                            <h2>{circle}</h2>
                                            <div className="circulo-banner-divider"></div>
                                        </div>
                                        {visibility.fotosMediadores && mediadoresFotoUrl && (
                                            <div className="circulo-banner-mediadores">
                                                <img 
                                                    src={getOptimizedImageUrl(mediadoresFotoUrl, 500, 350)} 
                                                    alt={`Mediadores de ${circle}`} 
                                                    loading="eager"
                                                    decoding="async"
                                                    onError={(e) => {
                                                        if (e.currentTarget.src !== mediadoresFotoUrl) {
                                                            e.currentTarget.src = mediadoresFotoUrl;
                                                        }
                                                    }}
                                                    style={{ objectPosition: `center ${mediadoresFotoPosY}%` }} 
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="section-header">
                                        <h2><Users size={24} /> {circle}</h2>
                                        <div className="divider"></div>
                                    </div>
                                )}

                                <div className="quadrante-grid">
                                    {members.map((item) => (
                                        <ParticipantCard key={item.id} item={item} />
                                    ))}
                                </div>
                            </div>
                        </section>
                    );
                })}

                {/* Encontreiros Sections (Team Layout 50/50) */}
                {visibility.encontreiros && <div id="encontreiros" className="no-print" style={{ paddingBottom: '1px' }}></div>}
                {visibility.encontreiros && (
                    <section className="section-sub-cover print-only">
                        <div className="section-print-wrapper">
                            <div className="sub-cover-content">
                                <h1 className="sub-cover-title">Equipes de Trabalho</h1>
                                <div className="sub-cover-divider"></div>
                            </div>
                        </div>
                    </section>
                )}
                {visibility.encontreiros && encontreirosPorEquipe.map(([team, members], sectionIndex) => {
                    const isRecreacao = isEquipeRecreacaoInfantil(team);
                    const hasCriancas = isRecreacao && criancasRecreacao.length > 0;
                    const secoesExtrasAnteriores = criancasRecreacao.length > 0
                        && encontreirosPorEquipe.slice(0, sectionIndex).some(([nome]) => isEquipeRecreacaoInfantil(nome))
                        ? 1
                        : 0;
                    const effectiveSectionIndex = sectionIndex + secoesExtrasAnteriores;
                    const fotoEquipe = members[0]?.equipes?.foto_url;
                    const fotoPosicaoY = members[0]?.equipes?.foto_posicao_y ?? 50;

                    return (
                        <Fragment key={team}>
                            <section id={`equipe-${slugify(team)}`} className={`content-team-section section-band ${effectiveSectionIndex % 2 === 0 ? 'section-band-alt' : 'section-band-base'}`} data-section-name={team}>
                                <div className="section-print-wrapper">
                                    <div className="team-layout">
                                        <div className="team-visual">
                                            <div className="team-photo-container">
                                                {fotoEquipe ? (
                                                    <img
                                                        src={getOptimizedImageUrl(fotoEquipe, 800, 450)}
                                                        alt={team}
                                                        loading="eager"
                                                        onError={(e) => {
                                                            if (e.currentTarget.src !== fotoEquipe) {
                                                                e.currentTarget.src = fotoEquipe;
                                                            }
                                                        }}
                                                        style={{ objectPosition: `center ${fotoPosicaoY}%` }}
                                                    />
                                                ) : (
                                                    <div className="team-photo-stub">
                                                        <Users size={60} />
                                                        <span>Foto da Equipe</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="team-members-list">
                                            <div className="list-header">
                                                <h3>{team}</h3>
                                                <div className="line"></div>
                                            </div>
                                            <ol className="numbered-list">
                                                {[...members]
                                                    .sort((a, b) => a.pessoas.nome_completo.localeCompare(b.pessoas.nome_completo, 'pt-BR'))
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
                                </div>
                            </section>

                            {hasCriancas && (
                                <section id="criancas-recreacao" className={`content-team-section section-band ${(effectiveSectionIndex + 1) % 2 === 0 ? 'section-band-alt' : 'section-band-base'}`} data-section-name="Crianças da Recreação">
                                    <div className="section-print-wrapper">
                                        <div className="team-layout">
                                            <div className="team-visual">
                                                <div className="team-photo-container">
                                                    {fotoEquipe ? (
                                                        <img
                                                            src={getOptimizedImageUrl(fotoEquipe, 800, 450)}
                                                            alt="Crianças da Recreação"
                                                            loading="eager"
                                                            onError={(e) => {
                                                                if (e.currentTarget.src !== fotoEquipe) {
                                                                    e.currentTarget.src = fotoEquipe;
                                                                }
                                                            }}
                                                            style={{ objectPosition: `center ${fotoPosicaoY}%` }}
                                                        />
                                                    ) : (
                                                        <div className="team-photo-stub">
                                                            <Users size={60} />
                                                            <span>Foto da Recreação</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="team-members-list">
                                                <div className="list-header">
                                                    <h3>Crianças da Recreação</h3>
                                                    <div className="line"></div>
                                                </div>
                                                <ol className="numbered-list children-numbered-list">
                                                    {[...criancasRecreacao]
                                                        .sort((a, b) => a.nome_crianca.localeCompare(b.nome_crianca, 'pt-BR'))
                                                        .map((crianca, childIndex) => {
                                                            const responsaveis = [
                                                                formatarResponsavelQuadrante(crianca.participacoes),
                                                                formatarResponsavelQuadrante(crianca.outro_responsavel)
                                                            ].filter((responsavel): responsavel is string => Boolean(responsavel));

                                                            return (
                                                                <li key={crianca.id} className="member-item child-member-item">
                                                                    <span className="number">{(childIndex + 1).toString().padStart(2, '0')}</span>
                                                                    <span className="child-member-content">
                                                                        <span className="name">{crianca.nome_crianca}</span>
                                                                        {responsaveis.length > 0 && (
                                                                            <span className="child-responsibles">
                                                                                {responsaveis.join('  •  ')}
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                </li>
                                                            );
                                                        })}
                                                </ol>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </Fragment>
                    );
                })}

                {/* Palestras Section — MOVED INSIDE main */}
                {visibility.palestras && <section id="palestras" className="content-palestras-section section-band section-band-base" data-section-name="Palestras">
                    <div className="section-print-wrapper">
                        <div className="section-header center">
                            <Mic2 size={32} />
                            <h2>Palestras do Encontro</h2>
                            <div className="divider mx-auto"></div>
                        </div>

                        <div className={`palestras-grid ${palestras.length === 1 ? 'single-item' : ''}`}>
                            {palestras.map((p) => (
                                <div
                                    key={p.id}
                                    className="palestra-card"
                                >
                                    <div className="palestra-speaker">
                                        <div className="speaker-avatar">
                                            {p.palestrante_foto_url ? (
                                                <img 
                                                    src={getOptimizedImageUrl(p.palestrante_foto_url, 150, 150)} 
                                                    alt={p.palestrante_nome || ''} 
                                                    onError={(e) => {
                                                        const orig = p.palestrante_foto_url;
                                                        if (orig && e.currentTarget.src !== orig) {
                                                            e.currentTarget.src = orig;
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <User size={40} />
                                            )}
                                        </div>
                                        <div className="speaker-info">
                                            <h3>{p.titulo}</h3>
                                            <span className="p-nome">{p.palestrante_nome}</span>
                                        </div>
                                    </div>
                                    <div
                                        className="palestra-body rich-editorial-output"
                                        dangerouslySetInnerHTML={{ __html: p.resumo || '<p>Resumo não disponível para esta palestra.</p>' }}
                                    />
                                </div>
                            ))}
                        </div>
                        {palestras.length === 0 && (
                            <div className="opacity-40 text-center py-10">Nenhuma palestra registrada para este encontro.</div>
                        )}
                    </div>
                </section>}

                <footer className="spa-footer">
                    <p>© {new Date().getFullYear()} EJC • Capelinha</p>
                </footer>
            </main>

            {/* Sidebar Overlay for Mobile */}
            {!printOptimized && <AnimatePresence>
                {sidebarOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="sidebar-overlay"
                        onClick={() => setSidebarOpen(false)}
                    />
                )}
            </AnimatePresence>}

            <style>{`
                :root {
                    --bg-color: #f8fafc;
                    --text-color: #0f172a;
                    --sidebar-bg: #ffffff;
                    --card-bg: #ffffff;
                    --border-color: #e2e8f0;
                    --primary-color: #2563eb;
                    --hero-gradient: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
                    --hero-text: #0f172a;
                    --hero-text-muted: #475569;
                    --hero-border: #e2e8f0;
                    --hero-accent: #2563eb;
                    --music-card-bg: #ffffff;
                    --music-card-border: #e2e8f0;
                    --music-btn-bg: #f1f5f9;
                    --music-btn-border: #cbd5e1;
                    --music-btn-text: #0f172a;
                    --section-base-bg: #f8fafc;
                    --section-alt-bg: #eef4ff;
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
                    --hero-text: #ffffff;
                    --hero-text-muted: rgba(255, 255, 255, 0.7);
                    --hero-border: rgba(255, 255, 255, 0.1);
                    --hero-accent: #93c5fd;
                    --music-card-bg: rgba(0, 0, 0, 0.2);
                    --music-card-border: rgba(255, 255, 255, 0.05);
                    --music-btn-bg: rgba(255, 255, 255, 0.1);
                    --music-btn-border: rgba(255, 255, 255, 0.2);
                    --music-btn-text: #ffffff;
                    --section-base-bg: #020617;
                    --section-alt-bg: #07111f;
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

                .section-band {
                    --section-bg: var(--section-base-bg);
                    background: var(--section-bg);
                    box-shadow: 0 0 0 100vmax var(--section-bg);
                    clip-path: inset(0 -100vmax);
                }

                .section-band-base {
                    --section-bg: var(--section-base-bg);
                }

                .section-band-alt {
                    --section-bg: var(--section-alt-bg);
                }

                .section-band-strong {
                    --section-bg: var(--hero-gradient);
                    background: var(--hero-gradient);
                    box-shadow: none;
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
                    padding-top: 64px;
                    scroll-behavior: smooth;
                    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                }

                /* Desktop: a barra inicia aberta, mas continua controlada pelo usuário */
                @media (min-width: 1025px) {
                    .spa-main-content {
                        padding-top: 0;
                    }
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

                .circulo-banner {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 20px;
                    padding: 1rem 2rem;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                    width: 100%;
                }

                .circulo-banner-logo {
                    width: 96px;
                    height: 96px;
                    flex: 0 0 96px;
                    border-radius: 0;
                    overflow: hidden;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: transparent;
                    border: 0;
                }

                .circulo-banner-logo img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }

                .circulo-banner-title-box {
                    flex-grow: 1;
                    display: flex;
                    flex-direction: column;
                }

                .circulo-banner-title-box h2 {
                    font-size: 1.5rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--text-color);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .circulo-banner-divider {
                    height: 4px;
                    width: 60px;
                    background: var(--primary-color);
                    border-radius: 2px;
                    margin-top: 0.5rem;
                }

                .circulo-banner-mediadores {
                    width: 240px;
                    height: 120px;
                    flex: 0 0 240px;
                    border-radius: 0;
                    overflow: hidden;
                    border: 0;
                    background: transparent;
                }

                .circulo-banner-mediadores img {
                    width: 100%;
                    height: 100%;
                    object-fit: contain;
                    display: block;
                }
                
                @media (max-width: 640px) {
                    .circulo-banner {
                        flex-direction: column;
                        text-align: center;
                        align-items: center;
                    }
                    .circulo-banner-title-box h2 {
                        justify-content: center;
                    }
                    .circulo-banner-divider {
                        margin-left: auto;
                        margin-right: auto;
                    }
                    .circulo-banner-logo {
                        width: 112px;
                        height: 112px;
                        flex-basis: 112px;
                    }
                    .circulo-banner-mediadores {
                        width: min(100%, 280px);
                        height: 140px;
                        flex-basis: 140px;
                    }
                }

                .hero-section {
                    min-height: 80vh;
                    background: var(--hero-gradient);
                    color: var(--hero-text);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem 2rem;
                    text-align: center;
                    border-bottom: 1px solid var(--border-color);
                }

                .hero-card {
                    max-width: 800px;
                    width: 100%;
                }

                /* Cabeçalho da Capa estilo Paróquia */
                .capa-header {
                    display: grid;
                    grid-template-columns: 80px 1fr 80px;
                    align-items: center;
                    gap: 1.5rem;
                    margin-bottom: 2rem;
                    width: 100%;
                    text-align: center;
                }
                
                .capa-header-logo-left img,
                .capa-header-logo-right img {
                    width: 70px;
                    height: 70px;
                    object-fit: contain;
                    border-radius: 8px;
                    background: var(--hero-border);
                    padding: 4px;
                }

                .dark-mode .capa-header-logo-left img {
                    background: #ffffff !important;
                }
                
                .capa-header-center h2 {
                    font-size: clamp(0.9rem, 2.5vw, 1.2rem);
                    font-weight: 800;
                    margin: 0 0 2px 0;
                    color: var(--hero-text);
                    letter-spacing: 0.05em;
                }
                
                .capa-header-center h3 {
                    font-size: clamp(0.75rem, 2vw, 0.95rem);
                    font-weight: 700;
                    margin: 0 0 1rem 0;
                    color: var(--hero-text-muted);
                    letter-spacing: 0.05em;
                }
                
                .capa-edicao {
                    font-size: clamp(1.8rem, 5vw, 3rem);
                    font-weight: 900;
                    color: var(--hero-text);
                    margin: 0 0 0.5rem 0;
                    letter-spacing: -0.02em;
                }
                
                .capa-tema {
                    font-size: clamp(1.1rem, 3vw, 1.6rem);
                    font-weight: 700;
                    color: var(--hero-accent);
                    font-style: italic;
                    margin: 0;
                }
                
                .capa-central-logo {
                    margin: 2rem auto;
                    max-width: 400px;
                    display: flex;
                    justify-content: center;
                }
                
                .capa-central-logo img {
                    width: 100%;
                    max-height: 400px;
                    object-fit: contain;
                    border-radius: 16px;
                    box-shadow: 0 12px 40px rgba(0,0,0,0.15);
                }
                
                .capa-footer-dates {
                    font-size: clamp(0.9rem, 2vw, 1.2rem);
                    font-weight: 700;
                    color: var(--hero-text);
                    margin-top: 2rem;
                }

                @media (max-width: 640px) {
                    .capa-header {
                        grid-template-columns: 1fr;
                        gap: 1rem;
                    }
                    .capa-header-logo-left,
                    .capa-header-logo-right {
                        display: flex;
                        justify-content: center;
                    }
                }

                @keyframes float-logo {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                }

                /* Editorial Sections */
                .content-editorial-section {
                    padding: 4.25rem 8%;
                    display: flex;
                    justify-content: center;
                }

                .editorial-container {
                    max-width: 1080px;
                    display: grid;
                    grid-template-columns: 1fr 1.5fr;
                    gap: 3rem;
                    align-items: center;
                }

                .content-editorial-section.reverse .editorial-container {
                    grid-template-columns: 1.5fr 1fr;
                }

                .content-editorial-section.reverse .editorial-visual {
                    order: 2;
                }

                .editorial-visual {
                    display: flex;
                    justify-content: center;
                }

                .simbol-logo img, .theme-logo {
                    max-width: 100%;
                    max-height: 320px;
                    object-fit: contain;
                    border-radius: 28px;
                    box-shadow:
                        0 22px 55px rgba(15, 23, 42, 0.16),
                        0 0 0 1px rgba(148, 163, 184, 0.18);
                }

                .dark-mode .simbol-logo img,
                .dark-mode .theme-logo {
                    box-shadow:
                        0 22px 55px rgba(255, 255, 255, 0.12),
                        0 0 0 1px rgba(255, 255, 255, 0.18),
                        0 0 32px rgba(59, 130, 246, 0.12);
                }

                .editorial-text {
                    font-size: 1rem;
                    line-height: 1.58;
                    opacity: 0.85;
                    color: var(--text-color);
                }

                .editorial-text p {
                    margin-bottom: 0.85rem;
                }

                .rich-editorial-output p {
                    min-height: 1.55em;
                    margin-bottom: 0.85rem;
                }

                .rich-editorial-output p:empty::before {
                    content: "\\00a0";
                    white-space: pre;
                }

                .rich-editorial-output h1,
                .rich-editorial-output h2,
                .rich-editorial-output h3 {
                    color: inherit;
                    line-height: 1.18;
                    margin: 1rem 0 0.65rem;
                }

                .rich-editorial-output h1 {
                    font-size: 1.85rem;
                    font-weight: 800;
                }

                .rich-editorial-output h2 {
                    font-size: 1.45rem;
                    font-weight: 800;
                }

                .rich-editorial-output h3 {
                    font-size: 1.15rem;
                    font-weight: 700;
                }

                .rich-editorial-output ul,
                .rich-editorial-output ol {
                    margin: 1rem 0 1rem 1.5rem;
                    padding-left: 1.25rem;
                    text-align: left;
                }

                .rich-editorial-output ul {
                    list-style: disc;
                }

                .rich-editorial-output ol {
                    list-style: decimal;
                }

                .rich-editorial-output li {
                    margin-bottom: 0.25rem;
                }

                .rich-editorial-output strong {
                    font-weight: 800;
                }

                .rich-editorial-output em {
                    font-style: italic;
                }

                .rich-editorial-output a {
                    color: var(--primary-color);
                    text-decoration: underline;
                    text-underline-offset: 3px;
                }

                /* Music Section */
                .content-music-section {
                    background: var(--hero-gradient);
                    color: var(--hero-text);
                    padding: 4.25rem 8%;
                    text-align: center;
                }

                .music-container {
                    max-width: 720px;
                    margin: 0 auto;
                }

                .music-header h2 {
                    font-size: 2rem;
                    margin: 0.75rem 0 1.35rem;
                    color: var(--hero-text);
                }

                .music-title-name {
                    margin: -0.8rem 0 1.35rem;
                    font-size: 1.05rem;
                    font-weight: 700;
                    letter-spacing: 0.01em;
                    opacity: 0.88;
                    color: var(--hero-text-muted);
                }

                .music-icon {
                    opacity: 0.3;
                    margin-bottom: 0.5rem;
                    color: var(--hero-text);
                }

                .music-links {
                    display: flex;
                    gap: 1rem;
                    justify-content: center;
                    margin-bottom: 2rem;
                }

                .music-link-btn {
                    display: flex;
                    align-items: center;
                    gap: 0.6rem;
                    padding: 0.8rem 1.5rem;
                    background: var(--music-btn-bg);
                    border: 1px solid var(--music-btn-border);
                    border-radius: 100px;
                    color: var(--music-btn-text);
                    text-decoration: none;
                    font-size: 0.9rem;
                    font-weight: 600;
                    transition: 0.3s;
                }

                .music-link-btn:hover {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }

                .lyrics-wrapper {
                    background: var(--music-card-bg);
                    padding: 2.25rem 1.75rem;
                    border-radius: 28px;
                    border: 1px solid var(--music-card-border);
                }

                .lyrics-content {
                    font-size: 1.02rem;
                    line-height: 1.45;
                    font-style: italic;
                    opacity: 0.9;
                }

                .lyrics-content p {
                    margin-bottom: 0.25rem;
                }

                /* Palestras Section */
                .content-palestras-section {
                    padding: 4.25rem 8%;
                    max-width: 1080px;
                    margin: 0 auto;
                }

                .palestras-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
                    gap: 1.4rem;
                    margin-top: 2.5rem;
                }

                .palestras-grid.single-item {
                    display: flex !important;
                    justify-content: center !important;
                }

                .palestras-grid.single-item .palestra-card {
                    max-width: 500px;
                    width: 100%;
                }

                .capa-titulos {
                    margin: 1.5rem 0;
                    text-align: center;
                }

                .palestra-card {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 24px;
                    padding: 1.5rem;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    transition: 0.3s;
                }

                .palestra-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
                    border-color: var(--primary-color)40;
                }

                .palestra-speaker {
                    display: flex;
                    align-items: center;
                    gap: 1.25rem;
                    margin-bottom: 1rem;
                }

                .speaker-avatar {
                    width: 58px;
                    height: 58px;
                    border-radius: 20px;
                    overflow: hidden;
                    background: var(--primary-color)10;
                    color: var(--primary-color);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--border-color);
                }

                .speaker-avatar img {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }

                .speaker-info h3 {
                    font-size: 1.05rem;
                    margin: 0;
                }

                .speaker-info .p-nome {
                    font-size: 0.9rem;
                    opacity: 0.6;
                    font-weight: 500;
                }

                .palestra-body p,
                .palestra-body li {
                    line-height: 1.48;
                    opacity: 0.8;
                    font-size: 0.94rem;
                }

                @media (max-width: 1024px) {
                    .editorial-container {
                        grid-template-columns: 1fr;
                        gap: 1.5rem;
                        text-align: center;
                        max-width: 760px;
                    }
                    .content-editorial-section.reverse .editorial-container {
                        grid-template-columns: 1fr;
                    }
                    .content-editorial-section.reverse .editorial-visual {
                        order: -1;
                    }
                    .palestras-grid {
                        grid-template-columns: 1fr;
                    }

                    .content-editorial-section,
                    .content-music-section,
                    .content-palestras-section {
                        padding-top: 3rem;
                        padding-bottom: 3rem;
                    }

                    .simbol-logo img,
                    .theme-logo {
                        max-height: 240px;
                    }
                }

                .section-header.center {
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
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
                    padding: 0;
                    width: 100%;
                    max-width: none !important;
                    margin: 0 !important;
                    clip-path: none !important;
                    box-shadow: none !important;
                }

                .content-team-section .section-print-wrapper {
                    max-width: 1400px;
                    margin: 0 auto;
                    padding: 4rem 5%;
                    width: 100%;
                    box-sizing: border-box;
                    display: block;
                }

                .team-layout {
                    display: flex;
                    flex-direction: column;
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.05);
                    max-width: 1200px;
                    margin: 0 auto;
                }

                @media (max-width: 900px) {
                    .content-team-section { padding: 2rem 1rem; }
                }

                .team-visual {
                    width: 100%;
                    aspect-ratio: 16 / 9;
                    max-height: 500px;
                    border-radius: 30px 30px 0 0;
                    overflow: hidden;
                }

                @media (max-width: 900px) {
                    .team-visual { aspect-ratio: 4 / 3; }
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
                    background: #f1f5f9;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    gap: 1.5rem;
                    color: var(--primary-color);
                    border: 1px solid var(--border-color);
                }

                .team-photo-stub svg {
                    opacity: 0.3;
                }

                .team-photo-stub span {
                    font-size: 0.9rem;
                    font-weight: 600;
                    letter-spacing: 0.2em;
                    text-transform: uppercase;
                    opacity: 0.6;
                    color: var(--text-color);
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
                    background: var(--card-bg);
                    border-radius: 0 0 30px 30px;
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

                .children-numbered-list {
                    grid-template-columns: repeat(3, 1fr);
                }

                @media (max-width: 900px) {
                    .children-numbered-list { grid-template-columns: repeat(2, 1fr); }
                }

                @media (max-width: 600px) {
                    .children-numbered-list { grid-template-columns: 1fr; }
                }

                .child-member-item {
                    align-items: flex-start;
                }

                .child-member-content {
                    display: flex;
                    min-width: 0;
                    flex-direction: column;
                    gap: 0.3rem;
                }

                .child-responsibles {
                    color: var(--text-color);
                    font-size: 0.72rem;
                    font-weight: 400;
                    line-height: 1.35;
                    opacity: 0.56;
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

                @media (max-width: 768px) {
                    .quadrante-spa-container {
                        font-size: 0.9rem;
                    }

                    .hero-card h1 {
                        font-size: clamp(1.75rem, 9vw, 2.35rem);
                    }

                    .hero-card p {
                        font-size: 1.15rem;
                        margin-bottom: 1.75rem;
                    }

                    .section-header h2,
                    .music-header h2 {
                        font-size: 1.22rem;
                    }

                    .editorial-text,
                    .lyrics-content,
                    .palestra-body p,
                    .palestra-body li {
                        font-size: 0.88rem;
                        line-height: 1.42;
                    }

                    .editorial-text p {
                        margin-bottom: 0.65rem;
                    }

                    .speaker-info h3,
                    .list-header h3 {
                        font-size: 1.08rem;
                    }

                    .content-editorial-section,
                    .content-music-section,
                    .content-section,
                    .content-team-section,
                    .content-palestras-section {
                        padding-left: 1rem;
                        padding-right: 1rem;
                    }

                    .content-editorial-section,
                    .content-music-section,
                    .content-palestras-section {
                        padding-top: 2rem;
                        padding-bottom: 2rem;
                    }

                    .editorial-container {
                        gap: 1rem;
                    }

                    .simbol-logo img,
                    .theme-logo {
                        max-height: 150px;
                    }

                    .music-icon {
                        width: 28px;
                        height: 28px;
                    }

                    .music-links {
                        margin-bottom: 1.25rem;
                        flex-direction: column;
                        align-items: stretch;
                        gap: 0.6rem;
                    }

                    .music-link-btn {
                        justify-content: center;
                        padding: 0.65rem 1rem;
                    }

                    .lyrics-wrapper {
                        padding: 1.2rem 1rem;
                        border-radius: 18px;
                    }

                    .palestras-grid {
                        margin-top: 1.5rem;
                        gap: 1rem;
                    }

                    .palestra-card {
                        padding: 1rem;
                        border-radius: 18px;
                    }

                    .speaker-avatar {
                        width: 48px;
                        height: 48px;
                        border-radius: 14px;
                    }

                    .quadrante-grid {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 1rem;
                    }
                    .hero-section { padding: 3rem 1rem; }
                    .stats-pills { flex-direction: column; align-items: center; gap: 0.5rem; }
                }

                .print-only {
                    display: none !important;
                }

                .section-print-wrapper {
                    display: contents;
                }

                /* ═══════════════════════════════════════════════
                   ESTILOS DE IMPRESSÃO / PDF — PREMIUM
                   ═══════════════════════════════════════════════ */
                @media print {

                    /* ── Página A4 sem margens ───────────────────── */
                    @page { size: A4 portrait; margin: 0; }

                    .print-only {
                        display: block !important;
                    }

                    .section-sub-cover.print-only {
                        display: table !important;
                        break-before: page !important;
                        page-break-before: always !important;
                        height: 297mm !important;
                        min-height: 297mm !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                        background: #ffffff !important;
                        padding: 0 !important;
                    }

                    .sub-cover-content {
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        text-align: center !important;
                        height: 100% !important;
                    }

                    .sub-cover-title {
                        font-size: 32pt !important;
                        font-weight: 800 !important;
                        color: #0f172a !important;
                        margin-bottom: 1rem !important;
                        text-transform: uppercase !important;
                        letter-spacing: 0.1em !important;
                    }

                    .sub-cover-divider {
                        height: 6px !important;
                        width: 100px !important;
                        background: #2563eb !important;
                        border-radius: 3px !important;
                    }

                    /* ── Evitar corte de páginas e rolagem oculta na impressão ── */
                    html, body {
                        overflow: visible !important;
                        height: auto !important;
                        background: white !important;
                    }

                    /* ── Ocultar UI de navegação ─────────────────── */
                    .spa-sidebar,
                    .mobile-header,
                    .sidebar-overlay,
                    .music-link-btn,
                    .no-print,
                    footer {
                        display: none !important;
                    }

                    /* ── Preservar cores e desativar animações ────── */
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                        animation: none !important;
                        transition: none !important;
                    }

                    /* ── Forçar visibilidade dos componentes animados do Framer Motion ── */
                    .participant-card,
                    .palestra-card,
                    .team-layout,
                    .hero-section,
                    .hero-card,
                    .lyrics-wrapper,
                    .content-section,
                    .content-team-section,
                    .content-palestras-section,
                    div[style*="opacity"],
                    div[style*="transform"] {
                        opacity: 1 !important;
                        transform: none !important;
                        visibility: visible !important;
                    }

                    /* ── Layout raiz ─────────────────────────────── */
                    .quadrante-spa-container,
                    .quadrante-spa-container.dark-mode {
                        display: block !important;
                        background: #ffffff !important;
                        --bg-color: #f8fafc !important;
                        --text-color: #0f172a !important;
                        --sidebar-bg: #ffffff !important;
                        --card-bg: #ffffff !important;
                        --border-color: #e2e8f0 !important;
                        --primary-color: #2563eb !important;
                        --hero-gradient: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%) !important;
                        --hero-text: #0f172a !important;
                        --hero-text-muted: #475569 !important;
                        --hero-border: #e2e8f0 !important;
                        --hero-accent: #2563eb !important;
                        --music-card-bg: #ffffff !important;
                        --music-card-border: #e2e8f0 !important;
                        --music-btn-bg: #f1f5f9 !important;
                        --music-btn-border: #cbd5e1 !important;
                        --music-btn-text: #0f172a !important;
                        --section-base-bg: #f8fafc !important;
                        --section-alt-bg: #eef4ff !important;
                        --glass-bg: rgba(255, 255, 255, 0.7) !important;
                        --glass-border: rgba(255, 255, 255, 0.4) !important;
                    }

                    .spa-main-content,
                    .spa-main-content.sidebar-open {
                        margin-left: 0 !important;
                        padding: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                    }

                    .simbol-logo img,
                    .theme-logo {
                        box-shadow: 0 22px 55px rgba(15, 23, 42, 0.16) !important;
                    }

                    /* ── Forçar fundo branco em todas as seções e remover efeitos de faixa ── */
                    .section-band,
                    .section-band-base,
                    .section-band-alt,
                    .section-band-strong {
                        background: #ffffff !important;
                        box-shadow: none !important;
                        clip-path: none !important;
                        --section-bg: #ffffff !important;
                    }

                    /* ── Páginas do print alinhadas ao topo ── */
                    .content-editorial-section,
                    .content-music-section,
                    .content-palestras-section,
                    .content-section,
                    .content-team-section {
                        break-before: page !important;
                        page-break-before: always !important;
                        height: 297mm !important;
                        min-height: 297mm !important;
                        display: table !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                        background: #ffffff !important;
                        padding: 0 !important;
                    }

                    .section-print-wrapper {
                        display: table-cell !important;
                        vertical-align: top !important;
                        width: 100% !important;
                        padding: 20mm 15mm !important;
                        box-sizing: border-box !important;
                    }

                    /* ── CAPA: Hero ocupa página inteira com fundo claro ─────────── */
                    .hero-section {
                        height: 297mm !important; /* Altura exata da folha A4 em milímetros */
                        padding: 20mm 15mm !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        background: #ffffff !important;
                        break-after: page !important;
                        page-break-after: always !important;
                        box-sizing: border-box !important;
                    }

                    .hero-card {
                        padding: 0 !important;
                        max-width: 100% !important;
                        width: 100% !important;
                        height: 100% !important;
                        display: flex !important;
                        flex-direction: column !important;
                        justify-content: space-between !important;
                        align-items: center !important;
                        background: transparent !important;
                        box-shadow: none !important;
                        border: none !important;
                    }

                    .capa-header {
                        display: grid !important;
                        grid-template-columns: 100px 1fr 100px !important;
                        align-items: center !important;
                        gap: 1rem !important;
                        width: 100% !important;
                        text-align: center !important;
                        margin-bottom: 0 !important;
                    }

                    .capa-header-logo-left,
                    .capa-header-logo-right {
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                    }

                    .capa-header-logo-left img,
                    .capa-header-logo-right img {
                        width: 85px !important;
                        height: 85px !important;
                        object-fit: contain !important;
                        background: transparent !important;
                        padding: 0 !important;
                        border: none !important;
                        box-shadow: none !important;
                    }

                    .capa-header-center {
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                    }

                    .capa-header-center h2 {
                        font-size: 13pt !important;
                        font-weight: 800 !important;
                        color: #000000 !important;
                        margin: 0 0 2px 0 !important;
                        letter-spacing: 0.02em !important;
                        line-height: 1.2 !important;
                    }

                    .capa-header-center h3 {
                        font-size: 10pt !important;
                        font-weight: 700 !important;
                        color: #000000 !important;
                        margin: 0 0 10px 0 !important;
                        letter-spacing: 0.02em !important;
                        line-height: 1.2 !important;
                    }

                    .capa-edicao {
                        font-size: 26pt !important;
                        font-weight: 800 !important;
                        color: #000000 !important;
                        margin: 10px 0 5px 0 !important;
                        letter-spacing: -0.01em !important;
                        line-height: 1.1 !important;
                    }

                    .capa-tema {
                        font-size: 16pt !important;
                        font-weight: 700 !important;
                        color: #000000 !important;
                        font-style: italic !important;
                        margin: 5px 0 0 0 !important;
                        line-height: 1.2 !important;
                    }

                    .capa-central-logo {
                        margin: 20px auto !important;
                        width: 100% !important;
                        max-width: 480px !important;
                        height: 110mm !important;
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                    }

                    .capa-central-logo img {
                        max-width: 100% !important;
                        max-height: 100% !important;
                        object-fit: contain !important;
                        border-radius: 0 !important;
                        box-shadow: none !important;
                    }

                    .capa-footer-dates {
                        font-size: 12pt !important;
                        font-weight: 700 !important;
                        color: #000000 !important;
                        margin-top: 0 !important;
                        margin-bottom: 10px !important;
                        text-align: center !important;
                        width: 100% !important;
                    }

                    /* ── Nova página para cada seção ─────────────── */
                    .content-editorial-section,
                    .content-music-section,
                    .content-palestras-section,
                    .content-section,
                    .content-team-section {
                        break-before: page !important;
                        page-break-before: always !important;
                    }

                    /* ── SIMBOLOGIA & TEMÁTICA ───────────────────── */
                    .content-editorial-section {
                        background: #ffffff !important;
                    }

                    .editorial-container,
                    .content-editorial-section.reverse .editorial-container {
                        display: block !important;
                        max-width: 100% !important;
                        text-align: left !important;
                    }

                    .editorial-visual {
                        display: flex !important;
                        justify-content: center !important;
                        align-items: center !important;
                        margin-bottom: 2rem !important;
                        width: 100% !important;
                    }

                    .simbol-logo img,
                    .theme-logo {
                        max-height: 260px !important;
                        max-width: 260px !important;
                        width: auto !important;
                        height: auto !important;
                        object-fit: contain !important;
                        border-radius: 16px !important;
                        box-shadow: 0 8px 30px rgba(0,0,0,0.06) !important;
                    }

                    .section-header h2 {
                        font-size: 22pt !important;
                        font-weight: 800 !important;
                        color: #0f172a !important;
                        margin-bottom: 0.5rem !important;
                    }

                    .section-header .divider {
                        height: 4px !important;
                        width: 50px !important;
                        background: #2563eb !important;
                        margin-bottom: 1.5rem !important;
                    }

                    .circulo-banner {
                        display: flex !important;
                        align-items: center !important;
                        justify-content: space-between !important;
                        background: #f8fafc !important;
                        border: 1px solid #e2e8f0 !important;
                        border-radius: 16px !important;
                        padding: 12px 20px !important;
                        gap: 20px !important;
                        margin-bottom: 20px !important;
                        width: 100% !important;
                        box-sizing: border-box !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }

                    .circulo-banner-logo {
                        width: 72px !important;
                        height: 72px !important;
                        flex: 0 0 72px !important;
                        border-radius: 0 !important;
                        overflow: hidden !important;
                        display: flex !important;
                        align-items: center !important;
                        justify-content: center !important;
                        background: transparent !important;
                        border: 0 !important;
                    }

                    .circulo-banner-logo img {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: contain !important;
                        display: block !important;
                    }

                    .circulo-banner-title-box {
                        flex-grow: 1 !important;
                        display: flex !important;
                        flex-direction: column !important;
                    }

                    .circulo-banner-title-box h2 {
                        font-size: 16pt !important;
                        font-weight: 800 !important;
                        color: #0f172a !important;
                        margin: 0 !important;
                    }

                    .circulo-banner-divider {
                        height: 3px !important;
                        width: 40px !important;
                        background: #2563eb !important;
                        border-radius: 1.5px !important;
                        margin-top: 4px !important;
                    }

                    .circulo-banner-mediadores {
                        width: 190px !important;
                        height: 90px !important;
                        flex: 0 0 190px !important;
                        border-radius: 0 !important;
                        overflow: hidden !important;
                        border: 0 !important;
                        background: transparent !important;
                    }

                    .circulo-banner-mediadores img {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: contain !important;
                        display: block !important;
                    }

                    .editorial-text,
                    .rich-editorial-output {
                        font-size: 10.5pt !important;
                        line-height: 1.65 !important;
                        color: #334155 !important;
                    }

                    .rich-editorial-output p {
                        min-height: 1.65em !important;
                        margin-bottom: 0.85rem !important;
                    }

                    .rich-editorial-output p:empty::before {
                        content: "\\00a0" !important;
                        white-space: pre !important;
                    }

                    .rich-editorial-output h1,
                    .rich-editorial-output h2,
                    .rich-editorial-output h3 {
                        color: #0f172a !important;
                        line-height: 1.18 !important;
                        margin: 10pt 0 6pt !important;
                    }

                    .rich-editorial-output h1 {
                        font-size: 18pt !important;
                        font-weight: 800 !important;
                    }

                    .rich-editorial-output h2 {
                        font-size: 15pt !important;
                        font-weight: 800 !important;
                    }

                    .rich-editorial-output h3 {
                        font-size: 12pt !important;
                        font-weight: 700 !important;
                    }

                    .rich-editorial-output a {
                        color: #1d4ed8 !important;
                        text-decoration: underline !important;
                    }

                    /* ── MÚSICA TEMA ─────────────────────────────── */
                    .content-music-section {
                        background: #ffffff !important;
                        color: #0f172a !important;
                    }

                    .music-container {
                        max-width: 640px !important;
                        margin: 0 auto !important;
                    }

                    .music-header h2 {
                        font-size: 26pt !important;
                        font-weight: 800 !important;
                        color: #0f172a !important;
                    }

                    .music-header h3 {
                        font-size: 14pt !important;
                        color: #334155 !important;
                        margin-bottom: 2rem !important;
                    }

                    .lyrics-wrapper {
                        background: #f8fafc !important;
                        border: 1px solid #e2e8f0 !important;
                        border-radius: 20px !important;
                        padding: 2rem 2.5rem !important;
                    }

                    .lyrics-content {
                        font-size: 11pt !important;
                        line-height: 1.6 !important;
                        color: #334155 !important;
                    }

                    /* ── ENCONTRISTAS: layout inline-block super robusto para quebras de página ── */
                    .content-section {
                        padding: 0 !important;
                        display: table !important;
                        break-inside: auto !important;
                        page-break-inside: auto !important;
                    }

                    .quadrante-grid {
                        display: block !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        text-align: center !important;
                        break-inside: auto !important;
                        page-break-inside: auto !important;
                    }

                    .participant-card {
                        display: inline-block !important;
                        width: calc(20% - 12px) !important; /* 5 colunas */
                        margin: 6px 6px 14px 6px !important;
                        vertical-align: top !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        border-radius: 12px !important;
                        border: 1px solid #e2e8f0 !important;
                        overflow: hidden !important;
                        background: white !important;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.06) !important;
                    }

                    .card-photo-wrapper {
                        aspect-ratio: 1/1 !important;
                        background: #f1f5f9 !important;
                    }

                    .card-info {
                        padding: 8px !important;
                    }

                    .card-info h3 {
                        font-size: 7.5pt !important;
                        font-weight: 700 !important;
                        color: #0f172a !important;
                        line-height: 1.25 !important;
                        margin: 0 !important;
                    }

                    .team-tag {
                        font-size: 6pt !important;
                        padding: 2px 5px !important;
                        border-radius: 4px !important;
                    }

                    /* ── EQUIPES: foto widescreen + lista 3 colunas  */
                    .content-team-section {
                        padding: 0 !important;
                        display: table !important;
                        break-inside: auto !important;
                        page-break-inside: auto !important;
                    }

                    .team-layout {
                        display: flex !important;
                        flex-direction: column !important;
                        border-radius: 20px !important;
                        overflow: visible !important;
                        border: 1px solid #e2e8f0 !important;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.06) !important;
                        background: white !important;
                        height: auto !important;
                        max-height: none !important;
                    }

                    .team-visual {
                        width: 100% !important;
                        aspect-ratio: 21 / 9 !important;
                        max-height: 350px !important;
                        height: auto !important;
                        overflow: hidden !important;
                        position: relative !important;
                    }

                    .team-photo-container {
                        width: 100% !important;
                        height: 100% !important;
                    }

                    .team-photo-container img {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: cover !important;
                    }

                    .team-photo-stub {
                        background: #f1f5f9 !important;
                        color: #475569 !important;
                        height: 100% !important;
                        display: flex !important;
                        flex-direction: column !important;
                        align-items: center !important;
                        justify-content: center !important;
                        gap: 8px !important;
                    }

                    .team-photo-stub svg {
                        color: #64748b !important;
                    }

                    .team-members-list {
                        padding: 28px 32px !important;
                        height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                    }

                    .list-header {
                        margin-bottom: 16px !important;
                    }

                    .list-header h3 {
                        font-size: 18pt !important;
                        font-weight: 800 !important;
                        color: #0f172a !important;
                        margin-bottom: 4px !important;
                    }

                    .list-header .line {
                        height: 4px !important;
                        width: 40px !important;
                        background: #2563eb !important;
                        border-radius: 2px !important;
                    }

                    .numbered-list {
                        grid-template-columns: repeat(3, 1fr) !important;
                        gap: 8px !important;
                    }

                    .member-item {
                        padding: 8px 12px !important;
                        border-radius: 10px !important;
                        background: #f8fafc !important;
                        border: 1px solid #e2e8f0 !important;
                        break-inside: avoid !important;
                    }

                    .member-item .number {
                        width: 26px !important;
                        height: 26px !important;
                        min-width: 26px !important;
                        font-size: 7.5pt !important;
                        background: rgba(37,99,235,0.1) !important;
                        color: #1d4ed8 !important;
                        border-radius: 6px !important;
                    }

                    .member-item .name {
                        font-size: 9pt !important;
                        font-weight: 600 !important;
                        color: #0f172a !important;
                    }

                    .child-member-content {
                        display: flex !important;
                        flex-direction: column !important;
                        gap: 2px !important;
                    }

                    .child-responsibles {
                        color: #64748b !important;
                        font-size: 6.5pt !important;
                        font-weight: 400 !important;
                        line-height: 1.25 !important;
                        opacity: 0.8 !important;
                    }

                    /* ── PALESTRAS: layout inline-block de 2 colunas ── */
                    .content-palestras-section {
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: table !important;
                    }

                    .palestras-grid {
                        display: block !important;
                        width: 100% !important;
                        margin: 24px 0 0 0 !important;
                        padding: 0 !important;
                        text-align: left !important;
                    }

                    .palestras-grid.single-item {
                        text-align: center !important;
                        display: block !important;
                    }

                    .palestras-grid.single-item .palestra-card {
                        display: inline-block !important;
                        width: 100% !important;
                        max-width: 500px !important;
                        margin: 0 auto !important;
                        text-align: left !important;
                    }

                    .palestra-card {
                        display: inline-block !important;
                        width: calc(50% - 18px) !important; /* 2 colunas */
                        margin: 9px !important;
                        vertical-align: top !important;
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                        border-radius: 14px !important;
                        padding: 18px !important;
                        border: 1px solid #e2e8f0 !important;
                        background: white !important;
                        box-shadow: none !important;
                    }

                    .speaker-avatar {
                        width: 48px !important;
                        height: 48px !important;
                        border-radius: 12px !important;
                        overflow: hidden !important;
                        flex-shrink: 0 !important;
                    }

                    .speaker-info h3 {
                        font-size: 11pt !important;
                        font-weight: 700 !important;
                        color: #0f172a !important;
                    }

                    .speaker-info .p-nome {
                        font-size: 9pt !important;
                        color: #64748b !important;
                    }

                    .palestra-body p,
                    .palestra-body li {
                        font-size: 9pt !important;
                        line-height: 1.55 !important;
                        color: #475569 !important;
                    }

                    /* ── Rodapé ──────────────────────────────────── */
                    .spa-footer {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}

async function waitForPrintReady(root: HTMLElement | null) {
    await nextFrame();

    const fontReady = 'fonts' in document
        ? document.fonts.ready.catch(() => undefined)
        : Promise.resolve();

    const images = root ? Array.from(root.querySelectorAll('img')) : [];
    const imageReady = images.map((image) => {
        if (image.complete && image.naturalWidth > 0) return Promise.resolve();
        return image.decode().catch(() => undefined);
    });

    await Promise.race([
        Promise.all([fontReady, ...imageReady]),
        new Promise((resolve) => window.setTimeout(resolve, 10000)),
    ]);

    await nextFrame();
}

function nextFrame() {
    return new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
    });
}

// --- Fim do QuadrantePage ---
