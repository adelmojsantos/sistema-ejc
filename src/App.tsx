import { Route, BrowserRouter as Router, Routes } from 'react-router-dom';
import { Header } from './components/Header';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Cadastros } from './pages/Cadastros';
import { CirculosPage } from './pages/cadastros/CirculosPage';
import { EncontrosPage } from './pages/cadastros/EncontrosPage';
import { EquipesPage } from './pages/cadastros/EquipesPage';
import { MontagemPage } from './pages/cadastros/MontagemPage';
import { PessoasPage } from './pages/cadastros/PessoasPage';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { VinculoPage } from './pages/visitacao/VinculoPage';
import { VinculoCirculoPage } from './pages/circulos/VinculoCirculoPage';

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex flex-col" style={{ minHeight: '100vh' }}>
      <Header />
      <main className="main-content container flex items-center justify-center text-center">
        <h1 style={{ fontSize: '2.5rem', opacity: 0.5 }}>{title}</h1>
      </main>
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route path="/" element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            } />

            <Route path="/secretaria" element={
              <ProtectedRoute>
                <PlaceholderPage title="Secretaria (Em Breve)" />
              </ProtectedRoute>
            } />

            <Route path="/visitacao" element={
              <ProtectedRoute>
                <VinculoPage />
              </ProtectedRoute>
            } />
            <Route path="/circulos" element={
              <ProtectedRoute>
                <VinculoCirculoPage />
              </ProtectedRoute>
            } />

            <Route path="/cadastros" element={
              <ProtectedRoute>
                <Cadastros />
              </ProtectedRoute>
            }>
              <Route path="pessoas" element={<PessoasPage />} />
              <Route path="encontros" element={<EncontrosPage />} />
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
