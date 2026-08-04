/** Prefer a compact render URL for list thumbnails when using Supabase public photos. */
export function avatarThumbUrl(
  raw: string | null | undefined,
  size = 80,
): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const url = raw.trim();
  if (!url || url.startsWith('blob:') || url.startsWith('data:')) return null;

  try {
    const marker = '/storage/v1/object/public/';
    const idx = url.indexOf(marker);
    if (idx === -1) return url;
    const base = url.slice(0, idx);
    const path = url.slice(idx + marker.length);
    return `${base}/storage/v1/render/image/public/${path}?width=${size}&height=${size}&resize=cover`;
  } catch {
    return url;
  }
}

export function profileAvatarSource(user: {
  photos?: string[] | null;
  avatar_url?: string | null;
}): string | null {
  const fromPhotos = Array.isArray(user.photos)
    ? user.photos.find((u) => typeof u === 'string' && u.trim().length > 0)
    : null;
  const raw = fromPhotos || user.avatar_url || null;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}
