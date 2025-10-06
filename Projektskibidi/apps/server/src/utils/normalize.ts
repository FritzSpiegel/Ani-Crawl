const umlautMap: Record<string, string> = {
  ä: "a",
  ö: "o",
  ü: "u",
  Ä: "A",
  Ö: "O",
  Ü: "U",
  ß: "ss",
};

const typoMap: Record<string, string> = {
  narutu: "naruto",
};

export function normalizeTitle(input: string): string {
  const replaced = input
    .replace(/[äöüÄÖÜß]/g, (m) => umlautMap[m] || m)
    .toLowerCase();
  const stripped = replaced
    .replace(/[.,:;!?'"()\[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const mapped = typoMap[stripped] || stripped;
  return mapped;
}

export function slugify(input: string): string {
  return normalizeTitle(input).replace(/\s+/g, "-");
}
