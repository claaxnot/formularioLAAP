import ffmpegPath from 'ffmpeg-static';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log("Iniciando indexación de metadatos de duración con FFmpeg...");

const rootFile = path.join(process.cwd(), 'tutorial_oficial_laap_2026.mp4');
const publicFile = path.join(process.cwd(), 'public', 'tutorial_oficial_laap_2026.mp4');
const tempFile = path.join(process.cwd(), 'temp_video_seekable.mp4');

if (fs.existsSync(rootFile)) {
  console.log("Procesando archivo para agregar barra de reproducción y búsqueda (seek bar / moov faststart)...");
  execSync(`"${ffmpegPath}" -y -i "${rootFile}" -c copy -movflags +faststart "${tempFile}"`);
  
  fs.copyFileSync(tempFile, rootFile);
  fs.copyFileSync(tempFile, publicFile);
  fs.unlinkSync(tempFile);
  console.log("✓ ÉXITO: El video ahora incluye duración exacta, barra de navegación, adelantar y retroceder en cualquier reproductor.");
} else {
  console.error("No se encontró el archivo original tutorial_oficial_laap_2026.mp4");
}
