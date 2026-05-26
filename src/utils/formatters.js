/**
 * Formatea un nombre completo a "Title Case" (ej. "Adrian Alejandro Rey Ruiz"),
 * preservando preposiciones en minúscula, letras con acento, apóstrofes y guiones.
 * 
 * @param {string} nombre Nombre completo original
 * @returns {string} Nombre formateado
 */
export const formatNombre = (nombre) => {
  if (!nombre || typeof nombre !== 'string') return '';

  const minorWords = ['de', 'del', 'la', 'las', 'los', 'y', 'e'];

  return nombre
    .trim()
    .toLowerCase()
    .split(/([\s'\-])/) // Separa por espacios, apóstrofes o guiones, reteniendo el delimitador
    .map((word, idx, arr) => {
      // Si es un delimitador o está vacío, mantenerlo intacto
      if (!word || /[\s'\-]/.test(word)) return word;

      // Si es una preposición/artículo al medio, mantener en minúscula
      if (idx > 0 && minorWords.includes(word)) {
        return word;
      }

      // Capitalizar la primera letra (soporta acentos de forma nativa)
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join('');
};
