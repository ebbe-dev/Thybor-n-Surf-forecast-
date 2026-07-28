// Solopgang/-nedgang (NOAA-tilnærmelse, ±3 min — rigeligt til at afgøre om
// en 3-timers blok er i dagslys). Regner i telefonens lokale tidszone, samme
// zone som alle forecast-tider.

const RAD = Math.PI / 180;

export type SunTimes = { sunrise: number; sunset: number } | "altid" | "aldrig";

// Fraktionelle lokale timer, fx 5.52 = kl. 05:31.
export function sunTimes(dateIso: string, lat: number, lon: number): SunTimes {
  const d = new Date(dateIso + "T12:00");
  const yearStart = new Date(d.getFullYear(), 0, 0);
  const N = Math.floor((d.getTime() - yearStart.getTime()) / 864e5);

  const B = (2 * Math.PI * (N - 81)) / 364;
  const eotMin = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  const dec = 23.45 * RAD * Math.sin((2 * Math.PI * (284 + N)) / 365);

  // -0,83°: solens skive + refraktion ved horisonten
  const cosH =
    (Math.sin(-0.83 * RAD) - Math.sin(lat * RAD) * Math.sin(dec)) /
    (Math.cos(lat * RAD) * Math.cos(dec));
  if (cosH > 1) return "aldrig"; // polarnat (sker ikke ved 56°N, men vær ærlig)
  if (cosH < -1) return "altid"; // midnatssol

  const H = Math.acos(cosH) / RAD / 15; // halvdagslængde i timer
  const tz = -d.getTimezoneOffset() / 60;
  const solarNoon = 12 - lon / 15 - eotMin / 60 + tz;
  return { sunrise: solarNoon - H, sunset: solarNoon + H };
}

// Hvor mange af blokkens 3 timer ligger i dagslys?
export function daylightOverlap(blockHour: number, st: SunTimes): number {
  if (st === "altid") return 3;
  if (st === "aldrig") return 0;
  return Math.max(0, Math.min(blockHour + 3, st.sunset) - Math.max(blockHour, st.sunrise));
}

export function fmtSunHour(h: number): string {
  const m = Math.round(((h % 24) + 24) % 24 * 60);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
