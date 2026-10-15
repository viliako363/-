export const MAX_PHOTOS = 10;
export function productPhotos(product) {
  const raw = Array.isArray(product.photos) ? product.photos : product.photo ? [product.photo] : [];
  return [...new Set(raw.filter(value => typeof value === 'string').map(value => value.trim()).filter(value => {
    if (/^\/api\/photo\?id=[a-f0-9-]+\.(jpg|png|webp)$/.test(value)) return true;
    try { return value.length <= 1500 && new URL(value).protocol === 'https:'; } catch { return false; }
  }))].slice(0, MAX_PHOTOS);
}
