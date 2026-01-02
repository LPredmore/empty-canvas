import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PageText {
  pageNumber: number;
  text: string;
  charCount: number;
}

export interface PDFExtractionResult {
  pages: PageText[];
  totalText: string;
  totalPages: number;
  extractedPages: number;
  isLikelyScanned: boolean;
  estimatedTokens: number;
}

const MAX_PAGES = 50;
const MAX_TOKENS = 80000;
const CHARS_PER_TOKEN = 4;
const SCANNED_THRESHOLD_CHARS_PER_PAGE = 100;
const SCANNED_THRESHOLD_PERCENTAGE = 0.5;

/**
 * Estimate token count from text (OpenAI approximation: ~4 chars per token)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Truncate text to stay within token limit, respecting page boundaries when possible
 */
export function truncateToTokenLimit(pages: PageText[], maxTokens: number): { pages: PageText[]; truncated: boolean } {
  let totalChars = 0;
  const maxChars = maxTokens * CHARS_PER_TOKEN;
  const result: PageText[] = [];
  let truncated = false;

  for (const page of pages) {
    if (totalChars + page.charCount <= maxChars) {
      result.push(page);
      totalChars += page.charCount;
    } else {
      // Partial page if we haven't included anything yet
      if (result.length === 0) {
        const remainingChars = maxChars - totalChars;
        result.push({
          ...page,
          text: page.text.slice(0, remainingChars),
          charCount: remainingChars
        });
      }
      truncated = true;
      break;
    }
  }

  return { pages: result, truncated };
}

/**
 * Detect if PDF is likely a scanned document (minimal text content)
 */
export function isLikelyScannedPDF(pages: PageText[]): boolean {
  if (pages.length === 0) return true;

  const avgCharsPerPage = pages.reduce((sum, p) => sum + p.charCount, 0) / pages.length;
  const lowTextPages = pages.filter(p => p.charCount < 50).length;
  const lowTextPercentage = lowTextPages / pages.length;

  return avgCharsPerPage < SCANNED_THRESHOLD_CHARS_PER_PAGE || 
         lowTextPercentage > SCANNED_THRESHOLD_PERCENTAGE;
}

/**
 * Extract text from a PDF file using PDF.js
 */
export async function extractTextFromPDF(file: File): Promise<PDFExtractionResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const totalPages = pdf.numPages;
  const pagesToExtract = Math.min(totalPages, MAX_PAGES);
  const pages: PageText[] = [];

  for (let i = 1; i <= pagesToExtract; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    
    // Extract text items and join them
    const text = textContent.items
      .map((item: any) => item.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    pages.push({
      pageNumber: i,
      text,
      charCount: text.length
    });
  }

  const isScanned = isLikelyScannedPDF(pages);
  
  // If not scanned, truncate to token limit
  const { pages: finalPages, truncated } = isScanned 
    ? { pages, truncated: false }
    : truncateToTokenLimit(pages, MAX_TOKENS);

  const totalText = finalPages.map(p => `--- Page ${p.pageNumber} ---\n${p.text}`).join('\n\n');
  const estimatedTokens = estimateTokenCount(totalText);

  return {
    pages: finalPages,
    totalText,
    totalPages,
    extractedPages: finalPages.length,
    isLikelyScanned: isScanned,
    estimatedTokens
  };
}

/**
 * Convert PDF pages to base64 images for Vision API processing
 */
export async function convertPDFPagesToImages(
  file: File, 
  maxPages: number = 10,
  scale: number = 1.5
): Promise<{ images: string[]; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const pagesToConvert = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= pagesToConvert; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });
    
    // Create canvas
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render page to canvas
    await page.render({
      canvasContext: context,
      viewport,
      canvas
    }).promise;

    // Convert to base64
    const imageData = canvas.toDataURL('image/jpeg', 0.8);
    images.push(imageData);
  }

  return { images, pageCount: pdf.numPages };
}
