/** Vérification de l'algèbre de simulation sur un arbre minimal. */
import {
  AUCUN,
  avecAjustement,
  listeAjustements,
  montantSimule,
  soldeSimule,
  type Ajustements,
} from '../src/data/simulation.ts';
import type { Node } from '../src/schema.ts';

const n = (id: string, parentId: string | null, dep: number, rec = 0, solde?: number): Node => ({
  id,
  label: id,
  dep,
  rec,
  solde,
  level: 'poste',
  sphere: 'etat',
  parentId,
  nDep: 0,
  nRec: 0,
  nSol: 0,
  consolide: true,
  src: 'x',
});

// racine 1000 = A 600 (= A1 400 + A2 200) + B 400
const nodes = new Map<string, Node>([
  ['racine', n('racine', null, 1000, 900)],
  ['A', n('A', 'racine', 600, 500)],
  ['A1', n('A1', 'A', 400)],
  ['A2', n('A2', 'A', 200)],
  ['B', n('B', 'racine', 400, 400)],
]);

const store = {
  nodes,
  ancestors(id: string) {
    const chain: Node[] = [];
    let cur = nodes.get(id)?.parentId ?? null;
    while (cur) {
      const node = nodes.get(cur);
      if (!node) break;
      chain.unshift(node);
      cur = node.parentId;
    }
    return chain;
  },
} as never;

let echecs = 0;
function eq(label: string, attendu: number, obtenu: number) {
  const ok = Math.abs(attendu - obtenu) < 1e-6;
  if (!ok) echecs++;
  console.log(`${ok ? '  ok  ' : 'ÉCHEC '} ${label} — attendu ${attendu}, obtenu ${obtenu}`);
}

const dep = (aj: Ajustements, id: string) => montantSimule(store, aj, nodes.get(id)!, 'dep');

console.log('\n1. Sans ajustement, rien ne bouge');
eq('racine', 1000, dep(AUCUN, 'racine'));
eq('A1', 400, dep(AUCUN, 'A1'));

console.log('\n2. Ajustement sur une feuille : remonte dans les parents');
const a = avecAjustement(AUCUN, 'A1', 'dep', 0.5, 'A1');
eq('A1 −50 %', 200, dep(a, 'A1'));
eq('A inchangé sauf la baisse', 400, dep(a, 'A'));
eq('racine idem', 800, dep(a, 'racine'));
eq('A2 non touché', 200, dep(a, 'A2'));
eq('B non touché', 400, dep(a, 'B'));

console.log('\n3. Ajustement sur un parent : met à l\'échelle tout le sous-arbre');
const b = avecAjustement(AUCUN, 'A', 'dep', 0.5, 'A');
eq('A −50 %', 300, dep(b, 'A'));
eq('A1 suit', 200, dep(b, 'A1'));
eq('A2 suit', 100, dep(b, 'A2'));
eq('racine', 700, dep(b, 'racine'));

console.log('\n4. Imbriqués : les facteurs se composent, sans double comptage');
// A −50 % puis A1 ×2 par-dessus : A1 = 400 × 0,5 × 2 = 400 ; A2 = 100 ; A = 500
const c = avecAjustement(b, 'A1', 'dep', 2, 'A1');
eq('A1 = 400 × 0,5 × 2', 400, dep(c, 'A1'));
eq('A2 = 200 × 0,5', 100, dep(c, 'A2'));
eq('A = A1 + A2', 500, dep(c, 'A'));
eq('racine = A + B', 900, dep(c, 'racine'));

console.log('\n5. Deux ajustements frères');
const d = avecAjustement(avecAjustement(AUCUN, 'A1', 'dep', 0, 'A1'), 'B', 'dep', 1.25, 'B');
eq('A1 supprimé', 0, dep(d, 'A1'));
eq('A = A2 seul', 200, dep(d, 'A'));
eq('B +25 %', 500, dep(d, 'B'));
eq('racine', 700, dep(d, 'racine'));

console.log('\n6. Solde : une baisse de dépense améliore le solde');
eq('solde racine de base', -100, soldeSimule(store, AUCUN, nodes.get('racine')!));
eq('après A1 −50 %', 100, soldeSimule(store, a, nodes.get('racine')!));

console.log('\n7. Solde publié préservé (cas Sécurité sociale)');
// solde publié −15, sans lien avec rec − dep ; une baisse de dépense de 100
// doit le porter à −15 + 100 = 85, pas le recalculer.
nodes.set('S', n('S', 'racine', 600, 620, -15));
const e = avecAjustement(AUCUN, 'S', 'dep', 500 / 600, 'S');
eq('dépense S', 500, dep(e, 'S'));
eq('solde publié décalé de l\'écart', 85, soldeSimule(store, e, nodes.get('S')!));

console.log('\n8. Les contributions marginales somment à l\'effet total');
// A −50 % puis A1 −50 % par-dessus. La ligne de A1 doit compter ce qu'elle
// retire en plus, pas sa baisse depuis le montant publié : sinon les lignes
// affichées ne somment plus à l'écart annoncé en tête du scénario.
const f = avecAjustement(avecAjustement(AUCUN, 'A', 'dep', 0.5, 'A'), 'A1', 'dep', 0.5, 'A1');
const lignes = listeAjustements(store, f);
const sommeMarginale = lignes.reduce((s, l) => s + (l.simule - l.base), 0);
const deltaTotal = dep(f, 'racine') - 1000;
eq('racine 1000 → 600', 600, dep(f, 'racine'));
eq('somme des lignes = écart du total', deltaTotal, sommeMarginale);
eq(
  'ligne A1 = contribution marginale',
  -100,
  lignes.find((l) => l.id === 'A1')!.simule - lignes.find((l) => l.id === 'A1')!.base,
);

console.log(`\n${echecs === 0 ? 'Tous les contrôles passent.' : `${echecs} ÉCHEC(S)`}`);
process.exitCode = echecs === 0 ? 0 : 1;
