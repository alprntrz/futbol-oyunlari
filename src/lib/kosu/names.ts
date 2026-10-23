/**
 * Dribbling Rush 3D: the footballers whose names are spelt with the letters on the pitch. Well-known names only,
 * as players know them (one word, uppercase A–Z, Turkish letters and accents folded like `normalizeAnswer`),
 * 4–9 letters so a name is done in under a minute.
 */
export const RUSH_NAMES = [
  "MESSI", "RONALDO", "PELE", "ZIDANE", "NEYMAR", "KAKA", "HAALAND", "MBAPPE", "SALAH", "MODRIC",
  "KANE", "PIRLO", "XAVI", "INIESTA", "HENRY", "BECKHAM", "MALDINI", "BUFFON", "TOTTI", "BENZEMA",
  "DROGBA", "KROOS", "PEDRI", "YAMAL", "SUAREZ", "PUYOL", "RAMOS", "NEUER", "OZIL", "HAGI",
  "CRUYFF", "MARADONA", "BAGGIO", "EUSEBIO", "PUSKAS", "FIGO", "GULER", "SUKUR", "RUSTU", "VINICIUS",
  "RODRI", "SAKA", "MUSIALA", "KOVACIC", "LAUDRUP", "KLOSE", "MULLER", "CASILLAS", "ROONEY", "GERRARD",
];

/** a shuffled run of names (no repeats until the list runs out) */
export function rushWords(rand: () => number = Math.random): string[] {
  const a = [...RUSH_NAMES];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
