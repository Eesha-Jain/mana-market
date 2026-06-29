import { GoogleGenAI } from '@google/genai';
import { preprocessImageForOcr } from './imagePreprocess';
import {
  OCR_PASS1_PROMPT,
  OCR_PASS2_FOLLOWUP_PROMPT,
  UPC_OCR_PROMPT,
  mergeOcrPasses,
} from './ocrPrompts';

export class OcrError extends Error {
  constructor(
    message: string,
    readonly code: 'NOT_CONFIGURED' | 'API' | 'NETWORK' | 'EMPTY',
  ) {
    super(message);
    this.name = 'OcrError';
  }
}

const defaultModel = 'gemini-2.5-flash';

const PASS1_MAX_OUTPUT_TOKENS = 1024;
const PASS2_MAX_OUTPUT_TOKENS = 768;

function geminiApiKey(): string | undefined {
  return import.meta.env?.VITE_GEMINI_API_KEY;
}

function ocrModel(): string {
  return import.meta.env?.VITE_GEMINI_OCR_MODEL ?? defaultModel;
}

async function blobToGenerativePart(blob: Blob) {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return {
    inlineData: {
      data: btoa(binary),
      mimeType: blob.type || 'image/jpeg',
    },
  };
}

function responseText(response: { text?: string | null }): string {
  return (typeof response.text === 'string' ? response.text : '').trim();
}

/**
 * Two-pass Gemini OCR via a single chat session:
 * 1. User message with image + MTG-aware prompt (image read once)
 * 2. Text-only follow-up — chat history carries image + pass-1 context
 *
 * Image is EXIF-corrected and downscaled once before the session starts.
 */
export async function extractTextFromImage(
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new OcrError(
      'Gemini OCR is not configured. Add VITE_GEMINI_API_KEY to .env and restart the dev server.',
      'NOT_CONFIGURED',
    );
  }

  onProgress?.('Straightening photo…');
  const prepared = await preprocessImageForOcr(file);
  const imagePart = await blobToGenerativePart(prepared);

  const ai = new GoogleGenAI({ apiKey });
  const chat = ai.chats.create({ model: ocrModel() });

  onProgress?.('Reading label (1/2)…');
  let pass1Response;
  try {
    pass1Response = await chat.sendMessage({
      message: [imagePart, OCR_PASS1_PROMPT],
      config: { maxOutputTokens: PASS1_MAX_OUTPUT_TOKENS },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new OcrError(msg, 'API');
  }

  const pass1 = responseText(pass1Response);
  if (!pass1) {
    throw new OcrError('Gemini returned no text on the first OCR pass.', 'EMPTY');
  }

  onProgress?.('Reading label (2/2)…');
  let pass2Response;
  try {
    pass2Response = await chat.sendMessage({
      message: OCR_PASS2_FOLLOWUP_PROMPT,
      config: { maxOutputTokens: PASS2_MAX_OUTPUT_TOKENS },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new OcrError(msg, 'API');
  }

  const pass2 = responseText(pass2Response);
  const merged = mergeOcrPasses(pass1, pass2);
  if (!merged) {
    throw new OcrError('Gemini returned no usable text for this image.', 'EMPTY');
  }

  return merged;
}

/** Extract UPC/EAN digits from a barcode photo via Gemini. */
export async function extractUpcFromImage(
  file: File,
  onProgress?: (message: string) => void,
): Promise<string> {
  const apiKey = geminiApiKey();
  if (!apiKey) {
    throw new OcrError(
      'Gemini OCR is not configured. Add VITE_GEMINI_API_KEY to .env and restart the dev server.',
      'NOT_CONFIGURED',
    );
  }

  onProgress?.('Straightening photo…');
  const prepared = await preprocessImageForOcr(file);
  const imagePart = await blobToGenerativePart(prepared);

  const ai = new GoogleGenAI({ apiKey });
  const chat = ai.chats.create({ model: ocrModel() });

  onProgress?.('Reading barcode…');
  let response;
  try {
    response = await chat.sendMessage({
      message: [imagePart, UPC_OCR_PROMPT],
      config: { maxOutputTokens: 64 },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new OcrError(msg, 'API');
  }

  const raw = responseText(response);
  if (!raw || /^none$/i.test(raw)) {
    throw new OcrError('Could not read a barcode from this photo. Try a clearer shot of the UPC label.', 'EMPTY');
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    throw new OcrError('Could not read a barcode from this photo. Try a clearer shot of the UPC label.', 'EMPTY');
  }

  return digits;
}
