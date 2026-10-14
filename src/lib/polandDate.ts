const DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Warsaw",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Data kalendarzowa w Europe/Warsaw, format YYYY-MM-DD. */
export function polandDateString(date = new Date()): string {
  return DATE.format(date);
}

/** Następny dzień kalendarzowy w Europe/Warsaw. */
export function polandTomorrowString(date = new Date()): string {
  const [year, month, day] = polandDateString(date).split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
