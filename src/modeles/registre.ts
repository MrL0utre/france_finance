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
 * Ordres de grandeur convergents de la littérature (Mésange, OFCE, FMI) : la
 * dépense pèse plus que l'impôt à euro égal, l'investissement plus que le
 * fonctionnement, et les prélèvements sur les entreprises ont l'effet de court
 * terme le plus faible. Les valeurs exactes restent débattues — c'est
 * précisément pourquoi elles sont affichées.
 *
 * La charge de la dette reçoit le multiplicateur le plus bas : la moitié environ
 * des titres est détenue hors de France, et le reste alimente une épargne dont
 * la propension à consommer est faible.
 */
const KEYNESIEN: Calibration = {
  multiplicateurs: {
    investissement: 1.0,
    fonctionnement: 0.8,
    transferts: 0.5,
    impot_menages: 0.5,
    impot_consommation: 0.5,
    impot_entreprises: 0.3,
    cotisations: 0.4,
    charge_dette: 0.2,
    autre: 0.5,
  },
  elasticiteRecettes: 1.0,
  elasticiteDepenses: -0.05,
};

/** Variante basse : multiplicateurs réduits, économie proche de son potentiel. */
const OFFRE: Calibration = {
  multiplicateurs: {
    investissement: 0.5,
    fonctionnement: 0.3,
    transferts: 0.2,
    impot_menages: 0.3,
    impot_consommation: 0.3,
    impot_entreprises: 0.5,
    cotisations: 0.5,
    charge_dette: 0.1,
    autre: 0.3,
  },
  elasticiteRecettes: 1.0,
  elasticiteDepenses: -0.05,
};

/** Variante haute : économie en bas de cycle, politique monétaire contrainte. */
const RELANCE: Calibration = {
  multiplicateurs: {
    investissement: 1.5,
    fonctionnement: 1.2,
    transferts: 0.9,
    impot_menages: 0.8,
    impot_consommation: 0.8,
    impot_entreprises: 0.4,
    cotisations: 0.6,
    charge_dette: 0.3,
    autre: 0.8,
  },
  elasticiteRecettes: 1.0,
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
    source: {
      label: 'Ordres de grandeur : Mésange (Insee/DG Trésor), OFCE, FMI',
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
