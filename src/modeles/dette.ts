import type { Dette } from '../schema';

/**
 * Effet d'une variation des taux d'emprunt sur la charge de la dette.
 *
 * Le point décisif : **un État ne renégocie pas sa dette**. Ses titres déjà émis
 * portent un taux fixé à l'émission et sont remboursés à l'échéance ; il n'existe
 * pas d'équivalent souverain au rachat de crédit immobilier. Une variation de
 * taux ne s'applique donc qu'à la dette réémise dans l'année — de l'ordre du
 * programme de financement — puis se propage à l'encours au rythme de son
 * renouvellement, soit environ neuf ans en France.
 *
 * Confondre les deux est l'erreur classique : appliquer un point de taux à tout
 * l'encours donnerait près de 29 Md € dès la première année, contre environ 3.
 */

export type EffetTaux = {
  /** Variation de taux demandée, en points de pourcentage. */
  pointsDeTaux: number;
  /** Surcoût ou économie la première année. */
  chargeAnnee1: number;
  /** Surcoût ou économie une fois tout l'encours renouvelé. */
  chargeATerme: number;
  /** Années nécessaires pour que l'effet à terme soit atteint. */
  horizonAnnees: number;
  /** Taux apparent actuel, charge rapportée à l'encours. */
  tauxApparent: number;
};

export function effetTaux(dette: Dette, pointsDeTaux: number): EffetTaux {
  const taux = pointsDeTaux / 100;
  return {
    pointsDeTaux,
    chargeAnnee1: taux * dette.programmeFinancementAnnuel,
    chargeATerme: taux * dette.encours,
    horizonAnnees: dette.dureeVieMoyenneAnnees,
    tauxApparent: dette.encours === 0 ? 0 : dette.charge / dette.encours,
  };
}
