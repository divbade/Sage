import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

// Estimate tokens (rough: 1 token ≈ 4 chars)
export function estimateTokens(text) {
  return Math.ceil((text || '').length / 4);
}

// Count words in text
export function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

// ──────────────────────────────────────
// Parse .txt and .md files
// ──────────────────────────────────────
function parseTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = () => reject(new Error('Failed to read text file'));
    reader.readAsText(file);
  });
}

// ──────────────────────────────────────
// Parse .pdf files using pdfjs-dist
// ──────────────────────────────────────
async function parsePdfFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    pages.push(pageText);
  }

  return pages.join('\n\n');
}

// ──────────────────────────────────────
// Parse .docx files using JSZip
// ──────────────────────────────────────
async function parseDocxFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(arrayBuffer);
  const docXml = await zip.file('word/document.xml')?.async('string');

  if (!docXml) {
    throw new Error('Invalid DOCX file — could not find word/document.xml');
  }

  // Strip XML tags and clean up whitespace
  const text = docXml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

// ──────────────────────────────────────
// Main dispatcher
// ──────────────────────────────────────
export async function parseFile(file) {
  const name = file.name.toLowerCase();
  const extension = name.split('.').pop();

  // Validate file size (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    throw new Error('File is too large — maximum size is 5MB');
  }

  switch (extension) {
    case 'txt':
    case 'md':
      return await parseTextFile(file);
    case 'pdf':
      return await parsePdfFile(file);
    case 'docx':
      return await parseDocxFile(file);
    default:
      throw new Error(`Unsupported file type: .${extension}`);
  }
}

// Accepted file extensions
export const ACCEPTED_EXTENSIONS = ['.pdf', '.txt', '.md', '.docx'];
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// Token limit check and truncation notice
export function checkContextLength(text) {
  const tokens = estimateTokens(text);
  if (tokens > 8000) {
    return {
      truncated: true,
      message: "Your file was long — Sage is working from the first portion of it.",
    };
  }
  return { truncated: false, message: null };
}
