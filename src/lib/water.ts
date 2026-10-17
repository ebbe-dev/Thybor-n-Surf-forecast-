// Vandtemperaturen og våddragten. Temperaturen er vejrtjenestens
// overfladetemperatur ude ved bølgepunktet (Météo-Frances havmodel via
// Open-Meteo). Våddragten er en tommelfingerregel for Vestkysten — ret
// grænserne her, når kroppen siger noget andet. docs/surf-science.md §15.

export const WETSUIT_STEPS: { from: number; hint: string }[] = [
  { from: 20, hint: "3/2 eller shorty" },
  { from: 17, hint: "3/2" },
  { from: 14, hint: "3/2 eller 4/3" },
  { from: 11, hint: "4/3 + støvler" },
  { from: 8, hint: "5/4 + hætte, støvler og handsker" },
  { from: -Infinity, hint: "6/5 + hætte, støvler og handsker" }
];

export function wetsuitHint(sst: number): string {
  for (const s of WETSUIT_STEPS) if (sst >= s.from) return s.hint;
  return WETSUIT_STEPS[WETSUIT_STEPS.length - 1].hint;
}
