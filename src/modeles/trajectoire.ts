import type { Calibration } from './moteur';
import type { Contexte, Impulsion } from './types';

/**
 * Projection pluriannuelle.
 *
 * Le moteur statique répondait à « quel effet cette année ». Celui-ci déroule un
 * sentier, ce qui rend enfin visibles deux mécanismes que l'annuel ne pouvait pas
 * montrer :
 *
 *   — les chantiers, dont la dépense s'étale sur des années et s'arrête ensuite ;
 *   — la boucle dette-intérêts, où un déficit accru alourdit la charge, qui
 *     creuse le déficit de l'année suivante, et ainsi de suite.
 *
 * Tout est exprimé en **écart au scénario de référence**. Aucune prévision de
 * croissance, d'inflation ou de solde tendanciel n'est faite : les projections
 * disent ce que le scénario change, pas où en seront les finances publiques.
 */

export type Impulsions = {
  /** Mesures reconduites chaque année : leur impulsion se répète à l'identique. */
  permanentes: Impulsion[];
  /** Dépenses limitées dans le temps, par année de projection. */
  parAnnee: Map<number, Impulsion[]>;
};

export type AnneeProjection = {
  annee: number;
  /** Impulsion budgétaire décidée cette année, en écart. */
  impulsionDep: number;
  impulsionRec: number;
  /** Écart d'activité, en euros et en points de PIB. */
  pib: number;
  pibPct: number;
  recettesInduites: number;
  depensesInduites: number;
  /** Surcroît de charge d'intérêt dû à la dette accumulée par le scénario. */
  chargeInterets: number;
  /** Écart de solde, effets induits et charge comprise. */
  soldeVariation: number;
  /** Écart d'encours de dette, cumulé depuis le début de la projection. */
  detteEcart: number;
  /** Emplois, ordre de grandeur. */
  emploi: number;
};

export type Trajectoire = {
  annees: AnneeProjection[];
  /** Écart de dette à l'horizon. */
  detteFinale: number;
  /** Cumul des intérêts supplémentaires payés sur la période. */
  interetsCumules: number;
  /** Année du plus fort écart d'activité. */
  picActivite: AnneeProjection | null;
};

export type ParametresTrajectoire = {
  horizonAnnees: number;
  /** Taux servant à chiffrer les intérêts de la dette supplémentaire. */
  tauxApparent: number;
  premiereAnnee: number;
};

export function projeter(
  calibration: Calibration,
  impulsions: Impulsions,
  contexte: Contexte,
  p: ParametresTrajectoire,
): Trajectoire {
  const annees: AnneeProjection[] = [];
  let detteEcart = 0;
  let interetsCumules = 0;

  for (let i = 0; i < p.horizonAnnees; i++) {
    const cetteAnnee = [...impulsions.permanentes, ...(impulsions.parAnnee.get(i) ?? [])];

    let impulsionDep = 0;
    let impulsionRec = 0;
    let pib = 0;

    for (const imp of cetteAnnee) {
      const k = calibration.multiplicateurs[imp.instrument];
      if (imp.cote === 'rec') {
        impulsionRec += imp.delta;
        pib -= k * imp.delta;
      } else {
        impulsionDep += imp.delta;
        pib += k * imp.delta;
      }
    }

    const variationRelative = contexte.pib === 0 ? 0 : pib / contexte.pib;
    const recettesInduites = calibration.elasticiteRecettes * contexte.recettes * variationRelative;
    const depensesInduites = calibration.elasticiteDepenses * contexte.depenses * variationRelative;

    // Les intérêts portent sur la dette accumulée les années précédentes : la
    // dette de l'année en cours ne coûte encore rien. C'est ce décalage qui rend
    // la boucle progressive plutôt qu'immédiate.
    const chargeInterets = p.tauxApparent * Math.max(0, -detteEcart);
    interetsCumules += chargeInterets;

    const soldeVariation =
      impulsionRec - impulsionDep + recettesInduites - depensesInduites - chargeInterets;

    // Un solde dégradé creuse la dette ; un solde amélioré la réduit.
    detteEcart += soldeVariation;

    annees.push({
      annee: p.premiereAnnee + i,
      impulsionDep,
      impulsionRec,
      pib,
      pibPct: variationRelative * 100,
      recettesInduites,
      depensesInduites,
      chargeInterets,
      soldeVariation,
      detteEcart,
      emploi: contexte.pibParEmploi === 0 ? 0 : pib / contexte.pibParEmploi,
    });
  }

  const picActivite = annees.reduce<AnneeProjection | null>(
    (pic, a) => (!pic || Math.abs(a.pib) > Math.abs(pic.pib) ? a : pic),
    null,
  );

  return {
    annees,
    detteFinale: detteEcart,
    interetsCumules,
    picActivite: picActivite && picActivite.pib !== 0 ? picActivite : null,
  };
}

/** Profil de dépense d'un chantier : montant réparti sur sa durée. */
export function profilChantier(
  cout: number,
  dureeAnnees: number,
  debut: number,
  horizon: number,
): number[] {
  const profil = new Array<number>(horizon).fill(0);
  if (dureeAnnees <= 0) return profil;
  // Répartition linéaire : le rythme réel d'un chantier n'est pas publié, et une
  // courbe inventée donnerait une fausse impression de précision.
  const parAn = cout / dureeAnnees;
  for (let i = 0; i < dureeAnnees; i++) {
    const annee = debut + i;
    if (annee >= 0 && annee < horizon) profil[annee] += parAn;
  }
  return profil;
}
