import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';
import {
  CheckCircle,
  AlertTriangle,
  BookOpen,
  Users,
  Clock,
  Bookmark,
  Lock,
  ListOrdered,
  ChevronDown,
  GraduationCap
} from 'lucide-react';

const getStudentNivelDestino = (curso) => {
  if (!curso) return null;
  const c = curso.toLowerCase();
  if (c.includes('2°') || c.includes('2o') || c.includes('segundo')) {
    return '3M';
  }
  if (c.includes('3°') || c.includes('3o') || c.includes('tercero')) {
    return '4M';
  }
  return null;
};

export default function StudentPortal() {
  const { profile, showToast, showConfirm } = useAuth();
  const [electives, setElectives] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [existingSelections, setExistingSelections] = useState([]);
  const [selectedElectives, setSelectedElectives] = useState({});
  const [expandedElectives, setExpandedElectives] = useState({});
  const toggleExpand = (e, id) => {
    e.stopPropagation();
    setExpandedElectives(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };
  const [waitlistStatus, setWaitlistStatus] = useState({}); // Tracking which electives they joined the waitlist for
  const [criticalError, setCriticalError] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isProcessOpen, setIsProcessOpen] = useState(true); // Control administrativo de apertura/cierre
  const [lastUpdated, setLastUpdated] = useState('');
  const [modalidad, setModalidad] = useState(null);
  const [savingModalidad, setSavingModalidad] = useState(false);
  const [pendingModalidad, setPendingModalidad] = useState(null);

  // Cargar datos al montar o al cambiar de perfil
  useEffect(() => {
    if (profile?.id) {
      fetchData();
    }
  }, [profile]);

  // REFRESH AUTOMÁTICO CADA 5 SEGUNDOS (REFETCH LIVIANO CON OPTIMIZACIONES)
  useEffect(() => {
    if (!profile?.id) return;

    // Condición de pausa del refetch en el cliente (no consultar si ya terminó o está cerrado)
    const shouldPause = alreadySubmitted || !isProcessOpen;

    if (shouldPause) {
      console.log("Auto-refresh pausado en Portal Estudiante: Formulario enviado o proceso cerrado.");
      return;
    }

    const handleRefresh = () => {
      // Omitir refetch si la pestaña está en segundo plano (ahorro de batería y queries)
      if (document.hidden) {
        console.log("Auto-refresh omitido: Pestaña en segundo plano (document.hidden).");
        return;
      }
      if (!submitting) {
        fetchData(false); // false indica refetch silencioso sin interrumpir la UI
      }
    };

    // Iniciar intervalo de 5 segundos
    const interval = setInterval(handleRefresh, 5000);

    // Escuchar cambios de visibilidad de pestaña para reactivar sync inmediato al volver a enfocar
    const handleVisibilityChange = () => {
      if (!document.hidden && !submitting) {
        console.log("Pestaña activa detectada. Forzando refresco de electivos inmediato...");
        fetchData(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [profile, submitting, alreadySubmitted, isProcessOpen]);

  const fetchData = async (showFullSpinner = true) => {
    if (showFullSpinner) {
      setLoading(true);
    }
    setCriticalError('');
    try {
      if (!profile?.id) return;

      const targetNivelDestino = getStudentNivelDestino(profile?.curso_actual);
      if (!targetNivelDestino) {
        setLoading(false);
        return;
      }

      // 0. Consultar procesos donde activo = true en Supabase
      const { data: procData, error: procErr } = await supabase
        .from('procesos')
        .select('*')
        .eq('activo', true)
        .eq('nivel_destino', targetNivelDestino);

      if (procErr) {
        console.error("Error al consultar tabla procesos:", procErr);
      }
      // Si no hay proceso activo o activo = false, bloquear formulario
      const open = procData && procData.length > 0;
      setIsProcessOpen(open);

      // 0.5. Consultar modalidad del alumno en Supabase
      let currentModalidad = null;
      try {
        const { data: modData, error: modErr } = await supabase
          .from('elecciones_modalidad')
          .select('*')
          .eq('alumno_id', profile.id)
          .maybeSingle();

        if (!modErr && modData) {
          currentModalidad = modData.modalidad;
        } else if (modErr && modErr.code !== 'PGRST116') {
          console.error("Error al consultar modalidad en Supabase:", modErr);
        }
      } catch (err) {
        console.error("Excepción al consultar modalidad:", err);
      }

      // Si no hay modalidad en la DB, buscar en localStorage
      if (!currentModalidad) {
        const cached = localStorage.getItem(`modalidad_${profile.id}`);
        if (cached) {
          currentModalidad = cached;
        }
      }
      setModalidad(currentModalidad);

      // 1. Verificar si hay postulaciones reales del alumno en Supabase
      const { data: postData, error: postErr } = await supabase
        .from('postulaciones')
        .select('*, electivos(*)')
        .eq('alumno_id', profile.id);

      let hasPostulaciones = false;
      let userSelections = [];

      if (!postErr && postData && postData.length > 0) {
        hasPostulaciones = true;
        userSelections = postData;
      }

      // 2. Consultar lista de espera del alumno en Supabase
      const { data: wlData, error: wlErr } = await supabase
        .from('lista_espera')
        .select('electivo_id')
        .eq('alumno_id', profile.id);

      const wlMap = {};
      if (!wlErr && wlData) {
        wlData.forEach(item => {
          wlMap[item.electivo_id] = true;
        });
      }

      setWaitlistStatus(wlMap);
      setAlreadySubmitted(hasPostulaciones);
      setExistingSelections(userSelections);

      // 3. Cargar Electivos y Cupos reales desde vista_electivos_cupos
      const { data: cuposData, error: cuposErr } = await supabase
        .from('vista_electivos_cupos')
        .select('*');

      if (cuposErr) {
        setErrorMsg(`Error al obtener electivos: ${cuposErr.message}`);
        setLoading(false);
        return;
      }

      // Agrupar horarios dinámicamente según la data real de la vista
      const horariosMap = {};
      const allElectives = [];

      // Filtro de activo estricto: electivo.activo === true y nivel_destino === targetNivelDestino
      const filteredData = (cuposData || []).filter(item =>
        item.activo === true &&
        item.nivel_destino === targetNivelDestino
      );

      if (filteredData && filteredData.length > 0) {
        filteredData.forEach(item => {
          // Agrupar solo por horario_orden
          const order = item.horario_orden || 1;
          const name = item.horario_nombre || `Horario ${order}`;
          const color = item.horario_color || (order === 1 ? '#fff6db' : order === 2 ? '#f7e7ef' : '#e8f1fb');

          if (!horariosMap[order]) {
            horariosMap[order] = {
              id: order,
              orden: order,
              nombre: name,
              color: color,
              label: name
            };
          }

          // No ocultar electivos sin descripción o docente (pueden ser NULL)
          allElectives.push({
            id: item.electivo_id || item.id,
            nombre: item.nombre,
            descripcion: item.descripcion || '',
            profesor: item.docente || item.profesor || 'Sin docente asignado',
            cupos_maximos: item.cupos_maximos !== undefined ? item.cupos_maximos : 15,
            cupos_ocupados: item.cupos_ocupados || 0,
            cupos_disponibles: item.cupos_disponibles !== undefined ? item.cupos_disponibles : 15,
            horario_id: order,
            area_id: item.area_codigo || item.area_id || 'A',
            area_nombre: item.area_nombre || 'Área A',
            estado: item.estado || 'disponible'
          });
        });
      }

      const sortedHorarios = Object.values(horariosMap).sort((a, b) => a.orden - b.orden);
      setHorarios(sortedHorarios);
      setElectives(allElectives);

      // Registrar hora exacta de última actualización
      const now = new Date();
      const timeString = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastUpdated(timeString);
    } catch (err) {
      console.error("Error al cargar portal de estudiantes:", err);
      setCriticalError("Error crítico de la aplicación: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Manejar selección de tarjeta
  const handleSelect = (horarioNombre, elective) => {
    if (alreadySubmitted || !isProcessOpen) return;

    setSelectedElectives(prev => {
      const next = { ...prev, [horarioNombre]: elective };
      validateSelections(next);
      return next;
    });
  };

  // Validar reglas (Max 2 por área)
  const validateSelections = (selections) => {
    setErrorMsg('');
    const activeSelections = Object.values(selections).filter(Boolean);

    if (activeSelections.length > 0) {
      const areaCounts = {};
      activeSelections.forEach(el => {
        const areaId = el.area_id;
        areaCounts[areaId] = (areaCounts[areaId] || 0) + 1;
      });

      const invalidArea = Object.entries(areaCounts).find(([_, count]) => count > 2);
      if (invalidArea) {
        const areaName = activeSelections.find(el => el.area_id === invalidArea[0])?.area_nombre || `Área ${invalidArea[0]}`;
        setErrorMsg(`Regla infringida: No puedes seleccionar más de 2 electivos de la misma Área Académica (${areaName}). Por favor ajusta tu selección.`);
        return false;
      }
    }
    return true;
  };


  // Unirse a la lista de espera real en Supabase
  const handleJoinWaitlist = async (elective) => {
    if (alreadySubmitted || !isProcessOpen) return;

    showConfirm(
      `¿Deseas inscribirte en la Lista de Espera para "${elective.nombre}"?`,
      async () => {
        try {
          const { error } = await supabase
            .from('lista_espera')
            .insert({
              alumno_id: profile.id,
              electivo_id: elective.id
            });

          if (error) throw error;

          setWaitlistStatus(prev => ({ ...prev, [elective.id]: true }));
          showToast(`Te has registrado correctamente en la lista de espera de "${elective.nombre}".`, 'success');
          await fetchData(false);
        } catch (err) {
          showToast("Error al unirse a la lista de espera: " + err.message, 'error');
        }
      }
    );
  };

  // Guardar la selección final vía Supabase RPC
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isProcessOpen) {
      setErrorMsg('El proceso de selección se encuentra cerrado actualmente.');
      return;
    }

    // Validar completitud basándose en los horarios reales agrupados
    const incomplete = horarios.some(h => !selectedElectives[h.nombre]);
    if (incomplete) {
      setErrorMsg('Debes elegir exactamente un electivo para cada uno de los horarios habilitados.');
      return;
    }

    // Validar regla de área de nuevo
    if (!validateSelections(selectedElectives)) return;

    showConfirm(
      '¿Estás seguro de enviar tu selección de electivos? Una vez guardada no podrás modificarla.',
      async () => {
        setSubmitting(true);
        try {
          // Mapear los horarios ordenados a los 3 electivos requeridos por la RPC
          const sortedSelections = horarios.map(h => selectedElectives[h.nombre]?.id);

          const { data, error } = await supabase.rpc('guardar_seleccion_electivos', {
            p_alumno_id: profile.id,
            p_electivo_1: sortedSelections[0] || null,
            p_electivo_2: sortedSelections[1] || null,
            p_electivo_3: sortedSelections[2] || null
          });

          if (error) throw error;

          setAlreadySubmitted(true);
          setSuccessMsg('Tu selección ha sido guardada exitosamente.');
          await fetchData(true); // Recargar datos frescos
        } catch (err) {
          console.error("Error al registrar selección:", err);
          setErrorMsg('Error al guardar tu selección: ' + (err.message || 'Intente nuevamente.'));
        } finally {
          setSubmitting(false);
        }
      }
    );
  };

  // UI Helper for Refresh Indicator
  const getUpdateIndicator = () => {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '5px 12px',
        borderRadius: '20px',
        fontSize: '11px',
        fontWeight: 'bold',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        color: '#3b82f6',
        border: '1px solid #3b82f6',
        transition: 'all 0.3s ease'
      }}>
        <span style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          backgroundColor: '#3b82f6',
          display: 'inline-block',
          animation: 'laap-pulse 2s infinite'
        }} />
        <span>Actualizado automáticamente {lastUpdated ? `(Última: ${lastUpdated})` : ''}</span>
      </div>
    );
  };

  const handleSelectModalidad = async (selectedMod) => {
    setSavingModalidad(true);
    try {
      // Intentar guardar en Supabase
      const { error } = await supabase
        .from('elecciones_modalidad')
        .insert([{
          alumno_id: profile.id,
          modalidad: selectedMod
        }]);

      if (error) {
        console.warn("No se pudo insertar en la tabla elecciones_modalidad (puede no existir aún). Se guardará en fallback local:", error);
      }
      
      // Siempre persistir en localStorage para fallback/offline robustness
      localStorage.setItem(`modalidad_${profile.id}`, selectedMod);
      
      setModalidad(selectedMod);
      showToast("Modalidad guardada exitosamente.", "success");
    } catch (err) {
      console.error(err);
      showToast("Error al guardar modalidad: " + err.message, "error");
    } finally {
      setSavingModalidad(false);
      setPendingModalidad(null);
    }
  };

  if (loading) {
    return (
      <div className="laap-loading-container">
        <div className="laap-spinner"></div>
        <p>Cargando datos institucionales de electivos...</p>
      </div>
    );
  }

  const targetNivelDestino = getStudentNivelDestino(profile?.curso_actual);

  if (!targetNivelDestino) {
    return (
      <div className="laap-student-portal">
        <Navbar />
        <div className="laap-page-unauthorized">
          <div className="laap-unauthorized-card" style={{ maxWidth: '600px', margin: '40px auto' }}>
            <div className="unauthorized-icon-container" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
              <AlertTriangle size={48} />
            </div>
            <h1 className="unauthorized-title" style={{ color: 'var(--secondary-color)' }}>Proceso Inactivo</h1>
            <p className="unauthorized-lead" style={{ margin: '16px 0' }}>
              Tu curso actual (<strong>{profile?.curso_actual || 'Sin registrar'}</strong>) no tiene un proceso de electivos activo.
            </p>
            <div className="unauthorized-instructions" style={{ marginTop: '20px', textAlign: 'center' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.6', margin: 0 }}>
                El sistema de toma de asignaturas electivas LAAP solo contempla elecciones para futuros alumnos de <strong>3° Medio</strong> (cursando actualmente 2° Medio) y <strong>4° Medio</strong> (cursando actualmente 3° Medio).
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '12px', fontWeight: 'bold' }}>
                Si crees que esto es un error, por favor ponte en contacto con la Dirección Académica / UTP.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!modalidad) {
    return (
      <div className="laap-student-portal" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main className="student-portal-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '24px' }}>
          <div className="animate-scaleIn" style={{
            maxWidth: '800px',
            width: '100%',
            backgroundColor: 'var(--bg-card, #1f2937)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.3))'
          }}>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <GraduationCap size={48} style={{ color: '#3b82f6', marginBottom: '12px' }} />
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', color: 'var(--text-primary, #ffffff)' }}>
                Selección de Modalidad Académica
              </h2>
              <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '14px', margin: 0 }}>
                Estimado/a <strong>{profile?.nombre_completo}</strong> (RUT: {profile?.rut || 'No registrado'}), debes declarar tu modalidad educativa para continuar.
              </p>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}>
              {/* VÍA 1: CIENTÍFICO HUMANISTA */}
              <div className="modality-card" style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: 'rgba(59, 130, 246, 0.04)',
                border: '2px solid rgba(59, 130, 246, 0.2)',
                transition: 'all 0.3s ease'
              }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0' }}>
                    <BookOpen size={20} />
                    Científico Humanista
                  </h3>
                  <p style={{ fontSize: '13px', color: '#d1d5db', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                    Esta modalidad te permite continuar con el proceso regular de postulación a asignaturas electivas según tus intereses académicos y horarios.
                  </p>
                  <ul style={{ paddingLeft: '20px', fontSize: '12px', color: '#9ca3af', margin: '0 0 20px 0', lineHeight: '1.6' }}>
                    <li>Elección de asignaturas por bloque de horario.</li>
                    <li>Preparación integral para la educación superior.</li>
                    <li>Acceso al catálogo regular de electivos LAAP.</li>
                  </ul>
                </div>
                <button
                  type="button"
                  className="laap-btn-primary"
                  onClick={() => handleSelectModalidad('cientifico_humanista')}
                  style={{ width: '100%', marginTop: 'auto', backgroundColor: '#2563eb' }}
                  disabled={savingModalidad}
                >
                  {savingModalidad ? 'Guardando...' : 'Continuar a Selección de Electivos'}
                </button>
              </div>

              {/* VÍA 2: TÉCNICO PROFESIONAL */}
              <div className="modality-card" style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '24px',
                borderRadius: '12px',
                backgroundColor: 'rgba(16, 185, 129, 0.04)',
                border: '2px solid rgba(16, 185, 129, 0.2)',
                transition: 'all 0.3s ease'
              }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#34d399', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0' }}>
                    <GraduationCap size={20} />
                    Técnico Profesional
                  </h3>
                  <p style={{ fontSize: '13px', color: '#d1d5db', lineHeight: '1.6', margin: '0 0 16px 0' }}>
                    Especialidad técnica de excelencia enfocada en gastronomía y servicios culinarios. Al seleccionar esta modalidad finalizas tu proceso de postulación de electivos comunes de inmediato.
                  </p>
                  <ul style={{ paddingLeft: '20px', fontSize: '12px', color: '#9ca3af', margin: '0 0 20px 0', lineHeight: '1.6' }}>
                    <li>Clases teórico-prácticas en talleres de cocina.</li>
                    <li>Práctica profesional integrada y titulación.</li>
                    <li>Proceso de electivos comunes cerrado automáticamente.</li>
                  </ul>
                </div>
                <button
                  type="button"
                  className="laap-btn-success"
                  onClick={() => setPendingModalidad('tecnico_profesional_gastronomia')}
                  style={{ width: '100%', marginTop: 'auto', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                  disabled={savingModalidad}
                >
                  Declarar Especialidad TP
                </button>
              </div>
            </div>

            {/* ADVERTENCIA DE CONFIRMACIÓN */}
            {pendingModalidad && (
              <div className="laap-modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                <div className="laap-modal-card animate-scaleIn" style={{ maxWidth: '500px', padding: '24px' }}>
                  <h3 style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 12px 0' }}>
                    <AlertTriangle size={24} />
                    Confirmar Especialidad TP
                  </h3>
                  <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#ffffff' }}>
                    ¿Estás seguro de que deseas inscribirte en la especialidad de **Técnico Profesional en Gastronomía**?
                  </p>
                  <p style={{ fontSize: '13px', padding: '12px', borderRadius: '6px', backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', margin: '16px 0' }}>
                    <strong>⚠️ Esta elección finalizará tu proceso de electivos.</strong> No podrás escoger asignaturas comunes una vez confirmada esta opción.
                  </p>
                  <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button 
                      type="button" 
                      className="laap-btn-text" 
                      onClick={() => setPendingModalidad(null)}
                      disabled={savingModalidad}
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button" 
                      className="laap-btn-primary" 
                      onClick={() => handleSelectModalidad('tecnico_profesional_gastronomia')}
                      disabled={savingModalidad}
                      style={{ backgroundColor: '#ef4444' }}
                    >
                      {savingModalidad ? 'Guardando...' : 'Confirmar Selección TP'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (modalidad === 'tecnico_profesional_gastronomia') {
    return (
      <div className="laap-student-portal" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <Navbar />
        <main className="student-portal-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '24px' }}>
          <div className="portal-submitted-notice animate-scaleIn" style={{
            maxWidth: '650px',
            width: '100%',
            backgroundColor: 'var(--bg-card, #1f2937)',
            border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.3))'
          }}>
            <Lock className="notice-icon" size={56} style={{ color: '#10b981', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 12px 0' }}>Matrícula de Especialidad Registrada</h2>
            <p className="notice-msg" style={{ fontSize: '15px', color: '#d1d5db', margin: '0 0 24px 0', lineHeight: '1.6' }}>
              Tu postulación ha concluido con éxito. Has seleccionado la modalidad técnica y tu portal se encuentra bloqueado de forma definitiva.
            </p>

            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.05)',
              border: '2px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'left',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399', margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                Resumen del Registro Académico
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div><strong>Estudiante:</strong> {profile?.nombre_completo}</div>
                <div><strong>RUT:</strong> {profile?.rut || 'No registrado'}</div>
                <div><strong>Correo:</strong> {profile?.correo}</div>
                <div><strong>Curso de Origen:</strong> {profile?.curso_actual || '3° Medio'}</div>
                <div><strong>Modalidad Declarada:</strong> Técnico Profesional (Gastronomía)</div>
                <div><strong>Estado de Toma Electiva:</strong> Finalizado y Bloqueado</div>
              </div>
            </div>

            <p style={{ fontSize: '12px', color: '#9ca3af', margin: 0 }}>
              Si requieres realizar modificaciones o crees que hubo un error, por favor ponte en contacto directo con la Unidad Técnico Pedagógica (UTP).
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="laap-student-portal">
      <Navbar />

      {/* Estilo auto-contenido para animación de pulso */}
      <style>{`
        @keyframes laap-pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 currentColor; opacity: 0.7; }
          70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(0,0,0,0); opacity: 1; }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,0,0,0); opacity: 0.7; }
        }
      `}</style>

      <main className="student-portal-main">
        {/* Banner de error visual crítico */}
        {criticalError && (
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid #ef4444',
            color: '#f87171',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '20px',
            lineHeight: '1.5',
            fontWeight: 'bold',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <span>⚠️ ERROR DETECTADO:</span>
            <span style={{ fontFamily: 'monospace', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '4px' }}>
              {criticalError}
            </span>
            <button
              onClick={() => fetchData(true)}
              style={{ alignSelf: 'flex-start', background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Reintentar Consulta
            </button>
          </div>
        )}
        {/* Banner de Proceso Cerrado */}
        {!isProcessOpen && (
          <div style={{
            padding: '16px',
            backgroundColor: 'rgba(245, 158, 11, 0.15)',
            border: '2px solid #f59e0b',
            color: '#fbbf24',
            borderRadius: '8px',
            fontSize: '14px',
            marginBottom: '20px',
            lineHeight: '1.5',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertTriangle size={24} style={{ flexShrink: 0 }} />
            <span>
              El proceso de selección de electivos se encuentra cerrado. Si necesitas información, contacta a UTP.
            </span>
          </div>
        )}

        {/* Encabezado del Portal */}
        <div className="portal-intro-section animate-fadeIn">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px' }}>
            <h1 style={{ margin: 0 }}>Postulación de Asignaturas Electivas</h1>
            {getUpdateIndicator()}
          </div>
          <p>
            Estimado/a <strong>{profile?.nombre_completo || 'Estudiante'}</strong> (Curso: <strong>{profile?.curso_actual || '3° Medio'}</strong>), selecciona tus asignaturas electivas para el ciclo académico vigente. Recuerda las siguientes normativas:
          </p>
          <div className="rules-grid">
            <div className="rule-item">
              <CheckCircle size={16} className="rule-icon success" />
              <span>Elige exactamente <strong>un electivo</strong> por cada uno de los horarios habilitados.</span>
            </div>
            <div className="rule-item">
              <AlertTriangle size={16} className="rule-icon warning" />
              <span>Máximo de <strong>2 electivos</strong> pertenecientes a la misma Área Académica.</span>
            </div>
          </div>
        </div>

        {/* Caso en que no haya electivos cargados */}
        {electives.length === 0 ? (
          <div className="portal-submitted-notice animate-scaleIn" style={{ padding: '40px', textAlign: 'center' }}>
            <AlertTriangle className="notice-icon text-amber-500" size={48} style={{ marginBottom: '16px' }} />
            <h2>Proceso No Iniciado</h2>
            <p className="notice-msg" style={{ fontSize: '15px', color: '#9ca3af' }}>
              No hay electivos disponibles para este proceso.
            </p>
          </div>
        ) : alreadySubmitted ? (
          /* Mensaje de ya postulado */
          <div className="portal-submitted-notice animate-scaleIn">
            <Lock className="notice-icon" size={48} />
            <h2>Formulario Bloqueado</h2>
            <p className="notice-msg">
              “Ya registraste tu selección de electivos. Si necesitas hacer un cambio, debes contactar a UTP.”
            </p>

            <div className="selections-display">
              <h3>Tus Electivos Registrados:</h3>
              <div className="selections-grid">
                {existingSelections.map((sel, idx) => {
                  const electiveItem = sel.electivos || {};
                  // Obtener color y orden real del electivo desde nuestro mapa dinámico
                  const matchedElective = electives.find(e => e.id === electiveItem.id);
                  const matchedHorario = horarios.find(h => h.id === matchedElective?.horario_id);
                  const blockColor = matchedHorario?.color || (idx === 0 ? '#fff6db' : idx === 1 ? '#f7e7ef' : '#e8f1fb');
                  const orderName = matchedHorario?.nombre || `Horario ${idx + 1}`;
                  const areaCode = matchedElective?.area_id || electiveItem.area_id || 'A';
                  const areaName = matchedElective?.area_nombre || 'Área A';

                  return (
                    <div
                      key={sel.id || idx}
                      className="selected-display-card"
                      style={{
                        borderLeft: `6px solid ${idx === 0 ? '#d97706' : idx === 1 ? '#db2777' : '#2563eb'}`,
                        backgroundColor: blockColor
                      }}
                    >
                      <div className="card-idx">{orderName}</div>
                      <h4 className="card-name">{electiveItem.nombre || 'Electivo'}</h4>
                      <div className="card-meta">
                        <span className={`area-badge area-${areaCode}`}>
                          Área {areaCode} - {areaName}
                        </span>
                        <span className="prof-name">{electiveItem.profesor || 'Docente UTP'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Formulario Interactivo */
          <form onSubmit={handleSubmit} className="portal-selection-form animate-fadeIn">
            {/* Panel flotante de elecciones */}
            <div className="selection-summary-panel">
              <div className="panel-title">
                <Bookmark size={18} />
                <span>Resumen de Elección</span>
              </div>
              <div className="summary-cards">
                {horarios.map((h, idx) => {
                  const selection = selectedElectives[h.nombre];
                  const blockColor = h.color || (idx === 0 ? '#fff6db' : idx === 1 ? '#f7e7ef' : '#e8f1fb');
                  return (
                    <div key={h.id} className="summary-item" style={{ backgroundColor: blockColor }}>
                      <span className="summary-horario">{h.nombre}</span>
                      <strong className="summary-course truncate">
                        {selection ? selection.nombre : '— Pendiente —'}
                      </strong>
                      {selection && (
                        <span className={`area-badge area-${selection.area_id}`}>
                          Área {selection.area_id}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Mensajes de Alerta y Envío */}
              {errorMsg && (
                <div className="error-alert" style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <span style={{ textAlign: 'left' }}>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="success-alert">
                  <CheckCircle size={18} />
                  <span>{successMsg}</span>
                </div>
              )}

              <button
                type="submit"
                className="laap-btn-primary submit-selections-btn"
                disabled={submitting || !isProcessOpen || horarios.some(h => !selectedElectives[h.nombre])}
              >
                {!isProcessOpen ? 'Proceso Cerrado' : submitting ? 'Enviando selección...' : 'Guardar y Finalizar Selección'}
              </button>
            </div>

            {/* Listado de electivos por Horarios */}
            <div className="schedules-workspace">
              {horarios.map((h) => {
                const scheduleElectives = electives.filter(el => String(el.horario_id) === String(h.id));

                return (
                  <div key={h.id} className="schedule-block-container">
                    <h2 className="schedule-block-header">
                      <Clock size={20} />
                      <span>{h.nombre}</span>
                    </h2>

                    <div className="electives-grid">
                      {scheduleElectives.map(el => {
                        const isSelected = selectedElectives[h.nombre]?.id === el.id;
                        const isFull = el.cupos_disponibles <= 0;
                        const isWaitlisted = waitlistStatus[el.id] || false;
                        const isExpanded = expandedElectives[el.id] || false;

                        return (
                          <div
                            key={el.id}
                            className={`elective-card ${isSelected ? 'selected' : ''} ${isFull || !isProcessOpen ? 'disabled' : ''} ${isExpanded ? 'details-expanded' : 'details-collapsed'}`}
                            style={{ '--horario-bg': h.color }}
                            onClick={() => isProcessOpen && !isFull && handleSelect(h.nombre, el)}
                          >
                            {/* Meta Cabecera (Desktop & Mobile Adaptiva) */}
                            <div className="card-header-meta">
                              <span className={`area-badge area-${el.area_id}`}>
                                Área {el.area_id} - {el.area_nombre}
                              </span>
                              <span className="mobile-seats-pill">
                                {el.cupos_disponibles} cupos disp.
                              </span>
                              <span className={`status-pill ${isFull ? 'full' : 'available'}`}>
                                {isFull ? 'Sin Vacantes' : 'Disponible'}
                              </span>
                            </div>

                            {/* Título Principal */}
                            <h3 className="elective-title">{el.nombre}</h3>

                            {/* Botón de Expansión (Solo Visible en Mobile mediante CSS) */}
                            <button
                              type="button"
                              className="expand-details-btn"
                              onClick={(e) => toggleExpand(e, el.id)}
                            >
                              <span>{isExpanded ? 'Ocultar detalles' : 'Ver detalles'}</span>
                              <ChevronDown size={14} style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                            </button>

                            {/* Contenedor de Detalles (Colapsable en Mobile mediante CSS) */}
                            <div className={`elective-details-container ${isExpanded ? 'mobile-expanded' : 'mobile-collapsed'}`}>
                              <p className="elective-desc">{el.descripcion || 'Sin descripción disponible.'}</p>

                              <div className="elective-footer">
                                <span className="teacher-info">Prof: {el.profesor || 'Docente UTP'}</span>

                                <div className="seats-info">
                                  <Users size={14} />
                                  <span>{el.cupos_ocupados} / {el.cupos_maximos} cupos</span>
                                </div>
                              </div>

                              <div className="seat-bar">
                                <div
                                  className="seat-bar-fill"
                                  style={{ width: `${Math.min(100, (el.cupos_ocupados / el.cupos_maximos) * 100)}%` }}
                                />
                              </div>
                            </div>

                            {/* Acciones de Lista de Espera */}
                            {isFull && (
                              <div className="waitlist-card-action" onClick={(e) => e.stopPropagation()}>
                                <p className="waitlist-notice">
                                  Esta asignatura no tiene vacantes libres. Puedes inscribirte en la lista de espera para optar a un cupo libre por desestimación.
                                </p>
                                {isWaitlisted ? (
                                  <button type="button" className="laap-btn-success full-width" disabled>
                                    <CheckCircle size={16} />
                                    <span>Ya estás en Lista de Espera</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    className="laap-btn-warning full-width"
                                    onClick={() => handleJoinWaitlist(el)}
                                    disabled={!isProcessOpen}
                                  >
                                    <ListOrdered size={16} />
                                    <span>Inscribirse en Lista de Espera</span>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Indicador de Acción (Mobile y Desktop) */}
                            {!isFull && (
                              <>
                                {/* Desktop Indicator */}
                                <div className="select-indicator desktop-only">
                                  {!isProcessOpen ? 'Proceso Cerrado' : isSelected ? 'Asignatura Seleccionada' : 'Haga clic para seleccionar'}
                                </div>

                                {/* Mobile Action Button */}
                                <div className="mobile-action-bar" onClick={(e) => e.stopPropagation()}>
                                  {isSelected ? (
                                    <div className="selected-badge-compact">
                                      <CheckCircle size={14} />
                                      <span>Seleccionado</span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      className="select-compact-btn"
                                      disabled={!isProcessOpen}
                                      onClick={() => isProcessOpen && handleSelect(h.nombre, el)}
                                    >
                                      Seleccionar
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
