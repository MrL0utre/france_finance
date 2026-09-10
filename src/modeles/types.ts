import type { Cote } from '../data/simulation';
import type { Assiettes } from '../schema';
import type { Assiette } from './assiettes';
import type { Instrument } from './instruments';

/** Un mouvement budgétaire décidé par l'utilisateur, en euros. */
export type Impulsion = {
  id: string;
  label: string;
  cote: Cote;
  instrument: Instrument;
  /** Positif = dépense accrue (cote dep) ou recette accrue (cote rec). */
  delta: number;
};

/** Cadrage macroéconomique de référence, issu de data/manual/reference.json. */
export type Contexte = {
  pib: number;
  pibParEmploi: number;
  recettes: number;
  /** Recette ventilée par nature, pour appliquer une sensibilité par impôt. */
  recettesParInstrument: Record<Instrument, number>;
  /** Assiettes économiques. Absentes d'un cadrage antérieur : la rétroaction
   *  se tait alors plutôt que d'inventer une chaîne. */
  assiettes: Assiettes | null;
  /** Élasticité du rendement de l'IR à sa base, calculée sur le barème actif. */
  elasticiteIR: number;
  depenses: number;
  soldeBase: number;
};

export type LigneEffet = {
  label: string;
  instrument: Instrument;
  delta: number;
  multiplicateur: number;
  /** Montant réellement encaissé, une fois l'assiette ajustée au taux. */
  rendementReel: number;
  /** Contribution de cette impulsion à la variation d'activité. */
  effetPib: number;
};

export type Effets = {
  /** Variation du solde sous le seul effet comptable, sans rétroaction. */
  soldeDirect: number;
  /** Variation d'activité induite, en euros et en points de PIB. */
  pib: number;
  pibPct: number;
  /** Recettes gagnées ou perdues du fait de la variation d'activité. */
  recettesInduites: number;
  /**
   * Détail de la recette induite, impôt par impôt.
   *
   * C'est la réponse à la question que pose n'importe qui devant une coupe
   * massive : « et les taxes perçues, elles font quoi ? ». Un total agrégé ne la
   * donne pas — il faut dire lesquelles reculent, et de combien.
   */
  recettesInduitesParInstrument: {
    instrument: Instrument;
    /** Assiette traversée, ou null pour le poste résiduel. */
    assiette: Assiette | null;
    montant: number;
    /** Facteur total appliqué : élasticité à l'assiette × sensibilité de celle-ci. */
    facteur: number;
  }[];
  /** Dépenses induites : négatif quand l'activité repart et allège le chômage. */
  depensesInduites: number;
  /** soldeDirect + recettesInduites − depensesInduites. */
  soldeVariation: number;
  /** Solde final, référence comprise. */
  solde: number;
  /** L'écart d'activité dépasse ce que le modèle peut prétendre décrire. */
  horsDomaine: boolean;
  /** Part des hausses décidées que l'érosion de l'assiette fait disparaître. */
  erosion: number;
  /** Au moins un prélèvement est relevé au-delà de son point de retournement. */
  saturation: boolean;
  /** Recettes effectivement encaissées en plus ou en moins, érosion comprise. */
  recettesEncaissees: number;
  /** Dépense décidée hors charge de la dette, qui n'achète aucun service. */
  depensesHorsDette: number;
  /** Emplois, ordre de grandeur. */
  emploi: number;
  lignes: LigneEffet[];
};

export type Modele = {
  id: string;
  nom: string;
  resume: string;
  /** Ce que le modèle ne prétend pas faire, affiché à côté des résultats. */
  limite: string;
  source?: { label: string; url: string };
  calculer(impulsions: Impulsion[], contexte: Contexte): Effets;
};
