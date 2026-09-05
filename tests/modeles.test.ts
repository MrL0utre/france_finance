/**
 * Contrôles de comportement des modèles de bouclage.
 *
 * On vérifie des propriétés plutôt que des valeurs : les coefficients sont
 * discutables et destinés à évoluer, mais un modèle qui violerait l'une de ces
 * règles serait faux quelle que soit sa calibration.
 */
import { instrumentDe, type Instrument } from '../src/modeles/instruments.ts';
import { MODELES, modeleParId, KEYNESIEN, OFFRE, RELANCE } from '../src/modeles/registre.ts';
import type { Contexte, Impulsion } from '../src/modeles/types.ts';

const CTX: Contexte = {
  pib: 2_920e9,
  pibParEmploi: 97_000,
  recettes: 1_351e9,
  depenses: 1_491e9,
  soldeBase: -166e9,
};

let echecs = 0;
function ok(label: string, condition: boolean, detail = '') {
  if (!condition) echecs++;
  console.log(`${condition ? '  ok  ' : 'ÉCHEC '} ${label}${detail ? ` — ${detail}` : ''}`);
}
const proche = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;

const imp = (
  delta: number,
  cote: 'dep' | 'rec',
  instrument: Instrument = 'fonctionnement',
): Impulsion => ({ id: 'x', label: 'x', cote, instrument, delta });

const AVEC_BOUCLAGE = MODELES.filter((m) => m.id !== 'comptable');

console.log('\n1. Un scénario vide ne produit aucun effet, quel que soit le modèle');
for (const m of MODELES) {
  const e = m.calculer([], CTX);
  ok(
    `${m.nom}`,
    e.pib === 0 && e.soldeVariation === 0 && e.recettesInduites === 0 && e.solde === CTX.soldeBase,
  );
}

console.log("\n2. Le modèle comptable n'a aucune rétroaction");
{
  const e = modeleParId('comptable').calculer([imp(10e9, 'dep')], CTX);
  ok('activité inchangée', e.pib === 0);
  ok('aucune recette induite', e.recettesInduites === 0);
  ok('solde = effet direct seul', proche(e.soldeVariation, -10e9));
}

console.log('\n3. Sens des effets');
for (const m of AVEC_BOUCLAGE) {
  const dep = m.calculer([imp(10e9, 'dep')], CTX);
  const rec = m.calculer([imp(10e9, 'rec')], CTX);
  ok(`${m.nom} : dépenser davantage dégrade le solde`, dep.soldeVariation < 0);
  ok(`${m.nom} : dépenser davantage soutient l'activité`, dep.pib > 0);
  ok(`${m.nom} : prélever davantage améliore le solde`, rec.soldeVariation > 0);
  ok(`${m.nom} : prélever davantage freine l'activité`, rec.pib < 0);
  ok(`${m.nom} : l'emploi suit le sens de l'activité`, Math.sign(dep.emploi) === Math.sign(dep.pib));
}

console.log("\n4. La rétroaction récupère une partie de l'effort, jamais la totalité");
// Une hausse de dépense qui améliorerait le solde, ou une coupe qui l'aggraverait,
// serait une affirmation extraordinaire : le test doit la rendre impossible par
// inadvertance lors d'un changement de calibration.
for (const m of AVEC_BOUCLAGE) {
  const e = m.calculer([imp(10e9, 'dep')], CTX);
  const taux = 1 - Math.abs(e.soldeVariation) / 10e9;
  ok(
    `${m.nom} : taux de récupération dans [0, 1[`,
    taux > 0 && taux < 1,
    `${(taux * 100).toFixed(0)} % de l'impulsion revient par les recettes`,
  );
  ok(`${m.nom} : le solde reste dégradé`, e.soldeVariation < 0);
}

console.log('\n5. Linéarité : deux mesures valent la somme de leurs effets séparés');
for (const m of MODELES) {
  const a = imp(8e9, 'dep', 'investissement');
  const b = imp(-5e9, 'rec', 'impot_consommation');
  const ensemble = m.calculer([a, b], CTX);
  const separes = m.calculer([a], CTX).soldeVariation + m.calculer([b], CTX).soldeVariation;
  ok(`${m.nom}`, proche(ensemble.soldeVariation, separes), `${ensemble.soldeVariation} vs ${separes}`);
}

console.log('\n6. Symétrie : une mesure et son inverse se compensent');
for (const m of MODELES) {
  const plus = m.calculer([imp(7e9, 'dep')], CTX);
  const moins = m.calculer([imp(-7e9, 'dep')], CTX);
  ok(`${m.nom} : solde opposé`, proche(plus.soldeVariation, -moins.soldeVariation));
  ok(`${m.nom} : activité opposée`, proche(plus.pib, -moins.pib));
}

console.log('\n7. Monotonie : une mesure plus forte a un effet plus fort');
for (const m of AVEC_BOUCLAGE) {
  const petit = m.calculer([imp(1e9, 'dep')], CTX);
  const grand = m.calculer([imp(10e9, 'dep')], CTX);
  ok(`${m.nom}`, grand.pib > petit.pib && grand.soldeVariation < petit.soldeVariation);
}

console.log("\n8. Hiérarchie des multiplicateurs à l'intérieur d'une calibration");
for (const [nom, c] of [
  ['médiane', KEYNESIEN],
  ['faible', OFFRE],
  ['élevée', RELANCE],
] as const) {
  const k = c.multiplicateurs;
  ok(`${nom} : investissement ≥ fonctionnement`, k.investissement >= k.fonctionnement);
  ok(`${nom} : fonctionnement ≥ transferts`, k.fonctionnement >= k.transferts);
  ok(`${nom} : tous positifs ou nuls`, Object.values(k).every((v) => v >= 0));
  ok(`${nom} : élasticité des recettes positive`, c.elasticiteRecettes > 0);
  ok(
    `${nom} : les dépenses refluent quand l'activité repart`,
    c.elasticiteDepenses <= 0,
  );
}

console.log('\n9. Ordre entre modèles : plus le multiplicateur est fort, moins une coupe rapporte');
{
  const coupe = [imp(-10e9, 'dep')];
  const gain = (id: string) => modeleParId(id).calculer(coupe, CTX).soldeVariation;
  const comptable = gain('comptable');
  const faible = gain('offre');
  const median = gain('keynesien');
  const eleve = gain('relance');
  ok('comptable > faible', comptable > faible);
  ok('faible > médian', faible > median);
  ok('médian > élevé', median > eleve);
  ok(
    'une coupe reste une amélioration du solde dans tous les modèles',
    [comptable, faible, median, eleve].every((v) => v > 0),
  );
  console.log(
    `       10 Md € de coupe → ${[comptable, faible, median, eleve].map((v) => (v / 1e9).toFixed(1)).join(' / ')} Md € de solde`,
  );
}

console.log('\n10. Classement des postes en instruments');
const cas: [string, 'dep' | 'rec', Instrument][] = [
  ['Taxe sur la valeur ajoutée', 'rec', 'impot_consommation'],
  ['Impôt sur les sociétés', 'rec', 'impot_entreprises'],
  ['Impôt sur le revenu', 'rec', 'impot_menages'],
  ['Mutations à titre gratuit par décès', 'rec', 'impot_menages'],
  ['Cotisations sociales', 'rec', 'cotisations'],
  ['CSG', 'rec', 'cotisations'],
  ['Investissement', 'dep', 'investissement'],
  ['Frais de personnel', 'dep', 'fonctionnement'],
  ["Dépenses d'intervention", 'dep', 'transferts'],
];
for (const [label, cote, attendu] of cas) {
  const obtenu = instrumentDe({ label, sphere: 'etat', level: 'poste' }, cote);
  ok(`« ${label} » (${cote}) → ${attendu}`, obtenu === attendu, obtenu !== attendu ? obtenu : '');
}
ok(
  'une branche de la Sécurité sociale verse des transferts',
  instrumentDe({ label: 'Vieillesse', sphere: 'secu', level: 'branche' }, 'dep') === 'transferts',
);
ok(
  "un ministère non qualifié relève du fonctionnement",
  instrumentDe({ label: 'Culture', sphere: 'etat', level: 'ministere' }, 'dep') === 'fonctionnement',
);

console.log('\n11. Chaque modèle documente ce qu\'il ne fait pas');
for (const m of MODELES) {
  ok(`${m.nom}`, m.resume.length > 20 && m.limite.length > 20);
}

console.log(`\n${echecs === 0 ? 'Tous les contrôles passent.' : `${echecs} ÉCHEC(S)`}`);
process.exitCode = echecs === 0 ? 0 : 1;
