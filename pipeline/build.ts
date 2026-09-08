import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  EXERCICE_OFGL,
  EXERCICE_PLF,
  OUT_DIR,
  PLF_DEPENSES,
  PLF_RECETTES,
} from './config.ts';
import { buildCollectivites } from './collectivites.ts';
import { buildEtat } from './etat.ts';
import { buildSecu, readChantiers, readReference } from './secu.ts';
import { buildBareme } from './openfisca.ts';
import { buildSearchIndex } from './search.ts';
import { check, checkCount, groupe, rapport, report } from './checks.ts';
import type { Node, SourceRef } from '../src/schema.ts';

const ofgl = (nom: string, dataset: string): SourceRef => ({
  label: `Comptes ${nom} — OFGL`,
  dataset,
  exercice: EXERCICE_OFGL,
  url: `https://data.ofgl.fr/explore/dataset/${dataset}/`,
  // Comptes clos : ces montants ont été effectivement dépensés et encaissés.
  nature: 'execute',
});

/**
 * Le PLF est un *projet* de loi. Celui de 2025 n'a de surcroît jamais été adopté
 * en l'état : le gouvernement a été censuré le 4 décembre 2024, une loi spéciale
 * a assuré l'intérim, et la loi de finances a finalement été promulguée le
 * 14 février 2025 dans une version de compromis moins ambitieuse. Aucune loi de
 * finances votée n'étant publiée en données ouvertes, ce projet reste la source
 * la plus fine disponible — mais l'écart doit être dit, faute de quoi un lecteur
 * y verrait des dépenses réelles.
 */
const RESERVE_PLF =
  "Projet de loi de finances, non des dépenses constatées. Ce projet n'a pas été adopté en l'état : après la censure du 4 décembre 2024, la loi de finances a été promulguée le 14 février 2025 dans une version de compromis. Les montants affichés en diffèrent.";

const SOURCES: Record<string, SourceRef> = {
  'ofgl-regions': ofgl('des régions', 'ofgl-base-regions'),
  'ofgl-departements': ofgl('des départements', 'ofgl-base-departements'),
  'ofgl-gfp': ofgl('des groupements à fiscalité propre', 'ofgl-base-gfp'),
  'ofgl-communes': ofgl('des communes', 'ofgl-base-communes'),
  'plf-etat-depenses': {
    label: "Dépenses de l'État selon destination — PLF 2025, budget général",
    dataset: PLF_DEPENSES,
    exercice: EXERCICE_PLF,
    url: `https://data.economie.gouv.fr/explore/dataset/${PLF_DEPENSES}/`,
    nature: 'prevision',
    reserve: RESERVE_PLF,
  },
  'plf-etat-recettes': {
    label: 'Recettes du budget général — PLF 2025',
    dataset: PLF_RECETTES,
    exercice: EXERCICE_PLF,
    url: `https://data.economie.gouv.fr/explore/dataset/${PLF_RECETTES}/`,
    nature: 'prevision',
    reserve: RESERVE_PLF,
  },
};

function write(relative: string, data: unknown): number {
  const path = resolve(OUT_DIR, relative);
  mkdirSync(dirname(path), { recursive: true });
  const json = JSON.stringify(data);
  writeFileSync(path, json);
  return Buffer.byteLength(json);
}

async function main() {
  console.time('build');
  rmSync(OUT_DIR, { recursive: true, force: true });

  const ref = readReference();

  console.log('\n[1/4] Collectivités territoriales');
  const col = await buildCollectivites();

  console.log('\n[2/4] État');
  const etat = await buildEtat();

  console.log('\n[3/5] Sécurité sociale');
  const secu = buildSecu(ref);

  console.log("\n[4/5] Barème de l'impôt sur le revenu");
  const bareme = await buildBareme();

  console.log('\n[5/5] Écriture');

  const spheres: Node[] = [
    {
      id: 'sphere:etat',
      label: 'État',
      dep: etat.totalDep,
      rec: etat.totalRec,
      level: 'sphere',
      sphere: 'etat',
      parentId: 'racine',
      nDep: etat.enfantsSphere.filter((n) => n.dep !== 0).length,
      nRec: etat.enfantsSphere.filter((n) => n.rec !== 0).length,
      // Un ministère n'a pas de recettes et une ligne d'impôt pas de dépenses :
      // aucun enfant de l'État n'a de solde interprétable.
      nSol: 0,
      consolide: true,
      note: `Budget général du projet de loi de finances 2025 ; dépenses en crédits de paiement. Les comptes spéciaux et budgets annexes sont hors périmètre. ${etat.noteRecettes}`,
      src: 'plf-etat-depenses',
    },
    {
      id: 'sphere:collectivites',
      label: 'Collectivités territoriales',
      dep: col.totalDep,
      rec: col.totalRec,
      level: 'sphere',
      sphere: 'collectivites',
      parentId: 'racine',
      nDep: col.regions.length,
      nRec: col.regions.length,
      nSol: col.regions.length,
      consolide: false,
      note: "Somme brute des comptes des régions, départements, EPCI et communes (budgets principaux, exercice 2024). Les transferts entre niveaux — dotations, subventions croisées, fiscalité reversée — y sont comptés deux fois, des deux côtés.",
      src: 'ofgl-communes',
    },
    {
      id: 'sphere:secu',
      label: 'Sécurité sociale',
      dep: secu.totalDep,
      rec: secu.totalRec,
      solde: secu.solde,
      level: 'sphere',
      sphere: 'secu',
      parentId: 'racine',
      nDep: secu.enfantsSphere.filter((n) => n.parentId === 'sphere:secu' && n.dep !== 0).length,
      nRec: secu.enfantsSphere.filter((n) => n.parentId === 'sphere:secu' && n.rec !== 0).length,
      // Les recettes ne sont pas ventilables par branche dans la source : aucun
      // enfant ne porte à la fois une dépense et une recette.
      nSol: 0,
      consolide: false,
      note: `${ref.secu.note} ${ref.secu.recettes.note}`,
      // Sortie de la note générale : elle répond à une question précise, posée
      // au moment où l'on regarde le solde, et se perdait dans un paragraphe.
      noteSolde: ref.secu.solde.note,
      src: 'secu',
    },
  ];

  const sommeDep = spheres.reduce((s, n) => s + n.dep, 0);
  const sommeRec = spheres.reduce((s, n) => s + n.rec, 0);
  const sommeSolde = spheres.reduce((s, n) => s + (n.solde ?? n.rec - n.dep), 0);

  const racine: Node = {
    id: 'racine',
    label: 'Dépenses publiques',
    dep: sommeDep,
    rec: sommeRec,
    solde: sommeSolde,
    level: 'racine',
    sphere: 'etat',
    parentId: null,
    nDep: 3,
    nRec: 3,
    nSol: 3,
    consolide: false,
    note: `Somme des trois périmètres explorés ici, chacun issu d'une source distincte. À titre de repère, l'Insee évalue les dépenses des administrations publiques 2024 à ${(ref.totalConsolideNational.montant / 1e9).toFixed(0)} Md € après consolidation des flux entre administrations — un total nécessairement inférieur à cette somme brute.`,
    // Le solde de la racine additionne ceux des trois sphères. L'écart de la
    // Sécurité sociale, dont le solde est publié et non calculé, remonte donc
    // jusqu'ici : mieux vaut le dire que laisser croire à une erreur de somme.
    noteSolde:
      "Somme des soldes des trois périmètres, et non la différence des deux totaux affichés ici. Celui de la Sécurité sociale est un chiffre publié, qui ne s'obtient pas en soustrayant ses propres totaux ; l'écart se reporte à ce niveau.",
    src: 'insee',
  };

  const rootNodes = [racine, ...spheres, ...col.regions, ...etat.enfantsSphere, ...secu.enfantsSphere];
  let bytes = write('root.json', { nodes: rootNodes });

  for (const [code, nodes] of col.regionShards) bytes += write(`region/${code}.json`, { nodes });
  for (const [code, nodes] of col.deptShards) bytes += write(`dept/${code}.json`, { nodes });
  for (const [code, nodes] of etat.shards) bytes += write(`etat/${code}.json`, { nodes });

  const index = buildSearchIndex(col, etat);
  bytes += write('search-index.json', index);

  // Cadrage macroéconomique et dette, nécessaires aux modèles côté application.
  // La charge de la dette est localisée ici plutôt que codée en dur : son
  // identifiant dépend du rang des lignes dans le CSV source et se décalerait à
  // la prochaine reconstruction.
  bytes += write('bareme.json', bareme);

  const chantiers = readChantiers();
  write('chantiers.json', chantiers);

  const charge = localiserChargeDette(etat);
  check('charge de la dette localisée', 1, charge ? 1 : 0, 0, 0);
  write('macro.json', {
    ...ref.macroeconomie,
    dette: { ...ref.dette, charge: charge?.dep ?? 0, chargeId: charge?.id ?? null },
  });

  write('sources.json', {
    ...SOURCES,
    secu: { ...ref.secu.source, nature: 'constate' },
    insee: {
      label: ref.totalConsolideNational.libelle,
      dataset: 'comptes-nationaux-apu',
      exercice: ref.totalConsolideNational.exercice,
      url: ref.totalConsolideNational.url,
      nature: 'repere',
    },
  });

  console.log(`  ${(bytes / 1e6).toFixed(1)} Mo écrits, ${index.length} entrées de recherche`);
  console.log(
    `  État ${md(etat.totalDep)} / ${md(etat.totalRec)} · Collectivités ${md(col.totalDep)} / ${md(col.totalRec)} · Sécu ${md(secu.totalDep)} / ${md(secu.totalRec)}`,
  );

  console.log('\nContrôles');
  groupe('Totaux par sphère');
  check('racine dépenses = somme des sphères', racine.dep, sommeDep);
  check('racine recettes = somme des sphères', racine.rec, sommeRec);
  check('État dépenses = somme des ministères', etat.totalDep, sommeCote(etat.enfantsSphere, 'dep'));
  check('État recettes = somme des catégories', etat.totalRec, sommeCote(etat.enfantsSphere, 'rec'));
  check(
    'Sécu dépenses = somme des branches',
    secu.totalDep,
    sommeCote(secu.enfantsSphere, 'dep', 'sphere:secu'),
  );
  check(
    'Sécu recettes = somme des postes',
    secu.totalRec,
    sommeCote(secu.enfantsSphere, 'rec', 'sphere:secu'),
    0.0002,
  );
  check('Collectivités dépenses = somme des régions', col.totalDep, sommeCote(col.regions, 'dep'));
  check('Collectivités recettes = somme des régions', col.totalRec, sommeCote(col.regions, 'rec'));

  groupe('Emboîtement des régions');
  for (const [code, nodes] of col.regionShards) {
    const region = col.regions.find((r) => r.id === `reg:${code}`)!;
    const enfants = nodes.filter((n) => n.parentId === region.id);
    check(`${region.label} : dépenses = propre + départements`, region.dep, sommeCote(enfants, 'dep'), 0.001);
    check(`${region.label} : recettes = propre + départements`, region.rec, sommeCote(enfants, 'rec'), 0.001);
  }

  // Toute entité présente dans les sources doit être atteignable dans le graphe :
  // les territoires sans collectivité de niveau départemental (Corse, Alsace,
  // Martinique, Guyane) ont déjà fait disparaître leurs communes une fois.
  groupe("Barème de l'impôt sur le revenu");
  checkCount('cas types conservés', 28, bareme.casTypes.length);
  check('notre calcul reproduit OpenFisca', 0, bareme.ecartMaximal, 0, 2);
  checkCount('tranches du barème', 5, bareme.tranches.length);

  groupe('Exhaustivité des entités');
  const emis = [...col.deptShards.values()].flat();
  checkCount('communes atteignables', col.attendus.communes, count(emis, 'commune'));
  checkCount('EPCI atteignables', col.attendus.epcis, count(emis, 'epci'));
  checkCount('départements atteignables', col.attendus.departements, col.deptShards.size);
  checkCount('régions atteignables', col.attendus.regions, col.regions.length);
  // Un code multivalué comme « 26,84 » signale un EPCI à cheval mal rattaché,
  // qui fabrique un département fantôme et y enferme ses communes.
  checkCount(
    'aucun code de territoire multivalué',
    0,
    [...col.deptShards.keys(), ...col.regionShards.keys()].filter((c) => c.includes(',')).length,
  );

  // Écrit même en cas d'échec : l'app doit pouvoir montrer ce qui ne va pas.
  write('controles.json', rapport());

  report();
  console.timeEnd('build');
}

/**
 * Somme d'un côté sur les seuls enfants directs de `parent`. Les tableaux de
 * nœuds contiennent aussi les petits-enfants : les sommer tous doublerait.
 */
function sommeCote(nodes: Node[], cote: 'dep' | 'rec', parent?: string): number {
  return nodes
    .filter((n) => parent === undefined || n.parentId === parent)
    .reduce((s, n) => s + n[cote], 0);
}

/**
 * Programme portant la charge de la dette de l'État. Le libellé est stable d'un
 * exercice à l'autre, contrairement à l'identifiant.
 */
function localiserChargeDette(etat: { shards: Map<string, Node[]> }): Node | undefined {
  for (const nodes of etat.shards.values()) {
    const trouve = nodes.find(
      (n) => n.level === 'programme' && /^Charge de la dette et trésorerie de l'État/i.test(n.label),
    );
    if (trouve) return trouve;
  }
  return undefined;
}

function count(nodes: Node[], level: Node['level']): number {
  return nodes.filter((n) => n.level === level).length;
}

function md(n: number): string {
  return `${(n / 1e9).toFixed(1)} Md`;
}

await main();
