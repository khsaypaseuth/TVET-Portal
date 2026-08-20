export type PeriodPreset = 'week' | 'month' | 'custom';

/** Local calendar date YYYY-MM-DD (avoid UTC shift from toISOString). */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekRange(ref = new Date()): { start: string; end: string } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toISODate(start), end: toISODate(end) };
}

export function getMonthRange(ref = new Date()): { start: string; end: string } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { start: toISODate(start), end: toISODate(end) };
}

export function resolvePeriod(
  preset: PeriodPreset,
  customStart?: string,
  customEnd?: string
): { start: string; end: string } {
  if (preset === 'week') return getWeekRange();
  if (preset === 'month') return getMonthRange();
  const today = toISODate(new Date());
  return {
    start: customStart || getMonthRange().start,
    end: customEnd || today,
  };
}

export function formatHours(minutes: number | null | undefined): string {
  return ((minutes || 0) / 60).toFixed(1);
}

/** Digits only for wa.me; keeps country code if present */
export function whatsappDigits(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 8) return null;
  // Lao local 20xxxxxxxx → 85620xxxxxxxx
  if (digits.startsWith('20') && digits.length >= 10) return `856${digits}`;
  if (digits.startsWith('856')) return digits;
  return digits;
}

export function whatsappUrl(phone?: string | null): string | null {
  const d = whatsappDigits(phone);
  return d ? `https://wa.me/${d}` : null;
}
