import type { PreferredImageSource } from '@/types';
import { getSupabase, isSupabaseConfigured, LISTING_IMAGES_BUCKET } from '@/lib/supabase/client';

export { isPersistentImageUrl } from './imageUrl';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const MAX_BYTES = 8 * 1024 * 1024;

function resolveExtension(file: File): string {
  const fromName = file.name.includes('.') ? `.${file.name.split('.').pop()!.toLowerCase()}` : '';
  if (fromName && Object.values(EXT_BY_MIME).includes(fromName)) return fromName;
  return EXT_BY_MIME[file.type] ?? '.jpg';
}

/** Upload scan/camera photo to Supabase when it is still a local blob URL. */
export async function persistPhotoScanImage(
  photoUrl: string | undefined,
  sourceFile: File | undefined,
): Promise<{ photoUrl?: string; userImageUrl?: string; preferredImageSource?: PreferredImageSource }> {
  const needsUpload =
    (photoUrl?.startsWith('blob:') || photoUrl?.startsWith('data:')) && sourceFile;

  if (!needsUpload) {
    return {};
  }

  if (!isSupabaseConfigured()) {
    return {};
  }

  const uploaded = await uploadProductImage(sourceFile);
  return {
    photoUrl: uploaded,
    userImageUrl: uploaded,
    preferredImageSource: 'user',
  };
}

/** Upload a listing image to Supabase Storage. */
export async function uploadProductImage(file: File): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to upload images.',
    );
  }

  if (file.size > MAX_BYTES) {
    throw new Error('Image exceeds 8 MB limit');
  }

  const supabase = getSupabase();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Sign in to upload images');
  }

  const ext = resolveExtension(file);
  const path = `${user.id}/${crypto.randomUUID()}${ext}`;

  const { error } = await supabase.storage.from(LISTING_IMAGES_BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || 'Upload to Supabase Storage failed');
  }

  const { data } = supabase.storage.from(LISTING_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

