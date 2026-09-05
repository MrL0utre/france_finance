import type { Instrument } from './instruments';
import type { Contexte, Effets, Impulsion, LigneEffet } from './types';

/**
 * Moteur de bouclage à multiplicateurs.
 *
 * Trois étages, dans cet ordre :
 *   1. l'impulsion budgétaire décidée agit sur l'activité, chaque instrument
 *      ayant son propre multiplicateur ;
 *   2. l'activité modifiée fait varier les recettes, via leur élasticité au PIB,
 *      et allège marginalement les dépenses sensibles au chômage ;
 *   3. le solde final additionne l'effet direct et ces effets induits.
 *
 * Le multiplicateur intègre déjà la boucle revenu-dépense : il ne faut donc pas
 * réinjecter les recettes induites dans un second tour, ce qui compterait deux
 * fois le même mécanisme.
 *
 * Le modèle est linéaire et statique. Il ne décrit pas l'étalement des effets
 * dans le temps et ne fait pas dépendre les multiplicateurs de la conjoncture.
 * La charge de la dette y entre comme une dépense ordinaire : le moteur ne
 * simule pas la dynamique dette-intérêts par lui-même.
 */

export type Calibration = {
  /** Multiplicateur d'activité par instrument, à un an. */
  multiplicateurs: Record<Instrument, number>;
  /** Élasticité des recettes au PIB. 1 signifie qu'elles suivent l'activité. */
  elasticiteRecettes: number;
  /**
   * Semi-élasticité des dépenses au PIB, négative : quand l'activité repart, les
   * dépenses liées au chômage refluent. L'essentiel du budget étant insensible
   * à la conjoncture, le coefficient est faible.
   */
  elasticiteDepenses: number;
};

export function calculerAvec(
  calibration: Calibration,
  impulsions: Impulsion[],
  contexte: Contexte,
): Effets {
  const lignes: LigneEffet[] = [];
  let soldeDirect = 0;
  let pib = 0;

  for (const imp of impulsions) {
    const k = calibration.multiplicateurs[imp.instrument];

    // Une dépense en plus dégrade le solde, une recette en plus l'améliore.
    soldeDirect += imp.cote === 'rec' ? imp.delta : -imp.delta;

    // Une dépense en plus soutient l'activité, un prélèvement en plus la freine.
    const effetPib = imp.cote === 'rec' ? -k * imp.delta : k * imp.delta;
    pib += effetPib;

    lignes.push({
      label: imp.label,
      instrument: imp.instrument,
      delta: imp.delta,
      multiplicateur: k,
      effetPib,
    });
  }

  const variationRelative = contexte.pib === 0 ? 0 : pib / contexte.pib;
  const recettesInduites = calibration.elasticiteRecettes * contexte.recettes * variationRelative;
  const depensesInduites = calibration.elasticiteDepenses * contexte.depenses * variationRelative;

  const soldeVariation = soldeDirect + recettesInduites - depensesInduites;

  return {
    soldeDirect,
    pib,
    pibPct: variationRelative * 100,
    recettesInduites,
    depensesInduites,
    soldeVariation,
    solde: contexte.soldeBase + soldeVariation,
    emploi: contexte.pibParEmploi === 0 ? 0 : pib / contexte.pibParEmploi,
    lignes: lignes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)),
  };
}

/** Calibration sans aucune rétroaction : tous les multiplicateurs sont nuls. */
export const CALIBRATION_NEUTRE: Calibration = {
  multiplicateurs: {
    investissement: 0,
    fonctionnement: 0,
    transferts: 0,
    impot_menages: 0,
    impot_consommation: 0,
    impot_entreprises: 0,
    cotisations: 0,
    charge_dette: 0,
    autre: 0,
  },
  elasticiteRecettes: 0,
  elasticiteDepenses: 0,
};
