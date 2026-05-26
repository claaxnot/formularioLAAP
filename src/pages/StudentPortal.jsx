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

  // Estados del sistema de reservas temporales
  const [temporaryReservations, setTemporaryReservations] = useState([]);
  const [reservationExpiry, setReservationExpiry] = useState(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [reservingScheduleId, setReservingScheduleId] = useState(null);

  // Manejo del temporizador de cuenta regresiva para la expiración
  useEffect(() => {
    if (!reservationExpiry) {
      setTimeLeft('');
      return;
    }

    const interval = setInterval(() => {
      const diff = reservationExpiry - Date.now();
      if (diff <= 0) {
        setTimeLeft('Reserva expirada');
        setReservationExpiry(null);
        showToast("⚠️ Tus reservas temporales han expirado y las vacantes fueron liberadas.", "error");
        fetchData(false);
      } else {
        const mins = Math.floor(diff / 60000);
        const secs = Math.floor((diff % 60000) / 1000);
        setTimeLeft(`Reserva temporal: ${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [reservationExpiry]);

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
      const isDemo = !!localStorage.getItem('laap_mock_session');
      try {
        const { data: modData, error: modErr } = await supabase
          .from('elecciones_modalidad')
          .select('*')
          .eq('alumno_id', profile.id)
          .maybeSingle();

        if (!modErr) {
          if (modData) {
            currentModalidad = modData.modalidad;
            // Sincronizar caché local con la realidad de la DB
            localStorage.setItem(`modalidad_${profile.id}`, modData.modalidad);
          } else {
            // El registro no existe en la base de datos (fue eliminado por admin o nunca creado)
            currentModalidad = null;
            if (!isDemo) {
              localStorage.removeItem(`modalidad_${profile.id}`);
            }
          }
        } else {
          // Si hay un error real de red/servidor, recurrir a la caché local como salvaguarda
          if (modErr.code !== 'PGRST116') {
            console.error("Error al consultar modalidad en Supabase:", modErr);
          }
          const cached = localStorage.getItem(`modalidad_${profile.id}`);
          if (cached) {
            currentModalidad = cached;
          }
        }
      } catch (err) {
        console.error("Excepción al consultar modalidad:", err);
        const cached = localStorage.getItem(`modalidad_${profile.id}`);
        if (cached) {
          currentModalidad = cached;
        }
      }
      setModalidad(currentModalidad);

      // 1. Verificar si el alumno ya tiene postulaciones definitivas en Supabase
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

      // 1.5. Consultar reservas temporales vigentes del alumno en Supabase
      const { data: tempReservas, error: tempErr } = await supabase
        .from('reservas_temporales')
        .select('*')
        .eq('alumno_id', profile.id)
        .gt('expires_at', new Date().toISOString());

      let currentTempReservations = [];
      if (!tempErr && tempReservas) {
        currentTempReservations = tempReservas;
      }
      setTemporaryReservations(currentTempReservations);

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
              label: name,
              uuid: item.horario_id // UUID real de la tabla horarios
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
            horario_uuid: item.horario_id, // Preservar el UUID real!
            horario_orden: order, // Preservar el orden real!
            horario_nombre: name, // Preservar el nombre real del horario!
            area_id: item.area_codigo || item.area_id || 'A',
            area_nombre: item.area_nombre || 'Área A',
            estado: item.estado || 'disponible'
          });
        });
      }

      const sortedHorarios = Object.values(horariosMap).sort((a, b) => a.orden - b.orden);
      setHorarios(sortedHorarios);
      setElectives(allElectives);

      // Sincronizar selectedElectives con reservas temporales o postulaciones finales
      const selectionsMap = {};
      if (hasPostulaciones) {
        userSelections.forEach(sel => {
          const matchedEl = allElectives.find(e => e.id === sel.electivo_id);
          if (matchedEl) {
            selectionsMap[matchedEl.horario_nombre] = matchedEl;
          }
        });
      } else {
        currentTempReservations.forEach(r => {
          const matchedEl = allElectives.find(e => e.id === r.electivo_id);
          if (matchedEl) {
            selectionsMap[matchedEl.horario_nombre] = matchedEl;
          }
        });
      }
      setSelectedElectives(selectionsMap);

      // Sincronizar temporizador de expiración de la reserva
      if (!hasPostulaciones && currentTempReservations.length > 0) {
        const expDates = currentTempReservations.map(r => new Date(r.expires_at).getTime());
        const minExpiry = Math.min(...expDates);
        setReservationExpiry(minExpiry);
      } else {
        setReservationExpiry(null);
      }

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

  // Manejar selección de tarjeta con reserva transaccional en tiempo real
  const handleSelect = async (horarioNombre, elective) => {
    if (alreadySubmitted || !isProcessOpen || reservingScheduleId) return;

    const previousSelection = selectedElectives[horarioNombre];

    // 1. Actualización optimista de la UI
    setSelectedElectives(prev => {
      const next = { ...prev, [horarioNombre]: elective };
      validateSelections(next);
      return next;
    });

    // Bloquear clics del bloque horario mientras se procesa la transacción
    setReservingScheduleId(elective.horario_uuid);

    try {
      // 2. Comunicarse con la base de datos atómicamente
      const { data, error } = await supabase.rpc('reservar_electivo_temporal', {
        p_alumno_id: profile.id,
        p_electivo_id: elective.id,
        p_horario_id: elective.horario_uuid
      });

      if (error) throw error;

      if (data && data.success === false) {
        throw new Error(data.message);
      }

      // 3. Éxito: notificar y recargar la data (vacantes actualizadas y expiración)
      showToast(data.message || `Cupo reservado temporalmente para "${elective.nombre}".`, 'success');
      await fetchData(false);
    } catch (err) {
      console.error("Error en reserva transaccional:", err);
      showToast("⚠️ No se pudo reservar: " + err.message, 'error');

      // 4. Reversión automática del estado visual (Rollback)
      setSelectedElectives(prev => {
        const next = { ...prev, [horarioNombre]: previousSelection };
        validateSelections(next);
        return next;
      });
    } finally {
      setReservingScheduleId(null);
    }
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

  // Guardar la selección final vía Supabase RPC transaccional
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
      '¿Estás seguro de finalizar tu postulación de electivos? Una vez confirmada, tu selección quedará sellada definitivamente y tu portal se bloqueará.',
      async () => {
        setSubmitting(true);
        try {
          const { data, error } = await supabase.rpc('confirmar_postulacion_final', {
            p_alumno_id: profile.id
          });

          if (error) throw error;

          if (data && data.success === false) {
            throw new Error(data.message);
          }

          setAlreadySubmitted(true);
          showToast(data.message || '¡Tu postulación ha sido finalizada y confirmada de forma definitiva con éxito!', 'success');
          await fetchData(true); // Recargar datos frescos
        } catch (err) {
          console.error("Error al finalizar postulación:", err);
          showToast('No se pudo finalizar: ' + err.message, 'error');
          setErrorMsg('Error al finalizar postulación: ' + err.message);
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
      const isDemo = !!localStorage.getItem('laap_mock_session');
      
      if (!isDemo) {
        // Intentar guardar en Supabase en entornos reales
        const { error } = await supabase
          .from('elecciones_modalidad')
          .insert([{
            alumno_id: profile.id,
            modalidad: selectedMod
          }]);

        if (error) {
          throw new Error(error.message);
        }
      } else {
        console.log("[Demo Mode] Omitiendo guardado en base de datos real.");
      }
      
      // Siempre persistir en localStorage para robustez del navegador
      localStorage.setItem(`modalidad_${profile.id}`, selectedMod);
      
      setModalidad(selectedMod);
      showToast("Modalidad registrada y guardada exitosamente.", "success");
    } catch (err) {
      console.error("Error al registrar modalidad:", err);
      showToast("No se pudo registrar en el servidor: " + err.message, "error");
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
          <div className="modality-selection-card animate-scaleIn">
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <GraduationCap size={48} style={{ color: '#3b82f6', marginBottom: '12px' }} />
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', color: 'var(--text-primary, #ffffff)' }}>
                Selección de Modalidad Académica
              </h2>
              <p style={{ color: 'var(--text-secondary, #9ca3af)', fontSize: '14px', margin: 0 }}>
                Estimado/a <strong>{profile?.nombre_completo}</strong> (RUT: {profile?.rut || 'No registrado'}), debes declarar tu modalidad educativa para continuar.
              </p>
            </div>

            <div className="modality-grid">
              {/* VÍA 1: CIENTÍFICO HUMANISTA */}
              <div className="modality-card ch-card">
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
                  onClick={() => setPendingModalidad('cientifico_humanista')}
                  style={{ width: '100%', marginTop: 'auto', backgroundColor: '#2563eb' }}
                  disabled={savingModalidad}
                >
                  {savingModalidad ? 'Guardando...' : 'Continuar a Selección de Electivos'}
                </button>
              </div>

              {/* VÍA 2: TÉCNICO PROFESIONAL */}
              <div className="modality-card tp-card">
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
                  style={{ width: '100%', marginTop: 'auto', backgroundColor: '#10b981' }}
                  disabled={savingModalidad}
                >
                  {savingModalidad ? 'Guardando...' : 'Declarar Especialidad TP'}
                </button>
              </div>
            </div>
          </div>

          {/* ADVERTENCIA DE CONFIRMACIÓN */}
          {pendingModalidad && (
            <div className="laap-modal-backdrop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
              <div className="laap-modal-card animate-scaleIn" style={{
                maxWidth: '500px',
                width: '100%',
                backgroundColor: 'var(--bg-card, #1f2937)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: '16px',
                padding: '32px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)'
              }}>
                {pendingModalidad === 'tecnico_profesional_gastronomia' ? (
                  <>
                    <h3 style={{ color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
                      <AlertTriangle size={24} />
                      Confirmar Especialidad TP
                    </h3>
                    <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#e5e7eb', margin: '0 0 16px 0' }}>
                      ¿Estás seguro de que deseas inscribirte en la especialidad de <strong>Técnico Profesional en Gastronomía</strong>?
                    </p>
                    <p style={{ fontSize: '13px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', color: '#fbbf24', margin: '0 0 24px 0', lineHeight: '1.5' }}>
                      <strong>⚠️ Esta elección finalizará tu proceso de electivos.</strong> No podrás escoger asignaturas comunes una vez confirmada esta opción.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        onClick={() => setPendingModalidad(null)}
                        disabled={savingModalidad}
                        style={{
                          padding: '10px 18px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '13px',
                          transition: 'all 0.2s'
                        }}
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleSelectModalidad('tecnico_profesional_gastronomia')}
                        disabled={savingModalidad}
                        style={{
                          padding: '10px 18px',
                          border: '1px solid transparent',
                          borderRadius: '8px',
                          backgroundColor: '#ef4444',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          transition: 'all 0.2s',
                          boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.4)'
                        }}
                      >
                        {savingModalidad ? 'Guardando...' : 'Confirmar Selección TP'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h3 style={{ color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 16px 0', fontSize: '18px', fontWeight: 'bold' }}>
                      <BookOpen size={24} />
                      Confirmar Modalidad Científico Humanista
                    </h3>
                    <p style={{ fontSize: '14px', lineHeight: '1.6', color: '#e5e7eb', margin: '0 0 16px 0' }}>
                      ¿Estás seguro de que deseas inscribirte en la modalidad de <strong>Científico Humanista</strong>?
                    </p>
                    <p style={{ fontSize: '13px', padding: '12px', borderRadius: '8px', backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', margin: '0 0 24px 0', lineHeight: '1.5' }}>
                      <strong>📝 Esta elección te dará acceso al catálogo de electivos.</strong> Podrás seleccionar tus 3 asignaturas electivas según las áreas disponibles.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
                      <button 
                        type="button" 
                        onClick={() => setPendingModalidad(null)}
                        disabled={savingModalidad}
                        style={{
                          padding: '10px 18px',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '8px',
                          backgroundColor: 'transparent',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          fontWeight: '600',
                          fontSize: '13px',
                          transition: 'all 0.2s'
                        }}
                      >
                        Cancelar
                      </button>
                      <button 
                        type="button" 
                        onClick={() => handleSelectModalidad('cientifico_humanista')}
                        disabled={savingModalidad}
                        style={{
                          padding: '10px 18px',
                          border: '1px solid transparent',
                          borderRadius: '8px',
                          backgroundColor: '#2563eb',
                          color: 'white',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '13px',
                          transition: 'all 0.2s',
                          boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.4)'
                        }}
                      >
                        {savingModalidad ? 'Guardando...' : 'Confirmar Selección CH'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
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
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
            color: '#ffffff'
          }}>
            <Lock className="notice-icon" size={56} style={{ color: '#10b981', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#ffffff' }}>Matrícula de Especialidad Registrada</h2>
            <p style={{
              fontSize: '15px',
              color: '#d1d5db',
              margin: '0 0 24px 0',
              lineHeight: '1.6',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}>
              Tu postulación ha concluido con éxito. Has seleccionado la modalidad técnica y tu portal se encuentra bloqueado de forma definitiva.
            </p>

            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.04)',
              border: '2px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '24px',
              textAlign: 'left',
              marginBottom: '24px'
            }}>
              <h3 style={{ fontSize: '16px', fontWeight: 'bold', color: '#34d399', margin: '0 0 16px 0', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                Resumen del Registro Académico
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '14px', color: '#e5e7eb' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: '#9ca3af' }}>Estudiante:</span>
                  <span style={{ fontWeight: '600' }}>{profile?.nombre_completo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: '#9ca3af' }}>RUT:</span>
                  <span style={{ fontWeight: '600' }}>{profile?.rut || 'No registrado'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: '#9ca3af' }}>Correo:</span>
                  <span style={{ fontWeight: '600' }}>{profile?.correo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: '#9ca3af' }}>Curso de Origen:</span>
                  <span style={{ fontWeight: '600' }}>{profile?.curso_actual || '3° Medio'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: '#9ca3af' }}>Modalidad Declarada:</span>
                  <span style={{ fontWeight: '600', color: '#34d399' }}>Técnico Profesional (Gastronomía)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                  <span style={{ color: '#9ca3af' }}>Estado de Toma Electiva:</span>
                  <span style={{ fontWeight: '600', color: '#10b981', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#10b981' }}></span>
                    Finalizado y Bloqueado
                  </span>
                </div>
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
          <div className="portal-submitted-notice animate-scaleIn" style={{
            maxWidth: '650px',
            width: '100%',
            margin: '0 auto',
            backgroundColor: 'var(--bg-card, #1f2937)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
            color: '#ffffff'
          }}>
            <AlertTriangle size={56} style={{ color: '#fbbf24', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#ffffff' }}>Proceso No Iniciado</h2>
            <p style={{
              fontSize: '15px',
              color: '#d1d5db',
              margin: '0 auto',
              lineHeight: '1.6',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              maxWidth: '500px'
            }}>
              No hay electivos disponibles para este proceso en este momento.
            </p>
          </div>
        ) : alreadySubmitted ? (
          /* Mensaje de ya postulado */
          <div className="portal-submitted-notice animate-scaleIn" style={{
            maxWidth: '850px',
            width: '100%',
            margin: '0 auto',
            backgroundColor: 'var(--bg-card, #1f2937)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: '16px',
            padding: '40px',
            textAlign: 'center',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
            color: '#ffffff'
          }}>
            <Lock className="notice-icon" size={56} style={{ color: '#10b981', marginBottom: '20px' }} />
            <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#ffffff' }}>Formulario Bloqueado</h2>
            <p style={{
              fontSize: '15px',
              color: '#d1d5db',
              margin: '0 auto 24px auto',
              lineHeight: '1.6',
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              maxWidth: '600px'
            }}>
              Ya registraste tu selección de electivos de forma exitosa. Si necesitas hacer un cambio, debes contactar a UTP.
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

              {timeLeft && (
                <div className={`summary-countdown-banner ${timeLeft.includes('expirada') ? 'expired' : ''}`}>
                  <Clock size={14} style={{ flexShrink: 0 }} />
                  <span>{timeLeft}</span>
                </div>
              )}
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
                        const isReservingThisBlock = reservingScheduleId === el.horario_uuid;

                        return (
                          <div
                            key={el.id}
                            className={`elective-card ${isSelected ? 'selected' : ''} ${isFull || !isProcessOpen || isReservingThisBlock ? 'disabled' : ''} ${isExpanded ? 'details-expanded' : 'details-collapsed'}`}
                            style={{ '--horario-bg': h.color, position: 'relative' }}
                            onClick={() => isProcessOpen && !isFull && !isReservingThisBlock && handleSelect(h.nombre, el)}
                          >
                            {isReservingThisBlock && isSelected && (
                              <div style={{
                                position: 'absolute',
                                top: 0, right: 0, bottom: 0, left: 0,
                                backgroundColor: 'rgba(30, 41, 59, 0.9)',
                                borderRadius: '8px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                zIndex: 10
                              }}>
                                <div className="laap-spinner" style={{ width: '24px', height: '24px', borderWidth: '3px' }}></div>
                                <span style={{ fontSize: '11px', color: '#60a5fa', fontWeight: 'bold' }}>Reservando cupo...</span>
                              </div>
                            )}
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
