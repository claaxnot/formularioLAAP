import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
    const { 
      email,
      nombre_completo,
      rut,
      curso_actual,
      nivel_destino,
      modalidad,
      correo_apoderado_1,
      correo_apoderado_2,
      electivos
    } = await req.json()

    // Consolidar destinatarios
    const toEmails = [email]
    if (correo_apoderado_1 && correo_apoderado_1.trim() !== '') {
      toEmails.push(correo_apoderado_1.trim())
    }
    if (correo_apoderado_2 && correo_apoderado_2.trim() !== '') {
      toEmails.push(correo_apoderado_2.trim())
    }

    // Configurar fecha del reporte en horario de Chile
    const dateStr = new Date().toLocaleString('es-CL', { timeZone: 'America/Santiago' });

    let emailHtml = ""

    if (modalidad === 'tecnico_profesional_gastronomia') {
      emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; border-bottom: 3px solid #10b981; padding-bottom: 24px; margin-bottom: 24px;">
            <h2 style="color: #10b981; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Comprobante de Selección Académica</h2>
            <p style="color: #64748b; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">Liceo Arturo Alessandri Palma</p>
          </div>
          
          <div style="margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Estimado/a <strong>${nombre_completo}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; color: #475569;">
              Confirmamos que has completado con éxito tu proceso de postulación académica para el año escolar 2026. A continuación, te presentamos el detalle del comprobante de inscripción:
            </p>
          </div>

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

          <div style="font-size: 13px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            Este es un comprobante de respaldo generado automáticamente por el sistema.<br>
            Si tienes dudas o requieres modificaciones, por favor ponte en contacto con UTP.<br><br>
            <strong>Liceo Arturo Alessandri Palma - Providencia</strong>
          </div>
        </div>
      `
    } else {
      let electivesRows = ""
      electivos.forEach((el: any) => {
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
        `
      })

      emailHtml = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 30px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
          <div style="text-align: center; border-bottom: 3px solid #3b82f6; padding-bottom: 24px; margin-bottom: 24px;">
            <h2 style="color: #3b82f6; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">Comprobante de Selección Académica</h2>
            <p style="color: #64748b; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">Liceo Arturo Alessandri Palma</p>
          </div>
          
          <div style="margin-bottom: 24px;">
            <p style="font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">Estimado/a <strong>${nombre_completo}</strong>,</p>
            <p style="font-size: 15px; line-height: 1.6; margin: 0 0 20px 0; color: #475569;">
              Confirmamos que has completado con éxito tu proceso de postulación académica para el año escolar 2026. A continuación, te presentamos el detalle de tus asignaturas electivas seleccionadas:
            </p>
          </div>

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

          <div style="font-size: 13px; color: #64748b; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 30px;">
            Este es un comprobante de respaldo generado automáticamente por el sistema.<br>
            Si tienes dudas o requieres modificaciones, por favor ponte en contacto con UTP.<br><br>
            <strong>Liceo Arturo Alessandri Palma - Providencia</strong>
          </div>
        </div>
      `
    }

    // Consultar el secret de API de Resend desde variables de entorno
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      throw new Error("No se ha configurado la variable de entorno RESEND_API_KEY en Supabase.");
    }

    // Consultar remitente desde variables de entorno o usar fallback por defecto
    const emailSender = Deno.env.get('EMAIL_FROM') || 'Liceo Arturo Alessandri Palma <no-reply@resend.dev>';

    // Envío del correo vía API REST de Resend
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`
      },
      body: JSON.stringify({
        from: emailSender,
        to: toEmails,
        subject: 'Confirmación de elección académica - Liceo Arturo Alessandri Palma',
        html: emailHtml
      })
    })

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Fallo del servicio Resend: ${errorText}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'Correo enviado correctamente.' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})
