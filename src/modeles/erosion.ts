import type { Instrument } from './instruments';

/**
 * Érosion de l'assiette par le taux.
 *
 * Le moteur supposait jusqu'ici qu'un prélèvement relevé rapporte
 * proportionnellement à la hausse : doubler l'impôt sur les sociétés doublait la
 * recette. C'est faux, et pas d'un peu. Une assiette réagit à ce qu'on lui
 * prélève — les revenus élevés et les capitaux sont mobiles, les entreprises
 * ferment ou se déplacent, une partie de l'activité cesse d'être déclarée.
 *
 * ATTENTION : ce mécanisme est grossier, et il faut le lire comme tel.
 * Contrairement à la sensibilité du profit — déduite d'une identité comptable —
 * ou à celle de l'impôt sur le revenu — calculée sur le barème publié —, les
 * valeurs ci-dessous sont des ordres de grandeur choisis. Aucune n'est extraite
 * d'une publication. Elles disent un sens et une hiérarchie, pas une ampleur.
 *
 * Ce qu'elles ne disent pas non plus : l'assiette qui s'érode part quelque part.
 * Une entreprise qui ferme détruit de l'activité, un capital qui s'expatrie la
 * déplace, un revenu non déclaré reste dépensé sur place. Ces trois cas n'ont
 * pas le même effet macroéconomique, et le moteur ne les distingue pas. Il ne
 * retient que le manque à gagner fiscal ; la perte d'activité correspondante
 * n'est portée que par le multiplicateur, qui en couvre une partie sans qu'on
 * sache laquelle.
 *
 * ─── La forme retenue ───
 *
 * Pour un prélèvement de rendement R au taux τ, relever τ d'une proportion x
 * donne un rendement R(1 + x)(1 − εx) : le taux monte de x, l'assiette recule de
 * εx. Le rendement supplémentaire réellement encaissé vaut donc
 *
 *     ΔR = R · x · (1 − ε(1 + x))
 *
 * contre R · x si l'assiette ne bougeait pas. Trois propriétés en découlent,
 * toutes vérifiées par des tests :
 *
 *   — une hausse rapporte toujours moins que proportionnellement ;
 *   — au-delà de x* = (1 − ε) / 2ε, elle rapporte moins en valeur absolue :
 *     c'est le retournement, que le modèle produit sans qu'on l'y mette ;
 *   — supprimer entièrement un prélèvement (x = −1) coûte exactement son
 *     rendement, ni plus ni moins — il n'y a plus d'assiette à éroder.
 */

/**
 * Sensibilité de chaque assiette à son propre taux.
 *
 * La hiérarchie est le seul contenu solide : le bénéfice des sociétés est la
 * base la plus mobile — se déclarer ailleurs demande une écriture —, le coût du
 * travail décide de fermetures et de délocalisations, les revenus élevés
 * arbitrent entre travail, capital et résidence, tandis que la consommation
 * taxée ne fuit guère au-delà d'une frontière proche.
 */
export const EROSION: Record<Instrument, number> = {
  impot_entreprises: 0.6,
  cotisations: 0.4,
  impot_menages: 0.3,
  impot_consommation: 0.2,
  autre: 0.2,
  // Une dépense n'a pas d'assiette à éroder.
  investissement: 0,
  fonctionnement: 0,
  transferts: 0,
  charge_dette: 0,
};

/** Point où une hausse supplémentaire cesse de rapporter, en proportion du taux. */
export function retournement(e: number): number | null {
  return e <= 0 ? null : (1 - e) / (2 * e);
}

/**
 * Rendement réellement encaissé d'une variation de prélèvement.
 *
 * `delta` est la variation décidée à assiette figée, `rendement` le rendement
 * publié du prélèvement. Le résultat est ce qui reste une fois l'assiette
 * ajustée — inférieur en valeur absolue pour une hausse, et supérieur pour une
 * baisse, puisqu'une assiette allégée s'élargit.
 */
export function rendementReel(delta: number, rendement: number, e: number): number {
  if (delta === 0 || rendement <= 0 || e <= 0) return delta;
  const x = delta / rendement;

  // Passé le retournement, le rendement reste à son maximum au lieu de suivre la
  // formule. Celle-ci décroît ensuite jusqu'à devenir négative, ce qui ferait
  // dire à l'outil qu'une taxe démesurée ne rapporte rien, voire coûte — une
  // affirmation bien plus forte que ce que le mécanisme autorise. Ce qu'il
  // permet de dire s'arrête à : au-delà de ce point, relever le taux n'apporte
  // plus rien. Le plateau dit exactement cela, et pas davantage.
  const seuil = retournement(e);
  const borne = seuil === null ? x : Math.min(x, Math.max(seuil, -1));
  const utile = delta >= 0 ? borne : x;

  return rendement * utile * (1 - e * (1 + utile));
}

/** Supplément maximal qu'un prélèvement peut rapporter, quel que soit son taux. */
export function rendementMaximal(rendement: number, e: number): number {
  const seuil = retournement(e);
  if (seuil === null || seuil <= 0) return Infinity;
  return rendement * seuil * (1 - e * (1 + seuil));
}

/** Vrai quand la hausse dépasse le point de retournement du prélèvement. */
export function saturee(delta: number, rendement: number, e: number): boolean {
  if (delta <= 0 || rendement <= 0 || e <= 0) return false;
  const seuil = retournement(e);
  return seuil !== null && delta / rendement > seuil;
}
