import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, Settings, User, AlertCircle, ArrowRight, Database, Loader2, Copy, Check } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
export default function Login() {
  const { loginWithGoogle, loginWithEmail, loginAsDemo } = useAuth();
  const [showSandbox, setShowSandbox] = useState(false);
  const [sandboxTab, setSandboxTab] = useState('simular'); // 'simular', 'real_dev', or 'rpc_test'
  const [expiredMsg] = useState(() => {
    const msg = localStorage.getItem('laap_session_expired_message');
    if (msg) {
      localStorage.removeItem('laap_session_expired_message');
      return msg;
    }
    return '';
  });

  const [dbStudents, setDbStudents] = useState([]);
  const [dbAdmins, setDbAdmins] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [dbLoading, setDbLoading] = useState(false);
  const [dbError, setDbError] = useState(null);

  // Manual Offline Demo States (Fallback)
  const [demoRole, setDemoRole] = useState('student');
  const [demoEmail, setDemoEmail] = useState('alumno.demo@alessandri.cl');
  const [demoName, setDemoName] = useState('Tomás Andrés Muñoz');
  const [demoCurso, setDemoCurso] = useState('3° Medio A');
  const [useManualOffline, setUseManualOffline] = useState(false);

  // Copy indicator state
  const [copiedId, setCopiedId] = useState(null);

  // Real Dev Login States
  const [realEmail, setRealEmail] = useState('');
  const [realPassword, setRealPassword] = useState('');
  const [realLoginErr, setRealLoginErr] = useState('');
  const [realLoginLoading, setRealLoginLoading] = useState(false);

  // Supabase RPC Tester States
  const [rpcStudentId, setRpcStudentId] = useState('');
  const [rpcElectivo1, setRpcElectivo1] = useState('');
  const [rpcElectivo2, setRpcElectivo2] = useState('');
  const [rpcElectivo3, setRpcElectivo3] = useState('');
  const [rpcStatus, setRpcStatus] = useState(null); // { success: boolean, message: string }
  const [rpcLoading, setRpcLoading] = useState(false);

  // Env Variable Toggle
  const enableSandbox = import.meta.env.VITE_ENABLE_SANDBOX === 'true';

  const fetchSandboxData = async () => {
    setDbLoading(true);
    setDbError(null);
    try {
      // 1. Cargar alumnos reales
      const { data: studentsData, error: studentsErr } = await supabase
        .from('alumnos')
        .select('id, rut, nombre_completo, correo, curso_actual, activo');

      if (studentsErr) throw studentsErr;

      // 2. Cargar administradores reales activos
      const { data: adminsData, error: adminsErr } = await supabase
        .from('administradores')
        .select('id, correo, nombre, activo')
        .eq('activo', true);

      if (adminsErr) throw adminsErr;

      setDbStudents(studentsData || []);
      setDbAdmins(adminsData || []);

      if (studentsData && studentsData.length > 0) {
        setSelectedStudentId(studentsData[0].id);
      }
      if (adminsData && adminsData.length > 0) {
        setSelectedAdminId(adminsData[0].id);
      }
    } catch (err) {
      console.error("Error al cargar datos del Sandbox:", err);
      setDbError("No se pudieron cargar los datos reales de la base de datos: " + err.message);
    } finally {
      setDbLoading(false);
    }
  };

  const handleToggleSandbox = () => {
    const nextState = !showSandbox;
    setShowSandbox(nextState);
    if (nextState && dbStudents.length === 0 && dbAdmins.length === 0) {
      fetchSandboxData();
    }
  };

  const handleCopy = (id, e) => {
    e.preventDefault();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRealLogin = async (e) => {
    e.preventDefault();
    setRealLoginErr('');
    setRealLoginLoading(true);
    const result = await loginWithEmail(realEmail, realPassword);
    setRealLoginLoading(false);
    if (!result.success) {
      setRealLoginErr(result.error || 'Credenciales inválidas o proveedor de correo desactivado en Supabase Auth.');
    }
  };

  const handleDemoSubmit = (e) => {
    e.preventDefault();
    if (useManualOffline) {
      // Simular con datos ficticios manuales (Offline Mode)
      const studentData = demoRole === 'student' ? {
        id: 'demo-student-id-123',
        rut: '12.345.678-9',
        nombre_completo: demoName,
        curso_actual: demoCurso,
        activo: true
      } : {
        id: 'demo-admin-id-123',
        nombre: demoName,
        activo: true
      };
      loginAsDemo(demoRole, demoEmail, studentData);
    } else {
      // Simular con datos REALES de la base de datos
      if (demoRole === 'student') {
        const selectedStudent = dbStudents.find(s => s.id === selectedStudentId);
        if (selectedStudent) {
          loginAsDemo('student', selectedStudent.correo, selectedStudent);
        } else {
          alert("Por favor selecciona un alumno de la lista.");
        }
      } else {
        const selectedAdmin = dbAdmins.find(a => a.id === selectedAdminId);
        if (selectedAdmin) {
          loginAsDemo('admin', selectedAdmin.correo, selectedAdmin);
        } else {
          alert("Por favor selecciona un administrador de la lista.");
        }
      }
    }
  };

  const handleRoleChange = (role) => {
    setDemoRole(role);
    if (role === 'admin') {
      setDemoEmail('utp.admin@alessandri.cl');
      setDemoName('Directora Carolina Valenzuela');
    } else {
      setDemoEmail('alumno.demo@alessandri.cl');
      setDemoName('Tomás Andrés Muñoz');
      setDemoCurso('3° Medio A');
    }
  };

  const handleRpcTest = async (e) => {
    e.preventDefault();
    setRpcLoading(true);
    setRpcStatus(null);
    try {
      // 1. Limpiar postulaciones previas del alumno para asegurar que la RPC pueda escribir de forma limpia
      const { error: cleanErr } = await supabase
        .from('postulaciones')
        .delete()
        .eq('alumno_id', rpcStudentId.trim());

      if (cleanErr) {
        console.log("Nota al limpiar postulaciones previas:", cleanErr.message);
      }

      // 2. Llamar a la RPC guardar_seleccion_electivos en Supabase
      const { data: rpcData, error: rpcErr } = await supabase.rpc('guardar_seleccion_electivos', {
        p_alumno_id: rpcStudentId.trim(),
        p_electivo_1: rpcElectivo1.trim(),
        p_electivo_2: rpcElectivo2.trim(),
        p_electivo_3: rpcElectivo3.trim()
      });

      if (rpcErr) {
        setRpcStatus({
          success: false,
          message: `Error Supabase RPC: ${rpcErr.message}. Detalle: ${rpcErr.details || 'Ninguno'}`
        });
        return;
      }

      // 3. Confirmar que se crearon los registros consultando directamente a la tabla postulaciones
      const { data: selectData, error: selectErr } = await supabase
        .from('postulaciones')
        .select('*')
        .eq('alumno_id', rpcStudentId.trim());

      if (selectErr) {
        setRpcStatus({
          success: true,
          message: `La RPC se ejecutó correctamente (retorno: ${JSON.stringify(rpcData)}), pero falló la consulta de comprobación RLS: ${selectErr.message}`
        });
        return;
      }

      if (selectData && selectData.length === 3) {
        setRpcStatus({
          success: true,
          message: `¡Confirmación Exitosa! La RPC se ejecutó correctamente y persistió exactamente ${selectData.length} registros en la tabla 'postulaciones' en tiempo real.`
        });
      } else {
        setRpcStatus({
          success: true,
          message: `La RPC se ejecutó, pero se encontraron ${selectData?.length || 0} postulaciones para este alumno (se esperaban 3).`
        });
      }
    } catch (err) {
      setRpcStatus({
        success: false,
        message: `Error Inesperado: ${err.message}`
      });
    } finally {
      setRpcLoading(false);
    }
  };

  // Student and Admin selection targets for metadata rendering
  const activeStudent = dbStudents.find(s => s.id === selectedStudentId);
  const activeAdmin = dbAdmins.find(a => a.id === selectedAdminId);

  return (
    <div className="laap-login-page">
      <div className="laap-login-container">

        {/* Encabezado Institucional */}
        <div className="laap-login-header">
          <div className="login-logo-container" style={{ background: 'white', padding: '16px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 20px rgba(255, 255, 255, 0.15)' }}>
            <img src="/logo.png" alt="Liceo Arturo Alessandri Palma Logo" style={{ height: '80px', width: '80px', objectFit: 'contain' }} />
          </div>
          <h1 className="login-title">Liceo Arturo Alessandri Palma</h1>
          <p className="login-subtitle">Proceso de Selección de Electivos 2026</p>
        </div>

        {/* Tarjeta de Autenticación */}
        <div className="laap-login-card">
          {expiredMsg && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid #ef4444',
              color: '#f87171',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '16px',
              lineHeight: '1.4',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }} className="animate-fadeIn">
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{expiredMsg}</span>
            </div>
          )}
          <h2 className="card-title">Portal de Acceso</h2>
          <p className="card-instructions">
            Inicia sesión con tu correo electrónico institucional para acceder al formulario de selección o al panel administrativo.
          </p>

          <button className="laap-btn-google" onClick={loginWithGoogle}>
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: '8px' }}>
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.69c-.29 1.5-.1.84-2.42 2.38v2.53h3.91c2.29-2.11 3.62-5.22 3.62-8.76z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.97-1.08 7.96-2.91l-3.91-3.03c-1.08.72-2.47 1.15-4.05 1.15-3.11 0-5.74-2.11-6.68-4.96H1.21v3.13C3.18 21.65 7.28 24 12 24z" />
              <path fill="#FBBC05" d="M5.32 14.25c-.24-.73-.38-1.5-.38-2.25s.14-1.52.38-2.25V6.62H1.21A11.96 11.96 0 0 0 0 12c0 1.92.45 3.74 1.21 5.38l4.11-3.13z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.28 0 3.18 2.35 1.21 6.62l4.11 3.13c.94-2.85 3.57-4.96 6.68-4.96z" />
            </svg>
            <span>Ingresar con Google</span>
          </button>

          <div className="card-footer-notice">
            <AlertCircle size={14} className="notice-icon" />
            <span>Exclusivo para la comunidad educativa de LAAP.</span>
          </div>

          {/* Mostrar Sandbox solo si VITE_ENABLE_SANDBOX === 'true' */}
          {enableSandbox && (
            <>
              {/* Divisor */}
              <div className="laap-divider">
                <span>O</span>
              </div>

              {/* Botón para colapsar Sandbox */}
              <button
                className="laap-btn-text sandbox-toggle"
                onClick={handleToggleSandbox}
              >
                <Settings size={14} style={{ marginRight: '6px' }} />
                {showSandbox ? 'Ocultar Acceso de Pruebas' : 'Mostrar Acceso de Pruebas (Sandbox)'}
              </button>
            </>
          )}

          {/* Panel de Sandbox de Demostración */}
          {enableSandbox && showSandbox && (
            <div className="sandbox-panel animate-fadeIn">
              <div className="sandbox-warning">
                <strong>Modo Desarrollo/Sandbox:</strong> Simula flujos con alumnos y administradores reales en caliente, o prueba credenciales directas y RPC.
              </div>

              {/* Sub-tabs del Sandbox */}
              <div className="form-group-row" style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
                <button
                  type="button"
                  className={`role-tab ${sandboxTab === 'simular' ? 'active' : ''}`}
                  onClick={() => setSandboxTab('simular')}
                  style={{ flex: 1, padding: '6px 4px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <User size={12} />
                  Simulador de Cuentas
                </button>
                <button
                  type="button"
                  className={`role-tab ${sandboxTab === 'real_dev' ? 'active' : ''}`}
                  onClick={() => setSandboxTab('real_dev')}
                  style={{ flex: 1, padding: '6px 4px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Database size={12} />
                  Acceso Real Dev
                </button>
                <button
                  type="button"
                  className={`role-tab ${sandboxTab === 'rpc_test' ? 'active' : ''}`}
                  onClick={() => setSandboxTab('rpc_test')}
                  style={{ flex: 1, padding: '6px 4px', fontSize: '11px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                >
                  <Settings size={12} />
                  Probar RPC Real
                </button>
              </div>

              {sandboxTab === 'simular' && (
                <form onSubmit={handleDemoSubmit} className="sandbox-form">
                  <div className="form-group-row">
                    <button
                      type="button"
                      className={`role-tab ${demoRole === 'student' ? 'active' : ''}`}
                      onClick={() => handleRoleChange('student')}
                    >
                      <User size={14} />
                      Estudiante
                    </button>
                    <button
                      type="button"
                      className={`role-tab ${demoRole === 'admin' ? 'active' : ''}`}
                      onClick={() => handleRoleChange('admin')}
                    >
                      <Settings size={14} />
                      Administrador
                    </button>
                  </div>

                  {/* Toggle para cambiar a modo Offline si se desea */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '8px 0 14px 0', fontSize: '11px' }}>
                    <input
                      type="checkbox"
                      id="useManualOffline"
                      checked={useManualOffline}
                      onChange={(e) => setUseManualOffline(e.target.checked)}
                    />
                    <label htmlFor="useManualOffline" style={{ cursor: 'pointer', color: '#9ca3af' }}>
                      Simular con datos ficticios (Offline/Fallback)
                    </label>
                  </div>

                  {useManualOffline ? (
                    /* Formulario Manual Offline */
                    <>
                      <div className="form-group">
                        <label>Correo de Pruebas</label>
                        <input
                          type="email"
                          required
                          value={demoEmail}
                          onChange={(e) => setDemoEmail(e.target.value)}
                          placeholder="ejemplo@alessandri.cl"
                        />
                      </div>

                      <div className="form-group">
                        <label>Nombre Completo</label>
                        <input
                          type="text"
                          required
                          value={demoName}
                          onChange={(e) => setDemoName(e.target.value)}
                          placeholder="Nombre Completo"
                        />
                      </div>

                      {demoRole === 'student' && (
                        <div className="form-group">
                          <label>Curso</label>
                          <select
                            value={demoCurso}
                            onChange={(e) => setDemoCurso(e.target.value)}
                          >
                            <option value="3° Medio A">3° Medio A</option>
                            <option value="3° Medio B">3° Medio B</option>
                            <option value="4° Medio A">4° Medio A</option>
                            <option value="4° Medio B">4° Medio B</option>
                          </select>
                        </div>
                      )}
                    </>
                  ) : (
                    /* Selectores Dinámicos de Base de Datos Real */
                    <>
                      {dbLoading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#9ca3af', padding: '20px 0', fontSize: '12px' }}>
                          <Loader2 className="animate-spin" size={16} />
                          <span>Obteniendo cuentas de producción en Supabase...</span>
                        </div>
                      ) : dbError ? (
                        <div style={{ padding: '8px 10px', borderRadius: '6px', fontSize: '11px', backgroundColor: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.4)', color: '#f87171', marginBottom: '12px' }}>
                          ⚠️ {dbError}
                          <button type="button" onClick={fetchSandboxData} style={{ background: 'none', border: 'none', color: '#60a5fa', textDecoration: 'underline', marginLeft: '6px', cursor: 'pointer', padding: 0 }}>Reintentar</button>
                        </div>
                      ) : (
                        <div className="form-group">
                          <label style={{ fontSize: '12px' }}>
                            {demoRole === 'student' ? 'Seleccionar Alumno Real de la Base:' : 'Seleccionar Administrador Real de la Base:'}
                          </label>

                          {demoRole === 'student' ? (
                            dbStudents.length === 0 ? (
                              <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', padding: '4px 0' }}>No se encontraron alumnos registrados en Supabase.</div>
                            ) : (
                              <>
                                <select
                                  value={selectedStudentId}
                                  onChange={(e) => setSelectedStudentId(e.target.value)}
                                  style={{ fontSize: '13px', padding: '8px' }}
                                >
                                  {dbStudents.map(student => (
                                    <option key={student.id} value={student.id}>
                                      {student.nombre_completo} ({student.curso_actual})
                                    </option>
                                  ))}
                                </select>

                                {activeStudent && (
                                  <div style={{
                                    marginTop: '12px',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    color: '#d1d5db'
                                  }}>
                                    <div><strong>RUT:</strong> {activeStudent.rut}</div>
                                    <div><strong>Correo:</strong> {activeStudent.correo}</div>
                                    <div><strong>Curso Actual:</strong> {activeStudent.curso_actual}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginTop: '2px' }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                                        <strong>UUID:</strong> {activeStudent.id}
                                      </span>
                                      <button
                                        onClick={(e) => handleCopy(activeStudent.id, e)}
                                        style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                        title="Copiar ID para pruebas RPC"
                                      >
                                        {copiedId === activeStudent.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )
                          ) : (
                            dbAdmins.length === 0 ? (
                              <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', padding: '4px 0' }}>No se encontraron administradores activos registrados en Supabase.</div>
                            ) : (
                              <>
                                <select
                                  value={selectedAdminId}
                                  onChange={(e) => setSelectedAdminId(e.target.value)}
                                  style={{ fontSize: '13px', padding: '8px' }}
                                >
                                  {dbAdmins.map(admin => (
                                    <option key={admin.id} value={admin.id}>
                                      {admin.nombre} ({admin.correo})
                                    </option>
                                  ))}
                                </select>

                                {activeAdmin && (
                                  <div style={{
                                    marginTop: '12px',
                                    padding: '10px',
                                    borderRadius: '6px',
                                    background: 'rgba(255,255,255,0.04)',
                                    border: '1px solid rgba(255,255,255,0.08)',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    color: '#d1d5db'
                                  }}>
                                    <div><strong>Nombre UTP:</strong> {activeAdmin.nombre}</div>
                                    <div><strong>Correo UTP:</strong> {activeAdmin.correo}</div>
                                    <div><strong>Estado Activo:</strong> {activeAdmin.activo ? 'Sí ✅' : 'No ❌'}</div>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px', marginTop: '2px' }}>
                                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '85%' }}>
                                        <strong>UUID:</strong> {activeAdmin.id}
                                      </span>
                                      <button
                                        onClick={(e) => handleCopy(activeAdmin.id, e)}
                                        style={{ background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                        title="Copiar ID"
                                      >
                                        {copiedId === activeAdmin.id ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </>
                            )
                          )}
                        </div>
                      )}
                    </>
                  )}

                  <button
                    type="submit"
                    className="laap-btn-primary full-width sandbox-submit"
                    disabled={!useManualOffline && dbLoading}
                    style={{ marginTop: '12px' }}
                  >
                    <span>Simular Acceso con Datos Reales</span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {sandboxTab === 'real_dev' && (
                <form onSubmit={handleRealLogin} className="sandbox-form">
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px', lineHeight: '1.4' }}>
                    Inicia sesión utilizando un usuario real creado en la pestaña <strong>Auth de Supabase</strong>. Esto permite cargar estudiantes, electivos e inscripciones reales sin requerir Google Auth.
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px' }}>Correo Electrónico (Supabase Auth)</label>
                    <input
                      type="email"
                      required
                      value={realEmail}
                      onChange={(e) => setRealEmail(e.target.value)}
                      placeholder="ej. dev@alessandri.cl"
                      style={{ fontSize: '13px', padding: '8px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px' }}>Contraseña</label>
                    <input
                      type="password"
                      required
                      value={realPassword}
                      onChange={(e) => setRealPassword(e.target.value)}
                      placeholder="Contraseña del usuario"
                      style={{ fontSize: '13px', padding: '8px' }}
                    />
                  </div>

                  {realLoginErr && (
                    <div style={{
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      lineHeight: '1.4',
                      marginBottom: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid #ef4444',
                      color: '#f87171'
                    }}>
                      {realLoginErr}
                    </div>
                  )}

                  <button type="submit" className="laap-btn-primary full-width" disabled={realLoginLoading} style={{ padding: '10px' }}>
                    <span>{realLoginLoading ? 'Autenticando en Supabase...' : 'Ingresar con Sesión Real'}</span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}

              {sandboxTab === 'rpc_test' && (
                <form onSubmit={handleRpcTest} className="sandbox-form">
                  <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '12px', lineHeight: '1.4' }}>
                    Introduce UUIDs reales de tu base de datos Supabase para verificar si la función <code>guardar_seleccion_electivos</code> guarda las 3 postulaciones de forma atómica en tiempo real.
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px' }}>ID del Alumno (UUID de 'alumnos')</label>
                    <input
                      type="text"
                      required
                      value={rpcStudentId}
                      onChange={(e) => setRpcStudentId(e.target.value)}
                      placeholder="e.g. 123e4567-e89b-12d3..."
                      style={{ fontSize: '13px', padding: '8px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px' }}>ID Electivo Horario 1 (UUID)</label>
                    <input
                      type="text"
                      required
                      value={rpcElectivo1}
                      onChange={(e) => setRpcElectivo1(e.target.value)}
                      placeholder="UUID del electivo en Horario 1"
                      style={{ fontSize: '13px', padding: '8px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px' }}>ID Electivo Horario 2 (UUID)</label>
                    <input
                      type="text"
                      required
                      value={rpcElectivo2}
                      onChange={(e) => setRpcElectivo2(e.target.value)}
                      placeholder="UUID del electivo en Horario 2"
                      style={{ fontSize: '13px', padding: '8px' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ fontSize: '12px' }}>ID Electivo Horario 3 (UUID)</label>
                    <input
                      type="text"
                      required
                      value={rpcElectivo3}
                      onChange={(e) => setRpcElectivo3(e.target.value)}
                      placeholder="UUID del electivo en Horario 3"
                      style={{ fontSize: '13px', padding: '8px' }}
                    />
                  </div>

                  {rpcStatus && (
                    <div style={{
                      padding: '10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      lineHeight: '1.4',
                      marginBottom: '16px',
                      backgroundColor: rpcStatus.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      border: `1px solid ${rpcStatus.success ? '#10b981' : '#ef4444'}`,
                      color: rpcStatus.success ? '#34d399' : '#f87171'
                    }}>
                      {rpcStatus.message}
                    </div>
                  )}

                  <button type="submit" className="laap-btn-primary full-width" disabled={rpcLoading} style={{ padding: '10px' }}>
                    <span>{rpcLoading ? 'Ejecutando y Validando...' : 'Ejecutar y Validar RPC'}</span>
                    <ArrowRight size={16} />
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* Footer Institucional */}
        <div className="laap-login-footer">
          <p>© 2026 Liceo Arturo Alessandri Palma. Todos los derechos reservados.</p>
          <p>Para soporte o consultas técnicas, escribir a <strong>cvidal@liceoalessandri.cl</strong></p>
        </div>

      </div>
    </div>
  );
}
