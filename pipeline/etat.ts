import { ECO_API, PLF_DEPENSES, PLF_RECETTES } from './config.ts';
import { download, readCsv } from './fetch.ts';
import type { Level, Node } from '../src/schema.ts';

export type EtatBuild = {
  /** Ministères et catégories de recettes, pour root.json. */
  enfantsSphere: Node[];
  /** Contenu de etat/{code}.json */
  shards: Map<string, Node[]>;
  totalDep: number;
  totalRec: number;
  noteRecettes: string;
};

/**
 * Les prélèvements sur recettes sont reversés à l'Union européenne et aux
 * collectivités : ce sont des moindres recettes pour l'État, pas des ressources.
 * Les additionner au reste surestimerait les recettes de près de 70 Md€.
 */
const PRELEVEMENTS = 'Prélèvement';

const DEP = 'plf-etat-depenses';
const REC = 'plf-etat-recettes';

type Bucket = { label: string; amount: number; children: Map<string, Bucket> };

const bucket = (label: string): Bucket => ({ label, amount: 0, children: new Map() });

function descend(parent: Bucket, label: string): Bucket {
  let b = parent.children.get(label);
  if (!b) {
    b = bucket(label);
    parent.children.set(label, b);
  }
  return b;
}

function urlDepenses(): string {
  const params = new URLSearchParams({
    where: 'typebudget="BG"',
    select: [
      'libelle_ministere',
      'libelle_mission',
      'libelle_programme',
      'libelle_action',
      'libelle_sous_action',
      'credit_de_paiement',
    ].join(','),
    delimiter: ';',
  });
  return `${ECO_API}/${PLF_DEPENSES}/exports/csv?${params}`;
}

function urlRecettes(): string {
  const params = new URLSearchParams({
    select: ['type_de_recettes', 'libelle', 'montant_recettes_plf'].join(','),
    delimiter: ';',
  });
  return `${ECO_API}/${PLF_RECETTES}/exports/csv?${params}`;
}

export async function buildEtat(): Promise<EtatBuild> {
  const [fichierDep, fichierRec] = await Promise.all([
    download(urlDepenses(), 'plf-etat-depenses.csv'),
    download(urlRecettes(), 'plf-etat-recettes.csv'),
  ]);

  const depenses = bucket('Dépenses');
  for await (const row of readCsv(fichierDep)) {
    const cp = nombre(row.credit_de_paiement);
    if (!cp) continue;
    const chaine = [
      row.libelle_ministere,
      row.libelle_mission,
      row.libelle_programme,
      row.libelle_action,
      row.libelle_sous_action,
    ];
    ajouter(depenses, chaine, cp);
  }

  const recettes = bucket('Recettes');
  let brut = 0;
  let prelevements = 0;
  for await (const row of readCsv(fichierRec)) {
    const m = nombre(row.montant_recettes_plf);
    if (!m) continue;
    const type = row.type_de_recettes?.trim() ?? '';
    // Un prélèvement est une recette qui sort : on le porte en négatif pour que
    // la somme de l'arbre donne bien les recettes nettes de l'État.
    const estPrelevement = type.startsWith(PRELEVEMENTS);
    if (estPrelevement) prelevements += m;
    else brut += m;
    ajouter(recettes, [type, row.libelle], estPrelevement ? -m : m);
  }

  const NIVEAUX_DEP: Level[] = ['ministere', 'mission', 'programme', 'action'];
  const NIVEAUX_REC: Level[] = ['categorie', 'poste'];

  const enfantsSphere: Node[] = [];
  const shards = new Map<string, Node[]>();

  let i = 0;
  for (const [label, min] of depenses.children) {
    const code = `d${i++}`;
    const id = `etat:min:${code}`;
    const nodes: Node[] = [];
    emettre(min, id, 1, nodes, NIVEAUX_DEP, 'dep', DEP);
    shards.set(code, nodes);
    enfantsSphere.push({
      id,
      label,
      dep: Math.round(min.amount),
      rec: 0,
      level: 'ministere',
      sphere: 'etat',
      parentId: 'sphere:etat',
      nDep: min.children.size,
      nRec: 0,
      nSol: 0,
      shard: `etat/${code}.json`,
      consolide: true,
      src: DEP,
    });
  }

  let j = 0;
  for (const [label, cat] of recettes.children) {
    const code = `r${j++}`;
    const id = `etat:rec:${code}`;
    const nodes: Node[] = [];
    emettre(cat, id, 1, nodes, NIVEAUX_REC, 'rec', REC);
    shards.set(code, nodes);
    enfantsSphere.push({
      id,
      label,
      dep: 0,
      rec: Math.round(cat.amount),
      level: 'categorie',
      sphere: 'etat',
      parentId: 'sphere:etat',
      nDep: 0,
      nRec: cat.children.size,
      nSol: 0,
      shard: `etat/${code}.json`,
      consolide: true,
      note: cat.amount < 0 ? NOTE_PRELEVEMENT : undefined,
      src: REC,
    });
  }

  enfantsSphere.sort((a, b) => Math.abs(b.dep + b.rec) - Math.abs(a.dep + a.rec));

  return {
    enfantsSphere,
    shards,
    totalDep: Math.round(depenses.amount),
    totalRec: Math.round(recettes.amount),
    noteRecettes:
      `Recettes nettes du budget général : ${md(brut)} de recettes fiscales et non fiscales, ` +
      `moins ${md(prelevements)} de prélèvements reversés à l'Union européenne et aux collectivités territoriales.`,
  };
}

const NOTE_PRELEVEMENT =
  "Prélèvement sur les recettes de l'État : cette somme est encaissée puis reversée, elle vient donc en déduction des recettes. Elle apparaît en négatif pour que le total de l'arbre corresponde aux recettes nettes.";

function ajouter(racine: Bucket, chaine: (string | undefined)[], montant: number): void {
  racine.amount += montant;
  let node = racine;
  for (const brut of chaine) {
    const label = brut?.trim();
    if (!label) continue;
    node = descend(node, label);
    node.amount += montant;
  }
}

function emettre(
  parent: Bucket,
  parentId: string,
  profondeur: number,
  out: Node[],
  niveaux: Level[],
  cote: 'dep' | 'rec',
  src: string,
): void {
  let i = 0;
  for (const [label, child] of parent.children) {
    const id = `${parentId}/${i++}`;
    const montant = Math.round(child.amount);
    out.push({
      id,
      label,
      dep: cote === 'dep' ? montant : 0,
      rec: cote === 'rec' ? montant : 0,
      level: niveaux[profondeur] ?? 'poste',
      sphere: 'etat',
      parentId,
      nDep: cote === 'dep' ? child.children.size : 0,
      nRec: cote === 'rec' ? child.children.size : 0,
      nSol: 0,
      consolide: true,
      src,
    });
    emettre(child, id, profondeur + 1, out, niveaux, cote, src);
  }
}

function nombre(valeur: string | undefined): number {
  const n = Number(valeur?.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function md(n: number): string {
  return `${(n / 1e9).toFixed(1).replace('.', ',')} Md €`;
}
