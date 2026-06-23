/**
 * 图片压缩限制
 * 最大尺寸：1920px（宽或高超过时等比缩放）
 * 最大文件大小：2MB（通过调整质量参数控制）
 */

const MAX_DIMENSION = 1920;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.4;

export interface CompressResult {
  data: Uint8Array;
  width: number;
  height: number;
  size: number;
}

/**
 * 压缩图片：限制尺寸和文件大小
 */
export async function compressImage(
  imageData: Uint8Array,
  mimeType: string = 'image/png'
): Promise<CompressResult> {
  // 首先通过 ImageData 检测尺寸
  const blob = new Blob([imageData], { type: mimeType });
  const bitmap = await createImageBitmap(blob);

  let width = bitmap.width;
  let height = bitmap.height;
  let needResize = false;

  // 如果尺寸超出最大限制，等比缩放
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.round(height * (MAX_DIMENSION / width));
      width = MAX_DIMENSION;
    } else {
      width = Math.round(width * (MAX_DIMENSION / height));
      height = MAX_DIMENSION;
    }
    needResize = true;
  }

  // 如果不需要缩放且是 PNG，直接返回原数据
  if (!needResize && mimeType === 'image/png' && imageData.length <= MAX_FILE_SIZE) {
    bitmap.close();
    return { data: imageData, width, height, size: imageData.length };
  }

  // 使用 canvas 压缩
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // 尝试用不同质量参数压缩，直到满足文件大小要求
  let quality = INITIAL_QUALITY;
  let compressedBlob: Blob | null = null;

  while (quality >= MIN_QUALITY) {
    compressedBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', quality)
    );
    if (compressedBlob.size <= MAX_FILE_SIZE) break;
    quality -= 0.1;
  }

  if (!compressedBlob) {
    compressedBlob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/jpeg', MIN_QUALITY)
    );
  }

  const buf = await compressedBlob.arrayBuffer();
  return {
    data: new Uint8Array(buf),
    width,
    height,
    size: compressedBlob.size,
  };
}
