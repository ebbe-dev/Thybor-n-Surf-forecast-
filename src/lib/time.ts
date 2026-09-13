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

const p = (n: number) => String(n).padStart(2, "0");

// Dags dato som "2026-09-13" i telefonens lokale tid.
export function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// Dagen efter en "YYYY-MM-DD"-dato. Regner fra middag, så skift til/fra
// sommertid ikke kan skubbe datoen.
export function nextDate(date: string): string {
  const d = new Date(date + "T12:00");
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isToday(iso: string): boolean {
  return dateOf(iso) === todayIso();
}

// "i dag" / "i morgen" / ugedag. Dommen og forsidelisten bruger den samme,
// så den samme blok hedder det samme begge steder.
export function relativeDayLabel(iso: string, today = todayIso()): string {
  const date = dateOf(iso);
  if (date === today) return "i dag";
  if (date === nextDate(today)) return "i morgen";
  return dayName(iso);
}

// Alle tider i appen ligger på hele timer, så "kl. 14" er nok.
export function fmtClock(iso: string): string {
  return iso.slice(11, 13);
}

const MONTHS = [
  "januar", "februar", "marts", "april", "maj", "juni",
  "juli", "august", "september", "oktober", "november", "december"
];
const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

// "15. juli 2026" (kort: "15. jul 2026") fra "2026-07-15…".
export function fmtDateDa(iso: string, short = false): string {
  const m = Number(iso.slice(5, 7)) - 1;
  return `${Number(iso.slice(8, 10))}. ${(short ? MONTHS_SHORT : MONTHS)[m]} ${iso.slice(0, 4)}`;
}

export function monthShort(monthIndex: number): string {
  return MONTHS_SHORT[monthIndex];
}

export function fmtDayLabel(iso: string): string {
  if (isToday(iso)) return "i dag";
  return dayName(iso, true) + " " + Number(iso.slice(8, 10)) + "/" + Number(iso.slice(5, 7));
}
