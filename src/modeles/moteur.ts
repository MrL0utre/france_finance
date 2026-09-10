import { effetSurLesRecettes } from './assiettes';
import { EROSION, rendementReel, saturee } from './erosion';
import { appliquerPlafond, pressions } from './plafond';
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
  /**
   * Sensibilité du poste résiduel de recettes — fiscalité locale et recettes non
   * fiscales — à l'activité.
   *
   * Les autres prélèvements n'en ont plus : ils traversent leur assiette, ce qui
   * sépare la réaction de l'assiette à l'activité de celle de l'impôt à son
   * assiette. Ce poste-ci mêle des recettes trop hétérogènes pour qu'une assiette
   * unique lui corresponde, et garde donc une sensibilité directe.
   */
  elasticiteAutre: number;
  /**
   * L'assiette réagit-elle au taux qu'on lui applique ?
   *
   * Faux pour la calibration comptable, dont le principe est qu'aucun agent ne
   * réagit à rien. Vrai partout ailleurs : une assiette qui ne bougerait pas
   * sous un doublement de son taux serait une hypothèse plus forte que toutes
   * celles que ces modèles assument par ailleurs.
   */
  erosionAssiette: boolean;
  /**
   * Semi-élasticité des dépenses au PIB, négative : quand l'activité repart, les
   * dépenses liées au chômage refluent. L'essentiel du budget étant insensible
   * à la conjoncture, le coefficient est faible.
   */
  elasticiteDepenses: number;
};

/**
 * Écart d'activité au-delà duquel le modèle sort de son domaine.
 *
 * Les multiplicateurs publiés sont estimés sur des variations de quelques
 * dixièmes de point. Cinq points de PIB, c'est déjà l'ordre de grandeur d'une
 * crise majeure ; au-delà, l'hypothèse de linéarité ne tient plus, et le résultat
 * ne vaut que comme illustration d'un mécanisme.
 */
export const SEUIL_HORS_DOMAINE = 0.05;

export function calculerAvec(
  calibration: Calibration,
  impulsions: Impulsion[],
  contexte: Contexte,
): Effets {
  const lignes: LigneEffet[] = [];
  let soldeDirect = 0;
  let pib = 0;
  /**
   * Recettes telles que le scénario les laisse, par nature.
   *
   * La rétroaction doit porter là-dessus, pas sur les recettes publiées. Un
   * scénario qui double la TVA double aussi ce que coûte un recul d'activité :
   * mesurer sa perte sur l'ancien rendement la sous-estime exactement dans la
   * proportion de la hausse décidée.
   */
  const assiettesRecettes: Record<string, number> = { ...(contexte.recettesParInstrument ?? {}) };
  /** Part de la hausse décidée que l'érosion de l'assiette fait disparaître. */
  let erosion = 0;
  /** Recettes effectivement encaissées en plus ou en moins, érosion comprise. */
  let recettesEncaissees = 0;
  /**
   * Dépense décidée, charge de la dette exclue.
   *
   * Les intérêts remboursent des créanciers et n'achètent aucune prestation :
   * les compter parmi les services rendus ferait passer un allègement de charge
   * pour une dégradation de service.
   */
  let depensesHorsDette = 0;
  /** Au moins un prélèvement dépasse son point de retournement. */
  let saturation = false;

  /**
   * Première passe : ce que chaque impulsion rapporte réellement.
   *
   * L'érosion s'applique ici, prélèvement par prélèvement. Le plafond, lui, ne
   * peut pas : il porte sur une assiette que plusieurs prélèvements se
   * partagent, et il faut donc les connaître tous avant de savoir si leur somme
   * la dépasse.
   */
  const retenus = impulsions.map((imp) => {
    const e = calibration.erosionAssiette ? EROSION[imp.instrument] : 0;
    const rendement = contexte.recettesParInstrument?.[imp.instrument] ?? 0;
    const delta = imp.cote === 'rec' ? rendementReel(imp.delta, rendement, e) : imp.delta;
    if (imp.cote === 'rec') {
      if (delta !== imp.delta) erosion += imp.delta - delta;
      if (saturee(imp.delta, rendement, e)) saturation = true;
      assiettesRecettes[imp.instrument] = (assiettesRecettes[imp.instrument] ?? 0) + delta;
    }
    return { imp, delta };
  });

  /**
   * Seconde passe : ramener chaque assiette sous ce qu'elle contient.
   *
   * On ne prélève pas 110 % de la masse salariale. Quand la somme dépasse, tous
   * les prélèvements assis dessus sont réduits dans la même proportion, et la
   * part abandonnée est rendue visible plutôt que silencieusement encaissée.
   */
  const { corrigees, retranche } = appliquerPlafond(
    assiettesRecettes,
    contexte.assiettes,
    contexte.pib,
  );
  const plafonne = retranche > 0;
  for (const cle of Object.keys(assiettesRecettes)) assiettesRecettes[cle] = corrigees[cle] ?? 0;

  for (const { imp, delta: brut } of retenus) {
    const k = calibration.multiplicateurs[imp.instrument];

    // La réduction imposée par le plafond se répercute sur l'impulsion elle-même :
    // un euro qu'on ne peut pas prélever n'améliore aucun solde et ne freine
    // aucune activité.
    let delta = brut;
    if (imp.cote === 'rec' && plafonne) {
      const avant = (contexte.recettesParInstrument?.[imp.instrument] ?? 0) + brut;
      const apres = corrigees[imp.instrument] ?? 0;
      if (avant !== 0) delta = brut - (avant - apres);
    }

    // Une dépense en plus dégrade le solde, une recette en plus l'améliore.
    soldeDirect += imp.cote === 'rec' ? delta : -delta;

    if (imp.cote === 'rec') recettesEncaissees += delta;
    else if (imp.instrument !== 'charge_dette') depensesHorsDette += delta;

    // Une dépense en plus soutient l'activité, un prélèvement en plus la freine.
    const effetPib = imp.cote === 'rec' ? -k * delta : k * delta;
    pib += effetPib;

    lignes.push({
      label: imp.label,
      instrument: imp.instrument,
      delta: imp.delta,
      rendementReel: delta,
      multiplicateur: k,
      effetPib,
    });
  }

  const variationRelative = contexte.pib === 0 ? 0 : pib / contexte.pib;
  const recettesInduitesParInstrument = effetSurLesRecettes(
    assiettesRecettes,
    contexte.assiettes,
    variationRelative,
    contexte.elasticiteIR,
    calibration.elasticiteAutre,
  );
  const recettesInduites = recettesInduitesParInstrument.reduce((s, l) => s + l.montant, 0);
  const depensesInduites = calibration.elasticiteDepenses * contexte.depenses * variationRelative;

  const soldeVariation = soldeDirect + recettesInduites - depensesInduites;

  return {
    soldeDirect,
    pib,
    pibPct: variationRelative * 100,
    recettesInduites,
    recettesInduitesParInstrument,
    depensesInduites,
    soldeVariation,
    solde: contexte.soldeBase + soldeVariation,
    // Au-delà de quelques points de PIB, un modèle linéaire à multiplicateurs
    // constants extrapole hors de tout ce sur quoi de tels coefficients sont
    // estimés. Il rend encore un nombre ; ce nombre n'est plus un résultat.
    horsDomaine: Math.abs(variationRelative) > SEUIL_HORS_DOMAINE,
    erosion,
    saturation,
    plafonne,
    retranche,
    pressions: pressions(assiettesRecettes, contexte.assiettes, contexte.pib),
    recettesEncaissees,
    depensesHorsDette,
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
  elasticiteAutre: 0,
  erosionAssiette: false,
  elasticiteDepenses: 0,
};
