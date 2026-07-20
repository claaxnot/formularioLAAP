import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { execSync } from 'child_process';

async function recordAndSaveVideo() {
  console.log("Iniciando navegador automatizado para generar video MP4 HD...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    acceptDownloads: true
  });
  const page = await context.newPage();

  await page.addInitScript(() => {
    localStorage.setItem('laap_mock_session', JSON.stringify({
      user: { id: 'demo-student-id', email: 'alumno.demo@estudiantes.edupro.cl' },
      role: 'student',
      profile: {
        id: 'demo-student-id',
        nombre_completo: 'ESTUDIANTE DEMO LAAP',
        email: 'alumno.demo@estudiantes.edupro.cl',
        curso_actual: '3° Medio A',
        isSimulated: true
      }
    }));
    localStorage.setItem('laap_student_modalidad', 'cientifico_humanista');
  });

  console.log("Navegando al portal de estudiantes...");
  await page.goto("http://localhost:5174/student");
  await page.waitForTimeout(2000);

  console.log("Current URL:", page.url());

  // Si está en la pantalla de selección de modalidad, hacer clic en "Continuar a Selección de Electivos"
  const modBtn = page.locator("button:has-text('Continuar a Selección de Electivos')").first();
  if (await modBtn.isVisible().catch(() => false)) {
    console.log("Haciendo clic en 'Continuar a Selección de Electivos'...");
    await modBtn.click();
    await page.waitForTimeout(1000);

    // Confirmar en el modal secundario si aparece
    const confirmBtn = page.locator("button:has-text('Confirmar Selección CH')").first();
    if (await confirmBtn.isVisible().catch(() => false)) {
      await confirmBtn.click();
      await page.waitForTimeout(1000);
    }
  }

  // Buscar el botón del tutorial
  console.log("Abriendo modal del tutorial...");
  const openBtn = page.locator("button:has-text('Video Instructivo'), button:has-text('Tutorial')").first();
  await openBtn.waitFor({ state: 'visible', timeout: 15000 });
  await openBtn.click();
  await page.waitForTimeout(1500);

  // Hacer clic en descargar video MP4
  console.log("Iniciando renderizado de video MP4 en 1080p...");
  const downloadPromise = page.waitForEvent('download', { timeout: 180000 });
  const downloadBtn = page.locator("button:has-text('Generar y Descargar Video MP4 Pro')").first();
  await downloadBtn.click();

  console.log("Renderizando escenas (108s en tiempo real con locución neural)...");
  const download = await downloadPromise;
  
  const destPublic = path.join(process.cwd(), 'public', 'tutorial_oficial_laap_2026.mp4');
  const destRoot = path.join(process.cwd(), 'tutorial_oficial_laap_2026.mp4');
  const tempPath = path.join(process.cwd(), 'temp_raw_stream.mp4');

  await download.saveAs(tempPath);

  console.log("Indexando metadatos de duración (faststart + moov atom) con FFmpeg...");
  execSync(`"${ffmpegPath}" -y -i "${tempPath}" -c copy -movflags +faststart "${destPublic}"`);
  fs.copyFileSync(destPublic, destRoot);
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

  console.log(`✓ ARCHIVO NAVEGABLE CON BARRA DE REPRODUCCIÓN GUARDADO EXITOSAMENTE EN:\n1. ${destPublic}\n2. ${destRoot}`);
  await browser.close();
}

recordAndSaveVideo().catch(err => {
  console.error("Error al generar video:", err);
  process.exit(1);
});
