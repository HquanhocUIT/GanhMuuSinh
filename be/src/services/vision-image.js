import sharp from 'sharp';

export async function prepareVisionImage(image) {
  const bytes = Buffer.from(image.base64, 'base64');
  const decoder = sharp(bytes, { failOn: 'error', limitInputPixels: 40_000_000 });
  const metadata = await decoder.metadata();
  if (!metadata.width || !metadata.height || Math.min(metadata.width, metadata.height) < 224) {
    throw new Error('image-too-small');
  }
  // Preserve already suitable images byte-for-byte, avoiding unnecessary JPEG loss.
  if (
    Math.max(metadata.width, metadata.height) <= 2048 &&
    (!metadata.orientation || metadata.orientation === 1) &&
    !metadata.hasAlpha &&
    (metadata.pages ?? 1) === 1
  )
    return image;
  const normalized = await decoder
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 95 })
    .toBuffer();
  return { mimeType: 'image/jpeg', base64: normalized.toString('base64') };
}
