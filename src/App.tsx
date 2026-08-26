import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation, Outlet, useParams } from 'react-router-dom';
import { Header } from './components/Header';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { AppObservability } from './components/AppObservability';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageTransition } from './components/ui/PageTransition';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { SplashScreen } from './components/ui/SplashScreen';
import { lazy, Suspense, type ComponentType } from 'react';
import { useLoading } from './contexts/LoadingContext';
import { AppLayout } from './components/layout/AppLayout';
import {
  ALMOXARIFADO_ROUTE_PERMISSIONS,
  ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS,
  ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS,
  ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS,
  FINANCE_ROUTE_PERMISSIONS,
  PURCHASES_ROUTE_PERMISSIONS,
  SHIRT_ROUTE_PERMISSIONS,
  canAccessKitchenArea,
} from './utils/accessControl';

function lazyNamed<TProps extends object = Record<string, never>>(
  loader: () => Promise<unknown>,
  exportName: string
) {
  return lazy(async () => {
    const module = await loader() as Record<string, unknown>;
    return { default: module[exportName] as ComponentType<TProps> };
  });
}

const UsersAdminPage = lazyNamed(() => import('./pages/admin/UsersAdminPage'), 'UsersAdminPage');
const ImportarDadosPage = lazyNamed(() => import('./pages/admin/ImportarDadosPage'), 'ImportarDadosPage');
const AccessAdminPage = lazyNamed(() => import('./pages/admin/AccessAdminPage'), 'AccessAdminPage');
const ExportConfigListPage = lazyNamed(() => import('./pages/admin/ExportConfigListPage'), 'ExportConfigListPage');
const ExportConfigFormPage = lazyNamed(() => import('./pages/admin/ExportConfigFormPage'), 'ExportConfigFormPage');
const BibliotecaPage = lazyNamed(() => import('./pages/admin/BibliotecaPage'), 'BibliotecaPage');
const DirigenciaPage = lazyNamed(() => import('./pages/admin/DirigenciaPage'), 'DirigenciaPage');
const DiagnosticsPage = lazyNamed(() => import('./pages/admin/DiagnosticsPage'), 'DiagnosticsPage');
const Cadastros = lazyNamed(() => import('./pages/cadastros/Cadastros'), 'Cadastros');
const CirculosPage = lazyNamed(() => import('./pages/circulos/CirculosPage'), 'CirculosPage');
const CirculosPortalPage = lazyNamed(() => import('./pages/circulos/CirculosPortalPage'), 'CirculosPortalPage');
const EncontroParticipantesPage = lazyNamed(() => import('./pages/cadastros/EncontroParticipantesPage'), 'EncontroParticipantesPage');
const AvaliacaoEncontroPage = lazyNamed(() => import('./pages/cadastros/AvaliacaoEncontroPage'), 'AvaliacaoEncontroPage');
const AvaliacaoEncontristasPage = lazyNamed(() => import('./pages/cadastros/AvaliacaoEncontristasPage'), 'AvaliacaoEncontristasPage');
const CronogramaEncontroPage = lazyNamed(() => import('./pages/cadastros/CronogramaEncontroPage'), 'CronogramaEncontroPage');
const EncontrosPage = lazyNamed(() => import('./pages/cadastros/EncontrosPage'), 'EncontrosPage');
const EquipesPage = lazyNamed(() => import('./pages/cadastros/EquipesPage'), 'EquipesPage');
const MontagemCirculos = lazyNamed(() => import('./pages/circulos/MontagemCirculos'), 'MontagemCirculos');
const ResumoPalestrasPage = lazyNamed(() => import('./pages/circulos/ResumoPalestrasPage'), 'ResumoPalestrasPage');
const PosEncontroCirculosPage = lazyNamed(() => import('./pages/circulos/PosEncontroCirculosPage'), 'PosEncontroCirculosPage');
const PosEncontroFichasPage = lazyNamed(() => import('./pages/circulos/PosEncontroFichasPage'), 'PosEncontroFichasPage');
const MontagemPage = lazyNamed(() => import('./pages/cadastros/MontagemPage'), 'MontagemPage');
const PessoasPage = lazyNamed(() => import('./pages/cadastros/PessoasPage'), 'PessoasPage');
const PalestrasGestaoPage = lazyNamed(() => import('./pages/cadastros/PalestrasGestaoPage'), 'PalestrasGestaoPage');
const PalestrasResumoPage = lazyNamed(() => import('./pages/cadastros/PalestrasResumoPage'), 'PalestrasResumoPage');
const PosEncontrosCadastroPage = lazyNamed(() => import('./pages/cadastros/PosEncontrosCadastroPage'), 'PosEncontrosCadastroPage');
const PosEncontroFormPage = lazyNamed(() => import('./pages/cadastros/PosEncontroFormPage'), 'PosEncontroFormPage');
const PreparacaoEncontroPage = lazyNamed(() => import('./pages/cadastros/PreparacaoEncontroPage'), 'PreparacaoEncontroPage');
const PalestrasModulePage = lazyNamed(() => import('./pages/atividades/PalestrasModulePage'), 'PalestrasModulePage');
const ChangePasswordPage = lazyNamed(() => import('./pages/ChangePasswordPage'), 'ChangePasswordPage');
const CoordenadorAvaliacaoPage = lazyNamed(() => import('./pages/coordenador/CoordenadorAvaliacaoPage'), 'CoordenadorAvaliacaoPage');
const CoordenadorCozinhaPage = lazyNamed(() => import('./pages/coordenador/CoordenadorCozinhaPage'), 'CoordenadorCozinhaPage');
const CoordenadorMinhaEquipePage = lazyNamed(() => import('./pages/coordenador/CoordenadorMinhaEquipePage'), 'CoordenadorMinhaEquipePage');
const CuidadosPage = lazyNamed(() => import('./pages/cuidados/CuidadosPage'), 'CuidadosPage');
const LigacaoPage = lazyNamed(() => import('./pages/ligacao/LigacaoPage'), 'LigacaoPage');
const RecepcaoAdminPage = lazyNamed(() => import('./pages/recepcao/RecepcaoAdminPage'), 'RecepcaoAdminPage');
const RecreacaoAdminPage = lazyNamed(() => import('./pages/recreacao/RecreacaoAdminPage'), 'RecreacaoAdminPage');
const RelatoriosPage = lazyNamed<{ mode?: 'relacao-crachas' | 'crachas-mesa' }>(() => import('./pages/relatorios/RelatoriosPage'), 'RelatoriosPage');
const ForgotPasswordPage = lazyNamed(() => import('./pages/ForgotPasswordPage'), 'ForgotPasswordPage');
const ResetPasswordPage = lazyNamed(() => import('./pages/ResetPasswordPage'), 'ResetPasswordPage');
const Home = lazyNamed(() => import('./pages/Home'), 'Home');
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Login = lazyNamed(() => import('./pages/Login'), 'Login');
const PrivacidadePage = lazyNamed(() => import('./pages/PrivacidadePage'), 'PrivacidadePage');
const Secretaria = lazyNamed(() => import('./pages/Secretaria'), 'Secretaria');
const ConfirmationReportPage = lazyNamed(() => import('./pages/secretaria/ConfirmationReportPage'), 'ConfirmationReportPage');
const ConfirmationTeamDetailPage = lazyNamed(() => import('./pages/secretaria/ConfirmationTeamDetailPage'), 'ConfirmationTeamDetailPage');
const VisitacaoMeusParticipantesPage = lazyNamed(() => import('./pages/visitacao/VisitacaoMeusParticipantesPage'), 'VisitacaoMeusParticipantesPage');
const CoordenadorVisitacaoPage = lazyNamed(() => import('./pages/visitacao/CoordenadorVisitacaoPage'), 'CoordenadorVisitacaoPage');
const VisitacaoManutencaoPage = lazyNamed(() => import('./pages/visitacao/VisitacaoManutencaoPage'), 'VisitacaoManutencaoPage');
const VisitacaoPortalPage = lazyNamed(() => import('./pages/visitacao/VisitacaoPortalPage'), 'VisitacaoPortalPage');
const VisitacaoPresencasPage = lazyNamed(() => import('./pages/visitacao/VisitacaoPresencasPage'), 'VisitacaoPresencasPage');
const SecretariaParticipantesPage = lazyNamed(() => import('./pages/secretaria/SecretariaParticipantesPage'), 'SecretariaParticipantesPage');
const SecretariaEncontreirosPage = lazyNamed(() => import('./pages/secretaria/SecretariaEncontreirosPage'), 'SecretariaEncontreirosPage');
const GerenciarListaEsperaPage = lazyNamed(() => import('./pages/secretaria/GerenciarListaEsperaPage'), 'GerenciarListaEsperaPage');
const SecretariaFotosPage = lazyNamed(() => import('./pages/secretaria/SecretariaFotosPage'), 'SecretariaFotosPage');
const ImpressosPage = lazyNamed(() => import('./pages/secretaria/ImpressosPage'), 'ImpressosPage');
const IdentificacaoCarrosPage = lazyNamed(() => import('./pages/secretaria/IdentificacaoCarrosPage'), 'IdentificacaoCarrosPage');
const SecretariaPlacasEquipesPage = lazyNamed<{ mode?: 'salas' | 'duplas' }>(() => import('./pages/secretaria/SecretariaPlacasEquipesPage'), 'SecretariaPlacasEquipesPage');
const LabelGeneratorPage = lazyNamed(() => import('./pages/secretaria/LabelGeneratorPage'), 'LabelGeneratorPage');
const ComprasPage = lazyNamed(() => import('./pages/compras/ComprasPage'), 'ComprasPage');
const TaxasPage = lazyNamed(() => import('./pages/compras/TaxasPage'), 'TaxasPage');
const PedidosCamisetasPage = lazyNamed(() => import('./pages/compras/PedidosCamisetasPage'), 'PedidosCamisetasPage');
const ConfiguracaoCamisetasPage = lazyNamed(() => import('./pages/compras/ConfiguracaoCamisetasPage'), 'ConfiguracaoCamisetasPage');
const AlmoxarifadoPage = lazyNamed(() => import('./pages/compras/AlmoxarifadoPage'), 'AlmoxarifadoPage');
const AlmoxarifadoItensPage = lazyNamed(() => import('./pages/compras/AlmoxarifadoItensPage'), 'AlmoxarifadoItensPage');
const AlmoxarifadoHubPage = lazyNamed(() => import('./pages/compras/AlmoxarifadoHubPage'), 'AlmoxarifadoHubPage');
const AlmoxarifadoPedidosPage = lazyNamed(() => import('./pages/compras/AlmoxarifadoPedidosPage'), 'AlmoxarifadoPedidosPage');
const AlmoxarifadoComprasOperacionalPage = lazyNamed(() => import('./pages/compras/AlmoxarifadoComprasOperacionalPage'), 'AlmoxarifadoComprasOperacionalPage');
const AlmoxarifadoComprasRealizadasPage = lazyNamed(() => import('./pages/compras/AlmoxarifadoComprasRealizadasPage'), 'AlmoxarifadoComprasRealizadasPage');
const AlmoxarifadoCompraDetalhePage = lazyNamed(() => import('./pages/compras/AlmoxarifadoCompraDetalhePage'), 'AlmoxarifadoCompraDetalhePage');
const FinanceiroPage = lazyNamed(() => import('./pages/compras/FinanceiroPage'), 'FinanceiroPage');
const FormAccess = lazy(() => import('./pages/Public/FormAccess'));
const FormPage = lazy(() => import('./pages/Public/FormPage'));
const FormRecreacaoPage = lazy(() => import('./pages/Public/FormRecreacaoPage'));
const FormCirculoAccessPage = lazy(() => import('./pages/Public/FormCirculoAccessPage'));
const FormCirculoFichaPage = lazy(() => import('./pages/Public/FormCirculoFichaPage'));
const PesquisaSatisfacaoPublicPage = lazy(() => import('./pages/Public/PesquisaSatisfacaoPublicPage'));
const EncontroQuadranteConfigPage = lazyNamed(() => import('./pages/cadastros/EncontroQuadranteConfigPage'), 'EncontroQuadranteConfigPage');
const QuadranteAuthPage = lazyNamed(() => import('./pages/Public/QuadranteAuthPage'), 'QuadranteAuthPage');
const QuadrantePage = lazyNamed<{ isAdminView?: boolean }>(() => import('./pages/Public/QuadrantePage'), 'QuadrantePage');
const SharedLibraryPage = lazy(() => import('./pages/shared/SharedLibraryPage'));
const InscricaoPublicaPage = lazy(() => import('./pages/InscricaoPublicaPage'));
const InscricaoPage = lazyNamed(() => import('./pages/InscricaoPage'), 'InscricaoPage');
const AuthenticatedDataProviders = lazy(() => import('./components/providers/AuthenticatedDataProviders'));
const ExternalAccessProvider = lazy(() => import('./components/providers/ExternalAccessProvider'));
const CirculoAccessProvider = lazy(() => import('./components/providers/CirculoAccessProvider'));

function LegacyExportConfigRedirect() {
  const { id } = useParams();
  return <Navigate to={`/secretaria/configuracoes-exportacao/${id}`} replace />;
}

function LegacyPesquisaSatisfacaoEquipeRedirect() {
  const location = useLocation();
  return <Navigate to={`/pesquisa-satisfacao${location.search}`} replace />;
}

export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="app-shell">
      <Header />
      <main className="main-content container page-placeholder">
        <h1 className="page-placeholder__title">{title}</h1>
      </main>
    </div>
  );
}

function RouteLoadingFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Carregando página"
      className="route-loading-fallback"
    >
      <span className="route-loading-fallback__spinner" aria-hidden="true" />
      <span>Carregando…</span>
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const { profile, hasPermission, userParticipacao } = useAuth();
  const canAccessMinhaEquipe = hasPermission('modulo_coordenador') && !!userParticipacao?.coordenador;
  const canAccessCozinha = canAccessKitchenArea({
    hasPermission,
    isCoordinator: Boolean(userParticipacao?.coordenador),
    teamName: userParticipacao?.equipes?.nome,
  });

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/esqueci-senha" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
        <Route path="/redefinir-senha" element={<PageTransition><ResetPasswordPage /></PageTransition>} />
        <Route path="/privacidade" element={<PageTransition><PrivacidadePage /></PageTransition>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/inicio" element={<LandingPage />} />
        <Route path="/inscricao-online" element={<PageTransition><InscricaoPublicaPage /></PageTransition>} />
        <Route element={<ExternalAccessProvider><Outlet /></ExternalAccessProvider>}>
          <Route path="/formulario" element={<PageTransition><FormAccess /></PageTransition>} />
          <Route path="/formulario/recepcao" element={<PageTransition><FormPage /></PageTransition>} />
          <Route path="/formulario/recreacao" element={<PageTransition><FormRecreacaoPage /></PageTransition>} />
        </Route>
        <Route path="/q/:token" element={<QuadranteAuthPage />} />
        <Route path="/quadrante/:token" element={<QuadrantePage isAdminView={true} />} />
        <Route path="/quadrante/:token/publico" element={<QuadrantePage isAdminView={false} />} />
        {/* Rotas públicas — Ficha Pós-Encontro por Círculo */}
        <Route element={<CirculoAccessProvider><Outlet /></CirculoAccessProvider>}>
          <Route path="/pos-encontro/circulo/:circulo_id" element={<PageTransition><FormCirculoAccessPage /></PageTransition>} />
          <Route path="/pos-encontro/ficha" element={<PageTransition><FormCirculoFichaPage /></PageTransition>} />
        </Route>
        <Route path="/pesquisa-satisfacao" element={<PageTransition><PesquisaSatisfacaoPublicPage /></PageTransition>} />
        <Route path="/pesquisa-satisfacao/equipe/:equipeId" element={<LegacyPesquisaSatisfacaoEquipeRedirect />} />

        <Route path="/alterar-senha" element={
          <ProtectedRoute allowTemporaryPassword={true}>
            <PageTransition>
              <ChangePasswordPage />
            </PageTransition>
          </ProtectedRoute>
        } />

        {/* Private Routes Wrapper */}
        <Route element={(
          <ProtectedRoute>
            <AuthenticatedDataProviders>
              <AppLayout><Outlet /></AppLayout>
            </AuthenticatedDataProviders>
          </ProtectedRoute>
        )}>
          <Route path="/dashboard" element={
            (() => {
              if ((hasPermission('modulo_visitacao_coordenar') || hasPermission('modulo_visitacao_duplas')) && !hasPermission('modulo_admin') && Object.keys(profile?.permissions || []).length === 1) {
                return <Navigate to="/visitacao" replace />;
              } else if (canAccessMinhaEquipe && !hasPermission('modulo_admin') && Object.keys(profile?.permissions || []).length === 1) {
                return <Navigate to="/coordenador/minha-equipe" replace />;
              } else {
                return <Home />;
              }
            })()
          } />

          <Route path="/dashboard/preparacao" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <PreparacaoEncontroPage />
            </ProtectedRoute>
          } />

          <Route path="/inscricao" element={<InscricaoPage />} />

          <Route path="/inscricao/participantes" element={
            <ProtectedRoute requiredPermissions={['modulo_inscricao', 'modulo_secretaria', 'modulo_admin']}>
              <SecretariaParticipantesPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/usuarios" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <UsersAdminPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/acessos" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <AccessAdminPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/dirigencia" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <DirigenciaPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/diagnosticos" element={
            <ProtectedRoute requiredExactPermissions={['modulo_diagnosticos']}>
              <DiagnosticsPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/biblioteca" element={
            <ProtectedRoute requiredPermissions={['modulo_biblioteca', 'modulo_admin']}>
              <PageTransition><BibliotecaPage /></PageTransition>
            </ProtectedRoute>
          } />

          <Route path="/admin/importar" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <Navigate to="/secretaria/importar" replace />
            </ProtectedRoute>
          } />

          <Route path="/admin/configuracoes-exportacao" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <Navigate to="/secretaria/configuracoes-exportacao" replace />
            </ProtectedRoute>
          } />

          <Route path="/admin/configuracoes-exportacao/novo" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <Navigate to="/secretaria/configuracoes-exportacao/novo" replace />
            </ProtectedRoute>
          } />

          <Route path="/admin/configuracoes-exportacao/:id" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <LegacyExportConfigRedirect />
            </ProtectedRoute>
          } />

          <Route path="/secretaria" element={
            <ProtectedRoute requiredPermissions={['modulo_secretaria', 'modulo_admin']}>
              <Secretaria />
            </ProtectedRoute>
          }>
            <Route path="confirmacoes" element={<ConfirmationReportPage />} />
            <Route path="confirmacoes/:equipe_id" element={<ConfirmationTeamDetailPage />} />
            <Route path="importar" element={<ImportarDadosPage />} />
            <Route path="configuracoes-exportacao" element={<ExportConfigListPage />} />
            <Route path="configuracoes-exportacao/novo" element={<ExportConfigFormPage />} />
            <Route path="configuracoes-exportacao/:id" element={<ExportConfigFormPage />} />
            <Route path="participantes" element={<SecretariaParticipantesPage />} />
            <Route path="encontreiros" element={<SecretariaEncontreirosPage />} />
            <Route path="lista-espera" element={<GerenciarListaEsperaPage />} />
            <Route path="fotos-equipes" element={<SecretariaFotosPage />} />
            <Route path="placas-equipes" element={<Navigate to="/secretaria/impressos" replace />} />
            <Route path="impressos" element={<ImpressosPage />} />
            <Route path="impressos/placas-salas" element={<SecretariaPlacasEquipesPage mode="salas" />} />
            <Route path="impressos/placas-duplas" element={<SecretariaPlacasEquipesPage mode="duplas" />} />
            <Route path="impressos/relacao-crachas" element={<RelatoriosPage mode="relacao-crachas" />} />
            <Route path="impressos/crachas-mesa" element={<RelatoriosPage mode="crachas-mesa" />} />
            <Route path="impressos/identificacao-carros" element={<IdentificacaoCarrosPage />} />
            <Route path="etiquetas" element={<LabelGeneratorPage />} />
          </Route>

          <Route path="/visitacao" element={
            <ProtectedRoute requiredPermissions={['modulo_visitacao_coordenar', 'modulo_visitacao_duplas', 'modulo_admin']}>
              <VisitacaoPortalPage />
            </ProtectedRoute>
          } />

          <Route path="/visitacao/coordenador" element={
            <ProtectedRoute requiredPermissions={['modulo_visitacao_coordenar', 'modulo_admin']}>
              <CoordenadorVisitacaoPage />
            </ProtectedRoute>
          } />

          <Route path="/visitacao/meus-participantes" element={
            <ProtectedRoute requiredPermissions={['modulo_visitacao_duplas']}>
              <VisitacaoMeusParticipantesPage />
            </ProtectedRoute>
          } />

          <Route path="/visitacao/presencas" element={
            <ProtectedRoute requiredPermissions={['modulo_visitacao_coordenar', 'modulo_visitacao_duplas', 'modulo_admin']}>
              <VisitacaoPresencasPage />
            </ProtectedRoute>
          } />

          <Route path="/visitacao/manutencao/:id" element={
            <ProtectedRoute requiredPermissions={['modulo_visitacao_duplas']}>
              <VisitacaoManutencaoPage />
            </ProtectedRoute>
          } />

          <Route path="/atividades/palestras" element={
            <ProtectedRoute requiredPermissions={['modulo_secretaria', 'modulo_admin']}>
              <Navigate to="/palestras" replace />
            </ProtectedRoute>
          } />

          <Route path="/cadastros/palestras" element={
            <ProtectedRoute requiredPermissions={['modulo_cadastros', 'modulo_admin']}>
              <Navigate to="/palestras" replace />
            </ProtectedRoute>
          } />

          <Route path="/cadastros/circulos" element={
            <ProtectedRoute
              requiredPermissions={[
                'modulo_circulos',
                'modulo_circulos_cadastros',
                'modulo_circulos_coordenador',
                'modulo_admin'
              ]}
            >
              <Navigate to="/circulos/cadastros" replace />
            </ProtectedRoute>
          } />

          <Route path="/biblioteca/compartilhada" element={
            <ProtectedRoute>
              <PageTransition><SharedLibraryPage /></PageTransition>
            </ProtectedRoute>
          } />

          <Route
            path="/circulos"
            element={
              <ProtectedRoute 
                requiredPermissions={[
                  'modulo_circulos', 
                  'modulo_circulos_cadastros', 
                  'modulo_circulos_coordenador', 
                  'modulo_circulos_mediador', 
                  'modulo_admin'
                ]}
              >
                <CirculosPortalPage />
              </ProtectedRoute>
            }
          >
            <Route 
              path="cadastros" 
              element={
                <ProtectedRoute requiredPermissions={['modulo_circulos_cadastros', 'modulo_admin']}>
                  <CirculosPage />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="montagem" 
              element={
                <ProtectedRoute requiredPermissions={['modulo_circulos_coordenador', 'modulo_admin']}>
                  <MontagemCirculos />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="resumo-palestras" 
              element={
                <ProtectedRoute requiredPermissions={['modulo_circulos_coordenador', 'modulo_admin']}>
                  <ResumoPalestrasPage />
                </ProtectedRoute>
              } 
            />
            <Route
              path="pos-encontros"
              element={
                <ProtectedRoute requiredPermissions={['modulo_circulos_coordenador', 'modulo_circulos_mediador', 'modulo_admin']}>
                  <PosEncontroCirculosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="pos-encontros/:id"
              element={
                <ProtectedRoute requiredPermissions={['modulo_circulos_coordenador', 'modulo_circulos_mediador', 'modulo_admin']}>
                  <PosEncontroCirculosPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="fichas-pos-encontro"
              element={
                <ProtectedRoute requiredPermissions={['modulo_circulos_coordenador', 'modulo_circulos_mediador', 'modulo_admin']}>
                  <PosEncontroFichasPage />
                </ProtectedRoute>
              }
            />
          </Route>

          <Route path="/coordenador/minha-equipe" element={
            canAccessMinhaEquipe ? <CoordenadorMinhaEquipePage /> : <Navigate to="/dashboard" replace />
          } />

          <Route path="/coordenador/minha-equipe/avaliacao" element={
            canAccessMinhaEquipe ? <CoordenadorAvaliacaoPage /> : <Navigate to="/dashboard" replace />
          } />

          <Route path="/coordenador/cozinha" element={
            <ProtectedRoute requiredPermissions={['modulo_coordenador', 'modulo_admin']}>
              {canAccessCozinha
                ? <CoordenadorCozinhaPage />
                : <Navigate to="/dashboard" replace />}
            </ProtectedRoute>
          } />

          <Route path="/palestras" element={
            <ProtectedRoute requiredPermissions={['modulo_secretaria', 'modulo_admin']}>
              <PalestrasModulePage />
            </ProtectedRoute>
          } />

          <Route path="/relatorios" element={
            <ProtectedRoute requiredPermissions={['modulo_secretaria', 'modulo_admin']}>
              <Navigate to="/secretaria/impressos" replace />
            </ProtectedRoute>
          } />

          <Route path="/atividades/recepcao" element={
            <ProtectedRoute requiredPermissions={['modulo_recepcao', 'modulo_admin']}>
              <Navigate to="/recepcao" replace />
            </ProtectedRoute>
          } />

          <Route path="/recepcao" element={
            <ProtectedRoute requiredPermissions={['modulo_recepcao', 'modulo_admin']}>
              <RecepcaoAdminPage />
            </ProtectedRoute>
          } />

          <Route path="/cuidados" element={
            <ProtectedRoute requiredPermissions={['modulo_cuidados', 'modulo_admin']}>
              <CuidadosPage />
            </ProtectedRoute>
          } />

          <Route path="/ligacao" element={
            <ProtectedRoute requiredPermissions={['modulo_ligacao', 'modulo_admin']}>
              <LigacaoPage />
            </ProtectedRoute>
          } />

          <Route path="/atividades/recreacao" element={
            <ProtectedRoute requiredPermissions={['modulo_recreacao', 'modulo_admin']}>
              <Navigate to="/recreacao" replace />
            </ProtectedRoute>
          } />

          <Route path="/recreacao" element={
            <ProtectedRoute requiredPermissions={['modulo_recreacao', 'modulo_admin']}>
              <RecreacaoAdminPage />
            </ProtectedRoute>
          } />

          <Route path="/compras" element={
            <ProtectedRoute requiredPermissions={PURCHASES_ROUTE_PERMISSIONS}>
              <ComprasPage />
            </ProtectedRoute>
          }>
            <Route path="almoxarifado" element={
              <ProtectedRoute requiredPermissions={ALMOXARIFADO_ROUTE_PERMISSIONS}>
                <PageTransition><AlmoxarifadoHubPage /></PageTransition>
              </ProtectedRoute>
            } />
            <Route element={
              <ProtectedRoute requiredPermissions={ALMOXARIFADO_STOCK_ROUTE_PERMISSIONS}>
                <Outlet />
              </ProtectedRoute>
            }>
              <Route path="almoxarifado/estoque" element={<PageTransition><AlmoxarifadoPage /></PageTransition>} />
              <Route path="almoxarifado/itens" element={<PageTransition><AlmoxarifadoItensPage /></PageTransition>} />
            </Route>
            <Route path="almoxarifado/pedidos" element={
              <ProtectedRoute requiredPermissions={ALMOXARIFADO_ORDER_ROUTE_PERMISSIONS}>
                <PageTransition><AlmoxarifadoPedidosPage /></PageTransition>
              </ProtectedRoute>
            } />
            <Route path="almoxarifado/compras" element={
              <ProtectedRoute requiredPermissions={ALMOXARIFADO_PURCHASE_OPERATION_ROUTE_PERMISSIONS}>
                <PageTransition><AlmoxarifadoComprasOperacionalPage /></PageTransition>
              </ProtectedRoute>
            } />
            <Route element={
              <ProtectedRoute requiredPermissions={ALMOXARIFADO_PURCHASE_HISTORY_ROUTE_PERMISSIONS}>
                <Outlet />
              </ProtectedRoute>
            }>
              <Route path="almoxarifado/compras-realizadas" element={<PageTransition><AlmoxarifadoComprasRealizadasPage /></PageTransition>} />
              <Route path="almoxarifado/compras-realizadas/:compraId" element={<PageTransition><AlmoxarifadoCompraDetalhePage /></PageTransition>} />
            </Route>
            <Route path="financeiro" element={
              <ProtectedRoute requiredPermissions={FINANCE_ROUTE_PERMISSIONS}>
                <PageTransition><FinanceiroPage /></PageTransition>
              </ProtectedRoute>
            } />
            <Route element={
              <ProtectedRoute requiredPermissions={SHIRT_ROUTE_PERMISSIONS}>
                <Outlet />
              </ProtectedRoute>
            }>
              <Route path="taxas" element={<PageTransition><TaxasPage /></PageTransition>} />
              <Route path="camisetas" element={<PageTransition><PedidosCamisetasPage /></PageTransition>} />
              <Route path="configuracao" element={<PageTransition><ConfiguracaoCamisetasPage /></PageTransition>} />
            </Route>
          </Route>

          <Route path="/cadastros" element={
            <ProtectedRoute requiredPermissions={['modulo_cadastros', 'modulo_secretaria', 'modulo_admin']}>
              <Cadastros />
            </ProtectedRoute>
          }>
            <Route path="pessoas" element={<PessoasPage />} />
            <Route path="encontros" element={<EncontrosPage />} />
            <Route path="encontros/:id/editar" element={<EncontrosPage />} />
            <Route path="encontros/:id/quadrante" element={<EncontroQuadranteConfigPage />} />
            <Route path="encontros/:id/palestras" element={<PalestrasGestaoPage />} />
            <Route path="encontros/:id/palestras-resumo" element={<PalestrasResumoPage />} />
            <Route path="encontros/participantes" element={<EncontroParticipantesPage />} />
            <Route path="equipes" element={<EquipesPage />} />
            <Route path="montagem" element={<MontagemPage />} />
            <Route path="avaliacao" element={<AvaliacaoEncontroPage />} />
            <Route path="avaliacao-encontristas" element={<AvaliacaoEncontristasPage />} />
            <Route path="cronograma" element={<CronogramaEncontroPage />} />
            <Route path="preparacao" element={<Navigate to="/dashboard/preparacao" replace />} />
            <Route path="pos-encontros" element={
              <ProtectedRoute requiredPermissions={['modulo_cadastros', 'modulo_secretaria', 'modulo_admin']}>
                <PosEncontrosCadastroPage />
              </ProtectedRoute>
            } />
            <Route path="pos-encontros/novo" element={
              <ProtectedRoute requiredPermissions={['modulo_cadastros', 'modulo_secretaria', 'modulo_admin']}>
                <PosEncontroFormPage />
              </ProtectedRoute>
            } />
            <Route path="pos-encontros/:id" element={
              <ProtectedRoute requiredPermissions={['modulo_cadastros', 'modulo_secretaria', 'modulo_admin']}>
                <PosEncontroFormPage />
              </ProtectedRoute>
            } />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
  );
}

function MainApp() {
  const { isLoading } = useLoading();

  return (
    <>
      <SplashScreen isVisible={isLoading} />
      <Toaster 
        position="top-right" 
        containerStyle={{ zIndex: 100000 }}
        toastOptions={{
          style: {
            zIndex: 100001,
          }
        }}
      />
      <Router>
        <AnimatedRoutes />
      </Router>
    </>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppObservability>
            <MainApp />
          </AppObservability>
        </AuthProvider>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default App;
