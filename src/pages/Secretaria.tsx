import { CheckCircle, FileSpreadsheet } from 'lucide-react';
import type { ReactNode } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Header } from '../components/Header';

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
  }
];

export function Secretaria() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHub = location.pathname === '/secretaria' || location.pathname === '/secretaria/';

  return (
    <div className="app-shell">
      <Header />

      <main className="main-content container">
        {isHub ? (
          <section className="cadastros-hub fade-in">
            <header className="page-header">
              <h1 className="page-title">Módulo de Secretaria</h1>
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
                  <span className="cadastros-hub__bar" style={{ backgroundColor: category.color }} />
                  <div className="cadastros-hub__content">
                    <span className="cadastros-hub__icon" style={{ backgroundColor: `${category.color}20`, color: category.color }}>
                      {category.icon}
                    </span>
                    <div>
                      <h3>{category.label}</h3>
                      <p>{category.description}</p>
                    </div>
                  </div>
                  {!category.available && <span className="cadastros-hub__tag">Em Breve</span>}
                </article>
              ))}
            </div>
          </section>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
