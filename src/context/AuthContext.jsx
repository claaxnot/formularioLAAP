import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null); // 'student', 'admin', 'unauthorized', or null
  const [profile, setProfile] = useState(null); // Full data from 'alumnos' or 'administradores'
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [toast, setToast] = useState(null); // { message, type, id }
  const [confirmConfig, setConfirmConfig] = useState(null); // { message, onConfirm, onCancel }
  const lastResolvedEmail = React.useRef(null);
  const resolvingRef = React.useRef(false);

  const showToast = (message, type = 'success') => {
    const id = Date.now();
    setToast({ message, type, id });
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
      setToast(current => current?.id === id ? null : current);
    }, 4000);
  };

  const showConfirm = (message, onConfirm) => {
    setConfirmConfig({
      message,
      onConfirm: () => {
        onConfirm();
        setConfirmConfig(null);
      },
      onCancel: () => {
        setConfirmConfig(null);
      }
    });
  };

  useEffect(() => {
    // 1. Verificar si hay una sesión mock en localStorage
    const savedMockSession = localStorage.getItem('laap_mock_session');
    if (savedMockSession) {
      try {
        const mockData = JSON.parse(savedMockSession);
        setUser(mockData.user);
        setRole(mockData.role);
        setProfile(mockData.profile);
        setLoading(false);
        return;
      } catch (e) {
        console.error("Error al parsear la sesión de prueba:", e);
        localStorage.removeItem('laap_mock_session');
      }
    }
    // 2. Si no hay sesión mock, usar Supabase Auth real
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const cachedSession = getResolvedSessionFromCache(session.user);
          if (cachedSession) {
            console.log("[AuthContext] Sesión e instantánea de rol cargada desde caché de recarga rápida.");
            setUser(session.user);
            setRole(cachedSession.role);
            setProfile(cachedSession.profile);
            setLoading(false);
            // Ejecutar validación/comprobación silenciosa en segundo plano para verificar que el rol/datos sigan vigentes
            resolveUserRole(session.user, 1, true);
          } else {
            await resolveUserRole(session.user);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Error al obtener sesión inicial:", err);
        setLoading(false);
      }
    };

    getInitialSession();

    // Suscribirse a cambios en la autenticación real
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (localStorage.getItem('laap_mock_session')) return;

      if (session?.user) {
        const cachedSession = getResolvedSessionFromCache(session.user);
        if (cachedSession) {
          setUser(session.user);
          setRole(cachedSession.role);
          setProfile(cachedSession.profile);
          setLoading(false);
          resolveUserRole(session.user, 1, true);
        } else {
          await resolveUserRole(session.user);
        }
      } else {
        setUser(null);
        setRole(null);
        setProfile(null);
        sessionStorage.removeItem('laap_resolved_session');
        setLoading(false);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);
  const saveResolvedSessionToCache = (supabaseUser, userRole, userProfile) => {
    try {
      const cachePayload = {
        userId: supabaseUser.id,
        email: supabaseUser.email,
        role: userRole,
        profile: userProfile,
        timestamp: Date.now()
      };
      sessionStorage.setItem('laap_resolved_session', JSON.stringify(cachePayload));
    } catch (e) {
      console.error("Error al guardar sesión en caché:", e);
    }
  };

  const getResolvedSessionFromCache = (supabaseUser) => {
    try {
      const cached = sessionStorage.getItem('laap_resolved_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.userId === supabaseUser.id && parsed.email === supabaseUser.email && (Date.now() - parsed.timestamp < 6 * 60 * 60 * 1000)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error("Error al obtener sesión de caché:", e);
    }
    return null;
  };

  // Determinar rol del usuario buscando en administradores y alumnos
  const resolveUserRole = async (supabaseUser, attempt = 1, isSilent = false) => {
    const email = supabaseUser?.email;
    if (!email) {
      console.warn("[AuthContext] resolveUserRole recibido sin email válido.");
      setLoading(false);
      return;
    }

    if (resolvingRef.current && attempt === 1) {
      console.log("[AuthContext] Ya hay una resolución de rol en progreso para:", email);
      return;
    }

    if (lastResolvedEmail.current === email && role !== null && role !== 'unauthorized') {
      console.log("[AuthContext] Evitando llamada redundante para email:", email);
      return;
    }

    resolvingRef.current = true;
    lastResolvedEmail.current = email;
    setUser(supabaseUser);

    const withTimeout = (promise, ms = 45000) => {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('TIMEOUT_ERROR')), ms)
      );
      return Promise.race([promise, timeout]);
    };

    try {
      console.log(`[AuthContext] Resolviendo rol para email: ${email} (Intento ${attempt})`);

      let adminData = null;
      let adminError = null;
      try {
        console.log("[AuthContext] Buscando en administradores...");
        let { data, error } = await withTimeout(
          supabase.from('administradores').select('*').eq('correo', email).eq('activo', true),
          15000
        );
        if (error && (error.code === 'PGRST204' || error.code === '42703')) {
          const fallback = await supabase.from('administradores').select('*').eq('email', email).eq('activo', true);
          data = fallback.data;
          error = fallback.error;
        }
        adminData = data && data.length > 0 ? data[0] : null;
        adminError = error;
      } catch (err) {
        adminError = err;
      }
      // Si es administrador, ¡resolver inmediatamente! Evitamos buscar más o esperar a la otra tabla.
      if (adminData) {
        console.log("[AuthContext] ¡Rol ADMIN detectado con éxito!");
        saveResolvedSessionToCache(supabaseUser, 'admin', adminData);
        setRole('admin');
        setProfile(adminData);
        setAuthError(null);
        resolvingRef.current = false;
        setLoading(false);
        return;
      }
      // 2. Si no es administrador o la búsqueda arrojó vacío, buscar en alumnos (probando 'correo' y 'email')
      let studentData = null;
      let studentError = null;
      try {
        console.log("[AuthContext] Buscando en alumnos...");
        let { data, error } = await withTimeout(
          supabase.from('alumnos').select('*').eq('correo', email),
          15000
        );
        if (error && (error.code === 'PGRST204' || error.code === '42703')) {
          const fallback = await supabase.from('alumnos').select('*').eq('email', email);
          data = fallback.data;
          error = fallback.error;
        }
        studentData = data && data.length > 0 ? data[0] : null;
        studentError = error;
      } catch (err) {
        studentError = err;
      }

      // Si es estudiante, ¡resolver inmediatamente!
      if (studentData) {
        console.log("[AuthContext] ¡Rol STUDENT detectado con éxito!");
        saveResolvedSessionToCache(supabaseUser, 'student', studentData);
        setRole('student');
        setProfile(studentData);
        setAuthError(null);
        resolvingRef.current = false;
        setLoading(false);
        return;
      }

      // 3. Si no se encontró en ninguna tabla, analizar si hubo errores de conexión legítimos
      const isTimeoutOrNetworkError = (error) => {
        if (!error) return false;
        const errMsg = String(error.message || error).toLowerCase();
        return errMsg.includes('timeout') || errMsg.includes('fetch') || errMsg.includes('network') || errMsg.includes('failed');
      };

      const hasAdminNetworkError = isTimeoutOrNetworkError(adminError);
      const hasStudentNetworkError = isTimeoutOrNetworkError(studentError);

      // Si es una validación silenciosa en segundo plano (para actualizar la caché), no interrumpir la interfaz por errores de red temporales
      if (isSilent && (hasAdminNetworkError || hasStudentNetworkError)) {
        console.warn("[AuthContext] Silent refresh falló temporalmente por red. Se mantiene el rol de la caché.");
        resolvingRef.current = false;
        return;
      }

      if ((hasAdminNetworkError || hasStudentNetworkError) && attempt < 3) {
        const adminErrMsg = adminError ? (adminError.message || JSON.stringify(adminError)) : 'ninguno';
        const studentErrMsg = studentError ? (studentError.message || JSON.stringify(studentError)) : 'ninguno';
        console.warn(`[AuthContext] Error temporal de conexión detectado. Reintentando... AdminError: "${adminErrMsg}", StudentError: "${studentErrMsg}"`);
        
        lastResolvedEmail.current = null;
        resolvingRef.current = false;
        await new Promise(resolve => setTimeout(resolve, 2000));
        return resolveUserRole(supabaseUser, attempt + 1);
      }

      // Si falló definitivamente por red tras los intentos
      if (adminError && studentError && isTimeoutOrNetworkError(adminError)) {
        setRole(null);
        setAuthError({
          message: "No se pudo conectar con el servidor de la plataforma LAAP. Verifica tu conexión a internet o reintenta en unos instantes.",
          details: `Detalles técnicos: ${adminError.message || adminError}`
        });
        resolvingRef.current = false;
        setLoading(false);
        return;
      }

      // C. No está registrado en ninguna tabla y no hubo errores de red (acceso no autorizado)
      console.log("[AuthContext] Correo verificado pero no está registrado en la matrícula.");
      setRole('unauthorized');
      setProfile({ 
        email, 
        isDevMode: true,
        debugDetails: {
          adminQuery: { data: null, error: adminError },
          studentQuery: { data: null, error: studentError },
          checkedEmail: email
        }
      });
      setAuthError(null);
      resolvingRef.current = false;
      setLoading(false);

    } catch (err) {
      console.error("Error crítico al resolver rol del usuario:", err);
      setRole('unauthorized');
      setProfile({ 
        email, 
        isDevMode: true,
        debugDetails: {
          caughtError: err.message || String(err),
          checkedEmail: email
        }
      });
      resolvingRef.current = false;
      setLoading(false);
    }
  };

  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutCountdown, setTimeoutCountdown] = useState(60);
  const inactivityTimerRef = React.useRef(null);
  const countdownIntervalRef = React.useRef(null);
  const lastActivityRef = React.useRef(Date.now());
  const warningTargetTimeRef = React.useRef(0);

  // CONTROL DE INACTIVIDAD GLOBAL DE 5 MINUTOS (300 SEGUNDOS)
  useEffect(() => {
    // Solo activar si el usuario está completamente autenticado con un rol válido
    if (!user || !role || role === 'unauthorized') {
      setShowTimeoutWarning(false);
      return;
    }

    // Inicializar timestamp
    lastActivityRef.current = Date.now();

    const resetInactivityTimer = () => {
      // Si ya se está mostrando la advertencia de cuenta regresiva, no resetear
      // el temporizador mediante micromovimientos para obligar acción explícita.
      if (showTimeoutWarning) return;
      lastActivityRef.current = Date.now();
    };

    // Escuchar eventos de interacción del usuario
    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    const resetWrapper = () => resetInactivityTimer();

    events.forEach(event => {
      window.addEventListener(event, resetWrapper);
    });

    const handleVisibilityOrFocus = () => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      
      if (showTimeoutWarning) {
        if (now >= warningTargetTimeRef.current) {
          handleAutoLogout();
        } else {
          const secondsRemaining = Math.max(0, Math.round((warningTargetTimeRef.current - now) / 1000));
          setTimeoutCountdown(secondsRemaining);
        }
      } else {
        if (elapsed >= 300000) {
          handleAutoLogout();
        } else if (elapsed >= 240000) {
          warningTargetTimeRef.current = lastActivityRef.current + 300000;
          setShowTimeoutWarning(true);
          const secondsRemaining = Math.max(0, Math.round((warningTargetTimeRef.current - now) / 1000));
          setTimeoutCountdown(secondsRemaining);
        }
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    // Intervalo de chequeo activo segundo a segundo
    const checkInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      
      if (showTimeoutWarning) {
        if (now >= warningTargetTimeRef.current) {
          clearInterval(checkInterval);
          handleAutoLogout();
        } else {
          const secondsRemaining = Math.max(0, Math.round((warningTargetTimeRef.current - now) / 1000));
          setTimeoutCountdown(secondsRemaining);
        }
      } else {
        if (elapsed >= 300000) {
          clearInterval(checkInterval);
          handleAutoLogout();
        } else if (elapsed >= 240000) {
          warningTargetTimeRef.current = lastActivityRef.current + 300000;
          setShowTimeoutWarning(true);
          setTimeoutCountdown(60);
        }
      }
    }, 1000);

    return () => {
      clearInterval(checkInterval);
      events.forEach(event => {
        window.removeEventListener(event, resetWrapper);
      });
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [user, role, showTimeoutWarning]);

  const handleKeepAlive = () => {
    console.log("[AuthContext] Usuario confirmó seguir conectado. Reseteando temporizador...");
    lastActivityRef.current = Date.now();
    setShowTimeoutWarning(false);
  };

  const handleAutoLogout = async () => {
    console.log("[AuthContext] Tiempo límite alcanzado. Cerrando sesión automáticamente...");
    setShowTimeoutWarning(false);
    localStorage.setItem(
      'laap_session_expired_message',
      'Tu sesión ha expirado por inactividad (límite de 5 minutos). Por favor, inicia sesión nuevamente.'
    );
    await logout();
  };

  const renderTimeoutModal = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        fontFamily: "var(--font-family)",
        animation: 'laap-fade-in 0.2s ease-out'
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          overflow: 'hidden',
          width: '90%',
          maxWidth: '400px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          border: '1px solid #e2e8f0',
          animation: 'laap-scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          {/* Institutional Top Header */}
          <div style={{
            height: '6px',
            background: 'linear-gradient(90deg, var(--primary-color) 0%, #3b82f6 100%)'
          }} />
          
          <div style={{ padding: '32px 28px', textAlign: 'center' }}>
            {/* Elegant Institutional Icon */}
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: 'rgba(30, 58, 138, 0.08)',
              color: 'var(--primary-color)',
              marginBottom: '20px'
            }}>
              <svg viewBox="0 0 24 24" width="32" height="32" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <h3 style={{ 
              margin: '0 0 10px 0', 
              fontSize: '20px', 
              fontWeight: '800', 
              color: 'var(--secondary-color)',
              letterSpacing: '-0.3px'
            }}>
              Sesión por Expirar
            </h3>
            
            <p style={{ 
              margin: '0 0 24px 0', 
              fontSize: '13.5px', 
              color: 'var(--text-muted)', 
              lineHeight: '1.5',
              fontWeight: '500'
            }}>
              Por motivos de seguridad institucional, su sesión administrativa en el panel finalizará debido a inactividad en:
            </p>

            {/* Giant countdown timer */}
            <div style={{
              fontSize: '44px',
              fontWeight: '800',
              color: 'var(--primary-color)',
              marginBottom: '28px',
              letterSpacing: '-1px',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}>
              {timeoutCountdown}
              <span style={{ fontSize: '20px', fontWeight: '700', color: '#64748b' }}>s</span>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                onClick={handleAutoLogout}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#475569',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                  e.currentTarget.style.borderColor = '#94a3b8';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = '#ffffff';
                  e.currentTarget.style.borderColor = '#cbd5e1';
                }}
              >
                Cerrar Sesión
              </button>
              <button 
                onClick={handleKeepAlive}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--primary-color)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(30, 58, 138, 0.2)',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary-hover)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(30, 58, 138, 0.35)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(30, 58, 138, 0.2)';
                }}
              >
                Seguir Conectado
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderConnectionErrorModal = () => {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        fontFamily: "'Outfit', 'Inter', sans-serif"
      }}>
        <div style={{
          backgroundColor: '#1f2937',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '460px',
          width: '90%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          color: '#f9fafb',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            padding: '16px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            marginBottom: '20px'
          }}>
            <svg viewBox="0 0 24 24" width="36" height="36" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0" />
              <path d="M1.42 9a16 16 0 0 1 21.16 0" />
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
              <line x1="12" y1="20" x2="12.01" y2="20" strokeWidth="3" />
            </svg>
          </div>

          <h3 style={{ margin: '0 0 8px 0', fontSize: '22px', fontWeight: 'bold' }}>Error de Conexión</h3>
          <p style={{ margin: '0 0 20px 0', fontSize: '15px', color: '#9ca3af', lineHeight: '1.6' }}>
            {authError?.message}
          </p>

          {authError?.details && (
            <div style={{
              backgroundColor: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: '#f3f4f6',
              fontFamily: 'monospace',
              textAlign: 'left',
              marginBottom: '24px',
              wordBreak: 'break-all',
              maxHeight: '100px',
              overflowY: 'auto'
            }}>
              {authError.details}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px' }}>
            <button 
              onClick={logout}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                backgroundColor: 'transparent',
                color: '#d1d5db',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Cerrar Sesión
            </button>
            <button 
              onClick={async () => {
                setLoading(true);
                const currentUser = user;
                setAuthError(null);
                lastResolvedEmail.current = null;
                if (currentUser) {
                  await resolveUserRole(currentUser);
                } else {
                  const { data: { session } } = await supabase.auth.getSession();
                  if (session?.user) {
                    await resolveUserRole(session.user);
                  } else {
                    setLoading(false);
                  }
                }
              }}
              style={{
                flex: 1,
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}
            >
              Reintentar Conexión
            </button>
          </div>
        </div>
      </div>
    );
  };

  const loginWithGoogle = async () => {
    try {
      localStorage.removeItem('laap_mock_session'); // Limpiar sesión mock activa
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error("Error en Google Auth:", err.message);
      alert("Error al iniciar sesión con Google: " + err.message);
    }
  };

  // Login real con Correo y Contraseña para desarrollo (bypassear Google Auth con sesión real)
  const loginWithEmail = async (email, password) => {
    setLoading(true);
    try {
      localStorage.removeItem('laap_mock_session'); // Limpiar sesión mock activa
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      });
      if (error) throw error;
      if (data?.user) {
        await resolveUserRole(data.user);
      }
      return { success: true };
    } catch (err) {
      console.error("Error al iniciar sesión con correo:", err.message);
      setLoading(false);
      return { success: false, error: err.message };
    }
  };

  // Login de Demostración local (Mock) para desarrollo
  const loginAsDemo = async (demoRole, customEmail, realProfileData = {}) => {
    setLoading(true);
    
    const mockUser = {
      id: realProfileData.id || (demoRole === 'admin' ? 'demo-admin-id' : 'demo-student-id'),
      email: customEmail,
      user_metadata: { 
        full_name: demoRole === 'admin' 
          ? (realProfileData.nombre || 'Administrador de Pruebas') 
          : (realProfileData.nombre_completo || 'Alumno de Pruebas') 
      }
    };

    let mockProfile = {};
    if (demoRole === 'admin') {
      mockProfile = {
        id: realProfileData.id || 'demo-admin-id',
        nombre: realProfileData.nombre || 'Administrador Demo',
        correo: customEmail,
        email: customEmail, // Duplicado para seguridad
        activo: realProfileData.activo ?? true,
        isSimulated: true // Flag de simulación activa
      };
    } else {
      mockProfile = {
        id: realProfileData.id || 'demo-student-id',
        rut: realProfileData.rut || '12.345.678-9',
        nombre_completo: realProfileData.nombre_completo || 'Alumno Demo',
        correo: customEmail,
        email: customEmail, // Duplicado para seguridad
        curso_actual: realProfileData.curso_actual || '3° Medio A',
        activo: realProfileData.activo ?? true,
        isSimulated: true // Flag de simulación activa
      };
    }

    const mockSession = {
      user: mockUser,
      role: demoRole,
      profile: mockProfile
    };

    localStorage.setItem('laap_mock_session', JSON.stringify(mockSession));
    setUser(mockUser);
    setRole(demoRole);
    setProfile(mockProfile);
    setLoading(false);
  };

  const logout = async () => {
    setLoading(true);
    localStorage.removeItem('laap_mock_session');
    sessionStorage.removeItem('laap_resolved_session');
    lastResolvedEmail.current = null;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error("Error al cerrar sesión real:", err);
    }
    setUser(null);
    setRole(null);
    setProfile(null);
    setLoading(false);
  };
  const renderToast = () => {
    if (!toast) return null;
    
    const bgColor = {
      success: '#10b981', // emerald
      error: '#ef4444', // rose
      warning: '#f59e0b', // amber
      info: '#3b82f6' // blue
    }[toast.type] || '#1f2937';

    const icon = {
      success: (
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      error: (
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      ),
      warning: (
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      ),
      info: (
        <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      )
    }[toast.type];

    return (
      <div style={{
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '14px 20px',
        borderRadius: '12px',
        backgroundColor: '#1f2937',
        borderLeft: `5px solid ${bgColor}`,
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.3), 0 4px 6px -2px rgba(0,0,0,0.15)',
        color: '#f9fafb',
        fontFamily: "'Outfit', 'Inter', sans-serif",
        fontSize: '14px',
        fontWeight: '600',
        minWidth: '280px',
        maxWidth: '420px',
        backdropFilter: 'blur(8px)',
        animation: 'laap-toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
      }}>
        <div style={{ color: bgColor, display: 'flex', alignItems: 'center' }}>
          {icon}
        </div>
        <div style={{ flex: 1, lineHeight: '1.4' }}>
          {toast.message}
        </div>
        <button 
          onClick={() => setToast(null)}
          style={{
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s'
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  };
  const renderConfirmModal = () => {
    if (!confirmConfig) return null;

    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)', // slate-900 with opacity
        backdropFilter: 'blur(8px)',
        zIndex: 99999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'laap-fade-in 0.2s ease-out'
      }}>
        <div style={{
          backgroundColor: '#1e293b', // slate-800
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          fontFamily: "'Outfit', 'Inter', sans-serif",
          animation: 'laap-scale-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards'
        }}>
          {/* Icon Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '20px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)', // transparent rose
              color: '#f87171' // light rose
            }}>
              <svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '800',
              color: '#f8fafc',
              margin: 0
            }}>
              Confirmar Acción
            </h3>
          </div>

          {/* Message */}
          <p style={{
            fontSize: '14px',
            color: '#cbd5e1',
            lineHeight: '1.6',
            margin: '0 0 24px 0',
            fontWeight: '500'
          }}>
            {confirmConfig.message}
          </p>

          {/* Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              onClick={confirmConfig.onCancel}
              style={{
                padding: '11px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                backgroundColor: 'transparent',
                color: '#94a3b8',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmConfig.onConfirm}
              style={{
                padding: '11px 22px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: '#ef4444', // vibrant red
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
              }}
            >
              Aceptar
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AuthContext.Provider value={{ user, role, profile, loading, loginWithGoogle, loginWithEmail, loginAsDemo, logout, showToast, showConfirm }}>
      {children}
      {showTimeoutWarning && renderTimeoutModal()}
      {authError && !window.location.pathname.startsWith('/acuse') && renderConnectionErrorModal()}
      {renderToast()}
      {renderConfirmModal()}
    </AuthContext.Provider>
  );
};




