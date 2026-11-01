import { dayNumber } from "@/lib/daily";
import { ARCHIVE_DAYS } from "@/lib/plus";

/**
 * `?day=N` on a daily screen (app/arsiv.tsx opens past days): the day number if it's a past day
 * inside the archive window, else null (today, garbage, or too far back all mean "today").
 */
export function archiveDay(param: string | string[] | undefined): number | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw) return null;
  const day = Number(raw);
  const today = dayNumber();
  if (!Number.isInteger(day) || day >= today || day < today - ARCHIVE_DAYS) return null;
  return day;
}
