// Downscales a photo on the device before upload. Phone photos are 3–10 MB; Vercel refuses request bodies
// above 4.5 MB, and a small file also uploads faster on mobile data.
// Falls back to the original file when the browser cannot decode it (e.g. HEIC on Android/desktop).
export async function shrinkPhoto(file: File, maxSide = 2000): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 2.5e6 && file.type === 'image/jpeg') return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
    return blob || file;
  } catch {
    return file;
  }
}
