// Formatage date/heure dans le fuseau horaire du joueur.
// Tout est stocké en UTC ; on convertit ici à l'affichage.

const LOCALE = "fr-FR";

export function timeIn(tz: string, iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

// Clé YYYY-MM-DD (dans le fuseau du joueur) pour regrouper par journée
export function dayKey(tz: string, iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: tz,
  }).format(new Date(iso));
}

// Libellé lisible, ex. "Jeudi 11 juin"
export function dayLabel(tz: string, iso: string): string {
  const s = new Intl.DateTimeFormat(LOCALE, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: tz,
  }).format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
