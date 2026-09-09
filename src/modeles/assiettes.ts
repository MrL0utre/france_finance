import type { Assiettes } from '../schema';
import type { Instrument } from './instruments';

/**
 * Chaîne de transmission de l'activité aux prélèvements.
 *
 * Avant, chaque impôt portait une élasticité directe au PIB. C'était un nombre
 * unique qui en mélangeait deux : la façon dont son assiette réagit à
 * l'activité, et la façon dont l'impôt réagit à son assiette. Les séparer rend
 * chacune vérifiable, et permet d'en calculer une plutôt que de la choisir.
 *
 *   activité → assiette → recette
 *
 * Ce qui reste choisi tient en deux nombres, ceux dont la littérature discute :
 * la sensibilité de la masse salariale et celle de la consommation. La
 * sensibilité du profit, elle, se déduit — voir plus bas.
 */

export type Assiette = 'masseSalariale' | 'excedentBrut' | 'impotsProduction' | 'consommation';

export const LIBELLES_ASSIETTE: Record<Assiette, string> = {
  masseSalariale: 'Masse salariale',
  excedentBrut: "Excédent brut d'exploitation",
  impotsProduction: 'Impôts sur la production',
  consommation: 'Consommation des ménages',
};

/** Assiette économique de chaque prélèvement. */
export const ASSIETTE_DE: Partial<Record<Instrument, Assiette>> = {
  impot_consommation: 'consommation',
  cotisations: 'masseSalariale',
  impot_menages: 'masseSalariale',
  impot_entreprises: 'excedentBrut',
};

/**
 * Sensibilité de la masse salariale à l'activité, en dessous de 1.
 *
 * L'emploi ne suit pas l'activité au même rythme : les entreprises conservent
 * leurs salariés au creux du cycle plutôt que de payer un recrutement plus tard,
 * et les salaires nominaux baissent rarement. La masse salariale amortit donc le
 * choc, à la baisse comme à la hausse.
 */
export const BETA_MASSE_SALARIALE = 0.8;

/**
 * Sensibilité de la consommation des ménages, également en dessous de 1.
 *
 * Un ménage lisse sa consommation : devant une perte de revenu qu'il juge
 * passagère, il puise dans son épargne avant de couper ses dépenses.
 */
export const BETA_CONSOMMATION = 0.8;

/** Les impôts sur la production suivent l'activité à peu près à l'unité. */
export const BETA_IMPOTS_PRODUCTION = 1.0;

/**
 * Sensibilité du profit : déduite, non choisie.
 *
 * Dans l'optique des revenus, le PIB est la somme exacte de la masse salariale,
 * de l'excédent brut d'exploitation et des impôts sur la production — le
 * pipeline le vérifie au centime. Si le PIB varie de 1 % et que deux des trois
 * termes varient moins, le troisième doit varier plus, et d'un montant que
 * l'arithmétique fixe. C'est aussi le mécanisme réel : le profit est un solde,
 * ce qui reste une fois les salaires payés, et un solde absorbe le choc.
 *
 * Un paramètre de moins à poser, et une valeur qui se recalcule d'elle-même si
 * les comptes nationaux sont révisés.
 */
export function betaExcedentBrut(a: Assiettes): number {
  const pib = a.masseSalariale + a.excedentBrut + a.impotsProduction;
  const explique = BETA_MASSE_SALARIALE * a.masseSalariale + BETA_IMPOTS_PRODUCTION * a.impotsProduction;
  return a.excedentBrut === 0 ? 0 : (pib - explique) / a.excedentBrut;
}

export function betaDe(assiette: Assiette, a: Assiettes): number {
  switch (assiette) {
    case 'masseSalariale':
      return BETA_MASSE_SALARIALE;
    case 'consommation':
      return BETA_CONSOMMATION;
    case 'impotsProduction':
      return BETA_IMPOTS_PRODUCTION;
    case 'excedentBrut':
      return betaExcedentBrut(a);
  }
}

/**
 * Élasticité de chaque prélèvement à sa propre assiette.
 *
 * Trois valent 1 : ce sont des prélèvements proportionnels, dont le rendement
 * suit l'assiette à taux inchangé. La cyclicité qu'on leur prête est déjà dans
 * celle de leur assiette, l'y remettre la compterait deux fois.
 *
 * L'impôt sur le revenu fait exception, et c'est la valeur intéressante : elle
 * n'est pas choisie mais calculée sur le barème publié — voir la note dans
 * `progressivite.ts`.
 */
export const ELASTICITE_A_L_ASSIETTE: Record<Assiette, number> = {
  consommation: 1.0,
  masseSalariale: 1.0,
  impotsProduction: 1.0,
  excedentBrut: 1.0,
};

/**
 * Élasticité du rendement de l'impôt sur le revenu à sa base imposable.
 *
 * Calculée sur le barème de l'année, comme le rapport du taux marginal au taux
 * moyen, pondéré par l'impôt payé sur les cas types validés contre OpenFisca.
 * Le calcul est reproductible : `progressivite.ts` l'exécute, et un test le
 * vérifie.
 *
 * Deux réserves. Les cas types servent à valider un calcul, pas à représenter
 * une distribution de revenus : la pondération est indicative. Et le calcul
 * déplace tous les revenus à nombre de foyers imposables constant, alors qu'une
 * récession fait sortir des foyers de l'impôt.
 *
 * Le sens de cette omission est inconnu, et il ne faut pas le prétendre. Des
 * foyers sortent de l'impôt et leur contribution tombe à zéro, ce qui amplifie
 * la baisse ; mais les pertes d'activité frappent d'abord des revenus modestes,
 * qui paient peu d'impôt, là où un choc uniforme atteindrait aussi le haut de la
 * distribution, où le rendement est concentré — ce qui l'amortit. Sur un barème
 * progressif, le second effet peut l'emporter. Trancher demanderait la
 * distribution des revenus imposables par tranche, que les données ouvertes ne
 * publient qu'en fichiers tableurs.
 */
export const ELASTICITE_IR_DEFAUT = 1.4;

/**
 * Recette induite par une variation d'activité, prélèvement par prélèvement.
 *
 * `variationRelative` est l'écart d'activité en proportion du PIB. Chaque
 * prélèvement le traverse par son assiette : l'assiette bouge d'un facteur beta,
 * la recette suit d'un facteur epsilon.
 */
export function effetSurLesRecettes(
  recettesParInstrument: Record<string, number>,
  assiettes: Assiettes | null,
  variationRelative: number,
  elasticiteIR: number,
  /** Sensibilité du reste — fiscalité locale et recettes non fiscales. */
  elasticiteAutre: number,
): { instrument: Instrument; assiette: Assiette | null; montant: number; facteur: number }[] {
  if (variationRelative === 0) return [];
  const lignes: {
    instrument: Instrument;
    assiette: Assiette | null;
    montant: number;
    facteur: number;
  }[] = [];

  for (const [cle, recette] of Object.entries(recettesParInstrument ?? {})) {
    const instrument = cle as Instrument;
    const assiette = ASSIETTE_DE[instrument] ?? null;

    // Le poste résiduel mêle fiscalité locale et recettes non fiscales : aucune
    // assiette unique ne lui correspond, il garde donc une sensibilité directe.
    let facteur: number;
    if (assiette === null) {
      facteur = instrument === 'autre' ? elasticiteAutre : 0;
    } else if (assiettes === null) {
      facteur = 0;
    } else {
      const epsilon = instrument === 'impot_menages' ? elasticiteIR : ELASTICITE_A_L_ASSIETTE[assiette];
      facteur = epsilon * betaDe(assiette, assiettes);
    }

    const montant = facteur * recette * variationRelative;
    if (montant !== 0) lignes.push({ instrument, assiette, montant, facteur });
  }

  return lignes.sort((a, b) => Math.abs(b.montant) - Math.abs(a.montant));
}
