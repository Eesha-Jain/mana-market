import { GoogleGenAI } from '@google/genai';
import {
  OCR_PASS1_PROMPT,
  OCR_PASS2_FOLLOWUP_PROMPT,
  UPC_OCR_PROMPT,
  mergeOcrPasses,
} from '../src/utils/ocrPrompts';

const defaultModel = 'gemini-2.5-flash';
const PASS1_MAX_OUTPUT_TOKENS = 1024;
const PASS2_MAX_OUTPUT_TOKENS = 768;

export function isGeminiConfigured(): boolean {
  return !!(process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim());
}

function geminiApiKey(): string {
  const key = process.env.GEMINI_API_KEY?.trim() || process.env.VITE_GEMINI_API_KEY?.trim();
  if (!key) {
    throw new Error('Gemini OCR is not configured. Set GEMINI_API_KEY on the server.');
  }
  return key;
}

function ocrModel(): string {
  return process.env.GEMINI_OCR_MODEL?.trim()
    || process.env.VITE_GEMINI_OCR_MODEL?.trim()
    || defaultModel;
}

function responseText(response: { text?: string | null }): string {
  return (typeof response.text === 'string' ? response.text : '').trim();
}

function imagePartFromBase64(base64: string, mimeType: string) {
  return {
    inlineData: {
      data: base64,
      mimeType: mimeType || 'image/jpeg',
    },
  };
}

/** Two-pass label OCR (server-side — API key never sent to the browser). */
export async function extractTextFromImageBase64(base64: string, mimeType: string): Promise<string> {
  const imagePart = imagePartFromBase64(base64, mimeType);
  const ai = new GoogleGenAI({ apiKey: geminiApiKey() });
  const chat = ai.chats.create({ model: ocrModel() });

  const pass1Response = await chat.sendMessage({
    message: [imagePart, OCR_PASS1_PROMPT],
    config: { maxOutputTokens: PASS1_MAX_OUTPUT_TOKENS },
  });

  const pass1 = responseText(pass1Response);
  if (!pass1) {
    throw new Error('Gemini returned no text on the first OCR pass.');
  }

  const pass2Response = await chat.sendMessage({
    message: OCR_PASS2_FOLLOWUP_PROMPT,
    config: { maxOutputTokens: PASS2_MAX_OUTPUT_TOKENS },
  });

  const pass2 = responseText(pass2Response);
  const merged = mergeOcrPasses(pass1, pass2);
  if (!merged) {
    throw new Error('Gemini returned no usable text for this image.');
  }

  return merged;
}

/** UPC/EAN digits from a barcode photo (server-side). */
export async function extractUpcFromImageBase64(base64: string, mimeType: string): Promise<string> {
  const imagePart = imagePartFromBase64(base64, mimeType);
  const ai = new GoogleGenAI({ apiKey: geminiApiKey() });
  const chat = ai.chats.create({ model: ocrModel() });

  const response = await chat.sendMessage({
    message: [imagePart, UPC_OCR_PROMPT],
    config: { maxOutputTokens: 64 },
  });

  const raw = responseText(response);
  if (!raw || /^none$/i.test(raw)) {
    throw new Error('Could not read a barcode from this photo. Try a clearer shot of the UPC label.');
  }

  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    throw new Error('Could not read a barcode from this photo. Try a clearer shot of the UPC label.');
  }

  return digits;
}
