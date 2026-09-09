import type { Node } from '../schema';
import type { Cote } from '../data/simulation';

/**
 * Classement d'un poste en instrument de politique budgétaire.
 *
 * Un multiplicateur ne se rattache pas à un ministère mais à la nature de la
 * dépense ou du prélèvement : un euro d'investissement, un euro de transfert et
 * un euro d'allègement d'impôt sur les sociétés n'ont pas le même effet sur
 * l'activité. Ce classement est nécessairement grossier — il est affiché dans
 * l'interface pour que l'hypothèse retenue reste visible.
 */

export type Instrument =
  | 'investissement'
  | 'fonctionnement'
  | 'transferts'
  | 'impot_menages'
  | 'impot_consommation'
  | 'impot_entreprises'
  | 'cotisations'
  | 'charge_dette'
  | 'autre';

export const LIBELLES: Record<Instrument, string> = {
  investissement: 'Investissement public',
  fonctionnement: 'Fonctionnement et masse salariale',
  transferts: 'Transferts et prestations',
  impot_menages: 'Impôts sur les ménages',
  impot_consommation: 'Impôts sur la consommation',
  impot_entreprises: 'Impôts sur les entreprises',
  cotisations: 'Cotisations et contributions sociales',
  charge_dette: 'Charge de la dette',
  autre: 'Non classé',
};

/**
 * Libellés côté recette, là où ceux ci-dessus induiraient en erreur.
 *
 * « Non classé » est juste pour une dépense qu'aucun motif n'a reconnue ; pour
 * une recette, ce poste a un contenu identifiable — fiscalité locale et recettes
 * non fiscales — et le nommer aide à lire pourquoi il réagit peu.
 */
export const LIBELLES_RECETTE: Partial<Record<Instrument, string>> = {
  autre: 'Fiscalité locale et recettes non fiscales',
};

export function libelleRecette(instrument: Instrument): string {
  return LIBELLES_RECETTE[instrument] ?? LIBELLES[instrument];
}

/** Motifs cherchés dans le libellé, du plus spécifique au plus général. */
const MOTIFS_RECETTE: [RegExp, Instrument][] = [
  [/valeur ajout[ée]e|consommation sur les produits|taxes int[ée]rieures|tabac|alcool/i, 'impot_consommation'],
  [/soci[ée]t[ée]s|b[ée]n[ée]fices des grandes entreprises|valeur ajout[ée]e des entreprises/i, 'impot_entreprises'],
  [/cotisation|csg|crds|contribution sociale/i, 'cotisations'],
  [/revenu|mutations|donations|succession|solidarit[ée]|capitaux mobiliers|fortune/i, 'impot_menages'],
];

const MOTIFS_DEPENSE: [RegExp, Instrument][] = [
  // Les intérêts vont pour moitié à des détenteurs non-résidents et, pour le
  // reste, à une épargne dont la propension à consommer est faible : leur effet
  // d'entraînement sur l'activité intérieure est ténu.
  [/charge de la dette|int[ée]r[êe]ts de la dette/i, 'charge_dette'],
  [/investissement|[ée]quipement/i, 'investissement'],
  [/fonctionnement|personnel|achats et charges/i, 'fonctionnement'],
  [/intervention|prestation|solidarit[ée]|retraite|vieillesse|maladie|famille|autonomie|accidents du travail/i, 'transferts'],
];

export function instrumentDe(node: Pick<Node, 'label' | 'sphere' | 'level'>, cote: Cote): Instrument {
  const label = node.label;

  if (cote === 'rec') {
    for (const [motif, instrument] of MOTIFS_RECETTE) {
      if (motif.test(label)) return instrument;
    }
    // Les recettes sociales non reconnues restent des prélèvements sociaux ; les
    // recettes locales mêlent fiscalité des ménages et des entreprises sans
    // ventilation nationale publiée.
    if (node.sphere === 'secu') return 'cotisations';
    if (node.sphere === 'collectivites') return 'autre';
    return 'autre';
  }

  for (const [motif, instrument] of MOTIFS_DEPENSE) {
    if (motif.test(label)) return instrument;
  }
  // Une branche de la Sécurité sociale verse essentiellement des prestations.
  if (node.sphere === 'secu') return 'transferts';
  // Les collectivités portent la majeure partie de l'investissement public, mais
  // leurs dépenses restent majoritairement du fonctionnement.
  return 'fonctionnement';
}
