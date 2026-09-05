import { loadNiveau, type Collectivite } from './sources/ofgl.ts';
import { check, groupe } from './checks.ts';
import {
  CLES_DEPENSES,
  CLES_RECETTES,
  SOLDE_PUBLIE,
  TOTAL_DEPENSES,
  TOTAL_RECETTES,
  type Node,
} from '../src/schema.ts';

export type CollectivitesBuild = {
  regions: Node[];
  regionShards: Map<string, Node[]>;
  deptShards: Map<string, Node[]>;
  totalDep: number;
  totalRec: number;
  attendus: { communes: number; epcis: number; departements: number; regions: number };
};

const SANS_COLLECTIVITE =
  "Ce territoire n'a pas de collectivité départementale propre : ses compétences sont exercées par la collectivité de niveau supérieur. Seules les dépenses et recettes du bloc communal apparaissent ici.";

const COLLECTIVITE_UNIQUE =
  "Une seule collectivité exerce ici les compétences communales et départementales. L'OFGL publie ses comptes dans les deux jeux de données ; ils ne sont comptés qu'une fois, au niveau communal.";

function montant(c: Collectivite | undefined, key: string): number {
  return c ? Math.round(c.agregats.get(key) ?? 0) : 0;
}

function ventilation(c: Collectivite | undefined, cles: string[]): number[] | undefined {
  if (!c) return undefined;
  return cles.map((k) => montant(c, k));
}

export async function buildCollectivites(): Promise<CollectivitesBuild> {
  const [regionsOfgl, departementsOfgl, epcis, communes] = await Promise.all([
    loadNiveau('region'),
    loadNiveau('departement'),
    loadNiveau('epci'),
    loadNiveau('commune'),
  ]);

  verifierIdentiteSolde([...regionsOfgl, ...departementsOfgl, ...epcis, ...communes]);

  const communesByEpci = groupBy(communes, (c) => c.epciCode ?? '');
  rattacherEpcis(epcis, communesByEpci);
  const sirensCommunaux = new Set(communes.map((c) => c.siren).filter(Boolean));

  const depTerritoires = new Map<string, Territoire>();
  const regTerritoires = new Map<string, Territoire>();

  const noterRegion = (code: string, name: string, ofgl?: Collectivite) => {
    if (!code) return;
    const t = regTerritoires.get(code);
    if (t) {
      if (ofgl) t.ofgl = ofgl;
      return;
    }
    regTerritoires.set(code, { code, name, regCode: code, regName: name, ofgl });
  };

  const noterDept = (t: Territoire) => {
    if (!t.code) return;
    const existing = depTerritoires.get(t.code);
    if (existing) {
      if (t.ofgl) existing.ofgl = t.ofgl;
      return;
    }
    depTerritoires.set(t.code, t);
  };

  for (const r of regionsOfgl) noterRegion(r.code, r.name, r);
  for (const d of departementsOfgl) {
    noterRegion(d.regCode, d.regName);
    noterDept({ code: d.code, name: d.name, regCode: d.regCode, regName: d.regName, ofgl: d });
  }
  // Seules les communes font naître de nouveaux territoires : leurs codes sont
  // toujours simples, là où ceux des EPCI peuvent en cumuler plusieurs.
  for (const c of communes) {
    noterRegion(c.regCode, c.regName);
    if (c.depCode) {
      noterDept({
        code: c.depCode,
        name: c.depName ?? c.depCode,
        regCode: c.regCode,
        regName: c.regName,
      });
    }
  }

  const epcisByDept = groupBy(epcis, (e) => e.depCode ?? '');
  const epciCodes = new Set(epcis.map((e) => e.code));
  const orphelines = groupBy(
    communes.filter((c) => !c.epciCode || !epciCodes.has(c.epciCode)),
    (c) => c.depCode ?? '',
  );

  const deptsByRegion = new Map<string, Territoire[]>();
  for (const t of depTerritoires.values()) {
    const bucket = deptsByRegion.get(t.regCode);
    if (bucket) bucket.push(t);
    else deptsByRegion.set(t.regCode, [t]);
  }

  const regionShards = new Map<string, Node[]>();
  const deptShards = new Map<string, Node[]>();
  const regionNodes: Node[] = [];
  let totalDep = 0;
  let totalRec = 0;

  for (const region of regTerritoires.values()) {
    const regId = `reg:${region.code}`;
    const shard: Node[] = [];
    let dep = 0;
    let rec = 0;
    let enfants = 0;

    if (region.ofgl) {
      shard.push(
        propreNode(regId, `${region.name} — la région`, region.ofgl, regId, 'ofgl-regions'),
      );
      dep += montant(region.ofgl, TOTAL_DEPENSES);
      rec += montant(region.ofgl, TOTAL_RECETTES);
      enfants++;
    }

    for (const dept of deptsByRegion.get(region.code) ?? []) {
      const bloc = buildDept(dept, regId, epcisByDept, communesByEpci, orphelines, sirensCommunaux);
      deptShards.set(dept.code, bloc.nodes);
      shard.push(bloc.node);
      dep += bloc.dep;
      rec += bloc.rec;
      enfants++;
    }

    regionShards.set(region.code, shard);
    regionNodes.push({
      id: regId,
      label: region.name,
      dep,
      rec,
      level: 'region',
      sphere: 'collectivites',
      parentId: 'sphere:collectivites',
      nDep: enfants,
      nRec: enfants,
      nSol: enfants,
      shard: `region/${region.code}.json`,
      consolide: false,
      population: region.ofgl?.population || undefined,
      bd: ventilation(region.ofgl, CLES_DEPENSES),
      br: ventilation(region.ofgl, CLES_RECETTES),
      src: 'ofgl-regions',
    });
    totalDep += dep;
    totalRec += rec;
  }

  regionNodes.sort((a, b) => b.dep - a.dep);
  return {
    regions: regionNodes,
    regionShards,
    deptShards,
    totalDep,
    totalRec,
    attendus: {
      communes: communes.length,
      epcis: epcis.length,
      departements: depTerritoires.size,
      regions: regTerritoires.size,
    },
  };
}

/**
 * L'OFGL publie lui-même la capacité ou le besoin de financement. Vérifier qu'il
 * égale recettes − dépenses confirme que les deux périmètres retenus sont bien
 * appariés : sans cela, le mode solde afficherait des écarts qui ne seraient
 * qu'un artefact de sélection d'agrégats.
 */
function verifierIdentiteSolde(collectivites: Collectivite[]): void {
  let controles = 0;
  let ecartMax = 0;
  let pire = '';

  for (const c of collectivites) {
    const publie = c.agregats.get(SOLDE_PUBLIE);
    if (publie === undefined) continue;
    const calcule = (c.agregats.get(TOTAL_RECETTES) ?? 0) - (c.agregats.get(TOTAL_DEPENSES) ?? 0);
    const ecart = Math.abs(publie - calcule);
    controles++;
    if (ecart > ecartMax) {
      ecartMax = ecart;
      pire = `${c.name} (${c.kind})`;
    }
  }

  console.log(`  solde   ${controles} identités vérifiées, écart max ${Math.round(ecartMax)} €`);
  // Quelques euros d'arrondi sont attendus ; au-delà, les agrégats choisis ne
  // décrivent pas le même périmètre des deux côtés.
  groupe('Identité comptable');
  check(
    `recettes − dépenses = capacité ou besoin de financement publié, sur ${controles.toLocaleString('fr-FR')} collectivités (pire cas : ${pire})`,
    0,
    ecartMax,
    0,
    100,
  );
}

type Territoire = {
  code: string;
  name: string;
  regCode: string;
  regName: string;
  ofgl?: Collectivite;
};

function buildDept(
  dept: Territoire,
  regId: string,
  epcisByDept: Map<string, Collectivite[]>,
  communesByEpci: Map<string, Collectivite[]>,
  orphelines: Map<string, Collectivite[]>,
  sirensCommunaux: Set<string>,
): { node: Node; nodes: Node[]; dep: number; rec: number } {
  const depId = `dep:${dept.code}`;
  const deptEpcis = epcisByDept.get(dept.code) ?? [];
  const deptOrphelines = orphelines.get(dept.code) ?? [];
  const nodes: Node[] = [];
  let dep = 0;
  let rec = 0;
  let enfants = 0;

  // Paris exerce à la fois les compétences communales et départementales, et
  // l'OFGL publie ses comptes à l'identique dans les deux jeux de données.
  // Compter les deux doublerait sa dépense comme sa recette.
  const doublon = !!dept.ofgl && sirensCommunaux.has(dept.ofgl.siren);

  if (dept.ofgl && !doublon) {
    nodes.push(
      propreNode(depId, `${dept.name} — le département`, dept.ofgl, depId, 'ofgl-departements'),
    );
    dep += montant(dept.ofgl, TOTAL_DEPENSES);
    rec += montant(dept.ofgl, TOTAL_RECETTES);
    enfants++;
  }

  for (const epci of deptEpcis) {
    const epciId = `epci:${epci.code}`;
    const members = communesByEpci.get(epci.code) ?? [];
    let epciDep = montant(epci, TOTAL_DEPENSES);
    let epciRec = montant(epci, TOTAL_RECETTES);

    nodes.push(propreNode(epciId, `${epci.name} — l'EPCI`, epci, epciId, 'ofgl-gfp'));
    for (const com of members) {
      epciDep += montant(com, TOTAL_DEPENSES);
      epciRec += montant(com, TOTAL_RECETTES);
      nodes.push(communeNode(com, epciId));
    }

    nodes.push({
      id: epciId,
      label: epci.name,
      dep: epciDep,
      rec: epciRec,
      level: 'epci',
      sphere: 'collectivites',
      parentId: depId,
      nDep: members.length + 1,
      nRec: members.length + 1,
      nSol: members.length + 1,
      consolide: false,
      population: epci.population || undefined,
      bd: ventilation(epci, CLES_DEPENSES),
      br: ventilation(epci, CLES_RECETTES),
      src: 'ofgl-gfp',
    });
    dep += epciDep;
    rec += epciRec;
    enfants++;
  }

  for (const com of deptOrphelines) {
    dep += montant(com, TOTAL_DEPENSES);
    rec += montant(com, TOTAL_RECETTES);
    nodes.push(communeNode(com, depId));
    enfants++;
  }

  return {
    node: {
      id: depId,
      label: dept.name,
      dep,
      rec,
      level: 'departement',
      sphere: 'collectivites',
      parentId: regId,
      nDep: enfants,
      nRec: enfants,
      nSol: enfants,
      shard: `dept/${dept.code}.json`,
      consolide: false,
      population: dept.ofgl?.population || undefined,
      bd: doublon ? undefined : ventilation(dept.ofgl, CLES_DEPENSES),
      br: doublon ? undefined : ventilation(dept.ofgl, CLES_RECETTES),
      note: doublon ? COLLECTIVITE_UNIQUE : dept.ofgl ? undefined : SANS_COLLECTIVITE,
      src: 'ofgl-departements',
    },
    nodes,
    dep,
    rec,
  };
}

/** Nœud « la collectivité elle-même », pour un échelon qui a aussi des sous-territoires. */
function propreNode(
  id: string,
  label: string,
  c: Collectivite,
  parentId: string,
  src: string,
): Node {
  return {
    id: `${id}:propre`,
    label,
    dep: montant(c, TOTAL_DEPENSES),
    rec: montant(c, TOTAL_RECETTES),
    level: 'propre',
    sphere: 'collectivites',
    parentId,
    nDep: 2,
    nRec: 2,
    nSol: 2,
    consolide: false,
    population: c.population || undefined,
    bd: ventilation(c, CLES_DEPENSES),
    br: ventilation(c, CLES_RECETTES),
    src,
  };
}

function communeNode(com: Collectivite, parentId: string): Node {
  return {
    id: `com:${com.code}`,
    label: com.name,
    dep: montant(com, TOTAL_DEPENSES),
    rec: montant(com, TOTAL_RECETTES),
    level: 'commune',
    sphere: 'collectivites',
    parentId,
    nDep: 2,
    nRec: 2,
    nSol: 2,
    consolide: false,
    population: com.population || undefined,
    bd: ventilation(com, CLES_DEPENSES),
    br: ventilation(com, CLES_RECETTES),
    src: 'ofgl-communes',
  };
}

/**
 * 91 EPCI chevauchent plusieurs départements ; l'OFGL renseigne alors un
 * `dep_code` multivalué du type « 26,84 ». Le prendre tel quel fabriquerait un
 * département fantôme « 26,84 » et y enfermerait toutes les communes membres.
 * On rattache donc chaque EPCI au département où réside le plus gros de sa
 * population, en s'appuyant sur ses communes membres — dont le code, lui, est
 * toujours simple.
 */
function rattacherEpcis(epcis: Collectivite[], communesByEpci: Map<string, Collectivite[]>): void {
  for (const epci of epcis) {
    if (!epci.depCode?.includes(',')) continue;

    const membres = communesByEpci.get(epci.code) ?? [];
    const population = new Map<string, { pop: number; name: string; reg: string; regName: string }>();
    for (const c of membres) {
      if (!c.depCode) continue;
      const e = population.get(c.depCode) ?? {
        pop: 0,
        name: c.depName ?? c.depCode,
        reg: c.regCode,
        regName: c.regName,
      };
      e.pop += c.population;
      population.set(c.depCode, e);
    }

    const principal = [...population.entries()].sort((a, b) => b[1].pop - a[1].pop)[0];
    if (principal) {
      epci.depCode = principal[0];
      epci.depName = principal[1].name;
      epci.regCode = principal[1].reg;
      epci.regName = principal[1].regName;
    } else {
      epci.depCode = epci.depCode.split(',')[0];
      epci.depName = epci.depName?.split(',')[0];
      epci.regCode = epci.regCode.split(',')[0];
      epci.regName = epci.regName.split(',')[0];
    }
  }
}

function groupBy<T extends Collectivite>(items: T[], key: (t: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue;
    const bucket = map.get(k);
    if (bucket) bucket.push(item);
    else map.set(k, [item]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => montant(b, TOTAL_DEPENSES) - montant(a, TOTAL_DEPENSES));
  }
  return map;
}
