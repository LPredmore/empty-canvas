/**
 * PDF.js Worker Initialization Module
 * 
 * This module is the SINGLE SOURCE OF TRUTH for PDF.js worker configuration.
 * It uses workerPort (not workerSrc) to bypass PDF.js's internal URL resolution
 * and CDN fallback mechanisms entirely.
 * 
 * Import this module before any PDF.js operations to ensure the worker is ready.
 */
import * as pdfjsLib from 'pdfjs-dist';

// Create the worker using Vite's native ESM worker bundling
// This approach explicitly constructs a module worker that Vite can bundle correctly
const pdfWorker = new Worker(
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
  { type: 'module' }
);

// Use workerPort instead of workerSrc - this bypasses all URL resolution logic
// and the CDN wrapper fallback path in PDF.js entirely
pdfjsLib.GlobalWorkerOptions.workerPort = pdfWorker;

// Export for potential debugging/health checks
export const isPdfWorkerReady = (): boolean => {
  return pdfjsLib.GlobalWorkerOptions.workerPort !== null;
};

export const getPdfWorkerDiagnostics = () => ({
  workerPort: pdfjsLib.GlobalWorkerOptions.workerPort ? 'set' : 'null',
  workerSrc: pdfjsLib.GlobalWorkerOptions.workerSrc || 'not set',
  version: pdfjsLib.version
});

// Log initialization in development
if (import.meta.env.DEV) {
  console.log('[PDF.js] Worker initialized via workerPort:', getPdfWorkerDiagnostics());
}
