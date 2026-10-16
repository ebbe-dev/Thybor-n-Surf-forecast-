// Målte tal fra kysten: Kystdirektoratets bølgebøje ved Fjaltring og DMI's
// vandstand ved Thyborøn Kyst. Hverken kyst.dk eller DMI sender CORS-
// hoveder, så browseren kan ikke hente dem selv. GitHub Actions henter dem
// hver halve time (scripts/fetch-obs.mjs, .github/workflows/obs.yml) og
// lægger obs.json på grenen "data" — raw.githubusercontent.com tillader
// kald fra appen.
//
// Fail-open: kan filen ikke hentes, vises det sidst hentede fra
// localStorage, og findes det heller ikke, siger appen "ikke hentet".
// Målingerne rører ALDRIG scoren — de står ved siden af forecasten, så
// man kan se, hvor modellen ligger (lib/obs.ts).

export const OBS_URL =
  "https://raw.githubusercontent.com/ebbe-dev/Thybor-n-Surf-forecast-/data/obs.json";

export interface BuoyRow {
  time: string; // ISO UTC
  hs: number; // signifikant bølgehøjde H_M0, m
  tp: number | null; // spektral signifikant periode T_s (≈ topperioden) — tom hos 2035
  tz: number | null; // middelperiode T_z, s — ligger 20-30 % under topperioden
  hmax: number | null; // største enkeltbølge, m
  tmax: number | null; // den største bølges periode, s
  dir: number | null; // bølgerne kommer fra, grader
}

export interface LevelRow {
  time: string; // ISO UTC
  m: number; // vandstand i m over middel (DVR90)
}

export interface Obs {
  fetchedAt: string; // ISO UTC — hvornår obs.json blev skrevet
  hours: number; // så langt tilbage rækkerne går
  buoy: {
    ident: string;
    name: string;
    source: string;
    header: string;
    rows: BuoyRow[];
    period?: "T_s" | "T_z"; // hvilken periode den nyeste række bærer
  } | null;
  level: { stationId: string; name: string; parameter: string; rows: LevelRow[] } | null;
  errors: string[];
}

const KEY = "bygtangen.obs1";

export async function fetchObs(): Promise<Obs> {
  // raw.githubusercontent.com cacher i op til 5 min; minut-stemplet holder
  // browserens egen cache ude af billedet.
  const res = await fetch(`${OBS_URL}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`obs.json svarede ${res.status}`);
  const body = (await res.json()) as Partial<Obs>;
  if (typeof body.fetchedAt !== "string") throw new Error("obs.json: uventet form");
  return {
    fetchedAt: body.fetchedAt,
    hours: typeof body.hours === "number" ? body.hours : 48,
    buoy: body.buoy && Array.isArray(body.buoy.rows) ? body.buoy : null,
    level: body.level && Array.isArray(body.level.rows) ? body.level : null,
    errors: Array.isArray(body.errors) ? body.errors : []
  };
}

export function saveObs(o: Obs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    // fuld storage er ikke kritisk
  }
}

export function loadObs(): Obs | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Obs;
    if (typeof o.fetchedAt !== "string") return null;
    return { ...o, buoy: o.buoy ?? null, level: o.level ?? null, errors: o.errors ?? [] };
  } catch {
    return null;
  }
}
