// To tryk på det samme inden for DOUBLE_TAP_MS er ét dobbelttryk. Første
// tryk gør det, et tryk plejer; andet tryk åbner kortet. Tælleren bor hos
// kalderen (en ref), så den overlever genrenderinger.

export const DOUBLE_TAP_MS = 400;

export function isDoubleTap(store: Map<string, number>, key: string, now = Date.now()): boolean {
  const last = store.get(key) ?? 0;
  if (now - last < DOUBLE_TAP_MS) {
    store.delete(key);
    return true;
  }
  store.set(key, now);
  return false;
}
