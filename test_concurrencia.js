import { createClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Faltan las variables de entorno de Supabase en .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Configuración de la prueba
const NUMERO_DE_USUARIOS = 2000;
const NIVEL_DESTINO = '3M'; // O '4M'

// NOTA: Para probar la escritura/reservas, necesitas un ID de alumno y electivo reales.
// Aquí probaremos el RPC de LECTURA masiva (obtener_estado_portal_estudiante) 
// simulando a 200 alumnos pidiendo sus datos al mismo milisegundo.
// Puedes cambiar el UUID por uno real de tu base de datos para ver datos precisos.
const ALUMNO_UUID_FICTICIO = '00000000-0000-0000-0000-000000000000'; 

async function simularUsuario(idUsuario) {
  const inicio = performance.now();
  
  try {
    const { data, error } = await supabase.rpc('obtener_estado_portal_estudiante', {
      p_alumno_id: ALUMNO_UUID_FICTICIO,
      p_nivel_destino: NIVEL_DESTINO
    });

    const fin = performance.now();
    const tiempo = Math.round(fin - inicio);

    if (error) {
      return { id: idUsuario, exito: false, tiempo, error: error.message };
    }
    return { id: idUsuario, exito: true, tiempo };
    
  } catch (err) {
    return { id: idUsuario, exito: false, tiempo: 0, error: err.message };
  }
}

async function correrPrueba() {
  console.log(`🚀 Iniciando prueba de estrés con ${NUMERO_DE_USUARIOS} conexiones simultáneas...`);
  console.log(`URL destino: ${SUPABASE_URL}`);
  
  const promesas = [];
  const inicioTotal = performance.now();

  // Disparamos todas las conexiones casi al mismo tiempo
  for (let i = 1; i <= NUMERO_DE_USUARIOS; i++) {
    promesas.push(simularUsuario(i));
  }

  // Esperamos a que TODAS terminen
  const resultados = await Promise.all(promesas);
  const finTotal = performance.now();

  // Analizar resultados
  const exitosos = resultados.filter(r => r.exito);
  const fallidos = resultados.filter(r => !r.exito);
  
  const tiempos = exitosos.map(r => r.tiempo);
  const tiempoPromedio = tiempos.length ? (tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
  const tiempoMax = tiempos.length ? Math.max(...tiempos) : 0;
  
  console.log("\n📊 --- RESULTADOS DE LA PRUEBA ---");
  console.log(`✅ Peticiones exitosas: ${exitosos.length}`);
  console.log(`❌ Peticiones fallidas: ${fallidos.length}`);
  console.log(`⏱️ Tiempo total de la prueba: ${Math.round(finTotal - inicioTotal)} ms`);
  console.log(`⚡ Tiempo promedio por petición: ${Math.round(tiempoPromedio)} ms`);
  console.log(`🐌 Petición más lenta: ${tiempoMax} ms`);

  if (fallidos.length > 0) {
    console.log("\n⚠️ Ejemplos de errores encontrados:");
    console.log(fallidos.slice(0, 3).map(f => `Usuario ${f.id}: ${f.error}`).join('\n'));
  }
}

correrPrueba();
