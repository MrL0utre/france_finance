import { betaExcedentBrut } from '../modeles/assiettes';
import type { Contexte, Effets } from '../modeles/types';

/**
 * Effet d'un scénario budgétaire sur l'indice CAC 40.
 *
 * ─── Ce que ce calcul n'est pas ───
 *
 * Ce n'est ni une prévision, ni un conseil en investissement, et il ne saurait
 * fonder une décision d'achat ou de vente. Le lien entre croissance et
 * rendement boursier est empiriquement faible, et plusieurs travaux — MSCI,
 * Boston Trust Walden — montrent qu'il est bien plus ténu qu'on ne l'imagine :
 * la valorisation, les bénéfices par action et la dilution y pèsent davantage
 * que le produit intérieur brut. Ce qui suit trace un mécanisme, pas une
 * trajectoire.
 *
 * Aucun niveau d'indice n'est affiché, seulement un écart en pourcentage. Donner
 * un niveau supposerait de connaître le cours du jour, que cette application —
 * statique, sans appel réseau à l'usage — n'a pas ; un cours périmé vaudrait
 * moins que rien.
 *
 * ─── Le cadre retenu ───
 *
 * Celui que la littérature financière emploie pour décomposer la valeur d'un
 * indice :
 *
 *     Prix = Activité × (Bénéfices / Activité) × (Prix / Bénéfices)
 *
 * Un scénario budgétaire agit donc par trois canaux, et l'écart total est leur
 * somme :
 *
 *   1. l'activité, qui porte les bénéfices ;
 *   2. l'impôt sur les sociétés, qui prélève sur le bénéfice net ;
 *   3. le taux d'emprunt, qui fixe le multiple auquel ce bénéfice se paie.
 *
 * ─── Le fait qui commande tout le reste ───
 *
 * Le CAC 40 n'est pas l'économie française. 77,3 % du chiffre d'affaires des
 * sociétés de l'indice est réalisé hors de France (étude EY, exercice 2023, sur
 * 27 des 40 sociétés). Un choc d'activité français ne touche donc qu'environ un
 * quart de leur activité, et c'est ce qui explique qu'un bouleversement
 * budgétaire national déplace l'indice bien moins qu'on ne l'attendrait.
 *
 * C'est la principale chose que cette estimation permet de comprendre, et elle
 * vaut davantage que le chiffre lui-même.
 */

/**
 * Part du chiffre d'affaires réalisée en France.
 *
 * Source : baromètre EY sur les sociétés du CAC 40, publié en juin 2024, portant
 * sur l'exercice 2023 — 77,3 % du chiffre d'affaires réalisé hors de France, sur
 * un échantillon de 27 sociétés.
 *
 * Le chiffre d'affaires sert ici d'approximation de la localisation du bénéfice,
 * faute de ventilation géographique des résultats. Les deux ne coïncident pas :
 * les marges diffèrent d'un pays à l'autre, et la part française du bénéfice
 * pourrait être supérieure comme inférieure à sa part du chiffre d'affaires.
 * L'écart entre sociétés est du reste considérable — près de la moitié du chiffre
 * d'affaires en France pour l'une, moins de 1 % pour une autre.
 */
export const PART_FRANCE = 0.227;

export const SOURCE_PART_FRANCE = {
  label: 'Profil financier du CAC 40 — EY, baromètre publié en juin 2024 (exercice 2023)',
  url: 'https://www.ey.com/fr_fr/insights/strategy-transactions/profil-financier-du-cac-40',
};

/**
 * Multiple de valorisation retenu.
 *
 * Le PER prospectif de l'indice tourne autour de 15, et sa référence historique
 * longtemps admise se situait entre 14 et 15. La valeur ronde est prise à
 * dessein : elle ne sert qu'à convertir une variation de taux en variation de
 * multiple, et un chiffre au dixième près y donnerait une fausse précision.
 *
 * Pour une rente en croissance, la durée d'un actif vaut l'inverse de l'écart
 * entre taux d'actualisation et croissance, c'est-à-dire le multiple lui-même :
 * un point de taux en plus retire donc de l'ordre de 15 % à la valeur. Ce
 * raisonnement suppose que le taux souverain se transmet intégralement au taux
 * d'actualisation des actions, ce qui est l'hypothèse standard et non un fait.
 */
export const MULTIPLE = 15;

export type EffetIndice = {
  /** Écart total, en pourcentage. */
  total: number;
  canaux: { nom: string; variation: number; detail: string }[];
};

export function effetCac40(
  effets: Effets,
  contexte: Contexte,
  /** Variation de taux en points, dans la même unité que le reste du modèle : 1 vaut un point. */
  pointsDeTaux: number,
): EffetIndice {
  // Les bénéfices réagissent à l'activité selon la sensibilité de l'excédent
  // brut d'exploitation — la seule valeur du modèle qui soit déduite d'une
  // identité comptable plutôt que choisie.
  const beta = contexte.assiettes ? betaExcedentBrut(contexte.assiettes) : 1;
  const activite = PART_FRANCE * beta * effets.pibPct;

  /**
   * Impôt sur les sociétés : il ampute le bénéfice net.
   *
   * Le taux effectif rapporte le rendement de l'impôt à l'excédent brut de
   * l'économie entière ; celui des sociétés de l'indice lui est certainement
   * différent, et la ventilation qui permettrait de le connaître n'est pas
   * publiée. Seul le sens de l'effet est solide.
   */
  const ebe = contexte.assiettes?.excedentBrut ?? 0;
  const isBase = contexte.recettesParInstrument?.impot_entreprises ?? 0;
  const isEcart = effets.lignes
    .filter((l) => l.instrument === 'impot_entreprises')
    .reduce((t, l) => t + l.rendementReel, 0);
  const tau = ebe === 0 ? 0 : isBase / ebe;
  const dTau = ebe === 0 ? 0 : isEcart / ebe;
  const fiscalite = tau >= 1 ? 0 : -PART_FRANCE * (dTau / (1 - tau)) * 100;

  // Le multiple auquel le bénéfice se paie recule quand le taux monte.
  const taux = -MULTIPLE * pointsDeTaux;

  const canaux = [
    {
      nom: 'Activité française',
      variation: activite,
      detail: `${(PART_FRANCE * 100).toFixed(1).replace('.', ',')} % de l'activité de l'indice, sensibilité du profit ${beta.toFixed(2).replace('.', ',')}`,
    },
    {
      nom: 'Impôt sur les sociétés',
      variation: fiscalite,
      detail: "sur la seule part française du bénéfice, au taux effectif de l'économie",
    },
    {
      nom: "Taux d'emprunt",
      variation: taux,
      detail: `multiple de ${MULTIPLE}, soit autant de pourcents par point de taux`,
    },
  ].filter((c) => c.variation !== 0);

  return { total: canaux.reduce((t, c) => t + c.variation, 0), canaux };
}
