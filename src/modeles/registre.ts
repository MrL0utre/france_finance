import { CALIBRATION_NEUTRE, calculerAvec, type Calibration } from './moteur';
import type { Modele } from './types';

/**
 * Modèles proposés au choix.
 *
 * Ils ne sont pas des implémentations des modèles institutionnels dont ils
 * portent l'inspiration : ce serait hors de portée d'une application sans
 * serveur, et Mésange lui-même n'est exécutable qu'avec un logiciel propriétaire.
 * Ce sont des calibrations distinctes d'un même moteur simplifié, dont l'intérêt
 * est de rendre visible à quel point la conclusion dépend des hypothèses. Chaque
 * fiche dit ce qu'elle ne fait pas.
 */

/**
 * Valeurs propres à ce projet, choisies rondes.
 *
 * Elles ne sont extraites d'aucun modèle institutionnel : elles traduisent
 * seulement des régularités largement admises — la dépense pèse plus que l'impôt
 * à euro égal, l'investissement plus que le fonctionnement, et les prélèvements
 * sur les entreprises ont l'effet de court terme le plus faible. Les valeurs
 * exactes restent débattues, ce pourquoi elles sont affichées et réglables.
 *
 * Les présenter comme issues de Mésange serait à la fois faux et abusif envers
 * ses auteurs : ce modèle compte environ 1 800 équations et publie ses propres
 * variantes chiffrées, qui ne sont pas reprises ici.
 *
 * La charge de la dette reçoit le multiplicateur le plus bas : la moitié environ
 * des titres est détenue hors de France, et le reste alimente une épargne dont
 * la propension à consommer est faible.
 */
/**
 * Sensibilité du poste résiduel de recettes à l'activité.
 *
 * Fiscalité locale et recettes non fiscales mêlées : la première est cyclique
 * (droits de mutation, cotisation sur la valeur ajoutée), la seconde presque pas
 * (dividendes, redevances). Aucune assiette unique ne leur correspond, d'où une
 * valeur intermédiaire, et la seule qui reste posée du côté des recettes.
 *
 * Tous les autres prélèvements traversent désormais leur assiette : voir
 * `assiettes.ts`, où deux sensibilités sont choisies, une est déduite d'une
 * identité comptable et une est calculée sur le barème publié.
 */
const ELASTICITE_AUTRE = 0.5;

const KEYNESIEN: Calibration = {
  multiplicateurs: {
    investissement: 1.0, // OCDE 1,0 ; Mésange 0,9 à 5 ans
    fonctionnement: 0.9, // Mésange, toutes dépenses publiques, 0,9 à 5 ans
    transferts: 0.6, // OCDE, prestations en espèces, 0,6
    impot_menages: 0.6, // OCDE, impôt sur le revenu des ménages, 0,6
    impot_consommation: 0.3, // OCDE, impôts indirects, 0,3
    impot_entreprises: 0.4, // aucune estimation publiée ne s'y rattache
    cotisations: 0.7, // Mésange, CSG 0,8 et cotisations employeurs 0,6 à 1,0
    charge_dette: 0.2, // aucune estimation publiée
    autre: 0.5,
  },
  elasticiteAutre: ELASTICITE_AUTRE,
  elasticiteDepenses: -0.05,
};

/**
 * Variante basse : économie proche de son potentiel. La littérature s'accorde
 * sur l'affaissement des multiplicateurs dans cette situation, la dépense s'y
 * traduisant davantage en inflation qu'en activité — d'où des valeurs de l'ordre
 * de la moitié de la calibration médiane.
 */
const OFFRE: Calibration = {
  multiplicateurs: {
    investissement: 0.6,
    fonctionnement: 0.5,
    transferts: 0.3,
    impot_menages: 0.3,
    impot_consommation: 0.2,
    // Vue d'offre : le coût du travail et les prélèvements sur les entreprises
    // pèsent ici davantage que la demande publique.
    impot_entreprises: 0.5,
    cotisations: 0.5,
    charge_dette: 0.1,
    autre: 0.3,
  },
  elasticiteAutre: ELASTICITE_AUTRE,
  elasticiteDepenses: -0.05,
};

/**
 * Variante haute : bas de cycle, politique monétaire contrainte. Calée sur le
 * haut de la fourchette publiée plutôt qu'au-delà — Mésange à deux ans et le
 * FMI donnent tous deux 1,4 pour l'investissement public.
 */
const RELANCE: Calibration = {
  multiplicateurs: {
    investissement: 1.4, // Mésange 1,4 à 2 ans ; FMI 1,4 après 4 ans
    fonctionnement: 1.1, // Mésange, toutes dépenses publiques, 1,1 à 2 ans
    transferts: 0.9,
    impot_menages: 0.8,
    impot_consommation: 0.5,
    impot_entreprises: 0.4,
    cotisations: 0.9,
    charge_dette: 0.3,
    autre: 0.8,
  },
  elasticiteAutre: ELASTICITE_AUTRE,
  elasticiteDepenses: -0.1,
};

export const MODELES: Modele[] = [
  {
    id: 'comptable',
    nom: 'Comptable',
    resume:
      "Aucune rétroaction : un euro coupé est un euro économisé. C'est l'hypothèse implicite de toute présentation budgétaire brute.",
    limite:
      "Suppose que l'activité économique ne réagit pas du tout aux décisions budgétaires, ce qu'aucun travail empirique ne soutient. À lire comme une borne, pas comme une prévision.",
    calculer: (i, c) => calculerAvec(CALIBRATION_NEUTRE, i, c),
  },
  {
    id: 'keynesien',
    nom: 'Multiplicateurs standards',
    resume:
      "La dépense soutient l'activité, l'impôt la freine, et l'activité modifiée fait varier les recettes. Multiplicateurs d'ordre de grandeur médian.",
    limite:
      "Statique et linéaire : les effets sont supposés se produire en un an et indépendamment de la conjoncture. La dette n'y évolue pas d'elle-même — seule une variation de taux explicite modifie sa charge.",
    // Lecture de référence sur les multiplicateurs, non provenance des valeurs
    // retenues ici : la nuance évite d'attribuer nos coefficients à l'Insee.
    source: {
      label:
        "Pour approfondir : documentation du modèle Mésange (Insee et DG Trésor, doc. de travail G2017/04). Les valeurs retenues ici n'en sont pas issues.",
      url: 'https://www.insee.fr/fr/statistiques/2848300',
    },
    calculer: (i, c) => calculerAvec(KEYNESIEN, i, c),
  },
  {
    id: 'offre',
    nom: 'Multiplicateurs faibles',
    resume:
      "Économie proche de son potentiel : la relance se diffuse peu, tandis que les prélèvements sur les entreprises pèsent davantage sur l'activité.",
    limite:
      "Mêmes limites structurelles que la calibration médiane ; seules les valeurs changent. Vue plutôt favorable aux mesures d'offre.",
    calculer: (i, c) => calculerAvec(OFFRE, i, c),
  },
  {
    id: 'relance',
    nom: 'Multiplicateurs élevés',
    resume:
      "Économie en bas de cycle, taux directeurs contraints : la dépense publique entraîne fortement l'activité et se finance en partie d'elle-même.",
    limite:
      "Mêmes limites structurelles. Cette calibration ne vaut que dans une situation de sous-emploi marqué ; l'appliquer en haut de cycle surestimerait nettement les effets.",
    calculer: (i, c) => calculerAvec(RELANCE, i, c),
  },
];

export const MODELE_DEFAUT = 'comptable';

export function modeleParId(id: string): Modele {
  return MODELES.find((m) => m.id === id) ?? MODELES[0];
}

export { KEYNESIEN, OFFRE, RELANCE };

/**
 * Calibration derrière chaque modèle, pour les usages qui ont besoin du jeu de
 * coefficients lui-même plutôt que de la fonction de calcul — la projection
 * pluriannuelle, notamment.
 */
export const CALIBRATIONS: Record<string, Calibration> = {
  comptable: CALIBRATION_NEUTRE,
  keynesien: KEYNESIEN,
  offre: OFFRE,
  relance: RELANCE,
};
