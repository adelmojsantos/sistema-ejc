import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle, FileSpreadsheet, FileText, Users, ListChecks, MapPin } from 'lucide-react';
import type { ReactNode } from 'react';

interface SecretariaCategory {
  id: string;
  path: string;
  label: string;
  description: string;
  icon: ReactNode;
  color: string;
  available: boolean;
}

const CATEGORIES: SecretariaCategory[] = [
  {
    id: 'confirmacoes',
    path: '/secretaria/confirmacoes',
    label: 'Confirmação de Dados',
    description: 'Relatório de conferência de dados pelas equipes.',
    icon: <CheckCircle size={34} />,
    color: '#10b981',
    available: true
  },
  {
    id: 'importar',
    path: '/admin/importar',
    label: 'Importar Planilha',
    description: 'Carga em massa de pessoas e equipes via Excel.',
    icon: <FileSpreadsheet size={34} />,
    color: '#6366f1',
    available: true
  },
  {
    id: 'configuracao-pdf',
    path: '/admin/configuracoes-exportacao',
    label: 'Cabeçalho PDF/Excel',
    description: 'Configurar logotipos e textos dos relatórios.',
    icon: <FileText size={34} />,
    color: '#ef4444',
    available: true
  },
  {
    id: 'sec-participantes',
    path: '/secretaria/participantes',
    label: 'Listagem de Participantes',
    description: 'Lista simplificada de encontristas com geolocalização.',
    icon: <MapPin size={34} />,
    color: '#3b82f6',
    available: true
  },
  {
    id: 'sec-encontreiros',
    path: '/secretaria/encontreiros',
    label: 'Listagem de Encontreiros',
    description: 'Lista completa de voluntários de todas as equipes.',
    icon: <Users size={34} />,
    color: '#f59e0b',
    available: true
  },
  {
    id: 'sec-lista-espera',
    path: '/secretaria/lista-espera',
    label: 'Gerenciar Inscrições Online',
    description: 'Aprovação e efetivação dos jovens inscritos via site.',
    icon: <ListChecks size={34} />,
    color: '#8b5cf6',
    available: true
  },
  {
    id: 'sec-fotos-equipes',
    path: '/secretaria/fotos-equipes',
    label: 'Fotos das Equipes (Quadrante)',
    description: 'Gestão das fotos de grupo dos encontreiros por equipe.',
    icon: <Users size={34} />,
    color: '#06b6d4',
    available: true
  }
];

export function Secretaria() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHub = location.pathname === '/secretaria' || location.pathname === '/secretaria/';

  return isHub ? (
    <section className="cadastros-hub fade-in">
      <header className="page-header">
        <h2 className="page-title">Módulo de Secretaria</h2>
        <p className="text-muted">Gestão de relatórios e documentos do encontro.</p>
      </header>

      <div className="cadastros-hub__grid">
        {CATEGORIES.map((category) => (
          <article
            key={category.id}
            className={`cadastros-hub__card card ${!category.available ? 'is-disabled' : ''}`}
            onClick={() => category.available && navigate(category.path)}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (!category.available) return;
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(category.path);
              }
            }}
          >
            <div className="cadastros-hub__content">
              <span className="cadastros-hub__icon" style={{ backgroundColor: `${category.color}15`, color: category.color }}>
                {category.icon}
              </span>
              <div>
                <h3>{category.label}</h3>
                <p>{category.description}</p>
              </div>
            </div>
            {!category.available && <span className="cadastros-hub__tag" style={{ position: 'absolute', bottom: '1.25rem' }}>Em Breve</span>}
          </article>
        ))}
      </div>
    </section>
  ) : (
    <Outlet />
  );
}
