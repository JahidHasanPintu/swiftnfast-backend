/**
 * Mirrors pfu2-backend-v2 `utils/imageUrl.js generateImageUrl(folder, filename)`:
 * returns `{S3_PUBLIC_URL}/{S3_BUCKET}/{folder}/{filename}` for stored filenames,
 * and passes through already-absolute URLs unchanged.
 */
export function generateImageUrl(
  folder: string,
  filename?: string | null,
): string | null {
  if (!filename) return null;
  if (/^https?:\/\//i.test(filename)) return filename;
  const publicUrl = process.env.S3_PUBLIC_URL || 'https://s3.pfu2.com';
  const bucket = process.env.S3_BUCKET || 'pfu2-uploads';
  return `${publicUrl}/${bucket}/${folder}/${filename}`;
}
