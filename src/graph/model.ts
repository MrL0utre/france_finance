import { nbEnfants, type Mode, type Node } from '../schema';
import type { Store } from '../data/store';
import {
  montantSimule,
  nbAjustements,
  soldeSimule,
  type Ajustements,
} from '../data/simulation';

/** Au-delà, les plus petits enfants sont repliés dans un nœud « Autres ». */
export const MAX_ENFANTS = 24;

export type GraphNode = Node & {
  autres?: number;
  depth: number;
  depSim: number;
  recSim: number;
  soldeSim: number;
};

export type GraphLink = { source: string; target: string };
export type GraphView = { nodes: GraphNode[]; links: GraphLink[] };

export function isAutres(id: string): boolean {
  return id.endsWith('#autres');
}

export function parentOfAutres(id: string): string {
  return id.slice(0, -'#autres'.length);
}

/** Montant à afficher, simulation comprise. */
export function valeurSimulee(node: GraphNode, mode: Mode): number {
  if (mode === 'depenses') return node.depSim;
  if (mode === 'recettes') return node.recSim;
  return node.soldeSim;
}

/**
 * Sous-arbre effectivement affiché. Un département peut compter 800 communes :
 * les afficher toutes rendrait le graphe illisible et la simulation inutilisable,
 * d'où le repli des plus petites derrière un nœud « Autres » dépliable.
 */
export function computeView(
  store: Store,
  mode: Mode,
  expanded: ReadonlySet<string>,
  developpes: ReadonlySet<string>,
  ajustements: Ajustements,
): GraphView {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];

  const simuler = (node: Node, depth: number): GraphNode => ({
    ...node,
    depth,
    depSim: montantSimule(store, ajustements, node, 'dep'),
    recSim: montantSimule(store, ajustements, node, 'rec'),
    soldeSim: soldeSimule(store, ajustements, node),
  });

  const walk = (id: string, depth: number): void => {
    const node = store.nodes.get(id);
    if (!node) return;
    nodes.push(simuler(node, depth));
    if (!expanded.has(id) || nbEnfants(node, mode) === 0) return;

    const enfants = store.resolveChildren(id, mode);
    const replier = enfants.length > MAX_ENFANTS && !developpes.has(id);
    const visibles = replier ? enfants.slice(0, MAX_ENFANTS) : enfants;

    for (const enfant of visibles) {
      links.push({ source: id, target: enfant.id });
      walk(enfant.id, depth + 1);
    }

    if (replier) {
      const restants = enfants.slice(MAX_ENFANTS);
      const autresId = `${id}#autres`;
      // Ce nœud n'existe pas dans le store : ses montants simulés sont sommés
      // depuis ses membres, faute de chaîne d'ancêtres à remonter.
      const somme = (cote: 'dep' | 'rec') =>
        nbAjustements(ajustements) === 0
          ? restants.reduce((s, n) => s + n[cote], 0)
          : restants.reduce((s, n) => s + montantSimule(store, ajustements, n, cote), 0);
      const depSim = somme('dep');
      const recSim = somme('rec');

      nodes.push({
        ...node,
        id: autresId,
        label: `Autres (${restants.length})`,
        dep: restants.reduce((s, n) => s + n.dep, 0),
        rec: restants.reduce((s, n) => s + n.rec, 0),
        solde: undefined,
        parentId: id,
        nDep: restants.length,
        nRec: restants.length,
        nSol: restants.length,
        shard: undefined,
        bd: undefined,
        br: undefined,
        note: undefined,
        autres: restants.length,
        depth: depth + 1,
        depSim,
        recSim,
        soldeSim: recSim - depSim,
      });
      links.push({ source: id, target: autresId });
    }
  };

  walk('racine', 0);
  return { nodes, links };
}
