/**
 * Data local no formato AAAA-MM-DD.
 * `toISOString()` usa UTC: no Brasil (UTC−3), um cadastro feito depois das 21h
 * sairia com a data do dia seguinte.
 */
export function localDateISO(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
