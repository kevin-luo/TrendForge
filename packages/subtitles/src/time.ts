export function toSrtTime(seconds: number): string {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const milli = ms % 1000;
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(milli).padStart(3, "0")}`;
}

export function toVttTime(seconds: number): string {
  return toSrtTime(seconds).replace(",", ".");
}

export function toAssTime(seconds: number): string {
  const centiseconds = Math.round(seconds * 100);
  const h = Math.floor(centiseconds / 360000);
  const m = Math.floor((centiseconds % 360000) / 6000);
  const s = Math.floor((centiseconds % 6000) / 100);
  const cs = centiseconds % 100;
  return `${h}:${pad(m)}:${pad(s)}.${String(cs).padStart(2, "0")}`;
}

export function parseTime(value: string): number {
  const normalized = value.trim().replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length < 3) return 0;
  const [h, m, sec] = parts;
  return Number(h) * 3600 + Number(m) * 60 + Number(sec);
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}
