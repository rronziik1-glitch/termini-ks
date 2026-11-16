// Links computed by code (never by the AI): maps.

export function mapsUrl(b: { name: string; address: string; city: string; lat?: number | null; lng?: number | null }) {
  const q = typeof b.lat === 'number' && typeof b.lng === 'number' ? `${b.lat},${b.lng}` : [b.name, b.address, b.city].filter(Boolean).join(', ');
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}
