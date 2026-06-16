import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import StudentPortal from './pages/StudentPortal';
import AdminDashboard from './pages/AdminDashboard';
import Unauthorized from './pages/Unauthorized';
import GuardianAcknowledgment from './pages/GuardianAcknowledgment';

// Componente para proteger rutas según rol
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="laap-loading-container">
        <div className="laap-spinner"></div>
        <p>Verificando credenciales académicas...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'unauthorized') {
    return <Navigate to="/unauthorized" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    // Si es estudiante tratando de entrar a admin, o viceversa, redirigir correctamente
    return <Navigate to={role === 'admin' ? '/admin' : '/student'} replace />;
  }

  return children;
};

// Componente de redirección inteligente para el Home/Login
const HomeRedirect = () => {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="laap-loading-container">
        <div className="laap-spinner"></div>
        <p>Redireccionando al portal...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (role === 'student') {
    return <Navigate to="/student" replace />;
  }

  if (role === 'unauthorized') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Login />;
};

// Sub-componente para inyectar elementos visuales globales dependientes del estado Auth
const AppContent = () => {
  const { profile } = useAuth();

  return (
    <>
      {profile?.isSimulated === true && (
        <div style={{
          backgroundColor: '#d97706',
          color: '#ffffff',
          padding: '10px 16px',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: '500',
          position: 'sticky',
          top: 0,
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.2)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(8px)',
          background: 'rgba(217, 119, 6, 0.95)',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          <span>🛠️ <strong>Modo desarrollo:</strong> sesión simulada. Google Auth pendiente de activación.</span>
        </div>
      )}
      
      <Routes>
        {/* Ruta raíz redirige inteligentemente */}
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/login" element={<HomeRedirect />} />

        {/* Ruta no autorizada */}
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Rutas Protegidas del Estudiante */}
        <Route path="/student" element={
          <ProtectedRoute allowedRoles={['student']}>
            <StudentPortal />
          </ProtectedRoute>
        } />

        {/* Rutas Protegidas del Administrador */}
        <Route path="/admin" element={
          <ProtectedRoute allowedRoles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />

        {/* Acuse de recibo de apoderados (Ruta pública) */}
        <Route path="/acuse/:token" element={<GuardianAcknowledgment />} />

        {/* Fallback redirige al Home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
