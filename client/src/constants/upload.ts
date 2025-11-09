const parsed = Number(import.meta.env.VITE_MAX_VLM_IMAGES ?? '5');

export const MAX_VLM_IMAGES = Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
