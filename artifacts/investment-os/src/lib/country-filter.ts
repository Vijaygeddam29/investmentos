/**
 * Alias map: ISO-2 code (and common abbreviations) → substrings of the full country name.
 * Used to make the country Combobox match "US" → "United States", "UK" → "United Kingdom", etc.
 */
const COUNTRY_ALIASES: Record<string, string[]> = {
  us:  ["united states"],
  usa: ["united states"],
  uk:  ["united kingdom"],
  gb:  ["united kingdom"],
  gbr: ["united kingdom"],
  in:  ["india"],
  ind: ["india"],
  de:  ["germany"],
  deu: ["germany"],
  fr:  ["france"],
  fra: ["france"],
  it:  ["italy"],
  ita: ["italy"],
  cn:  ["china"],
  chn: ["china"],
  tw:  ["taiwan"],
  twn: ["taiwan"],
  nl:  ["netherlands"],
  nld: ["netherlands"],
  ca:  ["canada"],
  can: ["canada"],
  au:  ["australia"],
  aus: ["australia"],
  br:  ["brazil"],
  bra: ["brazil"],
  dk:  ["denmark"],
  dnk: ["denmark"],
  hk:  ["hong kong"],
  ie:  ["ireland"],
  irl: ["ireland"],
  il:  ["israel"],
  isr: ["israel"],
  sg:  ["singapore"],
  sgp: ["singapore"],
  ch:  ["switzerland"],
  che: ["switzerland"],
  uy:  ["uruguay"],
  ury: ["uruguay"],
};

/**
 * A Combobox `filterFn` for country options.
 * Handles:
 *  - Standard substring matching on the full option label (incl. emoji prefix)
 *  - Alias lookup: "US", "UK", "IN", etc. expand to the full country name for matching
 */
export function countryFilterFn(option: string, query: string): boolean {
  if (!query) return true;
  const q    = query.toLowerCase().trim();
  const text = option.toLowerCase();

  if (text.includes(q)) return true;

  const aliases = COUNTRY_ALIASES[q];
  if (aliases) {
    return aliases.some(alias => text.includes(alias));
  }

  return false;
}
