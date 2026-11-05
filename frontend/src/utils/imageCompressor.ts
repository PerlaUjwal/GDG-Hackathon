/**
 * Client-Side Image Compression using HTML5 Offscreen Canvas
 * Compresses images before transmission to stay below 180 KB.
 */
export async function compressImage(
  file: File,
  maxDimension = 1000,
  quality = 0.78
): Promise<{ dataUrl: string; sizeKb: number; originalSizeKb: number }> {
  return new Promise((resolve, reject) => {
    const originalSizeKb = Math.round(file.size / 1024);
    const reader = new FileReader();

    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for compression'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Scale down keeping aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Could not initialize canvas context'));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Try WebP first, fallback to JPEG
        let dataUrl = canvas.toDataURL('image/webp', quality);
        if (!dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        // Calculate size in KB from base64 length
        const base64Length = dataUrl.length - (dataUrl.indexOf(',') + 1);
        const sizeKb = Math.round((base64Length * 3) / 4 / 1024);

        resolve({ dataUrl, sizeKb, originalSizeKb });
      };

      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
  });
}

