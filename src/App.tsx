import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation, Outlet } from 'react-router-dom';
import { Header } from './components/Header';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageTransition } from './components/ui/PageTransition';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { EncontroProvider } from './contexts/EncontroContext';
import { EquipeProvider } from './contexts/EquipeContext';
import { useAuth } from './hooks/useAuth';
import { UsersAdminPage } from './pages/admin/UsersAdminPage';
import { ImportarDadosPage } from './pages/admin/ImportarDadosPage';
import { AccessAdminPage } from './pages/admin/AccessAdminPage';
import { ExportConfigListPage } from './pages/admin/ExportConfigListPage';
import { ExportConfigFormPage } from './pages/admin/ExportConfigFormPage';
import { BibliotecaPage } from './pages/admin/BibliotecaPage';
import { Cadastros } from './pages/Cadastros';
import { CirculosPage } from './pages/cadastros/CirculosPage';
import { EncontroParticipantesPage } from './pages/cadastros/EncontroParticipantesPage';
import { EncontrosPage } from './pages/cadastros/EncontrosPage';
import { EquipesPage } from './pages/cadastros/EquipesPage';
import { MontagemCirculos } from './pages/cadastros/MontagemCirculos';
import { MontagemPage } from './pages/cadastros/MontagemPage';
import { PessoasPage } from './pages/cadastros/PessoasPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { CoordenadorMinhaEquipePage } from './pages/coordenador/CoordenadorMinhaEquipePage';
import { RecepcaoAdminPage } from './pages/atividades/RecepcaoAdminPage';
import { RecreacaoAdminPage } from './pages/atividades/RecreacaoAdminPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { Home } from './pages/Home';
import { InscricaoPage } from './pages/InscricaoPage';
import InscricaoPublicaPage from './pages/InscricaoPublicaPage';
import LandingPage from './pages/LandingPage';
import { Login } from './pages/Login';
import { PrivacidadePage } from './pages/PrivacidadePage';
import { Secretaria } from './pages/Secretaria';
import { ConfirmationReportPage } from './pages/secretaria/ConfirmationReportPage';
import { ConfirmationTeamDetailPage } from './pages/secretaria/ConfirmationTeamDetailPage';
import { VisitacaoMeusParticipantesPage } from './pages/visitacao/VisitacaoMeusParticipantesPage';
import { CoordenadorVisitacaoPage } from './pages/visitacao/CoordenadorVisitacaoPage';
import { VisitacaoManutencaoPage } from './pages/visitacao/VisitacaoManutencaoPage';
import { VisitacaoPortalPage } from './pages/visitacao/VisitacaoPortalPage';
import { SecretariaParticipantesPage } from './pages/secretaria/SecretariaParticipantesPage';
import { SecretariaEncontreirosPage } from './pages/secretaria/SecretariaEncontreirosPage';
import { GerenciarListaEsperaPage } from './pages/secretaria/GerenciarListaEsperaPage';
import { SecretariaFotosPage } from './pages/secretaria/SecretariaFotosPage';
import { ComprasPage } from './pages/compras/ComprasPage';
import { TaxasPage } from './pages/compras/TaxasPage';
import { PedidosCamisetasPage } from './pages/compras/PedidosCamisetasPage';
import { ConfiguracaoCamisetasPage } from './pages/compras/ConfiguracaoCamisetasPage';
import { SplashScreen } from './components/ui/SplashScreen';
import { useEffect } from 'react';
import { useLoading } from './contexts/LoadingContext';
import { AppLayout } from './components/layout/AppLayout';
import { ExternalSessionProvider } from './contexts/ExternalSessionContext';
import FormAccess from './pages/Public/FormAccess';
import FormPage from './pages/Public/FormPage';
import FormRecreacaoPage from './pages/Public/FormRecreacaoPage';
import { EncontroQuadranteConfigPage } from './pages/cadastros/EncontroQuadranteConfigPage';
import { QuadranteAuthPage } from './pages/Public/QuadranteAuthPage';
import { QuadrantePage } from './pages/Public/QuadrantePage';
import SharedLibraryPage from './pages/shared/SharedLibraryPage';


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

function AnimatedRoutes() {
  const location = useLocation();
  const { profile, hasPermission } = useAuth();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/esqueci-senha" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
        <Route path="/privacidade" element={<PageTransition><PrivacidadePage /></PageTransition>} />
        <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />
        <Route path="/inscricao-online" element={<PageTransition><InscricaoPublicaPage /></PageTransition>} />
        <Route path="/formulario" element={<PageTransition><FormAccess /></PageTransition>} />
        <Route path="/formulario/recepcao" element={<PageTransition><FormPage /></PageTransition>} />
        <Route path="/formulario/recreacao" element={<PageTransition><FormRecreacaoPage /></PageTransition>} />
        <Route path="/q/:token" element={<QuadranteAuthPage />} />
        <Route path="/quadrante/:token" element={<QuadrantePage />} />

        <Route path="/alterar-senha" element={
          <ProtectedRoute allowTemporaryPassword={true}>
            <PageTransition>
              <ChangePasswordPage />
            </PageTransition>
          </ProtectedRoute>
        } />

        {/* Private Routes Wrapper */}
        <Route element={<ProtectedRoute><AppLayout><Outlet /></AppLayout></ProtectedRoute>}>
          <Route path="/dashboard" element={
            (() => {
              if ((hasPermission('modulo_visitacao_coordenar') || hasPermission('modulo_visitacao_duplas')) && !hasPermission('modulo_admin') && Object.keys(profile?.permissions || []).length === 1) {
                return <Navigate to="/visitacao" replace />;
              } else if (hasPermission('modulo_coordenador') && !hasPermission('modulo_admin') && Object.keys(profile?.permissions || []).length === 1) {
                return <Navigate to="/coordenador/minha-equipe" replace />;
              } else {
                return <Home />;
              }
            })()
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

          <Route path="/admin/biblioteca" element={
            <ProtectedRoute requiredPermissions={['modulo_biblioteca', 'modulo_admin']}>
              <PageTransition><BibliotecaPage /></PageTransition>
            </ProtectedRoute>
          } />

          <Route path="/admin/importar" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <ImportarDadosPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/configuracoes-exportacao" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <ExportConfigListPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/configuracoes-exportacao/novo" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <ExportConfigFormPage />
            </ProtectedRoute>
          } />

          <Route path="/admin/configuracoes-exportacao/:id" element={
            <ProtectedRoute requiredPermissions={['modulo_admin']}>
              <ExportConfigFormPage />
            </ProtectedRoute>
          } />

          <Route path="/secretaria" element={
            <ProtectedRoute requiredPermissions={['modulo_secretaria', 'modulo_admin']}>
              <Secretaria />
            </ProtectedRoute>
          }>
            <Route path="confirmacoes" element={<ConfirmationReportPage />} />
            <Route path="confirmacoes/:equipe_id" element={<ConfirmationTeamDetailPage />} />
            <Route path="participantes" element={<SecretariaParticipantesPage />} />
            <Route path="encontreiros" element={<SecretariaEncontreirosPage />} />
            <Route path="lista-espera" element={<GerenciarListaEsperaPage />} />
            <Route path="fotos-equipes" element={<SecretariaFotosPage />} />
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

          <Route path="/visitacao/manutencao/:id" element={
            <ProtectedRoute requiredPermissions={['modulo_visitacao_duplas']}>
              <VisitacaoManutencaoPage />
            </ProtectedRoute>
          } />

          <Route path="/biblioteca/compartilhada" element={
            <ProtectedRoute>
              <PageTransition><SharedLibraryPage /></PageTransition>
            </ProtectedRoute>
          } />

          <Route path="/montagem-circulos" element={
            <ProtectedRoute requiredPermissions={['modulo_cadastros', 'modulo_admin']}>
              <MontagemCirculos />
            </ProtectedRoute>
          } />

          <Route path="/coordenador/minha-equipe" element={
            <ProtectedRoute requiredPermissions={['modulo_coordenador', 'modulo_admin']}>
              <CoordenadorMinhaEquipePage />
            </ProtectedRoute>
          } />

          <Route path="/atividades/recepcao" element={
            <ProtectedRoute requiredPermissions={['modulo_recepcao', 'modulo_admin']}>
              <RecepcaoAdminPage />
            </ProtectedRoute>
          } />

          <Route path="/atividades/recreacao" element={
            <ProtectedRoute requiredPermissions={['modulo_recreacao', 'modulo_admin']}>
              <RecreacaoAdminPage />
            </ProtectedRoute>
          } />

          <Route path="/compras" element={<ComprasPage />}>
            <Route path="taxas" element={<PageTransition><TaxasPage /></PageTransition>} />
            <Route path="camisetas" element={<PageTransition><PedidosCamisetasPage /></PageTransition>} />
            <Route path="configuracao" element={<PageTransition><ConfiguracaoCamisetasPage /></PageTransition>} />
          </Route>

          <Route path="/cadastros" element={
            <ProtectedRoute requiredPermissions={['modulo_cadastros', 'modulo_admin']}>
              <Cadastros />
            </ProtectedRoute>
          }>
            <Route path="pessoas" element={<PessoasPage />} />
            <Route path="encontros" element={<EncontrosPage />} />
            <Route path="encontros/:id/quadrante" element={<EncontroQuadranteConfigPage />} />
            <Route path="encontros/participantes" element={<EncontroParticipantesPage />} />
            <Route path="equipes" element={<EquipesPage />} />
            <Route path="circulos" element={<CirculosPage />} />
            <Route path="montagem" element={<MontagemPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function MainApp() {
  const { loading } = useAuth();
  const { isLoading, setIsLoading } = useLoading();

  // Sync initial auth loading with global loading state
  useEffect(() => {
    if (loading) {
      setIsLoading(true);
    } else {
      // Small delay for smooth transition on first load
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loading, setIsLoading]);

  // Safety timeout for initial mount (max 4s)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [setIsLoading]);

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
    <ThemeProvider>
      <AuthProvider>
        <ExternalSessionProvider>
          <EncontroProvider>
            <EquipeProvider>
              <MainApp />
            </EquipeProvider>
          </EncontroProvider>
        </ExternalSessionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
