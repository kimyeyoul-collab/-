export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 3:42 */
export const formatTime = (seconds: number) => {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};

/** 00:42.6 — recording HUD */
export const formatTicks = (seconds: number) => {
  const total = Math.max(0, seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  const cs = Math.floor((total % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs}`;
};

export const formatWon = (value: number) => `₩${Math.round(value).toLocaleString('ko-KR')}`;

export const formatCount = (value: number) => {
  if (value >= 10000) return `${(value / 10000).toFixed(value >= 100000 ? 0 : 1)}만`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}천`;
  return String(value);
};

export const formatBytes = (bytes: number) => {
  if (bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

let counter = 0;
export const uid = (prefix = 'id') => {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
};

/**
 * Greedy word wrap used for karaoke subtitles: Korean breaks mid-word in narrow
 * boxes, so we pack words into rows ourselves.
 */
export const wrapPhrase = (text: string, maxChars = 13): string[] => {
  const words = text.split(' ');
  const rows: string[] = [];
  let current = '';
  words.forEach(word => {
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
    } else {
      rows.push(current);
      current = word;
    }
  });
  if (current) rows.push(current);
  return rows;
};

export const todayLabel = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
};
