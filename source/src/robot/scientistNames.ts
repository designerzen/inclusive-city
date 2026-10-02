export function parseScientistSurnames(text: string): string[] {
  const unique = new Map<string, string>();
  for (const line of text.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const name = line.trim().normalize('NFC');
    if (!name || name.startsWith('#')) continue;
    if (name.length > 60) throw new Error('Scientist surnames must fit the robot name field.');
    unique.set(name.toLocaleLowerCase('en'), name);
  }
  const names = [...unique.values()];
  if (names.length < 2) throw new Error('At least two scientist surnames are required.');
  return names;
}
