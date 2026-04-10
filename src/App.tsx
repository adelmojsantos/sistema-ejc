import { AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { Navigate, Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PageTransition } from './components/ui/PageTransition';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { useAuth } from './hooks/useAuth';
import { UsersAdminPage } from './pages/admin/UsersAdminPage';
import { ImportarDadosPage } from './pages/admin/ImportarDadosPage';
import { Cadastros } from './pages/Cadastros';
import { CirculosPage } from './pages/cadastros/CirculosPage';
import { EncontroParticipantesPage } from './pages/cadastros/EncontroParticipantesPage';
import { EncontrosPage } from './pages/cadastros/EncontrosPage';
import { EquipesPage } from './pages/cadastros/EquipesPage';
import { MontagemCirculos } from './pages/cadastros/MontagemCirculos';
import { MontagemPage } from './pages/cadastros/MontagemPage';
import { MontagemVisitacao } from './pages/cadastros/MontagemVisitacao';
import { PessoasPage } from './pages/cadastros/PessoasPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { CoordenadorMinhaEquipePage } from './pages/coordenador/CoordenadorMinhaEquipePage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { Home } from './pages/Home';
import { InscricaoPage } from './pages/InscricaoPage';
import LandingPage from './pages/LandingPage';
import { Login } from './pages/Login';
import { PrivacidadePage } from './pages/PrivacidadePage';
import { Secretaria } from './pages/Secretaria';
import { ConfirmationReportPage } from './pages/secretaria/ConfirmationReportPage';
import { VisitacaoMeusParticipantesPage } from './pages/visitacao/VisitacaoMeusParticipantesPage';


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
  const { profile, userParticipacao } = useAuth();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/esqueci-senha" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
        <Route path="/privacidade" element={<PageTransition><PrivacidadePage /></PageTransition>} />

        <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            {profile?.role === 'visitacao' ? (
              userParticipacao?.coordenador ? (
                <Navigate to="/montagem-visitacao" replace />
              ) : (
                <Navigate to="/visitacao/meus-participantes" replace />
              )
            ) : profile?.role === 'coordenador' ? (
              <Navigate to="/coordenador/minha-equipe" replace />
            ) : (
              <PageTransition><Home /></PageTransition>
            )}
          </ProtectedRoute>
        } />

        <Route path="/alterar-senha" element={
          <ProtectedRoute allowTemporaryPassword>
            <PageTransition><ChangePasswordPage /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/inscricao" element={
          <ProtectedRoute>
            <PageTransition><InscricaoPage /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/admin/usuarios" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <PageTransition><UsersAdminPage /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/admin/importar" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <PageTransition><ImportarDadosPage /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/secretaria" element={
          <ProtectedRoute>
            <PageTransition><Secretaria /></PageTransition>
          </ProtectedRoute>
        }>
          <Route path="confirmacoes" element={<ConfirmationReportPage />} />
        </Route>

        <Route path="/montagem-visitacao" element={
          <ProtectedRoute allowedRoles={['admin', 'secretaria', 'visitacao']}>
            {profile?.role === 'visitacao' && !userParticipacao?.coordenador ? (
              <Navigate to="/visitacao/meus-participantes" replace />
            ) : (
              <PageTransition><MontagemVisitacao /></PageTransition>
            )}
          </ProtectedRoute>
        } />

        <Route path="/visitacao/meus-participantes" element={
          <ProtectedRoute allowedRoles={['visitacao']}>
            <PageTransition><VisitacaoMeusParticipantesPage /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/montagem-circulos" element={
          <ProtectedRoute>
            <PageTransition><MontagemCirculos /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/coordenador/minha-equipe" element={
          <ProtectedRoute allowedRoles={['coordenador', 'admin']}>
            <PageTransition><CoordenadorMinhaEquipePage /></PageTransition>
          </ProtectedRoute>
        } />

        {/* Note: In nested routes we shouldn't wrap with PageTransition if we don't want the surrounding UI to animate in/out. 
            Here we wrap Cadastros because it's the root layout for this section. */}
        <Route path="/cadastros" element={
          <ProtectedRoute>
            <PageTransition><Cadastros /></PageTransition>
          </ProtectedRoute>
        }>
          <Route path="pessoas" element={<PessoasPage />} />
          <Route path="encontros" element={<EncontrosPage />} />
          <Route path="encontros/participantes" element={<EncontroParticipantesPage />} />
          <Route path="equipes" element={<EquipesPage />} />
          <Route path="circulos" element={<CirculosPage />} />
          <Route path="montagem" element={<MontagemPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-right" />
        <Router>
          <AnimatedRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
