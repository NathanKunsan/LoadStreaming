export function toLocalMediaUrl(filePath: string): string {
  if (!filePath) return '';
  return `local-media://media/stream?path=${encodeURIComponent(filePath)}`;
}

export function formatMediaTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

const STUDIO_PALETTES: [string, string, string][] = [
  ['#FACC15', '#18181B', '#F59E0B'],
  ['#38BDF8', '#0F172A', '#0284C7'],
  ['#F43F5E', '#18181B', '#E11D48'],
  ['#10B981', '#090D16', '#059669'],
  ['#A855F7', '#140F23', '#7E22CE'],
  ['#FB923C', '#1C1917', '#EA580C']
];

export function getDeterministicPalette(seedStr: string): [string, string, string] {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) >>> 0;
  }
  return STUDIO_PALETTES[hash % STUDIO_PALETTES.length];
}
