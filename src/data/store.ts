import {
  CLES_DEPENSES,
  CLES_RECETTES,
  SECTIONS_SOLDE,
  clesDuMode,
  postesDuMode,
  soldeInterpretable,
  type BaremeIR,
  type Chantier,
  type Macro,
  type Mode,
  type Node,
  type Poste,
  type SearchEntry,
  type Shard,
  type SourceRef,
} from '../schema';

const BASE = `${import.meta.env.BASE_URL}data/`;

/** Sépare l'identifiant d'un nœud territorial de la ventilation synthétisée. */
const SEP = '~';

export class Store {
  readonly nodes = new Map<string, Node>();
  readonly sources = new Map<string, SourceRef>();
  macro: Macro | null = null;
  bareme: BaremeIR | null = null;
  chantiers: Chantier[] = [];
  private readonly byParent = new Map<string, Node[]>();
  private readonly loaded = new Set<string>();
  private readonly inflight = new Map<string, Promise<void>>();
  private searchIndex: SearchEntry[] | null = null;

  async init(): Promise<void> {
    const [root, sources, macro, bareme, chantiers] = await Promise.all([
      fetchJson<Shard>('root.json'),
      fetchJson<Record<string, SourceRef>>('sources.json'),
      fetchJson<Macro>('macro.json'),
      fetchJson<BaremeIR>('bareme.json'),
      fetchJson<{ chantiers: Chantier[] }>('chantiers.json'),
    ]);
    this.add(root.nodes);
    for (const [k, v] of Object.entries(sources)) this.sources.set(k, v);
    this.macro = macro;
    this.bareme = bareme;
    this.chantiers = chantiers.chantiers;
  }

  private add(nodes: Node[]): void {
    for (const n of nodes) {
      if (this.nodes.has(n.id)) continue;
      this.nodes.set(n.id, n);
      if (!n.parentId) continue;
      const siblings = this.byParent.get(n.parentId);
      if (siblings) siblings.push(n);
      else this.byParent.set(n.parentId, [n]);
    }
    for (const n of nodes) {
      if (n.parentId) this.byParent.get(n.parentId)?.sort((a, b) => b.dep - a.dep);
    }
  }

  /** Charge le shard d'un nœud si nécessaire. Les appels concurrents partagent la requête. */
  async loadShard(shard: string): Promise<void> {
    if (this.loaded.has(shard)) return;
    const pending = this.inflight.get(shard);
    if (pending) return pending;

    const task = fetchJson<Shard>(shard).then((data) => {
      this.add(data.nodes);
      this.loaded.add(shard);
      this.inflight.delete(shard);
    });
    this.inflight.set(shard, task);
    return task;
  }

  async search(): Promise<SearchEntry[]> {
    this.searchIndex ??= await fetchJson<SearchEntry[]>('search-index.json');
    return this.searchIndex;
  }

  /**
   * Enfants d'un nœud dans un mode donné.
   *
   * Les nœuds territoriaux voient leur ventilation fabriquée ici plutôt que
   * stockée : cela divise par dix le poids des shards départementaux, qui
   * contiennent des milliers de communes.
   */
  resolveChildren(id: string, mode: Mode): Node[] {
    const sep = id.lastIndexOf(SEP);
    if (sep !== -1) return this.postesEnfants(id.slice(0, sep), id.slice(sep + 1), mode);

    const node = this.nodes.get(id);
    if (!node) return [];

    const stockes = this.byParent.get(id);
    if (stockes?.length) return trier(stockes.filter((n) => pertinent(n, mode)), mode);

    return this.sections(node, mode);
  }

  /** Premier niveau de ventilation : les sections, ou les deux soldes de section. */
  private sections(node: Node, mode: Mode): Node[] {
    if (mode === 'solde') {
      if (!node.bd || !node.br) return [];
      return SECTIONS_SOLDE.map((s, i) =>
        this.enregistrer({
          ...gabarit(node),
          id: `${node.id}${SEP}s${i}`,
          label: s.label,
          dep: node.bd![CLES_DEPENSES.indexOf(s.depense)],
          rec: node.br![CLES_RECETTES.indexOf(s.recette)],
          level: 'section',
          parentId: node.id,
        }),
      ).filter((n) => n.dep !== 0 || n.rec !== 0);
    }
    return this.postesEnfants(node.id, mode === 'recettes' ? 'r' : 'd', mode);
  }

  /**
   * Enfants d'un chemin de ventilation. Le chemin encode le mode puis les
   * indices successifs, par exemple « d0.1 » pour le premier poste de la
   * section de fonctionnement, côté dépenses.
   */
  private postesEnfants(baseId: string, chemin: string, mode: Mode): Node[] {
    // Le solde ne se ventile pas au-delà des deux sections : « frais de
    // personnel » n'a pas de pendant en recettes.
    if (mode === 'solde') return [];

    const base = this.nodes.get(baseId);
    const cles = clesDuMode(mode);
    const valeurs = mode === 'recettes' ? base?.br : base?.bd;
    if (!base || !valeurs) return [];

    const indices = chemin.slice(1).split('.').filter(Boolean).map(Number);
    let niveau: Poste[] = postesDuMode(mode);
    for (const i of indices) {
      const suivant = niveau[i]?.enfants;
      if (!suivant) return [];
      niveau = suivant;
    }

    return trier(
      niveau
        .map((poste, i) => {
          const montant = valeurs[cles.indexOf(poste.key)] ?? 0;
          const suffixe = indices.length ? `${indices.join('.')}.${i}` : `${i}`;
          return this.enregistrer({
            ...gabarit(base),
            id: `${baseId}${SEP}${chemin[0]}${suffixe}`,
            label: poste.label,
            dep: mode === 'depenses' ? montant : 0,
            rec: mode === 'recettes' ? montant : 0,
            level: indices.length === 0 ? 'section' : 'poste',
            parentId: indices.length === 0 ? baseId : `${baseId}${SEP}${chemin}`,
            nDep: mode === 'depenses' ? (poste.enfants?.length ?? 0) : 0,
            nRec: mode === 'recettes' ? (poste.enfants?.length ?? 0) : 0,
          });
        })
        .filter((n) => n.dep !== 0 || n.rec !== 0),
      mode,
    );
  }

  private enregistrer(node: Node): Node {
    this.nodes.set(node.id, node);
    return node;
  }

  /** Chaîne des ancêtres, de la racine jusqu'au nœud exclu. */
  ancestors(id: string): Node[] {
    const chain: Node[] = [];
    let current = this.nodes.get(id)?.parentId ?? null;
    while (current) {
      const node = this.nodes.get(current);
      if (!node) break;
      chain.unshift(node);
      current = node.parentId;
    }
    return chain;
  }

  /** Ventilation détaillée d'un nœud, pour le tableau du panneau. */
  ventilation(node: Node, mode: Mode): { label: string; amount: number }[] {
    const valeurs = mode === 'recettes' ? node.br : node.bd;
    if (!valeurs) return [];
    return clesDuMode(mode).map((label, i) => ({ label, amount: valeurs[i] }));
  }
}

function gabarit(source: Node): Node {
  return {
    id: '',
    label: '',
    dep: 0,
    rec: 0,
    level: 'poste',
    sphere: source.sphere,
    parentId: source.id,
    nDep: 0,
    nRec: 0,
    nSol: 0,
    consolide: source.consolide,
    src: source.src,
  };
}

/** Un ministère n'a rien à faire dans la vue recettes, et inversement. */
function pertinent(node: Node, mode: Mode): boolean {
  if (mode === 'depenses') return node.dep !== 0;
  if (mode === 'recettes') return node.rec !== 0;
  return soldeInterpretable(node);
}

function trier(nodes: Node[], mode: Mode): Node[] {
  const cle = (n: Node) =>
    mode === 'recettes' ? Math.abs(n.rec) : mode === 'depenses' ? n.dep : Math.abs(n.solde ?? n.rec - n.dep);
  return [...nodes].sort((a, b) => cle(b) - cle(a));
}

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Chargement impossible : ${path} (${res.status})`);
  return (await res.json()) as T;
}
