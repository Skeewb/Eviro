import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.entry';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

const cleanText = (value) =>
  String(value || '')
    .replaceAll('\0', '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const extractAsciiStrings = (bytes, minLength = 6) => {
  const chunks = [];
  let current = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const code = bytes[i];
    const isPrintable = (code >= 32 && code <= 126) || code === 9 || code === 10 || code === 13;
    if (isPrintable) {
      current += String.fromCharCode(code);
    } else {
      if (current.length >= minLength) chunks.push(current);
      current = '';
    }
  }
  if (current.length >= minLength) chunks.push(current);
  return chunks;
};

const extractUtf16LeStrings = (bytes, minLength = 6) => {
  const chunks = [];
  let current = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) {
    const code = bytes[i] | (bytes[i + 1] << 8);
    const isPrintable = (code >= 32 && code <= 55295) || code === 9 || code === 10 || code === 13;
    if (isPrintable) {
      current += String.fromCharCode(code);
    } else {
      if (current.length >= minLength) chunks.push(current);
      current = '';
    }
  }
  if (current.length >= minLength) chunks.push(current);
  return chunks;
};

const dedupe = (lines) => {
  const seen = new Set();
  const output = [];
  lines.forEach((line) => {
    const key = line.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      output.push(line);
    }
  });
  return output;
};

export const parseImportedNoteFile = async (file) => {
  const name = String(file?.name || 'Imported Note');
  const ext = name.includes('.') ? name.split('.').pop().toLowerCase() : '';

  if (ext === 'pdf') {
    const bytes = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    const pageImages = [];
    for (let i = 1; i <= pdf.numPages; i += 1) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.45 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      pageImages.push({
        src: canvas.toDataURL('image/png'),
        width: canvas.width,
        height: canvas.height,
      });
    }
    return {
      title: name.replace(/\.[^.]+$/, ''),
      content: `PDF imported (${pageImages.length} page${pageImages.length === 1 ? '' : 's'}). Add text boxes on top to annotate.`,
      pageImages,
      tags: ['imported', 'pdf'],
    };
  }

  if (['txt', 'md', 'markdown', 'csv', 'json'].includes(ext)) {
    const text = cleanText(await file.text());
    return {
      title: name.replace(/\.[^.]+$/, ''),
      content: text || 'Imported file was empty.',
      tags: ['imported'],
    };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const rawChunks = dedupe([
    ...extractUtf16LeStrings(bytes),
    ...extractAsciiStrings(bytes),
  ]);

  const readable = rawChunks
    .map((line) => cleanText(line))
    .filter((line) => line.length >= 4)
    .filter((line) => !/^[\W_]+$/.test(line))
    .slice(0, 140);

  const preface = `Imported from ${ext || 'binary'} file.\n\n`;

  return {
    title: name.replace(/\.[^.]+$/, ''),
    content: `${preface}${readable.join('\n\n') || 'No readable text could be extracted from this file.'}`.trim(),
    tags: ['imported', ext || 'file'],
  };
};
