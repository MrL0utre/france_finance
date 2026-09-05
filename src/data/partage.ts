import {
  nbAjustements,
  type Ajustements,
  type ChantierRetenu,
  type Cote,
  type Mesure,
} from './simulation';

/**
 * Encodage d'un scénario dans une URL.
 *
 * Le contenu est sérialisé en tableau de tuples plutôt qu'en objets : les clés
 * répétées d'un objet JSON pèsent plus que les données elles-mêmes sur un
 * scénario d'une dizaine de lignes.
 *
 * Le libellé est transporté avec chaque ajustement. C'est le poste le plus lourd
 * de l'URL, mais il est indispensable : les identifiants de l'État dépendent du
 * rang des lignes dans le CSV source, et un lien partagé a toutes les chances
 * d'être ouvert sur une version des données plus récente que celle qui l'a
 * produit. Sans ce contrôle, l'ajustement porterait silencieusement sur le
 * mauvais ministère.
 */

export const PARAM = 's';
/** Modèle de bouclage actif : sans lui, un lien partagé afficherait d'autres chiffres. */
export const PARAM_MODELE = 'm';
/** Mesures créées de toutes pièces. */
export const PARAM_MESURES = 'x';
/** Variation des taux d'emprunt, en points. */
export const PARAM_TAUX = 't';

/** Réforme du barème de l'impôt sur le revenu. */
export const PARAM_BAREME = 'b';
/** Grands chantiers retenus. */
export const PARAM_CHANTIERS = 'c';

const MAX_MESURES = 50;
const MAX_POINTS_TAUX = 10;
const MAX_TRANCHES = 20;
const MAX_CHANTIERS = 30;
const MAX_DEBUT = 50;

/** Suffixe constant des shards, retiré de l'URL et remis à la lecture. */
const EXT = '.json';

type Tuple = [cote: string, id: string, facteur: number, label: string, shards: string[]];

/** Garde-fous à la lecture : une URL est une entrée non fiable. */
const MAX_AJUSTEMENTS = 200;
const MAX_LONGUEUR_ID = 200;
const FACTEUR_MAX = 10;

export function encoderScenario(aj: Ajustements): string {
  const tuples: Tuple[] = [];
  for (const cote of ['dep', 'rec'] as const) {
    for (const [id, facteur] of Object.entries(aj[cote])) {
      tuples.push([
        cote === 'dep' ? 'd' : 'r',
        id,
        facteur,
        aj.labels[id] ?? '',
        (aj.shards[id] ?? []).map((s) => (s.endsWith(EXT) ? s.slice(0, -EXT.length) : s)),
      ]);
    }
  }
  return versBase64Url(JSON.stringify(tuples));
}

export function decoderScenario(encode: string): Ajustements | null {
  let brut: unknown;
  try {
    brut = JSON.parse(depuisBase64Url(encode));
  } catch {
    return null;
  }
  if (!Array.isArray(brut) || brut.length > MAX_AJUSTEMENTS) return null;

  const aj: Ajustements = { dep: {}, rec: {}, labels: {}, shards: {} };
  for (const entree of brut) {
    if (!Array.isArray(entree) || entree.length < 3) return null;
    const [cote, id, facteur, label, shards] = entree as Tuple;

    if (cote !== 'd' && cote !== 'r') return null;
    if (typeof id !== 'string' || !id || id.length > MAX_LONGUEUR_ID) return null;
    if (typeof facteur !== 'number' || !Number.isFinite(facteur)) return null;
    if (facteur < 0 || facteur > FACTEUR_MAX || facteur === 1) return null;

    const cle: Cote = cote === 'd' ? 'dep' : 'rec';
    aj[cle][id] = facteur;
    if (typeof label === 'string' && label) aj.labels[id] = label;
    if (Array.isArray(shards) && shards.every((s) => typeof s === 'string')) {
      aj.shards[id] = shards.map((s) => (s.endsWith(EXT) ? s : s + EXT));
    }
  }
  return nbAjustements(aj) === 0 ? null : aj;
}

/**
 * Scénario porté par une URL, s'il y en a un de lisible.
 *
 * Ces deux fonctions prennent l'URL en paramètre au lieu de lire `window` :
 * le codec reste ainsi exempt de dépendance au navigateur, et vérifiable hors
 * de lui. L'interaction avec la barre d'adresse appartient à l'appelant.
 */
export function scenarioDepuisUrl(href: string): Ajustements | null {
  const params = new URL(href).searchParams;
  const encode = params.get(PARAM);

  const base = encode ? decoderScenario(encode) : null;
  const mesures = decoderMesures(params.get(PARAM_MESURES));
  const taux = decoderTaux(params.get(PARAM_TAUX));
  const bareme = decoderBareme(params.get(PARAM_BAREME));
  const chantiers = decoderChantiers(params.get(PARAM_CHANTIERS));

  if (!base && !mesures && taux === null && !bareme && !chantiers) return null;

  const aj: Ajustements = base ?? { dep: {}, rec: {}, labels: {}, shards: {} };
  if (mesures) aj.mesures = mesures;
  if (taux !== null) aj.pointsDeTaux = taux;
  if (bareme) aj.bareme = bareme;
  if (chantiers) aj.chantiers = chantiers;
  return aj;
}

function decoderChantiers(encode: string | null): ChantierRetenu[] | null {
  if (!encode) return null;
  let brut: unknown;
  try {
    brut = JSON.parse(depuisBase64Url(encode));
  } catch {
    return null;
  }
  if (!Array.isArray(brut) || brut.length === 0 || brut.length > MAX_CHANTIERS) return null;

  const sortie: ChantierRetenu[] = [];
  for (const e of brut) {
    if (!e || typeof e !== 'object') return null;
    const { id, ref, debut, label, cout, dureeAnnees } = e as ChantierRetenu;
    if (typeof id !== 'string' || !id || id.length > MAX_LONGUEUR_ID) return null;
    if (typeof ref !== 'string' || !ref || ref.length > MAX_LONGUEUR_ID) return null;
    if (!Number.isInteger(debut) || debut < 0 || debut > MAX_DEBUT) return null;

    const retenu: ChantierRetenu = { id, ref, debut };
    // Un chantier sur mesure porte ses propres caractéristiques ; celles du
    // catalogue sont retrouvées par `ref` et n'ont pas à voyager.
    if (label !== undefined) {
      if (typeof label !== 'string' || !label || label.length > 200) return null;
      retenu.label = label;
    }
    if (cout !== undefined) {
      if (typeof cout !== 'number' || !Number.isFinite(cout) || cout <= 0 || cout > 1e13) {
        return null;
      }
      retenu.cout = cout;
    }
    if (dureeAnnees !== undefined) {
      if (!Number.isInteger(dureeAnnees) || dureeAnnees <= 0 || dureeAnnees > 50) return null;
      retenu.dureeAnnees = dureeAnnees;
    }
    sortie.push(retenu);
  }
  return sortie;
}

function decoderBareme(encode: string | null): Ajustements['bareme'] | null {
  if (!encode) return null;
  let brut: unknown;
  try {
    brut = JSON.parse(depuisBase64Url(encode));
  } catch {
    return null;
  }
  if (!brut || typeof brut !== 'object' || Array.isArray(brut)) return null;

  const sortie: NonNullable<Ajustements['bareme']> = {};
  for (const [cle, valeur] of Object.entries(brut as Record<string, unknown>)) {
    const indice = Number(cle);
    if (!Number.isInteger(indice) || indice < 0 || indice > MAX_TRANCHES) return null;
    if (!valeur || typeof valeur !== 'object') return null;

    const { taux, seuil } = valeur as { taux?: unknown; seuil?: unknown };
    const tranche: { taux?: number; seuil?: number } = {};
    if (taux !== undefined) {
      if (typeof taux !== 'number' || !Number.isFinite(taux) || taux < 0 || taux > 1) return null;
      tranche.taux = taux;
    }
    if (seuil !== undefined) {
      if (typeof seuil !== 'number' || !Number.isFinite(seuil) || seuil < 0 || seuil > 1e7) {
        return null;
      }
      tranche.seuil = seuil;
    }
    if (Object.keys(tranche).length === 0) return null;
    sortie[cle] = tranche;
  }
  return Object.keys(sortie).length ? sortie : null;
}

export function urlAvecScenario(href: string, aj: Ajustements, modele?: string): string {
  const url = new URL(href);

  if (nbAjustements(aj) === 0) url.searchParams.delete(PARAM);
  else url.searchParams.set(PARAM, encoderScenario(aj));

  if (aj.mesures?.length) url.searchParams.set(PARAM_MESURES, encoderMesures(aj.mesures));
  else url.searchParams.delete(PARAM_MESURES);

  if (aj.pointsDeTaux) url.searchParams.set(PARAM_TAUX, String(aj.pointsDeTaux));
  else url.searchParams.delete(PARAM_TAUX);

  if (aj.bareme && Object.keys(aj.bareme).length) {
    url.searchParams.set(PARAM_BAREME, versBase64Url(JSON.stringify(aj.bareme)));
  } else url.searchParams.delete(PARAM_BAREME);

  if (aj.chantiers?.length) {
    url.searchParams.set(PARAM_CHANTIERS, versBase64Url(JSON.stringify(aj.chantiers)));
  } else url.searchParams.delete(PARAM_CHANTIERS);

  if (modele) url.searchParams.set(PARAM_MODELE, modele);
  else url.searchParams.delete(PARAM_MODELE);

  return url.toString();
}

function encoderMesures(mesures: Mesure[]): string {
  return versBase64Url(
    JSON.stringify(mesures.map((m) => [m.id, m.label, m.cote, m.montant, m.instrument])),
  );
}

function decoderMesures(encode: string | null): Mesure[] | null {
  if (!encode) return null;
  let brut: unknown;
  try {
    brut = JSON.parse(depuisBase64Url(encode));
  } catch {
    return null;
  }
  if (!Array.isArray(brut) || brut.length === 0 || brut.length > MAX_MESURES) return null;

  const mesures: Mesure[] = [];
  for (const entree of brut) {
    if (!Array.isArray(entree) || entree.length < 5) return null;
    const [id, label, cote, montant, instrument] = entree as [
      string,
      string,
      string,
      number,
      string,
    ];
    if (typeof id !== 'string' || !id || id.length > MAX_LONGUEUR_ID) return null;
    if (typeof label !== 'string' || !label || label.length > 200) return null;
    if (cote !== 'dep' && cote !== 'rec') return null;
    if (typeof montant !== 'number' || !Number.isFinite(montant) || montant <= 0) return null;
    if (typeof instrument !== 'string' || instrument.length > 40) return null;
    mesures.push({ id, label, cote, montant, instrument });
  }
  return mesures;
}

function decoderTaux(brut: string | null): number | null {
  if (brut === null) return null;
  const v = Number(brut);
  if (!Number.isFinite(v) || v === 0) return null;
  return Math.abs(v) > MAX_POINTS_TAUX ? null : v;
}

/** Identifiant de modèle porté par une URL, filtré contre la liste connue. */
export function modeleDepuisUrl(href: string, connus: string[]): string | null {
  const id = new URL(href).searchParams.get(PARAM_MODELE);
  return id && connus.includes(id) ? id : null;
}

/** base64url : sûr en URL, sans remplissage. */
function versBase64Url(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  let binaire = '';
  for (const o of octets) binaire += String.fromCharCode(o);
  return btoa(binaire).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function depuisBase64Url(encode: string): string {
  const base64 = encode.replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(base64);
  const octets = Uint8Array.from(binaire, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(octets);
}
