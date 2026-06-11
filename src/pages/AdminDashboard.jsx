import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../utils/supabaseClient';
import Navbar from '../components/Navbar';
import { formatNombre } from '../utils/formatters';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  Users,
  BookOpen,
  FileSpreadsheet,
  Plus,
  Edit3,
  Trash2,
  Search,
  CheckCircle,
  Clock,
  ListOrdered,
  AlertTriangle,
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

export default function AdminDashboard() {
  const { profile, showToast, showConfirm } = useAuth();
  const [activeTab, setActiveTab] = useState('stats'); // 'stats', 'postulaciones', 'lista_espera', 'electivos_3m', 'electivos_4m', 'alumnos'
  const [eleccionesModalidad, setEleccionesModalidad] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // States for DB data
  const [students, setStudents] = useState([]);
  const [electives, setElectives] = useState([]);
  const [cupos, setCupos] = useState([]);
  const [postulaciones, setPostulaciones] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [temporaryReservations, setTemporaryReservations] = useState([]);
  const [horarios, setHorarios] = useState([]);
  const [areas, setAreas] = useState([]);
  const [activeProcess3M, setActiveProcess3M] = useState(null);
  const [activeProcess4M, setActiveProcess4M] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('');
  const [statsFilter, setStatsFilter] = useState('all'); // 'all', '3M', '4M'

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [rosterSearchQuery, setRosterSearchQuery] = useState('');
  const [rosterCursoFilter, setRosterCursoFilter] = useState('all');

  // Edit Student Postulacion States
  const [editingPostulacion, setEditingPostulacion] = useState(null);
  const [newElectiveId, setNewElectiveId] = useState('');
  const [savingPostulacion, setSavingPostulacion] = useState(false);
  
  // Student Roster Edit Modal States
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState('create'); // 'create' or 'edit'
  const [currentElective, setCurrentElective] = useState({
    id: null,
    nombre: '',
    descripcion: '',
    docente: '',
    cupos_maximos: 15,
    horario_id: '',
    area_id: '',
    activo: true,
    nivel_destino: '3M'
  });
  useEffect(() => {
    fetchAdminData(true);
  }, []);
  // REFRESH AUTOMÁTICO CADA 5 SEGUNDOS (REFETCH LIVIANO)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAdminData(false); // false indica que es un refetch silencioso de fondo sin spinner
    }, 5000);

    return () => clearInterval(interval);
  }, []); const fetchAdminData = async (showFullSpinner = true) => {
    if (showFullSpinner) {
      setLoading(true);
    }
    try {
      // 1. Cargar alumnos real
      const { data: stdData, error: stdErr } = await supabase
        .from('alumnos')
        .select('id, rut, nombre_completo, correo, curso_actual, activo, ya_postulo, estado_correo, correo_apoderado_1, correo_apoderado_2')
        .order('nombre_completo');
      if (stdErr) throw stdErr;

      // 2. Cargar electivos real con nivel_destino
      const { data: elData, error: elErr } = await supabase
        .from('electivos')
        .select('id, nombre, descripcion, docente, horario_id, area_id, cupos_maximos, activo, nivel_destino')
        .order('nombre');
      if (elErr) throw elErr;

      // 3. Cargar vista_electivos_cupos real
      const { data: cuposData, error: cuposErr } = await supabase
        .from('vista_electivos_cupos')
        .select('*');
      if (cuposErr) throw cuposErr;

      // 4. Cargar postulaciones real
      const { data: postData, error: postErr } = await supabase
        .from('postulaciones')
        .select('id, alumno_id, electivo_id, horario_id, created_at')
        .order('created_at', { ascending: false });
      if (postErr) throw postErr;

      // 5. Cargar lista_espera real
      const { data: wlData, error: wlErr } = await supabase
        .from('lista_espera')
        .select('id, alumno_id, electivo_id, created_at')
        .order('created_at', { ascending: true });
      if (wlErr) throw wlErr;

      // 6. Cargar horarios real
      const { data: horData, error: horErr } = await supabase
        .from('horarios')
        .select('id, nombre, color, orden')
        .order('orden');
      if (horErr) throw horErr;

      // 7. Cargar areas real
      const { data: areaData, error: areaErr } = await supabase
        .from('areas')
        .select('id, nombre, codigo, color')
        .order('nombre');
      if (areaErr) throw areaErr;

      // 8. Cargar proceso activo real
      const { data: procData, error: procErr } = await supabase
        .from('procesos')
        .select('*');
      if (procErr) {
        console.error("Error al consultar procesos:", procErr);
      } else {
        const proc3M = procData?.find(p => p.nivel_destino === '3M' && p.activo === true) || procData?.find(p => p.nivel_destino === '3M') || null;
        const proc4M = procData?.find(p => p.nivel_destino === '4M' && p.activo === true) || procData?.find(p => p.nivel_destino === '4M') || null;
        setActiveProcess3M(proc3M);
        setActiveProcess4M(proc4M);
      }

      // 8.5. Cargar reservas temporales activas vigentes desde Supabase
      const { data: tempResData, error: tempResErr } = await supabase
        .from('reservas_temporales')
        .select('*')
        .gt('expires_at', new Date().toISOString());

      if (!tempResErr && tempResData) {
        setTemporaryReservations(tempResData);
      } else if (tempResErr) {
        console.error("Error al obtener reservas temporales:", tempResErr);
      }

      setStudents(stdData || []);
      setElectives(elData || []);
      setCupos(cuposData || []);
      setPostulaciones(postData || []);
      setWaitlist(wlData || []);
      setHorarios(horData || []);
      setAreas(areaData || []);

      // 9. Cargar elecciones_modalidad real (o fallback local)
      let modData = [];
      try {
        const { data, error } = await supabase
          .from('elecciones_modalidad')
          .select('*');
        if (!error && data) {
          modData = data;
        } else if (error && error.code !== 'PGRST116') {
          console.warn("Fallo query a elecciones_modalidad, se usará fallback local:", error);
        }
      } catch (err) {
        console.warn("Excepción al consultar elecciones_modalidad, usando fallback:", err);
      }

      if (modData.length === 0) {
        // Fallback local: recuperar del localStorage para los estudiantes cargados
        const fallbackList = [];
        (stdData || []).forEach(st => {
          const cached = localStorage.getItem(`modalidad_${st.id}`);
          if (cached) {
            fallbackList.push({
              alumno_id: st.id,
              modalidad: cached,
              created_at: new Date().toISOString()
            });
          }
        });
        modData = fallbackList;
      }
      setEleccionesModalidad(modData);

      // Registrar hora exacta de última actualización
      const now = new Date();
      const timeString = now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      setLastUpdated(timeString);

    } catch (err) {
      console.error("Error al cargar datos administrativos:", err);
      setErrorMsg("Error de conexión: No se pudieron sincronizar los datos reales de Supabase: " + err.message);
    } finally {
      setLoading(false);
    }
  };
  // Abrir postulaciones por nivel (3M / 4M)
  const handleOpenProcess = async (nivelDestino) => {
    const activeProcess = nivelDestino === '3M' ? activeProcess3M : activeProcess4M;
    const label = nivelDestino === '3M' ? '3° Medio' : '4° Medio';
    console.log(`handleOpenProcess para ${nivelDestino} llamado. Proceso actual:`, activeProcess);
    try {
      if (activeProcess) {
        console.log("Abriendo proceso existente con ID:", activeProcess.id);
        const { data, error } = await supabase
          .from('procesos')
          .update({ activo: true })
          .eq('id', activeProcess.id)
          .select();

        if (error) throw error;
        showToast(`Proceso de postulaciones para ${label} abierto correctamente.`, 'success');
      } else {
        console.log(`Creando y abriendo nuevo proceso Toma de Electivos ${label}...`);
        const { data, error } = await supabase
          .from('procesos')
          .insert({
            nombre: `Toma de Electivos ${label} 2026`,
            activo: true,
            nivel_destino: nivelDestino
          })
          .select();

        if (error) throw error;
        showToast(`Proceso 'Toma de Electivos ${label} 2026' creado y abierto correctamente.`, 'success');
      }
      await fetchAdminData(false);
    } catch (err) {
      console.error(`Error en handleOpenProcess (${nivelDestino}):`, err);
      showToast("Error al abrir proceso: " + err.message, 'error');
    }
  };

  // Lookup Helpers for Client-Side Crossing
  const handleCloseProcess = async (nivelDestino) => {
    const activeProcess = nivelDestino === '3M' ? activeProcess3M : activeProcess4M;
    const label = nivelDestino === '3M' ? '3° Medio' : '4° Medio';
    console.log(`handleCloseProcess para ${nivelDestino} called. Proceso actual:`, activeProcess);
    if (!activeProcess) {
      console.log(`No hay proceso definido para cerrar en ${nivelDestino}.`);
      return;
    }

    showConfirm(
      `¿Seguro que deseas cerrar el proceso de selección de electivos de ${label}? Los estudiantes ya no podrán realizar postulaciones para este nivel.`,
      async () => {
        try {
          console.log("Cerrando proceso en Supabase para ID:", activeProcess.id);
          const { data, error } = await supabase
            .from('procesos')
            .update({ activo: false })
            .eq('id', activeProcess.id)
            .select();

          console.log("Respuesta de Supabase update (Cerrar):", { data, error });

          if (!error && (!data || data.length === 0)) {
            console.warn("La actualización por ID no devolvió filas. Ejecutando actualización global de seguridad...");
            const { error: globalErr } = await supabase
              .from('procesos')
              .update({ activo: false })
              .eq('activo', true)
              .eq('nivel_destino', nivelDestino);
            if (globalErr) throw globalErr;
          } else if (error) {
            throw error;
          }

          showToast(`Proceso de postulaciones para ${label} cerrado correctamente.`, 'success');
          await fetchAdminData(false);
        } catch (err) {
          console.error(`Error en handleCloseProcess (${nivelDestino}):`, err);
          showToast("Error al cerrar proceso: " + err.message, 'error');
        }
      }
    );
  };
  // Lookup Helpers for Client-Side Crossing
  const getAlumnoName = (alumnoId) => {
    const student = students.find(s => s.id === alumnoId);
    return student ? formatNombre(student.nombre_completo) : 'Desconocido';
  };
  const getAlumnoEmail = (alumnoId) => {
    const student = students.find(s => s.id === alumnoId);
    return student ? student.correo : 'Sin Correo';
  };

  const getAlumnoCurso = (alumnoId) => {
    const student = students.find(s => s.id === alumnoId);
    return student ? student.curso_actual : '—';
  };

  const getAlumnoRut = (alumnoId) => {
    const student = students.find(s => s.id === alumnoId);
    return student ? student.rut : '—';
  };

  // Abrir Modal para editar una asignación de electivo individual
  const handleOpenEditPostulacionModal = (postItem) => {
    setEditingPostulacion(postItem);
    setNewElectiveId(postItem.electivo_id);
  };

  // Guardar la edición de una asignación de electivo en Supabase
  const handleSavePostulacionEdit = async (e) => {
    e.preventDefault();
    if (!newElectiveId || !editingPostulacion) return;
    setSavingPostulacion(true);
    try {
      const { data, error } = await supabase
        .from('postulaciones')
        .update({ electivo_id: newElectiveId })
        .eq('id', editingPostulacion.id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        throw new Error("No tienes permisos suficientes en Supabase (Políticas RLS) para actualizar esta postulación. Por favor ejecuta el script de políticas de actualización (UPDATE) en tu editor de SQL en Supabase.");
      }

      showToast("Asignación de electivo actualizada con éxito.", 'success');
      setEditingPostulacion(null);
      await fetchAdminData(false);
    } catch (err) {
      showToast("Error al actualizar la postulación: " + err.message, 'error');
    } finally {
      setSavingPostulacion(false);
    }
  };

  const getElectiveName = (electiveId) => {
    const el = electives.find(e => e.id === electiveId);
    return el ? el.nombre : 'Desconocido';
  };

  const getScheduleName = (horarioId) => {
    const hor = horarios.find(h => h.id === horarioId || String(h.id) === String(horarioId));
    return hor ? hor.nombre : `Horario ${horarioId}`;
  };

  const getAreaCode = (areaId) => {
    const ar = areas.find(a => a.id === areaId || String(a.id) === String(areaId));
    return ar ? ar.codigo : areaId;
  };

  // Guardar creación o edición de electivo directamente en Supabase
  const handleSaveElective = async (e) => {
    e.preventDefault();
    try {
      const dbPayload = {
        nombre: currentElective.nombre,
        descripcion: currentElective.descripcion,
        docente: currentElective.docente,
        cupos_maximos: parseInt(currentElective.cupos_maximos, 10),
        horario_id: currentElective.horario_id,
        area_id: currentElective.area_id,
        activo: currentElective.activo,
        nivel_destino: currentElective.nivel_destino || '3M'
      };
      if (modalType === 'create') {
        const { error } = await supabase.from('electivos').insert(dbPayload);
        if (error) throw error;
        showToast("Electivo creado exitosamente.", 'success');
      } else {
        const { error } = await supabase.from('electivos').update(dbPayload).eq('id', currentElective.id);
        if (error) throw error;
        showToast("Electivo actualizado exitosamente.", 'success');
      }

      await fetchAdminData(false);
      setShowModal(false);
    } catch (err) {
      showToast("Error al guardar electivo: " + err.message, 'error');
    }
  };


  // Eliminar Electivo real
  const handleDeleteElective = async (id) => {
    showConfirm(
      "¿Seguro que deseas eliminar este electivo? Esto podría romper referencias si ya hay postulados.",
      async () => {
        try {
          const { error } = await supabase.from('electivos').delete().eq('id', id);
          if (error) throw error;
          showToast("Electivo eliminado.", 'success');
          await fetchAdminData(false);
        } catch (err) {
          showToast("Error al eliminar: " + err.message, 'error');
        }
      }
    );
  };

  // Eliminar Postulación (Admin Override real - libera todos los cupos del alumno para permitirle postular de nuevo)
  const handleDeletePostulacion = async (postItem) => {
    const studentName = getAlumnoName(postItem.alumno_id);
    showConfirm(
      `¿Liberar completamente la selección de electivos y modalidad del alumno ${studentName}? Esto eliminará sus postulaciones, liberará sus cupos y borrará su modalidad elegida para que pueda iniciar de nuevo en el portal.`,
      async () => {
        try {
          // 1. Borrar postulaciones
          const { error: postErr } = await supabase.from('postulaciones').delete().eq('alumno_id', postItem.alumno_id);
          if (postErr) throw postErr;

          // 2. Borrar elecciones_modalidad
          const { data: modData, error: modErr } = await supabase
            .from('elecciones_modalidad')
            .delete()
            .eq('alumno_id', postItem.alumno_id)
            .select();
          if (modErr && modErr.code !== 'PGRST116') throw modErr;

          // 3. Resetear ya_postulo y estado_correo en la tabla alumnos
          const { data: alumData, error: alumErr } = await supabase
            .from('alumnos')
            .update({ ya_postulo: false, estado_correo: 'pendiente' })
            .eq('id', postItem.alumno_id)
            .select();
          
          if (alumErr) throw alumErr;

          // Si el update se completó pero afectó 0 filas, indica que una política RLS lo está bloqueando silenciosamente
          if (!alumData || alumData.length === 0) {
            throw new Error("El sistema no tiene permisos suficientes para actualizar la tabla 'alumnos' (RLS en Supabase bloqueó la consulta silenciosamente).");
          }

          // 4. Borrar del localStorage local
          localStorage.removeItem(`modalidad_${postItem.alumno_id}`);

          showToast(`Selección y modalidad de ${studentName} reiniciadas correctamente.`, 'success');
          await fetchAdminData(false);
        } catch (err) {
          showToast("Error al liberar estudiante: " + err.message, 'error');
        }
      }
    );
  };

  // Reiniciar selección desde el Roster General de alumnos
  const handleResetStudentSelections = async (student) => {
    const formattedName = formatNombre(student.nombre_completo);
    showConfirm(
      `¿Seguro que deseas reiniciar completamente el proceso de ${formattedName}? Esto eliminará sus postulaciones de electivos y borrará su modalidad declarada (TP / CH) para que pueda iniciar desde cero.`,
      async () => {
        try {
          // 1. Borrar postulaciones
          const { error: postErr } = await supabase.from('postulaciones').delete().eq('alumno_id', student.id);
          if (postErr) throw postErr;

          // 2. Borrar elecciones_modalidad
          const { data: modData, error: modErr } = await supabase
            .from('elecciones_modalidad')
            .delete()
            .eq('alumno_id', student.id)
            .select();
          if (modErr && modErr.code !== 'PGRST116') throw modErr;

          // 3. Resetear ya_postulo y estado_correo en la tabla alumnos
          const { data: alumData, error: alumErr } = await supabase
            .from('alumnos')
            .update({ ya_postulo: false, estado_correo: 'pendiente' })
            .eq('id', student.id)
            .select();
          
          if (alumErr) throw alumErr;

          // Si el update se completó pero afectó 0 filas, indica que una política RLS lo está bloqueando silenciosamente
          if (!alumData || alumData.length === 0) {
            throw new Error("El sistema no tiene permisos suficientes para actualizar la tabla 'alumnos' (RLS en Supabase bloqueó la consulta silenciosamente).");
          }

          // 4. Borrar del localStorage local
          localStorage.removeItem(`modalidad_${student.id}`);

          showToast(`Proceso y modalidad de ${formattedName} reiniciados con éxito.`, 'success');
          await fetchAdminData(false);
        } catch (err) {
          showToast("Error al reiniciar estudiante: " + err.message, 'error');
        }
      }
    );
  };


  // Abrir Modal para crear
  const openCreateModal = (defaultNivel = '3M') => {
    setModalType('create');
    setCurrentElective({
      id: null,
      nombre: '',
      descripcion: '',
      docente: '',
      cupos_maximos: 35,
      horario_id: horarios && horarios.length > 0 ? horarios[0].id : '1',
      area_id: areas && areas.length > 0 ? areas[0].id : 'A',
      activo: true,
      nivel_destino: defaultNivel
    });
    setShowModal(true);
  };

  // Abrir Modal para editar
  const openEditModal = (el) => {
    setModalType('edit');
    setCurrentElective({
      id: el.id,
      nombre: el.nombre ?? "",
      descripcion: el.descripcion ?? "",
      docente: el.docente ?? "",
      cupos_maximos: el.cupos_maximos ?? 35,
      horario_id: el.horario_id ?? "",
      area_id: el.area_id ?? "",
      activo: el.activo ?? true,
      nivel_destino: el.nivel_destino ?? "3M"
    });
    setShowModal(true);
  };

  // Exportar reporte de Roster por nivel (3M o 4M) a formato Excel (.xlsx) con múltiples pestañas
  const handleExportExcel = (nivelDestino) => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Filtrar los electivos asociados a este nivel
      const levelElectives = electives.filter(e => e.nivel_destino === nivelDestino);

      // --- PESTAÑA 1: Resumen General ---
      const summaryData = [
        ["REPORTES Y ROSTER DE POSTULACIÓN ELECTIVOS 2026", ""],
        ["Liceo Arturo Alessandri Palma - Providencia", ""],
        ["Nivel Destino:", nivelDestino === '3M' ? "3° Medio (3M)" : "4° Medio (4M)"],
        ["Fecha de Generación:", new Date().toLocaleString('es-CL')],
        ["", ""],
        ["Asignatura / Modalidad", "Estudiantes Inscritos / Seleccionados"]
      ];

      // Sumar conteo por cada asignatura electiva
      levelElectives.forEach(el => {
        const enrolledCount = postulaciones.filter(p => p.electivo_id === el.id).length;
        summaryData.push([el.nombre, enrolledCount]);
      });

      // Sumar conteo de alumnos de modalidad Técnico Profesional (Gastronomía)
      const tpRecords = eleccionesModalidad.filter(em => {
        const st = students.find(s => s.id === em.alumno_id);
        return em.modalidad === 'tecnico_profesional_gastronomia' && st && getStudentNivelDestino(st.curso_actual) === nivelDestino;
      });
      summaryData.push(["Técnico Profesional (Gastronomía)", tpRecords.length]);

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      
      // Autoajustar ancho de columnas para Resumen
      wsSummary['!cols'] = [
        { wch: 48 },
        { wch: 35 }
      ];

      XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen General");

      // --- PESTAÑAS INDIVIDUALES POR CADA ELECTIVO ---
      levelElectives.forEach(el => {
        const elPosts = postulaciones.filter(p => p.electivo_id === el.id);
        const sheetRows = [];

        // Encabezado de la hoja
        sheetRows.push([
          "Nº", "RUT", "Nombre completo", "Curso actual", "Correo", "Horario", "Área", "Electivo", "Nivel destino"
        ]);

        elPosts.forEach((post, index) => {
          const st = students.find(s => s.id === post.alumno_id);
          if (st) {
            const schedule = horarios.find(h => h.id === post.horario_id || String(h.id) === String(post.horario_id))?.nombre || `Horario ${post.horario_id}`;
            const areaCode = getAreaCode(el.area_id);
            sheetRows.push([
              index + 1,
              st.rut || "—",
              formatNombre(st.nombre_completo),
              st.curso_actual || "—",
              st.correo || "—",
              schedule,
              `Área ${areaCode}`,
              el.nombre,
              nivelDestino
            ]);
          }
        });

        const ws = XLSX.utils.aoa_to_sheet(sheetRows);

        // Congelar primera fila (Header)
        ws['!views'] = [{ state: 'frozen', ySplit: 1 }];

        // Autoajustar ancho de las columnas según contenido
        const maxCols = sheetRows[0] ? sheetRows[0].length : 0;
        const colWidths = [];
        for (let c = 0; c < maxCols; c++) {
          let maxLen = 10;
          sheetRows.forEach(row => {
            const val = row[c] ? String(row[c]) : "";
            if (val.length > maxLen) maxLen = val.length;
          });
          colWidths.push({ wch: maxLen + 3 });
        }
        ws['!cols'] = colWidths;

        // Limitar nombre de pestaña a 30 caracteres para evitar errores en Excel
        let sheetName = el.nombre.substring(0, 25);
        let finalSheetName = sheetName;
        let counter = 1;
        while (wb.SheetNames.includes(finalSheetName)) {
          finalSheetName = `${sheetName.substring(0, 22)} (${counter++})`;
        }

        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
      });

      // --- PESTAÑA: TP GASTRONOMÍA ---
      const tpRows = [
        ["Nº", "RUT", "Nombre completo", "Curso actual", "Correo", "Modalidad", "Nivel destino", "Fecha selección"]
      ];

      tpRecords.forEach((rec, index) => {
        const st = students.find(s => s.id === rec.alumno_id);
        if (st) {
          const dateStr = rec.created_at ? new Date(rec.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
          tpRows.push([
            index + 1,
            st.rut || "—",
            formatNombre(st.nombre_completo),
            st.curso_actual || "—",
            st.correo || "—",
            "Técnico Profesional (Gastronomía)",
            nivelDestino,
            dateStr
          ]);
        }
      });

      const wsTP = XLSX.utils.aoa_to_sheet(tpRows);

      // Congelar primera fila
      wsTP['!views'] = [{ state: 'frozen', ySplit: 1 }];

      // Autoajustar ancho de columnas para TP
      const tpMaxCols = tpRows[0] ? tpRows[0].length : 0;
      const tpColWidths = [];
      for (let c = 0; c < tpMaxCols; c++) {
        let maxLen = 10;
        tpRows.forEach(row => {
          const val = row[c] ? String(row[c]) : "";
          if (val.length > maxLen) maxLen = val.length;
        });
        tpColWidths.push({ wch: maxLen + 3 });
      }
      wsTP['!cols'] = tpColWidths;

      XLSX.utils.book_append_sheet(wb, wsTP, "TP Gastronomía");

      // --- GUARDAR ARCHIVO EXCEL ---
      XLSX.writeFile(wb, `roster_electivos_${nivelDestino}.xlsx`);
      showToast(`Roster ${nivelDestino} (.xlsx) exportado exitosamente.`, 'success');
    } catch (err) {
      console.error("Error al exportar Excel:", err);
      showToast("Error al generar el reporte Excel: " + err.message, 'error');
    }
  };

  const handleOpenEditStudentModal = (student) => {
    setEditingStudent({ ...student });
    setShowStudentModal(true);
  };

  const handleSaveStudentDetails = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('alumnos')
        .update({
          nombre_completo: editingStudent.nombre_completo,
          rut: editingStudent.rut,
          correo: editingStudent.correo,
          curso_actual: editingStudent.curso_actual,
          correo_apoderado_1: editingStudent.correo_apoderado_1,
          correo_apoderado_2: editingStudent.correo_apoderado_2
        })
        .eq('id', editingStudent.id);

      if (error) throw error;

      showToast("Datos del estudiante actualizados con éxito.", "success");
      setShowStudentModal(false);
      fetchAdminData(false); // Refrescar de forma silenciosa de fondo
    } catch (err) {
      console.error("Error al actualizar alumno:", err);
      showToast("No se pudieron guardar los cambios: " + err.message, "error");
    }
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
  // Calcular estadísticas reales filtradas por nivel
  const filteredStudentsForStats = students.filter(st => {
    const stNivel = getStudentNivelDestino(st.curso_actual);
    if (statsFilter === 'all') return stNivel !== null;
    return stNivel === statsFilter;
  });

  const filteredCuposForStats = cupos.filter(c => {
    const el = electives.find(e => e.id === c.electivo_id || e.id === c.id);
    if (statsFilter === 'all') return true;
    return el?.nivel_destino === statsFilter;
  });

  const filteredWaitlistForStats = waitlist.filter(w => {
    const el = electives.find(e => e.id === w.electivo_id);
    if (statsFilter === 'all') return true;
    return el?.nivel_destino === statsFilter;
  });

  const totalStudentsCount = filteredStudentsForStats.length;
  const completedStudentsCount = filteredStudentsForStats.filter(st => postulaciones.some(p => p.alumno_id === st.id)).length;
  const pendingStudentsCount = totalStudentsCount - completedStudentsCount;
  const participationRate = totalStudentsCount > 0 ? Math.round((completedStudentsCount / totalStudentsCount) * 100) : 0;

  // Contar reservas temporales activas de acuerdo al filtro
  const activeTempReservationsCount = temporaryReservations.filter(r => {
    if (statsFilter === 'all') return true;
    const matchedEl = electives.find(e => e.id === r.electivo_id);
    return matchedEl?.nivel_destino === statsFilter;
  }).length;

  const totalSeatsCapacity = filteredCuposForStats.reduce((acc, c) => acc + (c.cupos_maximos || 0), 0);
  const totalSeatsOccupied = filteredCuposForStats.reduce((acc, c) => acc + (c.cupos_ocupados || 0), 0);
  
  // Cupos estrictamente libres (restando postulaciones y reservas temporales)
  const totalSeatsRemaining = Math.max(0, totalSeatsCapacity - totalSeatsOccupied - activeTempReservationsCount);
  const totalWaitlistedCount = filteredWaitlistForStats.length;

  if (loading) {
    return (
      <div className="laap-loading-container">
        <div className="laap-spinner"></div>
        <p>Cargando panel de administración UTP...</p>
      </div>
    );
  }

  return (
    <div className="laap-admin-dashboard">
      <Navbar />

      {/* Estilo auto-contenido para animación de pulso */}
      <style>{`
        @keyframes laap-pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 currentColor; opacity: 0.7; }
          70% { transform: scale(1); box-shadow: 0 0 0 5px rgba(0,0,0,0); opacity: 1; }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(0,0,0,0); opacity: 0.7; }
        }
      `}</style>

      <main className="admin-dashboard-main">
        {errorMsg && (
          <div style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid #ef4444',
            color: '#f87171',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            ⚠️ {errorMsg}
            <button
              onClick={() => fetchAdminData(true)}
              style={{ background: 'none', border: 'none', color: '#60a5fa', textDecoration: 'underline', cursor: 'pointer', marginLeft: '8px', padding: 0 }}
            >
              Reintentar Consulta
            </button>
          </div>
        )}

        {/* Encabezado y Descarga */}
        <div className="admin-header-row animate-fadeIn">
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0 }}>Dashboard Administrativo UTP</h1>
              <p>Control del proceso, asignación de vacantes y visualización en tiempo real.</p>
            </div>
            {getUpdateIndicator()}
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="laap-btn-success" onClick={() => handleExportExcel('3M')} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={18} />
              <span>Exportar Roster 3M (.xlsx)</span>
            </button>
            <button className="laap-btn-success" onClick={() => handleExportExcel('4M')} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0d9488', borderColor: '#0d9488' }}>
              <FileSpreadsheet size={18} />
              <span>Exportar Roster 4M (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* TARJETAS SUPERIORES: ESTADOS DE LOS PROCESOS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '20px',
          marginBottom: '24px'
        }} className="animate-fadeIn">
          {/* Proceso 3M */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            boxShadow: 'var(--shadow-subtle)'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                Proceso futuro 3° Medio
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                (Para alumnos actuales de 2° Medio)
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: activeProcess3M?.activo ? '#10b981' : '#f59e0b',
                  display: 'inline-block'
                }} />
                <strong style={{ fontSize: '13px', color: activeProcess3M?.activo ? '#10b981' : '#f59e0b' }}>
                  {activeProcess3M?.activo ? 'ABIERTO' : 'CERRADO'}
                </strong>
              </div>
              {activeProcess3M?.activo ? (
                <button
                  onClick={() => handleCloseProcess('3M')}
                  className="laap-btn-danger"
                  style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }}
                >
                  Cerrar
                </button>
              ) : (
                <button
                  onClick={() => handleOpenProcess('3M')}
                  className="laap-btn-success"
                  style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }}
                >
                  Abrir
                </button>
              )}
            </div>
          </div>

          {/* Proceso 4M */}
          <div style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            boxShadow: 'var(--shadow-subtle)'
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                Proceso futuro 4° Medio
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
                (Para alumnos actuales de 3° Medio)
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: activeProcess4M?.activo ? '#10b981' : '#f59e0b',
                  display: 'inline-block'
                }} />
                <strong style={{ fontSize: '13px', color: activeProcess4M?.activo ? '#10b981' : '#f59e0b' }}>
                  {activeProcess4M?.activo ? 'ABIERTO' : 'CERRADO'}
                </strong>
              </div>
              {activeProcess4M?.activo ? (
                <button
                  onClick={() => handleCloseProcess('4M')}
                  className="laap-btn-danger"
                  style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }}
                >
                  Cerrar
                </button>
              ) : (
                <button
                  onClick={() => handleOpenProcess('4M')}
                  className="laap-btn-success"
                  style={{ margin: 0, padding: '6px 12px', fontSize: '12px' }}
                >
                  Abrir
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pestañas de Navegación */}
        <div className="admin-tabs">
          <button
            className={`admin-tab-btn ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            <BarChart3 size={16} />
            <span>Estadísticas</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'postulaciones' ? 'active' : ''}`}
            onClick={() => setActiveTab('postulaciones')}
          >
            <CheckCircle size={16} />
            <span>Postulaciones ({postulaciones.length / 3})</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'lista_espera' ? 'active' : ''}`}
            onClick={() => setActiveTab('lista_espera')}
          >
            <ListOrdered size={16} />
            <span>Listas de Espera ({waitlist.length})</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'electivos_3m' ? 'active' : ''}`}
            onClick={() => setActiveTab('electivos_3m')}
          >
            <BookOpen size={16} />
            <span>Gestionar 3° Medio ({electives.filter(e => e.nivel_destino === '3M').length})</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'electivos_4m' ? 'active' : ''}`}
            onClick={() => setActiveTab('electivos_4m')}
          >
            <BookOpen size={16} />
            <span>Gestionar 4° Medio ({electives.filter(e => e.nivel_destino === '4M').length})</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'alumnos' ? 'active' : ''}`}
            onClick={() => setActiveTab('alumnos')}
          >
            <Users size={16} />
            <span>Roster Alumnos ({students.length})</span>
          </button>
          <button
            className={`admin-tab-btn ${activeTab === 'modalidades_tp' ? 'active' : ''}`}
            onClick={() => setActiveTab('modalidades_tp')}
          >
            <GraduationCap size={16} />
            <span>Modalidades TP ({eleccionesModalidad.filter(m => m.modalidad === 'tecnico_profesional_gastronomia').length})</span>
          </button>
        </div>

        {/* SECCIÓN 1: ESTADÍSTICAS */}
        {activeTab === 'stats' && (
          <div className="admin-tab-content animate-fadeIn">
            {/* Filtro de estadísticas por nivel */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '20px',
              boxShadow: 'var(--shadow-subtle)'
            }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-secondary)' }}>
                Filtrar métricas y KPIs generales:
              </span>
              <select
                value={statsFilter}
                onChange={(e) => setStatsFilter(e.target.value)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-input)',
                  color: 'var(--text-primary)',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                <option value="all">Mostrar Ambos Niveles (Todos)</option>
                <option value="3M">Proceso 3° Medio (Futuro)</option>
                <option value="4M">Proceso 4° Medio (Futuro)</option>
              </select>
            </div>

            {/* Tarjetas KPI */}
            <div className="kpi-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div className="kpi-card">
                <span className="kpi-label">Matrícula Estudiantes</span>
                <span className="kpi-value">{totalStudentsCount}</span>
                <span className="kpi-trend">Roster total en el sistema</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Participación (Final)</span>
                <span className="kpi-value">{participationRate}%</span>
                <div className="participation-bar-wrapper">
                  <div className="participation-bar" style={{ width: `${participationRate}%` }} />
                </div>
                <span className="kpi-trend">
                  {completedStudentsCount} listos / {pendingStudentsCount} pendientes
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Reservas Temporales</span>
                <span className="kpi-value" style={{ color: '#fbbf24' }}>{activeTempReservationsCount}</span>
                <span className="kpi-trend">Cupos retenidos por 1 min</span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Cupos Libres Reales</span>
                <span className="kpi-value" style={{ color: '#34d399' }}>{totalSeatsRemaining}</span>
                <span className="kpi-trend">
                  Resta postulaciones y reservas
                </span>
              </div>
              <div className="kpi-card">
                <span className="kpi-label">Lista de Espera</span>
                <span className="kpi-value">{totalWaitlistedCount}</span>
                <span className="kpi-trend">Esperando liberación</span>
              </div>
            </div>
            {/* Ocupación por Electivos */}
            <div className="admin-section-card">
              <h2>Monitoreo de Vacantes por Asignatura</h2>
              <p style={{ marginBottom: '24px' }}>Capacidad real y demanda inmediata de cada electivo por nivel.</p>

              <div className="monitoreo-columnas-container" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
                gap: '24px'
              }}>
                {/* COLUMNA 1: 3° MEDIO */}
                <div className="monitoreo-columna">
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: '#60a5fa',
                    borderBottom: '2px solid rgba(59, 130, 246, 0.15)',
                    paddingBottom: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <BookOpen size={16} />
                    Asignaturas 3° Medio (3M)
                  </h3>
                  <div className="stats-electives-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const electives3M = cupos.filter(c => {
                        const el = electives.find(e => e.id === c.electivo_id || e.id === c.id);
                        return el?.nivel_destino === '3M';
                      });

                      if (electives3M.length === 0) {
                        return <div style={{ textAlign: 'center', padding: '16px', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>No hay registros para 3M.</div>;
                      }

                      return electives3M.map(el => {
                        const activeTempForEl = temporaryReservations.filter(r => r.electivo_id === el.electivo_id || r.electivo_id === el.id);
                        const tempCount = activeTempForEl.length;
                        const livePercent = el.cupos_maximos > 0 ? Math.round(((el.cupos_ocupados + tempCount) / el.cupos_maximos) * 100) : 0;
                        const order = el.horario_orden || 1;
                        return (
                          <div key={el.electivo_id || el.id} className="stat-elective-row" style={{ borderLeft: `5px solid ${String(order) === '1' ? '#d97706' : String(order) === '2' ? '#db2777' : '#2563eb'}`, padding: '12px 16px', margin: 0 }}>
                            <div className="stat-el-info">
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '13.5px' }}>{el.nombre}</strong>
                                {tempCount > 0 && (
                                  <span style={{
                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                    border: '1px solid #f59e0b',
                                    color: '#fbbf24',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '9.5px',
                                    fontWeight: 'bold',
                                    marginLeft: '8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    <Clock size={10} /> {tempCount} reservado(s) temp.
                                  </span>
                                )}
                              </div>
                              <span className="stat-el-sub" style={{ fontSize: '11px', marginTop: '2px' }}>
                                {el.horario_nombre || `Horario ${order}`} | Área {el.area_codigo || 'A'} | {el.profesor || el.docente || 'Docente UTP'}
                              </span>
                            </div>

                            <div className="stat-el-progress-col" style={{ width: '100%', gap: '10px', marginTop: '8px' }}>
                              <div className="stat-progress-bar-container" style={{ height: '8px' }}>
                                <div className={`stat-progress-bar ${livePercent >= 100 ? 'full' : ''}`} style={{ width: `${livePercent}%` }} />
                              </div>
                              <span className="stat-percent-text" style={{ fontSize: '11px', minWidth: '105px' }}>
                                {el.cupos_ocupados} firmes {tempCount > 0 ? `+ ${tempCount} temp ` : ''}/ {el.cupos_maximos} ({livePercent}%)
                              </span>
                            </div>

                            {activeTempForEl.length > 0 && (
                              <div style={{
                                fontSize: '10px',
                                color: '#9ca3af',
                                marginTop: '8px',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                borderLeft: '2px solid #f59e0b',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}>
                                <strong style={{ color: 'var(--text-secondary)' }}>Reservas activas (expiración):</strong>
                                {activeTempForEl.map(r => {
                                  const studentObj = students.find(s => s.id === r.alumno_id);
                                  const studentName = studentObj ? studentObj.nombre_completo : 'Estudiante';
                                  const secondsLeft = Math.max(0, Math.round((new Date(r.expires_at).getTime() - Date.now()) / 1000));
                                  const mins = Math.floor(secondsLeft / 60);
                                  const secs = secondsLeft % 60;
                                  const expiryFormatted = secondsLeft > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : 'expirado';
                                  return (
                                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>• {studentName}</span>
                                      <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{expiryFormatted}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* COLUMNA 2: 4° MEDIO */}
                <div className="monitoreo-columna">
                  <h3 style={{
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: '#10b981',
                    borderBottom: '2px solid rgba(16, 185, 129, 0.15)',
                    paddingBottom: '8px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <GraduationCap size={16} style={{ color: '#10b981' }} />
                    Asignaturas 4° Medio (4M)
                  </h3>
                  <div className="stats-electives-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {(() => {
                      const electives4M = cupos.filter(c => {
                        const el = electives.find(e => e.id === c.electivo_id || e.id === c.id);
                        return el?.nivel_destino === '4M';
                      });

                      if (electives4M.length === 0) {
                        return <div style={{ textAlign: 'center', padding: '16px', color: '#9ca3af', fontSize: '13px', fontStyle: 'italic' }}>No hay registros para 4M.</div>;
                      }

                      return electives4M.map(el => {
                        const activeTempForEl = temporaryReservations.filter(r => r.electivo_id === el.electivo_id || r.electivo_id === el.id);
                        const tempCount = activeTempForEl.length;
                        const livePercent = el.cupos_maximos > 0 ? Math.round(((el.cupos_ocupados + tempCount) / el.cupos_maximos) * 100) : 0;
                        const order = el.horario_orden || 1;
                        return (
                          <div key={el.electivo_id || el.id} className="stat-elective-row" style={{ borderLeft: `5px solid ${String(order) === '1' ? '#d97706' : String(order) === '2' ? '#db2777' : '#2563eb'}`, padding: '12px 16px', margin: 0 }}>
                            <div className="stat-el-info">
                              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '13.5px' }}>{el.nombre}</strong>
                                {tempCount > 0 && (
                                  <span style={{
                                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                                    border: '1px solid #f59e0b',
                                    color: '#fbbf24',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontSize: '9.5px',
                                    fontWeight: 'bold',
                                    marginLeft: '8px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px'
                                  }}>
                                    <Clock size={10} /> {tempCount} reservado(s) temp.
                                  </span>
                                )}
                              </div>
                              <span className="stat-el-sub" style={{ fontSize: '11px', marginTop: '2px' }}>
                                {el.horario_nombre || `Horario ${order}`} | Área {el.area_codigo || 'A'} | {el.profesor || el.docente || 'Docente UTP'}
                              </span>
                            </div>

                            <div className="stat-el-progress-col" style={{ width: '100%', gap: '10px', marginTop: '8px' }}>
                              <div className="stat-progress-bar-container" style={{ height: '8px' }}>
                                <div className={`stat-progress-bar ${livePercent >= 100 ? 'full' : ''}`} style={{ width: `${livePercent}%` }} />
                              </div>
                              <span className="stat-percent-text" style={{ fontSize: '11px', minWidth: '105px' }}>
                                {el.cupos_ocupados} firmes {tempCount > 0 ? `+ ${tempCount} temp ` : ''}/ {el.cupos_maximos} ({livePercent}%)
                              </span>
                            </div>

                            {activeTempForEl.length > 0 && (
                              <div style={{
                                fontSize: '10px',
                                color: '#9ca3af',
                                marginTop: '8px',
                                padding: '6px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                                borderLeft: '2px solid #f59e0b',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '2px'
                              }}>
                                <strong style={{ color: 'var(--text-secondary)' }}>Reservas activas (expiración):</strong>
                                {activeTempForEl.map(r => {
                                  const studentObj = students.find(s => s.id === r.alumno_id);
                                  const studentName = studentObj ? studentObj.nombre_completo : 'Estudiante';
                                  const secondsLeft = Math.max(0, Math.round((new Date(r.expires_at).getTime() - Date.now()) / 1000));
                                  const mins = Math.floor(secondsLeft / 60);
                                  const secs = secondsLeft % 60;
                                  const expiryFormatted = secondsLeft > 0 ? `${mins}:${String(secs).padStart(2, '0')}` : 'expirado';
                                  return (
                                    <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                      <span>• {studentName}</span>
                                      <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>{expiryFormatted}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* SECCIÓN 2: POSTULACIONES */}
        {activeTab === 'postulaciones' && (
          <div className="admin-tab-content animate-fadeIn">
            <div className="admin-section-card">
              <div className="card-filter-row">
                <h2>Récord de Postulaciones Registradas</h2>
                <div className="filters-wrapper">
                  <div className="search-box">
                    <Search size={16} />
                    <input
                      type="text"
                      placeholder="Buscar alumno..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="table-responsive">
                <table className="laap-admin-table">
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Curso</th>
                      <th>Asignatura</th>
                      <th>Horario</th>
                      <th>Área</th>
                      <th>Fecha de Registro</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {postulaciones.length === 0 ? (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: '24px' }}>No hay registros disponibles.</td>
                      </tr>
                    ) : (
                      postulaciones
                        .filter(p => getAlumnoName(p.alumno_id).toLowerCase().includes(searchQuery.toLowerCase()))
                        .map(p => {
                          const blockColor = String(p.horario_id) === '1' ? '#fff6db' : String(p.horario_id) === '2' ? '#f7e7ef' : '#e8f1fb';
                          const matchedElective = electives.find(e => e.id === p.electivo_id) || {};
                          return (
                            <tr key={p.id} style={{ backgroundColor: blockColor }}>
                              <td>
                                <strong>{getAlumnoName(p.alumno_id)}</strong><br />
                                <small style={{ display: 'block', color: 'var(--text-secondary)' }}>{getAlumnoEmail(p.alumno_id)}</small>
                                <small style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 'bold' }}>RUT: {getAlumnoRut(p.alumno_id)}</small>
                              </td>
                              <td>{getAlumnoCurso(p.alumno_id)}</td>
                              <td>{getElectiveName(p.electivo_id)}</td>
                              <td>{getScheduleName(p.horario_id)}</td>
                              <td>
                                <span className={`area-badge area-${matchedElective.area_id || 'A'}`}>
                                  Área {getAreaCode(matchedElective.area_id || 'A')}
                                </span>
                              </td>
                              <td>{new Date(p.created_at).toLocaleString('es-CL')}</td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px' }}>
                                  <button
                                    className="btn-table-edit"
                                    onClick={() => handleOpenEditPostulacionModal(p)}
                                    title="Modificar asignatura de esta postulación"
                                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', height: '28px', margin: 0 }}
                                  >
                                    <Edit3 size={12} />
                                    <span>Editar</span>
                                  </button>
                                  <button
                                    className="btn-table-danger"
                                    onClick={() => handleDeletePostulacion(p)}
                                    title="Liberar selección completa de este alumno"
                                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', height: '28px', margin: 0 }}
                                  >
                                    <Trash2 size={12} />
                                    <span>Liberar</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 3: LISTAS DE ESPERA */}
        {activeTab === 'lista_espera' && (
          <div className="admin-tab-content animate-fadeIn">
            <div className="admin-section-card">
              <h2>Alumnos Registrados en Lista de Espera</h2>
              <p>Seguimiento de estudiantes en cola de espera por falta de vacante.</p>

              <div className="table-responsive">
                <table className="laap-admin-table">
                  <thead>
                    <tr>
                      <th>Estudiante</th>
                      <th>Curso</th>
                      <th>Asignatura Solicitada</th>
                      <th>Horario</th>
                      <th>Fecha de Inscripción</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waitlist.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '24px' }}>No hay registros disponibles.</td>
                      </tr>
                    ) : (
                      waitlist.map(w => {
                        const matchedElective = electives.find(e => e.id === w.electivo_id) || {};
                        return (
                          <tr key={w.id}>
                            <td>
                              <strong>{getAlumnoName(w.alumno_id)}</strong><br />
                              <small style={{ display: 'block', color: 'var(--text-secondary)' }}>{getAlumnoEmail(w.alumno_id)}</small>
                              <small style={{ fontFamily: 'monospace', color: 'var(--text-secondary)', fontWeight: 'bold' }}>RUT: {getAlumnoRut(w.alumno_id)}</small>
                            </td>
                            <td>{getAlumnoCurso(w.alumno_id)}</td>
                            <td><strong>{getElectiveName(w.electivo_id)}</strong></td>
                            <td>{getScheduleName(matchedElective.horario_id || 1)}</td>
                            <td>{new Date(w.created_at).toLocaleString('es-CL')}</td>
                            <td>
                              <button
                                className="btn-table-danger"
                                onClick={async () => {
                                  if (window.confirm("¿Retirar de la lista de espera?")) {
                                    const { error } = await supabase.from('lista_espera').delete().eq('id', w.id);
                                    if (error) {
                                      alert("Error: " + error.message);
                                    } else {
                                      alert("Retirado.");
                                      await fetchAdminData(false);
                                    }
                                  }
                                }}
                              >
                                <Trash2 size={14} />
                                <span>Retirar</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 4A: GESTIONAR ELECTIVOS 3° MEDIO */}
        {activeTab === 'electivos_3m' && (
          <div className="admin-tab-content animate-fadeIn">
            <div className="admin-section-card">
              <div className="card-filter-row">
                <h2>Catálogo de Asignaturas Electivas - 3° Medio (Nivel Destino: 3M)</h2>
                <button className="laap-btn-primary" onClick={() => openCreateModal('3M')}>
                  <Plus size={16} />
                  <span>Nuevo Electivo 3M</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="laap-admin-table">
                  <thead>
                    <tr>
                      <th>Electivo</th>
                      <th>Profesor/Docente</th>
                      <th>Horario</th>
                      <th>Área</th>
                      <th>Capacidad</th>
                      <th>Inscritos</th>
                      <th>Vacantes</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {electives.filter(e => e.nivel_destino === '3M').length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>No hay registros para 3° Medio.</td>
                      </tr>
                    ) : (
                      electives
                        .filter(e => e.nivel_destino === '3M')
                        .map(el => {
                          const cupoDetail = cupos.find(c => c.electivo_id === el.id || c.id === el.id) || {};
                          const cuposOcupados = cupoDetail.cupos_ocupados || 0;
                          const cuposDisponibles = cupoDetail.cupos_disponibles !== undefined ? cupoDetail.cupos_disponibles : el.cupos_maximos;
                          return (
                            <tr key={el.id}>
                              <td>
                                <strong>{el.nombre}</strong>
                                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>{el.descripcion?.substring(0, 70)}...</small>
                              </td>
                              <td>{el.docente || 'Docente UTP'}</td>
                              <td>{getScheduleName(el.horario_id)}</td>
                              <td>
                                <span className={`area-badge area-${el.area_id}`}>
                                  Área {getAreaCode(el.area_id)}
                                </span>
                              </td>
                              <td>{el.cupos_maximos}</td>
                              <td>{cuposOcupados}</td>
                              <td>
                                <span className={`vacantes-badge ${cuposDisponibles <= 0 ? 'zero' : ''}`}>
                                  {cuposDisponibles}
                                </span>
                              </td>
                              <td>
                                <div className="btn-actions-group">
                                  <button className="btn-table-edit" onClick={() => openEditModal(el)}>
                                    <Edit3 size={14} />
                                  </button>
                                  <button className="btn-table-danger" onClick={() => handleDeleteElective(el.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECCIÓN 4B: GESTIONAR ELECTIVOS 4° MEDIO */}
        {activeTab === 'electivos_4m' && (
          <div className="admin-tab-content animate-fadeIn">
            <div className="admin-section-card">
              <div className="card-filter-row">
                <h2>Catálogo de Asignaturas Electivas - 4° Medio (Nivel Destino: 4M)</h2>
                <button className="laap-btn-primary" onClick={() => openCreateModal('4M')}>
                  <Plus size={16} />
                  <span>Nuevo Electivo 4M</span>
                </button>
              </div>

              <div className="table-responsive">
                <table className="laap-admin-table">
                  <thead>
                    <tr>
                      <th>Electivo</th>
                      <th>Profesor/Docente</th>
                      <th>Horario</th>
                      <th>Área</th>
                      <th>Capacidad</th>
                      <th>Inscritos</th>
                      <th>Vacantes</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {electives.filter(e => e.nivel_destino === '4M').length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '24px' }}>No hay registros para 4° Medio.</td>
                      </tr>
                    ) : (
                      electives
                        .filter(e => e.nivel_destino === '4M')
                        .map(el => {
                          const cupoDetail = cupos.find(c => c.electivo_id === el.id || c.id === el.id) || {};
                          const cuposOcupados = cupoDetail.cupos_ocupados || 0;
                          const cuposDisponibles = cupoDetail.cupos_disponibles !== undefined ? cupoDetail.cupos_disponibles : el.cupos_maximos;
                          return (
                            <tr key={el.id}>
                              <td>
                                <strong>{el.nombre}</strong>
                                <small style={{ color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>{el.descripcion?.substring(0, 70)}...</small>
                              </td>
                              <td>{el.docente || 'Docente UTP'}</td>
                              <td>{getScheduleName(el.horario_id)}</td>
                              <td>
                                <span className={`area-badge area-${el.area_id}`}>
                                  Área {getAreaCode(el.area_id)}
                                </span>
                              </td>
                              <td>{el.cupos_maximos}</td>
                              <td>{cuposOcupados}</td>
                              <td>
                                <span className={`vacantes-badge ${cuposDisponibles <= 0 ? 'zero' : ''}`}>
                                  {cuposDisponibles}
                                </span>
                              </td>
                              <td>
                                <div className="btn-actions-group">
                                  <button className="btn-table-edit" onClick={() => openEditModal(el)}>
                                    <Edit3 size={14} />
                                  </button>
                                  <button className="btn-table-danger" onClick={() => handleDeleteElective(el.id)}>
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alumnos' && (() => {
          const uniqueCursos = Array.from(new Set(students.map(s => s.curso_actual).filter(Boolean))).sort();
          const sortedHorarios = [...horarios].sort((a, b) => a.orden - b.orden);

          const filteredStudents = students.filter(st => {
            const query = rosterSearchQuery.trim().toLowerCase();
            const matchesSearch = !query ||
              (st.nombre_completo || '').toLowerCase().includes(query) ||
              (st.rut || '').toLowerCase().includes(query) ||
              (st.correo || '').toLowerCase().includes(query);
            const matchesCurso = rosterCursoFilter === 'all' || st.curso_actual === rosterCursoFilter;
            return matchesSearch && matchesCurso;
          });

          return (
            <div className="admin-tab-content animate-fadeIn">
              <div className="admin-section-card">
                <h2>Roster General de Estudiantes</h2>
                <p>Visualización del estado de postulación por cada estudiante registrado en la matrícula.</p>

                {/* Filtros de Roster */}
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  padding: '12px 16px',
                  marginBottom: '20px'
                }}>
                  {/* Caja de Búsqueda */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'rgba(0, 0, 0, 0.2)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '6px',
                    padding: '6px 12px',
                    flex: 1,
                    minWidth: '240px'
                  }}>
                    <Search size={16} style={{ color: '#9ca3af' }} />
                    <input
                      type="text"
                      placeholder="Buscar alumno por nombre, RUT o correo..."
                      value={rosterSearchQuery}
                      onChange={(e) => setRosterSearchQuery(e.target.value)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        outline: 'none',
                        width: '100%',
                        fontSize: '13px'
                      }}
                    />
                  </div>

                  {/* Filtro de Curso */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#9ca3af' }}>Curso:</span>
                    <select
                      value={rosterCursoFilter}
                      onChange={(e) => setRosterCursoFilter(e.target.value)}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)',
                        color: 'white',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      <option value="all" style={{ backgroundColor: '#1f2937' }}>Todos los Cursos</option>
                      {uniqueCursos.map(curso => (
                        <option key={curso} value={curso} style={{ backgroundColor: '#1f2937' }}>{curso}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="table-responsive">
                  <table className="laap-admin-table roster-table" style={{ tableLayout: 'fixed', width: '100%', minWidth: '1020px' }}>
                    <colgroup>
                      <col style={{ width: '135px' }} />
                      <col style={{ width: '175px' }} />
                      <col style={{ width: '55px' }} />
                      <col style={{ width: '110px' }} />
                      <col style={{ width: '110px' }} />
                      {sortedHorarios.map(h => (
                        <col key={h.id} style={{ width: '105px' }} />
                      ))}
                      {sortedHorarios.length === 0 && (
                        <>
                          <col style={{ width: '105px' }} />
                          <col style={{ width: '105px' }} />
                          <col style={{ width: '105px' }} />
                        </>
                      )}
                      <col style={{ width: '130px' }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        <th>Correo</th>
                        <th>Curso</th>
                        <th>Modalidad</th>
                        <th>Estado Formulario</th>
                        {sortedHorarios.map(h => (
                          <th key={h.id}>{h.nombre}</th>
                        ))}
                        {sortedHorarios.length === 0 && (
                          <>
                            <th>Horario 1</th>
                            <th>Horario 2</th>
                            <th>Horario 3</th>
                          </>
                        )}
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan="9" style={{ textAlign: 'center', padding: '24px' }}>No se encontraron alumnos que coincidan con la búsqueda.</td>
                        </tr>
                      ) : (
                        filteredStudents.map(st => {
                          const stPosts = postulaciones.filter(p => p.alumno_id === st.id);
                          
                          // Obtener modalidad cargada del alumno
                          const stModRecord = eleccionesModalidad.find(m => m.alumno_id === st.id);
                          const studentModality = stModRecord ? stModRecord.modalidad : null;
                          const isTP = studentModality === 'tecnico_profesional_gastronomia';
                          const isCH = studentModality === 'cientifico_humanista';
                          
                          // El proceso está finalizado/bloqueado si seleccionó TP o si tiene sus electivos seleccionados (CH completo)
                          const hasSubmitted = isTP || stPosts.length > 0;
                          const hasAnyRegistration = studentModality || stPosts.length > 0;

                          return (
                            <tr key={st.id}>
                              <td>
                                <strong style={{ fontSize: '11.5px', display: 'block', lineHeight: '1.25' }}>{formatNombre(st.nombre_completo)}</strong>
                                <span style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>RUT: {st.rut || 'No registrado'}</span>
                              </td>
                              <td>
                                <div style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontSize: '11px', fontWeight: '500' }} title={st.correo}>
                                  {st.correo}
                                </div>
                                {(st.correo_apoderado_1 || st.correo_apoderado_2) && (
                                  <div style={{ fontSize: '9.5px', color: '#60a5fa', marginTop: '4px', lineHeight: '1.2', display: 'flex', alignItems: 'center', gap: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`Apoderados: ${st.correo_apoderado_1 || '—'} / ${st.correo_apoderado_2 || '—'}`}>
                                    <span>👨‍👩‍👦</span>
                                    <span>
                                      {st.correo_apoderado_1 || '—'}
                                      {st.correo_apoderado_2 ? ` / ${st.correo_apoderado_2}` : ''}
                                    </span>
                                  </div>
                                )}
                              </td>
                              <td style={{ fontSize: '11px', textAlign: 'center', fontWeight: '600' }}>{st.curso_actual || '3° Medio'}</td>
                              <td>
                                {isTP ? (
                                  <span className="role-badge admin" style={{ fontSize: '9.5px', fontWeight: 'bold', padding: '2px 5px', whiteSpace: 'nowrap' }}>
                                    TP (Gastronomía)
                                  </span>
                                ) : isCH ? (
                                  <span className="role-badge" style={{ fontSize: '9.5px', fontWeight: 'bold', padding: '2px 5px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', whiteSpace: 'nowrap' }}>
                                    C. Humanista
                                  </span>
                                ) : (
                                  <span style={{ color: 'var(--text-secondary)', fontSize: '9.5px', fontStyle: 'italic', whiteSpace: 'nowrap' }}>
                                    Sin Declarar
                                  </span>
                                )}
                              </td>
                              <td>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                  {isTP ? (
                                    <span className="status-pill available" style={{ display: 'inline-flex', padding: '2px 5px', fontSize: '9.5px', backgroundColor: 'rgba(16, 185, 129, 0.15)', color: '#34d399', width: 'fit-content' }}>
                                      Finalizado (TP)
                                    </span>
                                  ) : hasSubmitted ? (
                                    <span className="status-pill available" style={{ display: 'inline-flex', padding: '2px 5px', fontSize: '9.5px', width: 'fit-content' }}>
                                      Listo (CH)
                                    </span>
                                  ) : isCH ? (
                                    <span className="status-pill full" style={{ display: 'inline-flex', padding: '2px 5px', fontSize: '9.5px', backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', width: 'fit-content' }}>
                                      En Sel. CH
                                    </span>
                                  ) : (
                                    <span className="status-pill full" style={{ display: 'inline-flex', padding: '2px 5px', fontSize: '9.5px', width: 'fit-content' }}>
                                      Pendiente
                                    </span>
                                  )}
                                  
                                  {hasSubmitted && (
                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '1px' }}>
                                      {st.estado_correo === 'enviado' ? (
                                        <span className="status-pill available" style={{ fontSize: '9px', padding: '1px 4px', fontWeight: 'bold', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                          📧 Enviado
                                        </span>
                                      ) : st.estado_correo === 'error' ? (
                                        <span className="status-pill full" style={{ fontSize: '9px', padding: '1px 4px', fontWeight: 'bold', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                                          📧 Error
                                        </span>
                                      ) : (
                                        <span className="status-pill full" style={{ fontSize: '9px', padding: '1px 4px', fontWeight: 'bold', backgroundColor: 'rgba(156, 163, 175, 0.1)', color: '#9ca3af', border: '1px solid rgba(156, 163, 175, 0.2)' }}>
                                          📧 Pend.
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              {sortedHorarios.map(h => {
                                const post = stPosts.find(p => String(p.horario_id) === String(h.id));
                                const electiveName = post ? getElectiveName(post.electivo_id) : '—';
                                return (
                                  <td key={h.id}>
                                    <div style={{ maxWidth: '98px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={electiveName}>
                                      {isTP ? (
                                        <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '9.5px' }}>Exento TP</span>
                                      ) : (
                                        <small style={{ fontWeight: post ? '600' : 'normal', color: post ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '10.5px' }}>
                                          {electiveName}
                                        </small>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              {sortedHorarios.length === 0 && (
                                <>
                                  <td>—</td>
                                  <td>—</td>
                                  <td>—</td>
                                </>
                              )}
                              <td>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  {hasAnyRegistration ? (
                                    <button
                                      className="btn-table-danger"
                                      onClick={() => handleResetStudentSelections(st)}
                                      title="Reiniciar y liberar proceso del alumno"
                                      style={{ padding: '3px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', margin: 0, height: '24px' }}
                                    >
                                      <Trash2 size={10} />
                                      <span>Reiniciar</span>
                                    </button>
                                  ) : (
                                    <span style={{ color: 'var(--text-secondary)', fontSize: '10px', marginRight: '4px' }}>—</span>
                                  )}
                                  
                                  <button
                                    className="btn-table-edit"
                                    onClick={() => handleOpenEditStudentModal(st)}
                                    title="Editar apoderados y ficha"
                                    style={{ padding: '3px 6px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '3px', margin: 0, height: '24px', backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: '1px solid rgba(59, 130, 246, 0.25)' }}
                                  >
                                    <Edit3 size={10} />
                                    <span>Editar</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {activeTab === 'modalidades_tp' && (() => {
          // KPIs
          const totalCH = eleccionesModalidad.filter(m => m.modalidad === 'cientifico_humanista').length;
          const totalTP = eleccionesModalidad.filter(m => m.modalidad === 'tecnico_profesional_gastronomia').length;

          return (
            <div className="animate-fadeIn">
              {/* KPIs de Modalidad */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '20px',
                marginBottom: '24px'
              }}>
                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-subtle)'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                    Científico Humanista
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#3b82f6', marginTop: '8px' }}>
                    {totalCH} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>estudiantes</span>
                  </div>
                </div>

                <div style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px',
                  boxShadow: 'var(--shadow-subtle)'
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 'bold' }}>
                    TP Gastronomía
                  </div>
                  <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#10b981', marginTop: '8px' }}>
                    {totalTP} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>estudiantes</span>
                  </div>
                </div>
              </div>

              {/* Contenedor de la Tabla */}
              <div style={{
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '24px',
                boxShadow: 'var(--shadow-subtle)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                    Listado de Estudiantes por Modalidad
                  </h3>
                </div>

                <div className="table-responsive">
                  <table className="laap-table">
                    <thead>
                      <tr>
                        <th>Alumno</th>
                        <th>Curso</th>
                        <th>Correo</th>
                        <th>Modalidad</th>
                        <th>Fecha de Selección</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eleccionesModalidad.length === 0 ? (
                        <tr>
                          <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                            No hay registros de modalidad registrados aún.
                          </td>
                        </tr>
                      ) : (
                        eleccionesModalidad.map((row, idx) => {
                          const st = students.find(s => s.id === row.alumno_id) || {};
                          const isTP = row.modalidad === 'tecnico_profesional_gastronomia';
                          const modLabel = isTP ? 'Técnico Profesional (Gastronomía)' : 'Científico Humanista';
                          const badgeColor = isTP ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)';
                          const badgeText = isTP ? '#10b981' : '#3b82f6';
                          const dateStr = row.created_at ? new Date(row.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

                          return (
                            <tr key={row.id || idx}>
                              <td>
                                <strong>{st.nombre_completo || 'Desconocido'}</strong>
                                <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', display: 'block', marginTop: '2px' }}>
                                  RUT: {st.rut || '—'}
                                </span>
                              </td>
                              <td>{st.curso_actual || '—'}</td>
                              <td>{st.correo || '—'}</td>
                              <td>
                                <span style={{
                                  display: 'inline-flex',
                                  padding: '4px 8px',
                                  borderRadius: '20px',
                                  fontSize: '11px',
                                  fontWeight: 'bold',
                                  backgroundColor: badgeColor,
                                  color: badgeText
                                }}>
                                  {modLabel}
                                </span>
                              </td>
                              <td>{dateStr}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* MODAL CREAR / EDITAR ELECTIVO */}
        {showModal && (
          <div className="laap-modal-backdrop">
            <div className="laap-modal-card animate-scaleIn">
              <div className="modal-header">
                <h2>{modalType === 'create' ? 'Crear Nuevo Electivo' : 'Editar Asignatura'}</h2>
                <button className="btn-modal-close" onClick={() => setShowModal(false)}>×</button>
              </div>

              <form onSubmit={handleSaveElective} className="modal-form">
                <div className="form-group">
                  <label>Nombre de la Asignatura</label>
                  <input
                    type="text"
                    required
                    value={currentElective.nombre ?? ""}
                    onChange={(e) => setCurrentElective({ ...currentElective, nombre: e.target.value })}
                    placeholder="Ej. Robótica Avanzada"
                  />
                </div>

                <div className="form-group">
                  <label>Descripción Académica</label>
                  <textarea
                    rows="3"
                    required
                    value={currentElective.descripcion ?? ""}
                    onChange={(e) => setCurrentElective({ ...currentElective, descripcion: e.target.value })}
                    placeholder="Detalles sobre el contenido del curso..."
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Docente / Profesor</label>
                    <input
                      type="text"
                      required
                      value={currentElective.docente ?? ""}
                      onChange={(e) => setCurrentElective({ ...currentElective, docente: e.target.value })}
                      placeholder="Ej. Ing. Alan Turing"
                    />
                  </div>
                  <div className="form-group">
                    <label>Cupos Totales (Capacidad)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={currentElective.cupos_maximos ?? 35}
                      onChange={(e) => setCurrentElective({ ...currentElective, cupos_maximos: e.target.value })}
                      placeholder="15"
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label>Horario Asignado</label>
                    <select
                      value={currentElective.horario_id ?? ""}
                      onChange={(e) => setCurrentElective({ ...currentElective, horario_id: e.target.value })}
                    >
                      {horarios.map(h => (
                        <option key={h.id} value={h.id}>{h.nombre}</option>
                      ))}
                      {horarios.length === 0 && (
                        <>
                          <option value="1">Horario 1</option>
                          <option value="2">Horario 2</option>
                          <option value="3">Horario 3</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Área Temática</label>
                    <select
                      value={currentElective.area_id ?? ""}
                      onChange={(e) => setCurrentElective({ ...currentElective, area_id: e.target.value })}
                    >
                      {areas.map(a => (
                        <option key={a.id} value={a.id}>Área {a.codigo || a.nombre}</option>
                      ))}
                      {areas.length === 0 && (
                        <>
                          <option value="A">Área A</option>
                          <option value="B">Área B</option>
                          <option value="C">Área C</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="form-row-2" style={{ marginTop: '12px' }}>
                  <div className="form-group">
                    <label>Nivel de Destino (Proceso)</label>
                    <select
                      value={currentElective.nivel_destino ?? "3M"}
                      onChange={(e) => setCurrentElective({ ...currentElective, nivel_destino: e.target.value })}
                    >
                      <option value="3M">3° Medio (Actuales 2° Medio)</option>
                      <option value="4M">4° Medio (Actuales 3° Medio)</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                    <input
                      type="checkbox"
                      id="elActivo"
                      checked={currentElective.activo ?? true}
                      onChange={(e) => setCurrentElective({ ...currentElective, activo: e.target.checked })}
                    />
                    <label htmlFor="elActivo" style={{ cursor: 'pointer', fontWeight: 'bold' }}>Electivo Activo y Habilitado</label>
                  </div>
                </div>

                <div className="modal-actions">
                  <button type="button" className="laap-btn-text" onClick={() => setShowModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="laap-btn-primary">
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL EDITAR POSTULACIÓN DEL ALUMNO */}
        {editingPostulacion && (() => {
          const student = students.find(s => s.id === editingPostulacion.alumno_id) || {};
          const nivelDestino = getStudentNivelDestino(student.curso_actual) || '3M';
          const availableElectives = electives.filter(e =>
            e.activo &&
            String(e.horario_id) === String(editingPostulacion.horario_id) &&
            e.nivel_destino === nivelDestino
          );

          return (
            <div className="laap-modal-backdrop">
              <div className="laap-modal-card animate-scaleIn">
                <div className="modal-header">
                  <h2>Modificar Electivo Asignado</h2>
                  <button className="btn-modal-close" onClick={() => setEditingPostulacion(null)}>×</button>
                </div>

                <form onSubmit={handleSavePostulacionEdit} className="modal-form">
                  <div style={{
                    padding: '12px',
                    borderRadius: '6px',
                    backgroundColor: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    marginBottom: '16px',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}>
                    <div><strong>Estudiante:</strong> {student.nombre_completo}</div>
                    <div><strong>RUT:</strong> {student.rut || 'No registrado'}</div>
                    <div><strong>Curso Actual:</strong> {student.curso_actual || '3° Medio'}</div>
                    <div><strong>Bloque Horario:</strong> {getScheduleName(editingPostulacion.horario_id)}</div>
                  </div>

                  <div className="form-group">
                    <label>Seleccionar Nueva Asignatura para este Horario</label>
                    <select
                      value={newElectiveId}
                      onChange={(e) => setNewElectiveId(e.target.value)}
                      required
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backgroundColor: 'rgba(0,0,0,0.2)',
                        color: 'white',
                        fontSize: '14px'
                      }}
                    >
                      <option value="" disabled>Seleccione una opción...</option>
                      {availableElectives.map(el => {
                        const cupoDetail = cupos.find(c => c.electivo_id === el.id || c.id === el.id) || {};
                        const vacantes = (el.cupos_maximos - (cupoDetail.cupos_ocupados || 0));
                        return (
                          <option key={el.id} value={el.id} style={{ backgroundColor: '#1f2937' }}>
                            {el.nombre} (Vacantes: {vacantes > 0 ? vacantes : 'Sin cupo'})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div className="modal-actions" style={{ marginTop: '20px' }}>
                    <button
                      type="button"
                      className="laap-btn-text"
                      onClick={() => setEditingPostulacion(null)}
                      disabled={savingPostulacion}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="laap-btn-primary"
                      disabled={savingPostulacion || !newElectiveId}
                    >
                      {savingPostulacion ? 'Guardando...' : 'Confirmar Cambio'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          );
        })()}

        {/* MODAL EDITAR ESTUDIANTE / APODERADOS */}
        {showStudentModal && editingStudent && (
          <div className="laap-modal-backdrop">
            <div className="laap-modal-card animate-scaleIn" style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h2>Editar Ficha del Estudiante</h2>
                <button className="btn-modal-close" onClick={() => setShowStudentModal(false)}>×</button>
              </div>

              <form onSubmit={handleSaveStudentDetails} className="modal-form">
                <div className="form-group">
                  <label>Nombre Completo</label>
                  <input
                    type="text"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                    value={editingStudent.nombre_completo ?? ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, nombre_completo: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label>RUT</label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                      value={editingStudent.rut ?? ""}
                      onChange={(e) => setEditingStudent({ ...editingStudent, rut: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Curso Actual</label>
                    <input
                      type="text"
                      style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                      value={editingStudent.curso_actual ?? ""}
                      onChange={(e) => setEditingStudent({ ...editingStudent, curso_actual: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Correo Electrónico Alumno</label>
                  <input
                    type="email"
                    required
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                    value={editingStudent.correo ?? ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, correo: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '16px', marginTop: '16px' }}>
                  <label style={{ color: '#60a5fa', fontWeight: 'bold', fontSize: '13px' }}>📧 Contactos de Apoderados (Para comprobante)</label>
                </div>

                <div className="form-group">
                  <label>Correo Apoderado Principal</label>
                  <input
                    type="email"
                    placeholder="ejemplo@correo.com"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                    value={editingStudent.correo_apoderado_1 ?? ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, correo_apoderado_1: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Correo Apoderado Secundario (Opcional)</label>
                  <input
                    type="email"
                    placeholder="ejemplo2@correo.com"
                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(0,0,0,0.2)', color: 'white' }}
                    value={editingStudent.correo_apoderado_2 ?? ""}
                    onChange={(e) => setEditingStudent({ ...editingStudent, correo_apoderado_2: e.target.value })}
                  />
                </div>

                <div className="modal-actions" style={{ marginTop: '24px' }}>
                  <button type="button" className="laap-btn-text" onClick={() => setShowStudentModal(false)}>
                    Cancelar
                  </button>
                  <button type="submit" className="laap-btn-primary">
                    Guardar Cambios
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
