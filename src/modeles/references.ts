import type { Instrument } from './instruments';

/**
 * Estimations publiées de multiplicateurs budgétaires.
 *
 * Ces valeurs ne sont pas celles qu'applique le simulateur : elles servent de
 * point de comparaison, affiché à côté des nôtres pour qu'un lecteur juge de
 * leur plausibilité plutôt que de nous croire sur parole.
 *
 * Provenance exacte : elles sont reprises du recensement qu'en fait FIPECO, non
 * des publications primaires. Le document de travail de Mésange présente ses
 * variantes sous forme de graphiques, dont on ne peut lire de valeur au dixième
 * près ; annoncer une vérification à la source serait donc inexact. Les liens
 * vers les travaux d'origine sont donnés pour qui veut remonter plus haut.
 *
 * Les correspondances ne sont pas parfaites : les nomenclatures publiées
 * (« toutes dépenses publiques », « prestations en espèces », « impôts
 * indirects ») ne recouvrent pas exactement nos instruments. Le rattachement est
 * indiqué pour que l'approximation reste visible.
 */

export type Reference = {
  instrument: Instrument;
  /** Intitulé exact employé par la publication. */
  intitule: string;
  valeur: string;
  source: string;
};

export const REFERENCES: Reference[] = [
  {
    instrument: 'investissement',
    intitule: 'Investissement public',
    valeur: '1,4 à 2 ans · 0,9 à 5 ans',
    source: 'Mésange (Insee et DG Trésor, 2017), d’après FIPECO',
  },
  {
    instrument: 'investissement',
    intitule: 'Investissements publics',
    valeur: '1,0',
    source: 'OCDE (2013), France, d’après FIPECO',
  },
  {
    instrument: 'fonctionnement',
    intitule: 'Toutes dépenses publiques',
    valeur: '1,1 à 2 ans · 0,9 à 5 ans',
    source: 'Mésange (Insee et DG Trésor, 2017), d’après FIPECO',
  },
  {
    instrument: 'transferts',
    intitule: 'Prestations en espèces',
    valeur: '0,6',
    source: 'OCDE (2013), France, d’après FIPECO',
  },
  {
    instrument: 'impot_menages',
    intitule: 'Impôt sur le revenu des ménages',
    valeur: '0,6',
    source: 'OCDE (2013), France, d’après FIPECO',
  },
  {
    instrument: 'impot_consommation',
    intitule: 'Impôts indirects',
    valeur: '0,3',
    source: 'OCDE (2013), France, d’après FIPECO',
  },
  {
    instrument: 'cotisations',
    intitule: 'Baisse de CSG',
    valeur: '0,8 à 2 ans · 0,8 à 5 ans',
    source: 'Mésange (Insee et DG Trésor, 2017), d’après FIPECO',
  },
  {
    instrument: 'cotisations',
    intitule: 'Baisse de cotisations employeurs',
    valeur: '0,6 à 2 ans · 1,0 à 5 ans',
    source: 'Mésange (Insee et DG Trésor, 2017), d’après FIPECO',
  },
];

/**
 * Instruments pour lesquels aucune estimation publiée ne se rattache
 * directement. Le dire explicitement vaut mieux que de laisser croire que
 * chaque coefficient est adossé à une publication.
 */
export const SANS_REFERENCE: Instrument[] = ['impot_entreprises', 'charge_dette', 'autre'];

export const SOURCE_REFERENCES = {
  label: "FIPECO — L'effet multiplicateur d'une variation du déficit public",
  url: 'https://www.fipeco.fr/fiche/Leffet-multiplicateur-dune-variation-du-deficit-public',
};

/**
 * Constat que la littérature partage et que nos trois calibrations traduisent :
 * un multiplicateur s'affaisse quand l'économie tourne au-dessus de son
 * potentiel, la relance s'y traduisant en inflation plutôt qu'en activité.
 */
export const NOTE_CONJONCTURE =
  "Les publications s'accordent sur un point que le choix entre nos trois calibrations reproduit : les multiplicateurs décroissent lorsque le PIB dépasse son potentiel, la dépense s'y traduisant davantage en inflation qu'en activité.";
