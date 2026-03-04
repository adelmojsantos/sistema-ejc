import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Header } from './components/Header';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
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

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Toaster position="top-right" />
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={<LandingPage />} />

            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />

            <Route path="/inscricao" element={
              <ProtectedRoute>
                <InscricaoPage />
              </ProtectedRoute>
            } />

            <Route path="/secretaria" element={
              <ProtectedRoute>
                <PlaceholderPage title="Secretaria (Em Breve)" />
              </ProtectedRoute>
            } />

            <Route path="/cadastros/montagem-visitacao" element={
              <ProtectedRoute>
                <MontagemVisitacao />
              </ProtectedRoute>
            } />
            <Route path="/cadastros/montagem-circulos" element={
              <ProtectedRoute>
                <MontagemCirculos />
              </ProtectedRoute>
            } />

            <Route path="/cadastros" element={
              <ProtectedRoute>
                <Cadastros />
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
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
