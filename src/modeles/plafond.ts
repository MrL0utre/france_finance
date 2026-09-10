import type { Assiettes } from '../schema';
import { ASSIETTE_DE, LIBELLES_ASSIETTE, type Assiette } from './assiettes';
import type { Instrument } from './instruments';

/**
 * Ce qu'il est matériellement possible de prélever.
 *
 * Le simulateur laissait relever un impôt sans borne, et créer une taxe d'un
 * montant libre. Rien n'empêchait donc de lever plus que le pays ne produit —
 * ce qui n'est pas une hypothèse discutable mais une impossibilité.
 *
 * La borne retenue est la seule qui ne demande aucun arbitrage : un prélèvement
 * ne peut pas dépasser son assiette. On ne prend pas 110 % de la masse salariale
 * ni 130 % du bénéfice des entreprises. Aucun coefficient à choisir, aucun seuil
 * à justifier — c'est de l'arithmétique, et l'assiette vient des comptes
 * nationaux publiés.
 *
 * Le plafond porte sur l'assiette et non sur l'impôt, parce que plusieurs
 * prélèvements se partagent la même : cotisations et impôt sur le revenu pèsent
 * tous deux sur la masse salariale, et c'est leur somme qui bute.
 *
 * ─── Ce que 100 % ne veut pas dire ───
 *
 * Atteindre le plafond n'est pas atteindre un point limite réaliste : bien
 * avant, personne ne travaillerait ni n'investirait. L'érosion de l'assiette
 * traduit déjà cette réaction et mord bien plus tôt. Le plafond n'est que le
 * dernier garde-fou, celui qui empêche le simulateur d'annoncer des recettes qui
 * n'existent nulle part. C'est pourquoi le taux de prélèvement sur chaque
 * assiette est affiché : le voir monter apprend davantage que la borne
 * elle-même.
 */

/** Assiette du poste résiduel : faute d'assiette propre, l'économie entière. */
export const ASSIETTE_RESIDUELLE = 'PIB';

export type Pression = {
  assiette: Assiette | null;
  /** Libellé de l'assiette, ou du repère qui en tient lieu. */
  label: string;
  /** Ce qui est prélevé dessus, une fois le scénario appliqué. */
  preleve: number;
  /** Le montant sur lequel on prélève. */
  base: number;
  /** Part de l'assiette prélevée, en pourcentage. */
  taux: number;
  /** Le plafond est-il atteint ? */
  plafonnee: boolean;
};

/** Montant sur lequel chaque prélèvement est assis. */
export function baseDe(
  instrument: Instrument,
  assiettes: Assiettes | null,
  pib: number,
): { assiette: Assiette | null; base: number } {
  const assiette = ASSIETTE_DE[instrument] ?? null;
  if (assiette === null) return { assiette: null, base: pib };
  return { assiette, base: assiettes ? assiettes[assiette] : 0 };
}

/**
 * Pression exercée sur chaque assiette par un jeu de recettes.
 *
 * `recettes` porte les rendements par instrument, scénario compris. Le résultat
 * est trié du plus tendu au moins tendu : c'est l'assiette qui bute en premier
 * qui informe.
 */
export function pressions(
  recettes: Record<string, number>,
  assiettes: Assiettes | null,
  pib: number,
): Pression[] {
  const cumul = new Map<string, { assiette: Assiette | null; preleve: number; base: number }>();

  for (const [cle, montant] of Object.entries(recettes ?? {})) {
    if (montant === 0) continue;
    const { assiette, base } = baseDe(cle as Instrument, assiettes, pib);
    const k = assiette ?? ASSIETTE_RESIDUELLE;
    const courant = cumul.get(k) ?? { assiette, preleve: 0, base };
    courant.preleve += montant;
    cumul.set(k, courant);
  }

  return [...cumul.entries()]
    .map(([k, v]) => ({
      assiette: v.assiette,
      label: v.assiette ? LIBELLES_ASSIETTE[v.assiette] : k,
      preleve: v.preleve,
      base: v.base,
      taux: v.base === 0 ? 0 : (v.preleve / v.base) * 100,
      // La tolérance évite qu'un arrondi fasse clignoter l'alerte à 99,999 %.
      plafonnee: v.base > 0 && v.preleve >= v.base * 0.9999,
    }))
    .sort((a, b) => b.taux - a.taux);
}

/**
 * Ramène chaque assiette sous son plafond, en réduisant proportionnellement les
 * prélèvements qui y sont assis.
 *
 * Proportionnellement, parce que rien ne désigne lequel devrait céder : si les
 * cotisations et l'impôt sur le revenu dépassent ensemble la masse salariale, il
 * n'y a pas de raison de rogner l'un plutôt que l'autre.
 *
 * Renvoie les rendements corrigés et la part qui a dû être abandonnée.
 */
export function appliquerPlafond(
  recettes: Record<string, number>,
  assiettes: Assiettes | null,
  pib: number,
): { corrigees: Record<string, number>; retranche: number } {
  const corrigees = { ...recettes };
  let retranche = 0;

  const parAssiette = new Map<string, { base: number; instruments: string[]; total: number }>();
  for (const [cle, montant] of Object.entries(recettes ?? {})) {
    const { assiette, base } = baseDe(cle as Instrument, assiettes, pib);
    const k = assiette ?? ASSIETTE_RESIDUELLE;
    const courant = parAssiette.get(k) ?? { base, instruments: [], total: 0 };
    courant.instruments.push(cle);
    courant.total += montant;
    parAssiette.set(k, courant);
  }

  for (const { base, instruments, total } of parAssiette.values()) {
    if (base <= 0 || total <= base) continue;
    const facteur = base / total;
    for (const cle of instruments) corrigees[cle] = (corrigees[cle] ?? 0) * facteur;
    retranche += total - base;
  }

  return { corrigees, retranche };
}
