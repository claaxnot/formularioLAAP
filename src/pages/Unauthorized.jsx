import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, LogOut, MailCheck, Loader2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { useNavigate } from 'react-router-dom';

export default function Unauthorized() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [liveDebug, setLiveDebug] = useState(null);
  const [loadingDebug, setLoadingDebug] = useState(true);

  const isDev = window.location.hostname === 'localhost' && import.meta.env.VITE_ENABLE_SANDBOX === 'true';

  // Redireccionar si no hay usuario logueado
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!isDev || !user?.email) {
      setLoadingDebug(false);
      return;
    }

    const withTimeout = (promise, ms = 3500) => {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_ERROR')), ms)
      );
      return Promise.race([promise, timeout]);
    };

    const runLiveDebug = async () => {
      setLoadingDebug(true);
      const email = user.email;
      
      try {
        // 1. Query administradores con Timeout
        const adminPromise = (async () => {
          let { data, error } = await supabase.from('administradores').select('*').eq('correo', email).eq('activo', true);
          if (error && (error.code === 'PGRST204' || error.code === '42703')) {
            const fallback = await supabase.from('administradores').select('*').eq('email', email).eq('activo', true);
            return { data: fallback.data, error: fallback.error };
          }
          return { data, error };
        })();

        const adminResult = await withTimeout(adminPromise, 3500)
          .catch(err => {
            if (err.message === 'TIMEOUT_ERROR') {
              return { 
                data: null, 
                error: { message: 'Timeout: La consulta tardó más de 3.5 segundos. Esto suele ocurrir cuando hay una RECURSIÓN INFINITA en las políticas RLS de tu tabla "administradores".' } 
              };
            }
            return { data: null, error: { message: err.message || String(err) } };
          });

        // 2. Query alumnos con Timeout
        const studentPromise = (async () => {
          let { data, error } = await supabase.from('alumnos').select('*').eq('correo', email);
          if (error && (error.code === 'PGRST204' || error.code === '42703')) {
            const fallback = await supabase.from('alumnos').select('*').eq('email', email);
            return { data: fallback.data, error: fallback.error };
          }
          return { data, error };
        })();

        const studentResult = await withTimeout(studentPromise, 3500)
          .catch(err => {
            if (err.message === 'TIMEOUT_ERROR') {
              return { 
                data: null, 
                error: { message: 'Timeout: La consulta tardó más de 3.5 segundos. Esto suele ocurrir cuando hay una RECURSIÓN INFINITA en las políticas RLS de tu tabla "alumnos".' } 
              };
            }
            return { data: null, error: { message: err.message || String(err) } };
          });

        setLiveDebug({
          admin: { 
            data: adminResult.data && adminResult.data.length > 0 ? adminResult.data[0] : null, 
            error: adminResult.error 
          },
          student: { 
            data: studentResult.data && studentResult.data.length > 0 ? studentResult.data[0] : null, 
            error: studentResult.error 
          },
          checkedEmail: email
        });
      } catch (err) {
        setLiveDebug({
          error: err.message || String(err),
          checkedEmail: email
        });
      } finally {
        setLoadingDebug(false);
      }
    };

    runLiveDebug();
  }, [user, isDev]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="laap-page-unauthorized">
      <div className="laap-unauthorized-card" style={{ maxWidth: '650px' }}>
        <div className="unauthorized-icon-container">
          <ShieldAlert className="unauthorized-icon animate-pulse" size={64} />
        </div>
        
        <h1 className="unauthorized-title">Acceso No Autorizado</h1>
        <p className="unauthorized-lead">
          El correo institucional <strong>{user?.email}</strong> no se encuentra registrado en el sistema de postulación de electivos.
        </p>

        <div className="unauthorized-instructions">
          <h3>¿Cómo resolver esto?</h3>
          <ul>
            <li>
              <MailCheck size={16} className="text-primary-color" />
              <span>Verifica que hayas iniciado sesión con tu correo de estudiante o administrador asignado por el Liceo.</span>
            </li>
            <li>
              <MailCheck size={16} className="text-primary-color" />
              <span>Si eres estudiante nuevo o cambiaste de correo, contacta a la **Unidad Técnico Pedagógica (UTP)** o al **Administrador de Sistemas** del establecimiento para registrar tu cuenta.</span>
            </li>
          </ul>
        </div>

        {isDev && (
          <div className="unauthorized-debug-panel" style={{
            marginTop: '20px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'left',
            fontSize: '13px'
          }}>
            <h3 style={{ margin: '0 0 10px 0', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
              <ShieldAlert size={16} />
              Panel de Depuración de Supabase en Vivo (Protección contra Hang)
            </h3>
            
            {loadingDebug ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9ca3af' }}>
                <Loader2 className="animate-spin" size={16} />
                <span>Consultando tablas de producción en caliente (Timeout activo)...</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: 'monospace', color: '#e5e7eb' }}>
                <div><strong>Correo Evaluado:</strong> "{liveDebug?.checkedEmail || user?.email}"</div>
                
                <hr style={{ border: '0', borderTop: '1px solid rgba(255, 255, 255, 0.1)', margin: '8px 0' }} />
                
                <div>
                  <strong>1. Tabla 'administradores' (Filtro correo/activo=true):</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    <li><strong>Encontrado:</strong> {liveDebug?.admin?.data ? 'Sí ✅' : 'No ❌'}</li>
                    {liveDebug?.admin?.data && (
                      <li style={{ color: '#34d399' }}><strong>Nombre:</strong> {liveDebug.admin.data.nombre}</li>
                    )}
                    <li style={{ color: liveDebug?.admin?.error ? '#f87171' : 'inherit' }}>
                      <strong>Error Postgres:</strong> {liveDebug?.admin?.error ? JSON.stringify(liveDebug.admin.error) : 'Ninguno'}
                    </li>
                  </ul>
                </div>
                
                <hr style={{ border: '0', borderTop: '1px solid rgba(255, 255, 255, 0.1)', margin: '8px 0' }} />
                
                <div>
                  <strong>2. Tabla 'alumnos' (Filtro correo):</strong>
                  <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                    <li><strong>Encontrado:</strong> {liveDebug?.student?.data ? 'Sí ✅' : 'No ❌'}</li>
                    {liveDebug?.student?.data && (
                      <li style={{ color: '#34d399' }}><strong>Nombre:</strong> {liveDebug.student.data.nombre}</li>
                    )}
                    <li style={{ color: liveDebug?.student?.error ? '#f87171' : 'inherit' }}>
                      <strong>Error Postgres:</strong> {liveDebug?.student?.error ? JSON.stringify(liveDebug.student.error) : 'Ninguno'}
                    </li>
                  </ul>
                </div>

                {liveDebug?.error && (
                  <div style={{ color: '#f87171', marginTop: '6px' }}>
                    <strong>Excepción:</strong> {liveDebug.error}
                  </div>
                )}

                <div style={{ marginTop: '8px', fontSize: '11px', color: '#9ca3af', lineHeight: '1.4' }}>
                  💡 <strong>Diagnóstico Rápido:</strong><br />
                  - Si ambos dan 'No ❌' y no hay errores, abre tu panel de Supabase y comprueba que exista exactamente un registro con este correo en minúsculas en la tabla <code>administradores</code> o <code>alumnos</code>.<br />
                  - Si es administrador, verifica que la columna <code>activo</code> sea exactamente <code>true</code> (no <code>false</code> o <code>NULL</code>).
                </div>
              </div>
            )}
          </div>
        )}

        <div className="unauthorized-actions" style={{ marginTop: '20px' }}>
          <button className="laap-btn-primary full-width" onClick={handleLogout}>
            <LogOut size={18} style={{ marginRight: '8px' }} />
            Volver al Inicio / Cambiar de Cuenta
          </button>
        </div>
      </div>
    </div>
  );
}
