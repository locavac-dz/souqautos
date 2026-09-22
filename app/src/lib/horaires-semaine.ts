export const DAYS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"] as const;
export type DayKey = (typeof DAYS)[number];

export interface DaySchedule {
  open: boolean;
  debut: string; // "HH:MM"
  fin: string;   // "HH:MM"
}

export type WeekSchedule = Record<DayKey, DaySchedule>;

export function defaultWeekSchedule(): WeekSchedule {
  return Object.fromEntries(
    DAYS.map((d) => [d, { open: false, debut: "08:00", fin: "18:00" }])
  ) as WeekSchedule;
}

export function parseHorairesSemaine(raw: string | null | undefined): WeekSchedule | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const result: Partial<WeekSchedule> = {};
    for (const day of DAYS) {
      const entry = parsed[day];
      if (
        entry &&
        typeof entry === "object" &&
        typeof entry.open === "boolean" &&
        typeof entry.debut === "string" &&
        typeof entry.fin === "string"
      ) {
        result[day] = { open: entry.open, debut: entry.debut, fin: entry.fin };
      } else {
        result[day] = { open: false, debut: "08:00", fin: "18:00" };
      }
    }
    return result as WeekSchedule;
  } catch {
    return null;
  }
}

// Algeria is UTC+1 with no DST
const ALGERIA_OFFSET_MS = 60 * 60 * 1000;

function toAlgeriaDate(now: Date): Date {
  return new Date(now.getTime() + ALGERIA_OFFSET_MS);
}

export function isOpenNow(schedule: WeekSchedule, now: Date = new Date()): boolean {
  const local = toAlgeriaDate(now);
  const dayKey = DAYS[local.getUTCDay()]; // 0=Sunday=dim, 6=Saturday=sam
  const entry = schedule[dayKey];
  if (!entry.open || !entry.debut || !entry.fin) return false;
  const current = local.getUTCHours() * 60 + local.getUTCMinutes();
  const [dh, dm] = entry.debut.split(":").map(Number);
  const [fh, fm] = entry.fin.split(":").map(Number);
  return current >= dh * 60 + dm && current < fh * 60 + fm;
}

export function todayDayKey(now: Date = new Date()): DayKey {
  return DAYS[toAlgeriaDate(now).getUTCDay()];
}
