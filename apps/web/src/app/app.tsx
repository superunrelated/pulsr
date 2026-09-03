import { Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '../lib/auth';
import { Layout } from './Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { WeightLog } from './pages/WeightLog';
import { Medications } from './pages/Medications';
import { Symptoms } from './pages/Symptoms';
import { Activity } from './pages/Activity';
import { Settings } from './pages/Settings';

function AppRoutes() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-neutral-400">
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/weight" element={<WeightLog />} />
        <Route path="/medications" element={<Medications />} />
        <Route path="/symptoms" element={<Symptoms />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
