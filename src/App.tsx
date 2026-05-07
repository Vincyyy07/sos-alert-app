import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import Dashboard from './pages/Dashboard';
import Contacts from './pages/Contacts';
import CheckIn from './pages/CheckIn';
import Login from './pages/Login';
import Tracking from './pages/Tracking';
import Profile from './pages/Profile';
import Layout from './components/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6">
      <div className="relative">
        <div className="w-16 h-16 border-2 border-white/5 rounded-full"></div>
        <div className="absolute inset-0 w-16 h-16 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 bg-accent rounded-full animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"></div>
        </div>
      </div>
      <p className="text-[10px] font-bold text-accent uppercase tracking-[0.4em] animate-pulse">Syncing Encrypted Link</p>
    </div>
  );
  
  if (!user) return <Navigate to="/login" />;
  
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/track" element={<Tracking />} />
          
          <Route path="/" element={
            <PrivateRoute>
              <Layout>
                <Dashboard />
              </Layout>
            </PrivateRoute>
          } />
          
          <Route path="/contacts" element={
            <PrivateRoute>
              <Layout>
                <Contacts />
              </Layout>
            </PrivateRoute>
          } />
          
          <Route path="/checkin" element={
            <PrivateRoute>
              <Layout>
                <CheckIn />
              </Layout>
            </PrivateRoute>
          } />

          <Route path="/profile" element={
            <PrivateRoute>
              <Layout>
                <Profile />
              </Layout>
            </PrivateRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
