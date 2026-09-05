const NBSP = ' ';

/** Signe moins typographique, pour ne pas mélanger deux glyphes selon le mode. */
const MOINS = '−';

export function euros(montant: number): string {
  const abs = Math.abs(montant);
  const signe = montant < 0 ? MOINS : '';
  if (abs >= 1e9) return `${signe}${nombre(abs / 1e9, 1)}${NBSP}Md${NBSP}€`;
  if (abs >= 1e6) return `${signe}${nombre(abs / 1e6, 1)}${NBSP}M${NBSP}€`;
  if (abs >= 1e3) return `${signe}${nombre(abs / 1e3, 0)}${NBSP}k${NBSP}€`;
  return `${signe}${nombre(abs, 0)}${NBSP}€`;
}

export function eurosPrecis(montant: number): string {
  return `${nombre(montant, 0)}${NBSP}€`;
}

/**
 * Montant signé à l'euro près. À l'échelle d'un foyer, arrondir au millier
 * effacerait l'essentiel de l'information.
 */
export function eurosPrecisSigne(montant: number): string {
  if (Math.round(montant) === 0) return `0${NBSP}€`;
  return `${montant > 0 ? '+' : MOINS}${nombre(Math.abs(montant), 0)}${NBSP}€`;
}

/** Montant signé, pour les soldes : le « + » d'un excédent doit être explicite. */
export function eurosSigne(montant: number): string {
  if (montant === 0) return `0${NBSP}€`;
  return montant > 0 ? `+${euros(montant)}` : euros(montant);
}

export function nombre(n: number, decimales = 0): string {
  return n.toLocaleString('fr-FR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function pourcent(part: number): string {
  return `${nombre(part * 100, 1)}${NBSP}%`;
}

export function parHabitant(montant: number, population?: number): string | null {
  if (!population) return null;
  return `${nombre(montant / population, 0)}${NBSP}€/hab.`;
}
