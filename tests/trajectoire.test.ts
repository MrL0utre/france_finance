/**
 * Contrôles de la projection pluriannuelle.
 *
 * Deux mécanismes n'existaient pas dans le moteur annuel et sont testés ici :
 * l'étalement d'un chantier, qui doit dépenser exactement son coût puis
 * s'arrêter, et la boucle dette-intérêts, qui doit s'auto-alimenter sans
 * diverger ni s'appliquer avec un an d'avance.
 */
import { profilChantier, projeter, type Impulsions } from '../src/modeles/trajectoire.ts';
import { KEYNESIEN } from '../src/modeles/registre.ts';
import { CALIBRATION_NEUTRE } from '../src/modeles/moteur.ts';
import type { Contexte, Impulsion } from '../src/modeles/types.ts';

const CTX: Contexte = {
  pib: 2_920e9,
  pibParEmploi: 97_000,
  recettes: 1_351e9,
  depenses: 1_491e9,
  soldeBase: -166e9,
};

const P = { horizonAnnees: 10, tauxApparent: 0.019, premiereAnnee: 2026 };

let echecs = 0;
function ok(label: string, condition: boolean, detail = '') {
  if (!condition) echecs++;
  console.log(`${condition ? '  ok  ' : 'ÉCHEC '} ${label}${detail ? ` — ${detail}` : ''}`);
}
const proche = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
const md = (n: number) => `${(n / 1e9).toFixed(2)} Md €`;

const dep = (delta: number): Impulsion => ({
  id: 'x',
  label: 'x',
  cote: 'dep',
  instrument: 'investissement',
  delta,
});
const vide: Impulsions = { permanentes: [], parAnnee: new Map() };

console.log('\n1. Un scénario vide ne bouge rien sur dix ans');
{
  const t = projeter(KEYNESIEN, vide, CTX, P);
  ok('dix années projetées', t.annees.length === 10);
  ok('aucun écart de dette', t.detteFinale === 0);
  ok('aucun intérêt supplémentaire', t.interetsCumules === 0);
  ok("aucun pic d'activité", t.picActivite === null);
  ok('les années sont numérotées à partir de la première', t.annees[0].annee === 2026 && t.annees[9].annee === 2035);
}

console.log("\n2. Profil d'un chantier : il dépense son coût, puis s'arrête");
{
  const profil = profilChantier(60e9, 5, 0, 10);
  ok('la somme égale le coût total', proche(profil.reduce((s, v) => s + v, 0), 60e9));
  ok('réparti sur cinq ans', profil.filter((v) => v > 0).length === 5);
  ok('12 Md € par an', proche(profil[0], 12e9));
  ok('rien après la cinquième année', profil.slice(5).every((v) => v === 0));

  const decale = profilChantier(60e9, 5, 3, 10);
  ok('un chantier décalé commence plus tard', decale[0] === 0 && decale[3] > 0);

  // Un chantier qui déborde de l'horizon ne dépense que la part qui y tient.
  const deborde = profilChantier(100e9, 20, 0, 10);
  ok('la part hors horizon est ignorée', proche(deborde.reduce((s, v) => s + v, 0), 50e9));
}

console.log('\n3. Sans rétroaction, le solde ne bouge que de la dépense décidée');
{
  const parAnnee = new Map([[0, [dep(10e9)]]]);
  const t = projeter(CALIBRATION_NEUTRE, { permanentes: [], parAnnee }, CTX, {
    ...P,
    tauxApparent: 0,
  });
  ok('année 1 : le solde se dégrade du montant dépensé', proche(t.annees[0].soldeVariation, -10e9));
  ok('année 2 : plus de dépense, plus d\'effet', t.annees[1].soldeVariation === 0);
  ok('la dette garde l\'écart accumulé', proche(t.detteFinale, -10e9));
  ok('aucune activité induite', t.annees[0].pib === 0);
}

console.log('\n4. La boucle dette-intérêts');
{
  const parAnnee = new Map([[0, [dep(100e9)]]]);
  const t = projeter(CALIBRATION_NEUTRE, { permanentes: [], parAnnee }, CTX, P);

  ok('aucun intérêt la première année', t.annees[0].chargeInterets === 0,
    'la dette de l\'année ne coûte encore rien');
  ok('des intérêts dès la deuxième', t.annees[1].chargeInterets > 0,
    md(t.annees[1].chargeInterets));
  ok('année 2 : intérêts = taux × dette de l\'année 1',
    proche(t.annees[1].chargeInterets, 0.019 * 100e9, 1e6),
    `${md(t.annees[1].chargeInterets)} pour ${md(0.019 * 100e9)} attendus`);

  // Les intérêts se cumulent : chaque année, la dette héritée est plus lourde.
  const croissants = t.annees.slice(1).every((a, i, arr) => i === 0 || a.chargeInterets > arr[i - 1].chargeInterets);
  ok('la charge croît année après année', croissants);
  ok('la dette dépasse la dépense initiale', Math.abs(t.detteFinale) > 100e9,
    `${md(Math.abs(t.detteFinale))} pour 100 Md € dépensés`);
  ok('mais ne diverge pas sur dix ans', Math.abs(t.detteFinale) < 130e9, md(Math.abs(t.detteFinale)));
  ok('les intérêts cumulés valent l\'écart de dette moins la dépense',
    proche(Math.abs(t.detteFinale) - 100e9, t.interetsCumules, 1e6),
    md(t.interetsCumules));
}

console.log('\n5. Un excédent réduit la dette et ne crée aucun intérêt');
{
  const permanentes = [{ ...dep(-20e9) }];
  const t = projeter(CALIBRATION_NEUTRE, { permanentes, parAnnee: new Map() }, CTX, P);
  ok('le solde s\'améliore chaque année', t.annees.every((a) => a.soldeVariation > 0));
  ok('la dette recule', t.detteFinale > 0, md(t.detteFinale));
  ok('aucun intérêt supplémentaire sur une dette réduite', t.interetsCumules === 0);
}

console.log('\n6. Avec rétroaction, une dépense soutient l\'activité pendant qu\'elle dure');
{
  const parAnnee = new Map([
    [0, [dep(12e9)]],
    [1, [dep(12e9)]],
    [2, [dep(12e9)]],
  ]);
  const t = projeter(KEYNESIEN, { permanentes: [], parAnnee }, CTX, P);
  ok('activité soutenue les trois premières années', t.annees.slice(0, 3).every((a) => a.pib > 0));
  ok('effet nul dès la quatrième', t.annees[3].pib === 0,
    "l'impulsion cesse, l'écart d'activité aussi");
  ok('emploi positif pendant le chantier', t.annees[0].emploi > 0,
    `${Math.round(t.annees[0].emploi)} emplois`);
  ok('le pic est situé pendant le chantier', (t.picActivite?.annee ?? 0) <= 2028);
  ok('la dette reste dégradée après la fin du chantier', t.detteFinale < 0);

  // La rétroaction amortit : la dette finale doit être inférieure au coût brut.
  const sans = projeter(CALIBRATION_NEUTRE, { permanentes: [], parAnnee }, CTX, P);
  ok('la rétroaction limite la dette accumulée', Math.abs(t.detteFinale) < Math.abs(sans.detteFinale),
    `${md(Math.abs(t.detteFinale))} contre ${md(Math.abs(sans.detteFinale))} sans rétroaction`);
}

console.log('\n7. Linéarité de la projection');
{
  const un = new Map([[0, [dep(10e9)]]]);
  const deux = new Map([[0, [dep(20e9)]]]);
  const a = projeter(KEYNESIEN, { permanentes: [], parAnnee: un }, CTX, P);
  const b = projeter(KEYNESIEN, { permanentes: [], parAnnee: deux }, CTX, P);
  ok('doubler la dépense double l\'écart de dette', proche(2 * a.detteFinale, b.detteFinale, 1e6));
  ok('doubler la dépense double l\'activité', proche(2 * a.annees[0].pib, b.annees[0].pib, 1e6));
}

console.log(`\n${echecs === 0 ? 'Tous les contrôles passent.' : `${echecs} ÉCHEC(S)`}`);
process.exitCode = echecs === 0 ? 0 : 1;
