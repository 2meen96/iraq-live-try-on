import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import Welcome from './pages/Welcome';
import ServiceSelection from './pages/ServiceSelection';
import ServiceCatalog from './pages/ServiceCatalog';
import TryOn from './pages/TryOn';
import Chat from './pages/Chat';
import BrideFlow from './pages/BrideFlow';
import AdminPanel from './pages/AdminPanel';
import MedicalAesthetics from './pages/MedicalAesthetics';
import { useAuth } from './services/firebase';

import AutoMakeover from './pages/AutoMakeover';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen w-full flex items-center justify-center bg-[color:var(--theme-bg)]"><p className="micro-label text-[color:var(--theme-text)]">Loading Excellence...</p></div>;
  }

  return (
    <Router>
      <div className="min-h-screen overflow-x-hidden bg-[color:var(--theme-bg)] text-[color:var(--theme-text)] font-sans antialiased flex flex-col transition-colors duration-500">
        <Navigation user={user} />
        <main className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/services" element={<ServiceSelection />} />
            <Route path="/medical-aesthetics" element={<MedicalAesthetics />} />
            <Route path="/services/:id" element={<ServiceCatalog />} />
            <Route path="/try-on" element={<TryOn />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/bride" element={<BrideFlow />} />
            <Route path="/auto-makeover" element={<AutoMakeover />} />
            <Route path="/admin" element={<AdminPanel />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
