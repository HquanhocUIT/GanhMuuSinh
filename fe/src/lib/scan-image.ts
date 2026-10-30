// Decode before upload so EXIF orientation is baked into the pixels seen by AI.
// Keep the whole frame and enough detail to distinguish small cake shapes.
export async function prepareScanImage(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    if (Math.min(bitmap.width, bitmap.height) < 224) throw new Error('image-too-small');
    const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('image-decode-failed');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    const base64 = dataUrl.split(',')[1];
    const blob = await (await fetch(dataUrl)).blob();
    if (blob.size > 5 * 1024 * 1024) throw new Error('image-too-large');
    return { blob, base64, mimeType: 'image/jpeg' };
  } finally {
    bitmap.close();
  }
}
