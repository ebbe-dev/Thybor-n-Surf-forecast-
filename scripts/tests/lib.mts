// Lille testhjælper uden ramme: check / near / done, og en localStorage til
// de moduler, der rører den ved kald (config/spots, lib/calibration).
let total = 0;
let failed = 0;

export function check(name: string, ok: boolean, detail = ""): void {
  total++;
  if (ok) console.log(`  ok   ${name}`);
  else {
    failed++;
    console.log(`  FEJL ${name}${detail ? " — " + detail : ""}`);
  }
}

export const near = (a: number, b: number, tol = 0.05): boolean => Math.abs(a - b) <= tol;

export function done(suite: string): void {
  console.log(`${suite}: ${total - failed} af ${total} tjek ok`);
  if (failed > 0) process.exitCode = 1;
}

export function fakeLocalStorage(init: Record<string, string> = {}): void {
  const m = new Map(Object.entries(init));
  const store = {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    }
  };
  (globalThis as unknown as { localStorage: unknown }).localStorage = store;
}
