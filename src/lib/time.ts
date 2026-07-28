// 3-timers blokke til barografen. Værdien er timen på bloktidspunktet
// (05, 08, 11, 14, 17, 20) — ikke et gennemsnit.

export const BLOCK_HOURS = [5, 8, 11, 14, 17, 20];

const DAYS = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];
const DAYS_SHORT = ["søn", "man", "tir", "ons", "tor", "fre", "lør"];

// Open-Meteo leverer "2026-07-28T14:00" i lokal tid (Europe/Copenhagen).
export function dateOf(iso: string): string {
  return iso.slice(0, 10);
}

export function hourOf(iso: string): number {
  return Number(iso.slice(11, 13));
}

export function dayName(iso: string, short = false): string {
  const d = new Date(iso.slice(0, 10) + "T12:00");
  return (short ? DAYS_SHORT : DAYS)[d.getDay()];
}

export function isToday(iso: string): boolean {
  const now = new Date();
  const today =
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0");
  return dateOf(iso) === today;
}

export function fmtClock(iso: string): string {
  return iso.slice(11, 16);
}

export function fmtDayLabel(iso: string): string {
  if (isToday(iso)) return "i dag";
  return dayName(iso, true) + " " + Number(iso.slice(8, 10)) + "/" + Number(iso.slice(5, 7));
}
