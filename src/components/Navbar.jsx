import React from 'react';
import { useAuth } from '../context/AuthContext';
import { LogOut, GraduationCap, ShieldAlert, Award } from 'lucide-react';
import { formatNombre } from '../utils/formatters';

export default function Navbar() {
  const { role, profile, logout } = useAuth();

  return (
    <nav className="laap-navbar">
      <div className="laap-navbar-container">
        <div className="laap-navbar-brand">
          <div className="laap-logo-wrapper" style={{ background: 'white', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src="/logo.png" alt="Liceo Arturo Alessandri Palma Logo" style={{ height: '32px', width: '32px', objectFit: 'contain' }} />
          </div>
          <div className="laap-brand-text">
            <span className="laap-brand-title">Liceo Arturo Alessandri Palma</span>
            <span className="laap-brand-subtitle">Providencia</span>
          </div>
        </div>

        {profile && (
          <div className="laap-navbar-user">
            <div className="laap-user-info">
              <span className="laap-user-name">{formatNombre(profile.nombre_completo || profile.nombre || 'Usuario')}</span>
              <span className="laap-user-detail">
                {role === 'admin' ? (
                  <span className="role-badge admin">
                    <Award size={12} style={{ marginRight: '4px' }} />
                    Administrador UTP
                  </span>
                ) : (
                  <span className="role-badge student">
                    Estudiante - {profile.curso_actual || profile.curso || '3° Medio'}
                  </span>
                )}
              </span>
            </div>
            
            <button className="laap-btn-logout" onClick={logout} title="Cerrar Sesión">
              <LogOut size={18} />
              <span className="logout-text">Salir</span>
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
