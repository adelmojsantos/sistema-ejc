import { Route, BrowserRouter as Router, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { Header } from './components/Header';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { PageTransition } from './components/ui/PageTransition';
import { Cadastros } from './pages/Cadastros';
import { CirculosPage } from './pages/cadastros/CirculosPage';
import { EncontrosPage } from './pages/cadastros/EncontrosPage';
import { EncontroParticipantesPage } from './pages/cadastros/EncontroParticipantesPage';
import { EquipesPage } from './pages/cadastros/EquipesPage';
import { MontagemPage } from './pages/cadastros/MontagemPage';
import { PessoasPage } from './pages/cadastros/PessoasPage';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { InscricaoPage } from './pages/InscricaoPage';
import { MontagemVisitacao } from './pages/cadastros/MontagemVisitacao';
import { MontagemCirculos } from './pages/cadastros/MontagemCirculos';
import LandingPage from './pages/LandingPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { UsersAdminPage } from './pages/admin/UsersAdminPage';
import { PrivacidadePage } from './pages/PrivacidadePage';


function PlaceholderPage({ title }: { title: string }) {
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
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/esqueci-senha" element={<PageTransition><ForgotPasswordPage /></PageTransition>} />
        <Route path="/privacidade" element={<PageTransition><PrivacidadePage /></PageTransition>} />

        <Route path="/" element={<PageTransition><LandingPage /></PageTransition>} />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <PageTransition><Home /></PageTransition>
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

        <Route path="/secretaria" element={
          <ProtectedRoute>
            <PageTransition><PlaceholderPage title="Secretaria (Em Breve)" /></PageTransition>
          </ProtectedRoute>
        } />

        <Route path="/montagem-visitacao" element={
          <ProtectedRoute>
            <PageTransition><MontagemVisitacao /></PageTransition>
          </ProtectedRoute>
        } />
        <Route path="/montagem-circulos" element={
          <ProtectedRoute>
            <PageTransition><MontagemCirculos /></PageTransition>
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
