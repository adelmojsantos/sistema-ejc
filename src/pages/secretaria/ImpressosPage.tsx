import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/ui/PageHeader';
import './ImpressosPage.css';

const impressos = [
  {
    title: 'Placa das Salas',
    path: '/secretaria/impressos/placas-salas',
  },
  {
    title: 'Placa de duplas',
    path: '/secretaria/impressos/placas-duplas',
  },
  {
    title: 'Relação de crachás',
    path: '/secretaria/impressos/relacao-crachas',
  },
  {
    title: 'Crachás de mesa',
    path: '/secretaria/impressos/crachas-mesa',
  },
  {
    title: 'Identificação de carros',
    path: '/secretaria/impressos/identificacao-carros',
  },
];

export function ImpressosPage() {
  const navigate = useNavigate();

  return (
    <section className="impressos-page fade-in">
      <PageHeader
        title="Impressos"
        subtitle="Secretaria"
        backPath="/secretaria"
      />

      <div className="impressos-list">
        {impressos.map(item => (
          <button
            type="button"
            className="impressos-card card"
            key={item.path}
            onClick={() => navigate(item.path)}
          >
            <strong>{item.title}</strong>
          </button>
        ))}
      </div>
    </section>
  );
}
