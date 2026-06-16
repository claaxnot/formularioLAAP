import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.8"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejo de solicitudes CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("=== INICIO SEND-CONFIRMATION-EMAIL ===")
    console.log("Payload recibido:", JSON.stringify(body, null, 2))

    const { 
      alumno_id,
      email,
      nombre_completo,
      rut,
      curso_actual,
      nivel_destino,
      modalidad,
      correo_apoderado_1,
      correo_apoderado_2,
      electivos
    } = body

    console.log("Alumno ID:", alumno_id || "No especificado")
    console.log("Modalidad:", modalidad)

    // 1. VALIDACIÓN: RESEND_API_KEY
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error("Error de Validación: Falta RESEND_API_KEY en secrets.");
      return new Response(JSON.stringify({
        success: false,
        error: "No se ha configurado la variable de entorno RESEND_API_KEY en Supabase.",
        details: "RESEND_API_KEY is missing or undefined inside Supabase Secrets."
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 2. VALIDACIÓN: Alumno existe (Nombre y RUT válidos)
    if (!nombre_completo || !nombre_completo.trim() || !rut || !rut.trim()) {
      console.error("Error de Validación: Alumno incompleto o inexistente");
      return new Response(JSON.stringify({
        success: false,
        error: "La información básica del estudiante (Nombre o RUT) está incompleta o es inválida.",
        details: `nombre_completo: "${nombre_completo}", rut: "${rut}"`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // 3. VALIDACIÓN: Modalidad válida
    if (modalidad !== 'cientifico_humanista' && modalidad !== 'tecnico_profesional_gastronomia') {
      console.error("Error de Validación: Modalidad no soportada");
      return new Response(JSON.stringify({
        success: false,
        error: "La modalidad académica especificada no es válida.",
        details: `modalidad received: "${modalidad}". Must be 'cientifico_humanista' or 'tecnico_profesional_gastronomia'.`
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    // Inicializar cliente de Supabase con Service Role para evadir RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Configurar fecha del reporte en horario de Chile
    const dateStr = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

    // Helper para generar el HTML del correo
    const getHtml = (isApoderado: boolean, token?: string) => {
      const primaryColor = modalidad === 'tecnico_profesional_gastronomia' ? '#10b981' : '#3b82f6';
      
      let mainContent = "";
      if (modalidad === 'tecnico_profesional_gastronomia') {
        mainContent = `
          <div style="background-color: #f8fafc; border-left: 4px solid #10b981; padding: 20px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14.5px;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569; width: 140px;">Estudiante:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${nombre_completo}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">RUT:</td>
                <td style="padding: 10px 0; color: #0f172a; font-family: monospace;">${rut}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">Curso Actual:</td>
                <td style="padding: 10px 0; color: #0f172a;">${curso_actual}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">Nivel Destino:</td>
                <td style="padding: 10px 0; color: #0f172a;">${nivel_destino === '3M' ? '3° Medio' : '4° Medio'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">Modalidad:</td>
                <td style="padding: 10px 0; font-weight: 700; color: #10b981;">Técnico Profesional - Gastronomía</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">Fecha Registro:</td>
                <td style="padding: 10px 0; color: #64748b; font-style: italic;">${dateStr}</td>
              </tr>
            </table>
          </div>
        `;
      } else {
        let electivesRows = "";
        const electivesArray = electivos || [];
        electivesArray.forEach((el: any) => {
          electivesRows += `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 12px 0;">
                <div style="font-weight: 700; color: #0f172a; font-size: 14.5px;">${el.nombre}</div>
                <div style="font-size: 12.5px; color: #64748b; margin-top: 3px;">
                  Horario: <span style="font-weight: 600; color: #3b82f6;">${el.horario_nombre}</span> | 
                  Área: <span style="font-weight: 600; color: #4b5563;">Área ${el.area_codigo}</span>
                </div>
              </td>
            </tr>
          `;
        });

        mainContent = `
          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 0 12px 12px 0; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14.5px;">
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569; width: 140px;">Estudiante:</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: 600;">${nombre_completo}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">RUT:</td>
                <td style="padding: 10px 0; color: #0f172a; font-family: monospace;">${rut}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">Curso Actual:</td>
                <td style="padding: 10px 0; color: #0f172a;">${curso_actual}</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">Nivel Destino:</td>
                <td style="padding: 10px 0; color: #0f172a;">${nivel_destino === '3M' ? '3° Medio' : '4° Medio'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; font-weight: 700; color: #475569;">Fecha Registro:</td>
                <td style="padding: 10px 0; color: #64748b; font-style: italic;">${dateStr}</td>
              </tr>
            </table>
          </div>

          <div style="margin-bottom: 24px;">
            <h3 style="font-size: 15px; font-weight: 700; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 12px; color: #0f172a;">
              Asignaturas Electivas Registradas:
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              ${electivesRows}
            </table>
          </div>
        `;
      }

      let buttonHtml = "";
      if (isApoderado && token) {
        buttonHtml = `
          <div style="text-align: center; margin: 32px 0; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px;">
            <p style="margin: 0 0 14px 0; font-size: 14px; color: #475569; font-weight: 600; line-height: 1.4;">
              Como apoderado, solicitamos confirmar que ha tomado conocimiento y autoriza esta selección académica:
            </p>
            <a href="https://electivoslaap.fplb.cl/acuse/${token}" style="background-color: ${primaryColor}; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              Acuso recibo y tomo conocimiento
            </a>
          </div>
        `;
      }

      return `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; border-bottom: 3px solid ${primaryColor}; padding-bottom: 24px; margin-bottom: 24px;">
            <h2 style="color: ${primaryColor}; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Comprobante de Selección Académica</h2>
            <p style="color: #64748b; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">Liceo Arturo Alessandri Palma</p>
          </div>
          
          <div style="margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Estimado/a <strong>${nombre_completo}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; color: #475569;">
              Confirmamos que se ha registrado con éxito la postulación académica para el año escolar 2026. A continuación, se detalla la inscripción:
            </p>
          </div>

          ${mainContent}

          ${buttonHtml}

          <div style="font-size: 13px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            Este es un comprobante de respaldo generado automáticamente por el sistema.<br>
            Si tienes dudas o requieres modificaciones, por favor ponte en contacto con UTP.<br><br>
            <strong>Liceo Arturo Alessandri Palma - Providencia</strong>
          </div>
        </div>
      `;
    };

    const emailSender = 'Electivos LAAP <electivoslaap@fplb.cl>';
    const sentTo = [];

    // Helper para enviar correo vía Resend API
    const sendResendEmail = async (toEmail: string, subject: string, htmlContent: string) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`
        },
        body: JSON.stringify({
          from: emailSender,
          reply_to: 'electivoslaap@fplb.cl',
          to: [toEmail],
          subject: subject,
          html: htmlContent
        })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Resend API Error: ${errorText}`);
      }
      return await res.json();
    };

    // 1. Enviar correo al Estudiante (Sin botón de acuse)
    if (email && email.trim() !== '') {
      console.log("Enviando comprobante al estudiante:", email);
      const studentHtml = getHtml(false);
      await sendResendEmail(email.trim(), 'Comprobante de Selección Académica - Liceo Arturo Alessandri Palma', studentHtml);
      sentTo.push(email.trim());
    }

    // 2. Enviar correo al Apoderado 1 (Con botón de acuse)
    if (correo_apoderado_1 && correo_apoderado_1.trim() !== '') {
      const token1 = crypto.randomUUID();
      console.log(`Generando acuse para Apoderado 1 (${correo_apoderado_1}): Token ${token1}`);

      // Registrar acuse en la base de datos
      const { error: dbErr1 } = await supabase
        .from('acuse_recibo_apoderados')
        .insert({
          alumno_id: alumno_id,
          token: token1,
          correo_destinatario: correo_apoderado_1.trim(),
          tipo_confirmacion: 'apoderado_1',
          confirmado: false
        });

      if (dbErr1) {
        console.error("Error al registrar acuse_recibo_apoderados (Apoderado 1) en base de datos:", dbErr1);
        throw dbErr1;
      }

      const apoderado1Html = getHtml(true, token1);
      await sendResendEmail(correo_apoderado_1.trim(), 'Acuse de Recibo: Elección Académica - Liceo Arturo Alessandri Palma', apoderado1Html);
      sentTo.push(correo_apoderado_1.trim());
    }

    // 3. Enviar correo al Apoderado 2 (Con botón de acuse)
    if (correo_apoderado_2 && correo_apoderado_2.trim() !== '') {
      const token2 = crypto.randomUUID();
      console.log(`Generando acuse para Apoderado 2 (${correo_apoderado_2}): Token ${token2}`);

      // Registrar acuse en la base de datos
      const { error: dbErr2 } = await supabase
        .from('acuse_recibo_apoderados')
        .insert({
          alumno_id: alumno_id,
          token: token2,
          correo_destinatario: correo_apoderado_2.trim(),
          tipo_confirmacion: 'apoderado_2',
          confirmado: false
        });

      if (dbErr2) {
        console.error("Error al registrar acuse_recibo_apoderados (Apoderado 2) en base de datos:", dbErr2);
        throw dbErr2;
      }

      const apoderado2Html = getHtml(true, token2);
      await sendResendEmail(correo_apoderado_2.trim(), 'Acuse de Recibo: Elección Académica - Liceo Arturo Alessandri Palma', apoderado2Html);
      sentTo.push(correo_apoderado_2.trim());
    }

    console.log("=== COMPLETED SEND-CONFIRMATION-EMAIL EXITOSAMENTE ===")
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Correos de confirmación y acuse de recibo enviados correctamente.',
      recipients: sentTo
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error("send-confirmation-email error:", error)
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      details: error.stack || "Excepción general capturada en el catch principal."
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
