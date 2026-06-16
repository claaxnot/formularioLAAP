import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../utils/supabaseClient';
import { CheckCircle, AlertTriangle, Loader2, ShieldCheck, Mail, Calendar, BookOpen, User } from 'lucide-react';

export default function GuardianAcknowledgment() {
  const { token } = useParams();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  
  const [declared, setDeclared] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  
  useEffect(() => {
    if (!token) {
      setError('Falta el token de confirmación en la dirección web.');
      setLoading(false);
      return;
    }
    fetchAcknowledgmentDetails();
  }, [token]);

  const fetchAcknowledgmentDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      // Llamar al RPC obtener_datos_acuse
      const { data: resData, error: rpcErr } = await supabase.rpc('obtener_datos_acuse', {
        p_token: token
      });

      if (rpcErr) throw rpcErr;
      
      if (resData && resData.success === false) {
        setError(resData.message || 'El token de acuse es inválido o ha expirado.');
      } else {
        setData(resData);
        if (resData.confirmado) {
          setSubmitSuccess(true);
        }
      }
    } catch (err) {
      console.error('Error al obtener datos del acuse:', err);
      setError('Ocurrió un error al verificar el comprobante: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (!declared) return;

    setIsSubmitting(true);
    try {
      // Obtener IP pública
      let ipAddress = 'Desconocida';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
        if (ipRes.ok) {
          const ipJson = await ipRes.json();
          ipAddress = ipJson.ip || 'Desconocida';
        }
      } catch (ipErr) {
        console.warn('No se pudo obtener IP pública:', ipErr);
      }

      const userAgent = navigator.userAgent || 'Desconocido';

      // Llamar al RPC confirmar_acuse_recibo
      const { data: resConfirm, error: confirmErr } = await supabase.rpc('confirmar_acuse_recibo', {
        p_token: token,
        p_user_agent: userAgent,
        p_ip_address: ipAddress
      });

      if (confirmErr) throw confirmErr;

      if (resConfirm && resConfirm.success === false) {
        setError(resConfirm.message || 'No se pudo registrar la confirmación.');
      } else {
        setSubmitSuccess(true);
        // Volver a cargar para reflejar el estado confirmado actualizado
        await fetchAcknowledgmentDetails();
      }
    } catch (err) {
      console.error('Error al confirmar acuse:', err);
      setError('Ocurrió un error al registrar el acuse: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '80vh',
        fontFamily: 'system-ui, sans-serif',
        color: '#1e293b'
      }}>
        <Loader2 className="animate-spin" size={48} style={{ color: '#1e3a8a', marginBottom: '16px' }} />
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>Cargando ficha de postulación...</h3>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: '6px' }}>Verificando token de seguridad institucional</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        maxWidth: '500px',
        margin: '60px auto',
        padding: '30px',
        backgroundColor: '#ffffff',
        borderRadius: '12px',
        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -2px rgba(0,0,0,0.02)',
        fontFamily: 'system-ui, sans-serif',
        border: '1px solid #fee2e2',
        textAlign: 'center'
      }}>
        <div style={{
          backgroundColor: '#fee2e2',
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px auto'
        }}>
          <AlertTriangle size={32} style={{ color: '#ef4444' }} />
        </div>
        <h2 style={{ color: '#991b1b', margin: '0 0 12px 0', fontSize: '20px', fontWeight: 'bold' }}>Problema de Validación</h2>
        <p style={{ color: '#4b5563', fontSize: '14.5px', lineHeight: '1.5', margin: '0 0 20px 0' }}>
          {error}
        </p>
        <div style={{ fontSize: '12px', color: '#9ca3af', borderTop: '1px solid #f3f4f6', paddingTop: '16px' }}>
          Liceo Arturo Alessandri Palma — Unidad Técnico Pedagógica
        </div>
      </div>
    );
  }

  const isTP = data.modalidad === 'tecnico_profesional_gastronomia';
  const badgeColor = isTP ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)';
  const badgeText = isTP ? '#10b981' : '#3b82f6';
  const modLabel = isTP ? 'Técnico Profesional (Gastronomía)' : 'Científico Humanista';

  return (
    <div style={{
      maxWidth: '600px',
      margin: '40px auto',
      padding: '0 16px',
      fontFamily: 'system-ui, sans-serif',
      color: '#1e293b'
    }}>
      {/* CARD PRINCIPAL */}
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 10px 10px -5px rgba(0, 0, 0, 0.02)',
        border: '1px solid #e2e8f0',
        overflow: 'hidden'
      }}>
        {/* Encabezado */}
        <div style={{
          backgroundColor: '#0f172a',
          color: 'white',
          padding: '24px',
          textAlign: 'center',
          position: 'relative'
        }}>
          <div style={{
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            color: '#94a3b8',
            fontWeight: 'bold',
            marginBottom: '4px'
          }}>
            Ministerio de Educación
          </div>
          <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>Liceo Arturo Alessandri Palma</h1>
          <span style={{ fontSize: '13px', color: '#38bdf8' }}>Acuse de Recibo y Consentimiento de Apoderado</span>
        </div>

        <div style={{ padding: '28px' }}>
          
          {/* Mensaje de Confirmado si ya se acuso recibo */}
          {submitSuccess ? (
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '28px',
              textAlign: 'center'
            }}>
              <div style={{
                backgroundColor: '#10b981',
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px auto',
                color: 'white'
              }}>
                <ShieldCheck size={28} />
              </div>
              <h2 style={{ color: '#065f46', margin: '0 0 4px 0', fontSize: '18px', fontWeight: 'bold' }}>Acuse de Recibo Registrado</h2>
              <p style={{ color: '#047857', fontSize: '13.5px', margin: '0 0 16px 0', lineHeight: '1.4' }}>
                Usted ha dejado constancia oficial de haber tomado conocimiento de la elección académica realizada por su estudiante.
              </p>
              <div style={{
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '12px',
                color: '#374151',
                display: 'inline-flex',
                flexDirection: 'column',
                gap: '4px',
                textAlign: 'left',
                border: '1px solid rgba(16, 185, 129, 0.15)'
              }}>
                <div><strong>Destinatario:</strong> {data.correo_destinatario} ({data.tipo_confirmacion === 'apoderado_1' ? 'Apoderado Principal' : 'Apoderado Secundario'})</div>
                <div><strong>Fecha Firma:</strong> {new Date(data.confirmado_at).toLocaleString('es-CL')}</div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: '14.5px', lineHeight: '1.5', color: '#4b5563', margin: '0 0 24px 0' }}>
              Estimado/a apoderado/a, el estudiante registrado a su tutela ha finalizado el proceso de postulación académica para el periodo escolar 2026. A continuación se presentan los detalles oficiales:
            </p>
          )}

          {/* DETALLES DE LA POSTULACIÓN */}
          <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <User size={16} />
            Datos del Estudiante
          </h3>
          
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '18px',
            marginBottom: '24px'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 0', fontWeight: 'bold', color: '#64748b' }}>Nombre:</td>
                  <td style={{ padding: '8px 0', color: '#0f172a', fontWeight: '600' }}>{data.alumno_nombre}</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 0', fontWeight: 'bold', color: '#64748b' }}>Curso Actual:</td>
                  <td style={{ padding: '8px 0', color: '#0f172a' }}>{data.alumno_curso}</td>
                </tr>
                <tr>
                  <td style={{ padding: '8px 0', fontWeight: 'bold', color: '#64748b' }}>Ruta Elegida:</td>
                  <td style={{ padding: '8px 0' }}>
                    <span style={{
                      display: 'inline-flex',
                      padding: '3px 8px',
                      borderRadius: '20px',
                      fontSize: '11.5px',
                      fontWeight: 'bold',
                      backgroundColor: badgeColor,
                      color: badgeText
                    }}>
                      {modLabel}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ASIGNATURAS ELECTIVAS (Solo para Científico Humanista) */}
          {!isTP && data.electivos && data.electivos.length > 0 && (
            <div style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={16} />
                Asignaturas Seleccionadas
              </h3>
              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                overflow: 'hidden'
              }}>
                {data.electivos.map((el, index) => (
                  <div key={index} style={{
                    padding: '12px 16px',
                    borderBottom: index < data.electivos.length - 1 ? '1px solid #e2e8f0' : 'none',
                    backgroundColor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>{el.nombre}</div>
                      <span style={{ fontSize: '12px', color: '#64748b' }}>Bloque Horario: {el.horario_nombre}</span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      backgroundColor: '#e2e8f0',
                      borderRadius: '4px',
                      fontWeight: '600',
                      color: '#475569'
                    }}>
                      Área {el.area_codigo}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FORMULARIO DE FIRMA (Solo si no está confirmado) */}
          {!submitSuccess && (
            <form onSubmit={handleConfirm} style={{
              borderTop: '2px dashed #e2e8f0',
              paddingTop: '24px',
              marginTop: '24px'
            }}>
              <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#0f172a', marginBottom: '12px' }}>
                Firma Electrónica Simple
              </h3>
              
              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '16px',
                backgroundColor: 'rgba(30, 58, 138, 0.03)',
                border: '1px solid rgba(30, 58, 138, 0.1)',
                borderRadius: '12px',
                marginBottom: '24px',
                cursor: 'pointer'
              }} onClick={() => setDeclared(!declared)}>
                <input
                  type="checkbox"
                  id="declaracion_check"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  style={{
                    marginTop: '3px',
                    width: '18px',
                    height: '18px',
                    cursor: 'pointer'
                  }}
                />
                <label htmlFor="declaracion_check" style={{
                  fontSize: '13.5px',
                  lineHeight: '1.45',
                  color: '#334155',
                  cursor: 'pointer',
                  fontWeight: '500'
                }}>
                  Declaro bajo firma simple que tomo pleno conocimiento de la modalidad académica y electivos inscritos por mi estudiante para el año escolar 2026.
                </label>
              </div>

              <button
                type="submit"
                disabled={!declared || isSubmitting}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: declared ? '#1e3a8a' : '#94a3b8',
                  color: 'white',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '15px',
                  fontWeight: 'bold',
                  cursor: declared && !isSubmitting ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'background-color 0.2s'
                }}
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : null}
                <span>Confirmar acuse de recibo</span>
              </button>
            </form>
          )}

        </div>
      </div>

      <div style={{
        textAlign: 'center',
        marginTop: '20px',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        Este comprobante digital cuenta con validez interna para la organización académica del Liceo.
      </div>
    </div>
  );
}
