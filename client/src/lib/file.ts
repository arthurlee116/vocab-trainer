import type { ImageFile, ImageValidationResult } from '../types';
import { MAX_VLM_IMAGES } from '../constants/upload';

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const filesToBase64Array = async (files: File[]): Promise<string[]> => {
  const base64Array = await Promise.all(files.map((file) => fileToBase64(file)));
  return base64Array;
};

export const validateImageFiles = (
  files: FileList | File[],
  existingCount: number = 0
): ImageValidationResult => {
  const fileArray = Array.from(files);
  const valid: ImageFile[] = [];
  const errors: string[] = [];

  if (fileArray.length > MAX_VLM_IMAGES) {
    errors.push(`单次最多只能选择 ${MAX_VLM_IMAGES} 张图片`);
  }

  const totalCount = existingCount + fileArray.length;
  if (totalCount > MAX_VLM_IMAGES) {
    const allowedCount = MAX_VLM_IMAGES - existingCount;
    if (allowedCount <= 0) {
      errors.push(`已达到 ${MAX_VLM_IMAGES} 张图片的上限，请删除部分图片后再试`);
      return { valid: [], errors };
    }
    fileArray.splice(allowedCount);
    errors.push(`已自动截取前 ${allowedCount} 张图片（最多 ${MAX_VLM_IMAGES} 张）`);
  }

  for (const file of fileArray) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      errors.push(`文件 "${file.name}" 格式不支持，请使用 PNG/JPEG/WEBP/GIF 格式`);
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      errors.push(`文件 "${file.name}" 大小超过 5MB 限制`);
      continue;
    }

    const preview = URL.createObjectURL(file);
    valid.push({
      file,
      preview,
      id: `${file.name}-${file.size}-${file.lastModified}`,
    });
  }

  return { valid, errors };
};

export const revokeObjectUrls = (images: ImageFile[]) => {
  images.forEach((img) => {
    URL.revokeObjectURL(img.preview);
  });
};
