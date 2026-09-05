import type { Node } from '../schema';
import type { Store } from './store';

/**
 * Simulation comptable.
 *
 * Un ajustement est un facteur multiplicatif posé sur un nœud : il met à
 * l'échelle tout son sous-arbre et remonte dans les totaux de ses parents.
 *
 * La contrainte structurante est que l'arbre est chargé paresseusement : on ne
 * peut pas recalculer un total en sommant ses enfants, puisqu'un département en
 * compte des centaines qui ne sont pas en mémoire. Le montant simulé d'un nœud
 * est donc obtenu par un produit de facteurs le long de son chemin, corrigé des
 * seuls écarts introduits par les nœuds effectivement ajustés — dont le nombre
 * reste petit.
 */

export type Cote = 'dep' | 'rec';

/**
 * Mesure créée de toutes pièces : une taxe qui n'existe pas encore, une dépense
 * nouvelle. Elle ne se rattache à aucun nœud des données publiées, et porte donc
 * son montant en valeur absolue plutôt qu'un facteur.
 */
export type Mesure = {
  id: string;
  label: string;
  cote: Cote;
  /** Montant annuel en euros. Toujours positif : le côté porte le sens. */
  montant: number;
  /** Nature retenue pour le multiplicateur, clé de src/modeles/instruments. */
  instrument: string;
};

/** Facteur appliqué par nœud, de chaque côté du budget. 1 = inchangé. */
export type Ajustements = {
  dep: Record<string, number>;
  rec: Record<string, number>;
  /** Libellé au moment de la pose, pour détecter une donnée reconstruite. */
  labels: Record<string, string>;
  /**
   * Shards à charger pour que le nœud visé existe en mémoire. Sans eux, un
   * scénario restauré porterait sur des nœuds introuvables : ses ajustements
   * seraient comptés dans le total affiché mais silencieusement non appliqués.
   */
  shards: Record<string, string[]>;
  /** Mesures créées par l'utilisateur, hors nomenclature publiée. */
  mesures?: Mesure[];
  /** Variation des taux d'emprunt, en points de pourcentage. */
  pointsDeTaux?: number;
  /** Réforme du barème de l'impôt sur le revenu, par indice de tranche. */
  bareme?: Record<string, { taux?: number; seuil?: number }>;
  /** Grands chantiers retenus, avec leur année de démarrage. */
  chantiers?: ChantierRetenu[];
};

/**
 * Chantier inscrit au scénario. `ref` renvoie au catalogue publié ; les champs
 * suivants ne sont renseignés que pour un chantier créé sur mesure, absent du
 * catalogue.
 */
export type ChantierRetenu = {
  id: string;
  ref: string;
  /** Décalage en années par rapport au début de la projection. */
  debut: number;
  label?: string;
  cout?: number;
  dureeAnnees?: number;
};

export const AUCUN: Ajustements = { dep: {}, rec: {}, labels: {}, shards: {} };

/** Recopie les volets qui ne sont pas indexés par nœud. */
function reporter(source: Ajustements, cible: Ajustements): Ajustements {
  if (source.mesures?.length) cible.mesures = source.mesures;
  if (source.pointsDeTaux) cible.pointsDeTaux = source.pointsDeTaux;
  if (source.bareme && Object.keys(source.bareme).length) cible.bareme = source.bareme;
  if (source.chantiers?.length) cible.chantiers = source.chantiers;
  return cible;
}

export function avecChantier(aj: Ajustements, chantier: ChantierRetenu): Ajustements {
  const autres = (aj.chantiers ?? []).filter((c) => c.id !== chantier.id);
  return { ...aj, chantiers: [...autres, chantier] };
}

export function sansChantier(aj: Ajustements, id: string): Ajustements {
  const restants = (aj.chantiers ?? []).filter((c) => c.id !== id);
  const suivant: Ajustements = { ...aj };
  if (restants.length === 0) delete suivant.chantiers;
  else suivant.chantiers = restants;
  return suivant;
}

/** Réforme d'une tranche du barème. Une valeur vide rétablit le droit en vigueur. */
export function avecTranche(
  aj: Ajustements,
  indice: number,
  champ: 'taux' | 'seuil',
  valeur: number | undefined,
): Ajustements {
  const bareme = { ...(aj.bareme ?? {}) };
  const cle = String(indice);
  const tranche = { ...(bareme[cle] ?? {}) };

  if (valeur === undefined) delete tranche[champ];
  else tranche[champ] = valeur;

  if (Object.keys(tranche).length === 0) delete bareme[cle];
  else bareme[cle] = tranche;

  const suivant: Ajustements = { ...aj };
  if (Object.keys(bareme).length === 0) delete suivant.bareme;
  else suivant.bareme = bareme;
  return suivant;
}

export function nbTranchesReformees(aj: Ajustements): number {
  return Object.keys(aj.bareme ?? {}).length;
}

export function avecMesure(aj: Ajustements, mesure: Mesure): Ajustements {
  const autres = (aj.mesures ?? []).filter((m) => m.id !== mesure.id);
  return { ...aj, mesures: [...autres, mesure] };
}

export function sansMesure(aj: Ajustements, id: string): Ajustements {
  const restantes = (aj.mesures ?? []).filter((m) => m.id !== id);
  const suivant: Ajustements = { ...aj };
  // Laisser un tableau vide ferait apparaître un volet « mesures » inutile dans
  // le scénario enregistré comme dans l'URL partagée.
  if (restantes.length === 0) delete suivant.mesures;
  else suivant.mesures = restantes;
  return suivant;
}

export function avecPointsDeTaux(aj: Ajustements, points: number): Ajustements {
  const suivant = { ...aj };
  if (points === 0) delete suivant.pointsDeTaux;
  else suivant.pointsDeTaux = points;
  return suivant;
}

/** Chaîne de shards, du plus général au plus précis, menant à un nœud. */
export function shardsPour(store: Store, id: string): string[] {
  return store
    .ancestors(id)
    .map((a) => a.shard)
    .filter((s): s is string => !!s);
}

export function shardsRequis(aj: Ajustements): string[] {
  return [...new Set(Object.values(aj.shards).flat())];
}

/** Ajustements portant sur un nœud publié, hors mesures libres et taux. */
export function nbAjustements(aj: Ajustements): number {
  return Object.keys(aj.dep).length + Object.keys(aj.rec).length;
}

/** Tout ce qui compose le scénario, y compris ce qui ne vise aucun nœud. */
export function nbElements(aj: Ajustements): number {
  return (
    nbAjustements(aj) +
    (aj.mesures?.length ?? 0) +
    (aj.pointsDeTaux ? 1 : 0) +
    nbTranchesReformees(aj) +
    (aj.chantiers?.length ?? 0)
  );
}

export function facteurDe(aj: Ajustements, id: string, cote: Cote): number {
  return aj[cote][id] ?? 1;
}

export function avecAjustement(
  aj: Ajustements,
  id: string,
  cote: Cote,
  facteur: number,
  label: string,
  shards: string[] = [],
): Ajustements {
  const suivant: Ajustements = {
    dep: { ...aj.dep },
    rec: { ...aj.rec },
    labels: { ...aj.labels, [id]: label },
    shards: { ...aj.shards, [id]: shards },
  };
  if (facteur === 1) delete suivant[cote][id];
  else suivant[cote][id] = facteur;
  if (!(id in suivant.dep) && !(id in suivant.rec)) {
    delete suivant.labels[id];
    delete suivant.shards[id];
  }
  return reporter(aj, suivant);
}

/** Produit des facteurs des ancêtres, sans celui du nœud lui-même. */
function facteurAncetres(store: Store, aj: Ajustements, id: string, cote: Cote): number {
  let f = 1;
  for (const a of store.ancestors(id)) f *= aj[cote][a.id] ?? 1;
  return f;
}

function estSous(store: Store, id: string, ancetre: string): boolean {
  return store.ancestors(id).some((a) => a.id === ancetre);
}

/**
 * Nœuds ajustés situés sous `id`, sans autre nœud ajusté entre eux et lui.
 * Ne retenir que ces « maximaux » évite de compter deux fois l'écart d'un nœud
 * déjà inclus dans celui d'un de ses ancêtres ajustés.
 */
function maximauxSous(store: Store, aj: Ajustements, id: string, cote: Cote): string[] {
  const sous = Object.keys(aj[cote]).filter((a) => a !== id && estSous(store, a, id));
  return sous.filter((a) => {
    const ancetres = new Set(store.ancestors(a).map((x) => x.id));
    return !sous.some((b) => b !== a && ancetres.has(b));
  });
}

/**
 * Montant du nœud une fois appliqués les seuls ajustements de ses ancêtres.
 * C'est le point de départ réel de son propre curseur : un poste dont le
 * ministère a déjà été réduit de 10 % ne part pas de son montant publié.
 */
export function montantHerite(
  store: Store,
  aj: Ajustements,
  node: Pick<Node, 'id' | 'dep' | 'rec'>,
  cote: Cote,
): number {
  return node[cote] * facteurAncetres(store, aj, node.id, cote);
}

export function montantSimule(
  store: Store,
  aj: Ajustements,
  node: Pick<Node, 'id' | 'dep' | 'rec'>,
  cote: Cote,
): number {
  if (nbAjustements(aj) === 0) return node[cote];

  const fAncetres = facteurAncetres(store, aj, node.id, cote);
  let total = node[cote] * fAncetres * (aj[cote][node.id] ?? 1);

  for (const sousId of maximauxSous(store, aj, node.id, cote)) {
    const sous = store.nodes.get(sousId);
    if (!sous) continue;
    // Aucun nœud ajusté ne s'intercale, donc le facteur hérité par ce
    // descendant est exactement celui du nœud courant.
    const avant = sous[cote] * fAncetres * (aj[cote][node.id] ?? 1);
    total += montantSimule(store, aj, sous, cote) - avant;
  }
  return total;
}

/**
 * Le solde simulé part du solde de référence et y applique les écarts des deux
 * côtés. Passer par les écarts plutôt que par une soustraction des montants
 * simulés préserve les soldes publiés — celui de la Sécurité sociale n'est pas
 * la différence de ses deux totaux affichés.
 */
export function soldeSimule(store: Store, aj: Ajustements, node: Node): number {
  const base = node.solde ?? node.rec - node.dep;
  if (nbAjustements(aj) === 0) return base;
  const dDep = montantSimule(store, aj, node, 'dep') - node.dep;
  const dRec = montantSimule(store, aj, node, 'rec') - node.rec;
  return base + dRec - dDep;
}

export type LigneAjustement = {
  id: string;
  cote: Cote;
  label: string;
  facteur: number;
  base: number;
  simule: number;
};

export function listeAjustements(store: Store, aj: Ajustements): LigneAjustement[] {
  const lignes: LigneAjustement[] = [];
  for (const cote of ['dep', 'rec'] as const) {
    for (const [id, facteur] of Object.entries(aj[cote])) {
      const node = store.nodes.get(id);
      if (!node) continue;
      // Contribution marginale : ce que cet ajustement retire ou ajoute, une
      // fois ceux du dessus déjà appliqués. Mesurer l'écart depuis le montant
      // publié recompterait la part héritée, et les lignes ne sommeraient plus
      // à l'effet total affiché en tête.
      const herite = montantHerite(store, aj, node, cote);
      lignes.push({
        id,
        cote,
        label: node.label,
        facteur,
        base: herite,
        simule: herite * facteur,
      });
    }
  }
  return lignes.sort((a, b) => Math.abs(b.simule - b.base) - Math.abs(a.simule - a.base));
}

const CLE_STOCKAGE = 'finances-france:scenario';

export function chargerScenario(): Ajustements {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (!brut) return AUCUN;
    const lu = JSON.parse(brut) as Partial<Ajustements>;
    return reporter(lu as Ajustements, {
      dep: lu.dep ?? {},
      rec: lu.rec ?? {},
      labels: lu.labels ?? {},
      shards: lu.shards ?? {},
    });
  } catch {
    return AUCUN;
  }
}

export function enregistrerScenario(aj: Ajustements): void {
  try {
    if (nbElements(aj) === 0) localStorage.removeItem(CLE_STOCKAGE);
    else localStorage.setItem(CLE_STOCKAGE, JSON.stringify(aj));
  } catch {
    // Navigation privée ou stockage plein : le scénario reste utilisable, il
    // ne survivra simplement pas au rechargement.
  }
}

export type Purge = { ajustements: Ajustements; retires: number };

/**
 * À n'appeler qu'après avoir chargé les shards de `shardsRequis` : à ce stade,
 * tout nœud visé doit exister.
 *
 * Deux cas d'écart. Un nœud introuvable, dont la donnée a disparu. Et surtout un
 * nœud dont le libellé ne correspond plus : les identifiants de l'État sont
 * construits sur le rang des lignes dans le CSV source, si bien qu'une
 * reconstruction des données peut les décaler et faire porter un ajustement sur
 * le mauvais ministère. Mieux vaut perdre l'ajustement que l'appliquer ailleurs.
 */
export function purgerObsoletes(store: Store, aj: Ajustements): Purge {
  const suivant: Ajustements = { dep: {}, rec: {}, labels: {}, shards: {} };
  let retires = 0;

  for (const cote of ['dep', 'rec'] as const) {
    for (const [id, facteur] of Object.entries(aj[cote])) {
      const node = store.nodes.get(id);
      const attendu = aj.labels[id];
      if (!node || (attendu && node.label !== attendu)) {
        retires++;
        continue;
      }
      suivant[cote][id] = facteur;
      if (attendu) suivant.labels[id] = attendu;
      if (aj.shards[id]) suivant.shards[id] = aj.shards[id];
    }
  }

  // Mesures libres et variation de taux ne visent aucun nœud : rien ne peut
  // les rendre obsolètes, elles traversent la purge intactes.
  return { ajustements: reporter(aj, suivant), retires };
}
