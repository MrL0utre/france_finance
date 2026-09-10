import type { Calibration } from './moteur';
import { ASSIETTE_DE, betaDe, effetSurLesRecettes } from './assiettes';
import type { Assiettes } from '../schema';
import type { Instrument } from './instruments';
import { EROSION, rendementReel } from './erosion';
import { appliquerPlafond } from './plafond';
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
  /** Écart de recettes, décision encaissée et rétroaction comprises. */
  recettesEcart: number;
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

/**
 * Part de l'écart d'activité de l'année précédente qui se reporte sur la
 * suivante.
 *
 * Sans elle, le sentier était plat : une mesure permanente donnait la même ligne
 * dix ans de suite, parce qu'un modèle statique traite chaque année comme si
 * l'économie repartait du compte publié. Or une économie durablement plus faible
 * investit moins, perd des compétences et des capacités de production ; elle ne
 * retrouve pas le point de départ l'année suivante. C'est l'hystérèse, et elle
 * joue dans les deux sens — un soutien durable laisse aussi une trace.
 *
 * VALEUR CHOISIE, comme les multiplicateurs et l'érosion : aucune publication
 * n'en est la source, et l'ampleur de ce mécanisme est très discutée. Ce qui est
 * sûr, c'est sa forme. Le report étant une fraction de l'écart, la série est
 * géométrique : l'écart converge vers 1 / (1 − ρ) fois l'effet immédiat, soit
 * environ 18 % de plus ici, et ne diverge jamais. Un test le vérifie, parce
 * qu'une valeur supérieure ou égale à 1 ferait exploser le sentier sans que
 * rien ne l'arrête.
 */
export const PERSISTANCE = 0.15;

export function projeter(
  calibration: Calibration,
  impulsions: Impulsions,
  contexte: Contexte,
  p: ParametresTrajectoire,
): Trajectoire {
  const annees: AnneeProjection[] = [];
  let detteEcart = 0;
  let interetsCumules = 0;
  /** Écart d'activité de l'année précédente, dont une part se reporte. */
  let ecartPrecedent = 0;

  for (let i = 0; i < p.horizonAnnees; i++) {
    const cetteAnnee = [...impulsions.permanentes, ...(impulsions.parAnnee.get(i) ?? [])];

    let impulsionDep = 0;
    let impulsionRec = 0;
    let pib = 0;

    /**
     * L'économie telle qu'elle se présente au début de l'année, et non telle
     * qu'elle était dans les comptes publiés.
     *
     * C'est ce qui rend le sentier dynamique : après un effondrement d'activité,
     * la masse salariale, la consommation et le profit sont plus faibles, donc
     * les mêmes taux y rapportent moins et les assiettes butent plus tôt.
     * L'écart de l'année précédente sert de référence — utiliser celui de
     * l'année en cours créerait une circularité.
     */
    const ratio = contexte.pib === 0 ? 0 : ecartPrecedent / contexte.pib;
    const facteur = (instrument: Instrument): number => {
      const a = ASSIETTE_DE[instrument];
      const beta = a && contexte.assiettes ? betaDe(a, contexte.assiettes) : 1;
      return Math.max(0, 1 + beta * ratio);
    };

    const rendementDe = (instrument: Instrument) =>
      (contexte.recettesParInstrument?.[instrument] ?? 0) * facteur(instrument);

    const assiettesRecettes: Record<string, number> = {};
    for (const [cle, montant] of Object.entries(contexte.recettesParInstrument ?? {}))
      assiettesRecettes[cle] = montant * facteur(cle as Instrument);

    const assiettesAnnee: Assiettes | null = contexte.assiettes
      ? {
          masseSalariale:
            contexte.assiettes.masseSalariale *
            Math.max(0, 1 + betaDe('masseSalariale', contexte.assiettes) * ratio),
          excedentBrut:
            contexte.assiettes.excedentBrut *
            Math.max(0, 1 + betaDe('excedentBrut', contexte.assiettes) * ratio),
          impotsProduction:
            contexte.assiettes.impotsProduction *
            Math.max(0, 1 + betaDe('impotsProduction', contexte.assiettes) * ratio),
          consommation:
            contexte.assiettes.consommation *
            Math.max(0, 1 + betaDe('consommation', contexte.assiettes) * ratio),
        }
      : null;

    // Mêmes règles qu'à un an : l'assiette réagit au taux, puis nul prélèvement
    // ne dépasse ce qu'elle contient. Un sentier qui encaisserait ce que le
    // calcul annuel juge impossible se contredirait lui-même.
    const retenus = cetteAnnee.map((imp) => {
      const e = calibration.erosionAssiette ? EROSION[imp.instrument] : 0;
      const rendement = rendementDe(imp.instrument);
      // La décision est exprimée en euros sur l'économie de référence : sur une
      // économie rétrécie, le même geste de taux rapporte moins.
      const vise = imp.cote === 'rec' ? imp.delta * facteur(imp.instrument) : imp.delta;
      const delta = imp.cote === 'rec' ? rendementReel(vise, rendement, e) : vise;
      if (imp.cote === 'rec')
        assiettesRecettes[imp.instrument] = (assiettesRecettes[imp.instrument] ?? 0) + delta;
      return { imp, delta };
    });

    const { corrigees } = appliquerPlafond(
      assiettesRecettes,
      assiettesAnnee,
      contexte.pib + ecartPrecedent,
    );
    for (const cle of Object.keys(assiettesRecettes)) assiettesRecettes[cle] = corrigees[cle] ?? 0;

    for (const { imp, delta: brut } of retenus) {
      const k = calibration.multiplicateurs[imp.instrument];
      let delta = brut;
      if (imp.cote === 'rec') {
        const avant = rendementDe(imp.instrument) + brut;
        const apres = corrigees[imp.instrument] ?? 0;
        if (avant !== apres) delta = brut - (avant - apres);
        impulsionRec += delta;
        pib -= k * delta;
      } else {
        impulsionDep += delta;
        pib += k * delta;
      }
    }

    // Une part de l'écart de l'année précédente se reporte : c'est l'hystérèse,
    // et c'est elle qui fait qu'une stratégie se défait ou s'installe au fil des
    // ans au lieu de rendre la même ligne chaque année.
    pib += PERSISTANCE * ecartPrecedent;
    ecartPrecedent = pib;

    const variationRelative = contexte.pib === 0 ? 0 : pib / contexte.pib;
    // Même chaîne qu'à un an : un sentier qui ferait réagir les impôts autrement
    // que le calcul annuel n'aurait pas de sens.
    const recettesInduites = effetSurLesRecettes(
      assiettesRecettes,
      assiettesAnnee,
      variationRelative,
      contexte.elasticiteIR,
      calibration.elasticiteAutre,
    ).reduce((s, l) => s + l.montant, 0);
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
      // Écart de recettes total : ce que le scénario décide et encaisse
      // vraiment, plus ce que l'activité modifiée y ajoute ou en retire.
      recettesEcart: impulsionRec + recettesInduites,
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
