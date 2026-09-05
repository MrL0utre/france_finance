/** Vérification de l'encodage d'un scénario en URL. */
import {
  decoderScenario,
  encoderScenario,
  scenarioDepuisUrl,
  urlAvecScenario,
} from '../src/data/partage.ts';
import { avecAjustement, AUCUN, nbAjustements, type Ajustements } from '../src/data/simulation.ts';

let echecs = 0;
function ok(label: string, condition: boolean, detail = '') {
  if (!condition) echecs++;
  console.log(`${condition ? '  ok  ' : 'ÉCHEC '} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log("\n1. Aller-retour d'un scénario réaliste");
let aj: Ajustements = AUCUN;
aj = avecAjustement(aj, 'etat:min:d6', 'dep', 0.9, 'Budget et comptes publics', []);
aj = avecAjustement(aj, 'etat:min:d6/1', 'dep', 0.5, 'Remboursements et dégrèvements', [
  'etat/d6.json',
]);
aj = avecAjustement(aj, 'com:84138', 'rec', 1.25, 'Valréas', [
  'region/93.json',
  'dept/84.json',
]);

const encode = encoderScenario(aj);
const relu = decoderScenario(encode)!;

ok('3 ajustements conservés', nbAjustements(relu) === 3);
ok('facteur dépense', relu.dep['etat:min:d6'] === 0.9);
ok('facteur recette', relu.rec['com:84138'] === 1.25);
ok('libellé accentué intact', relu.labels['com:84138'] === 'Valréas', relu.labels['com:84138']);
ok(
  'chaîne de shards restituée avec son extension',
  JSON.stringify(relu.shards['com:84138']) ===
    JSON.stringify(['region/93.json', 'dept/84.json']),
  JSON.stringify(relu.shards['com:84138']),
);
ok('URL sûre (base64url sans remplissage)', /^[A-Za-z0-9_-]+$/.test(encode));
console.log(`       longueur encodée : ${encode.length} caractères`);

console.log('\n2. Un scénario vide ne produit pas de lien');
ok('décodage du vide rejeté', decoderScenario(encoderScenario(AUCUN)) === null);

console.log('\n3. Entrées malformées rejetées plutôt qu\'appliquées à moitié');
const mauvais: [string, string][] = [
  ['texte quelconque', 'pas-du-base64!!'],
  ['base64 valide mais pas du JSON', btoa('nawak')],
  ['objet au lieu du tableau attendu', btoa(JSON.stringify({ dep: { a: 0.5 } }))],
  ['tuple trop court', btoa(JSON.stringify([['d', 'x']]))],
  ['côté inconnu', btoa(JSON.stringify([['z', 'x', 0.5, 'X', []]]))],
  ['facteur non numérique', btoa(JSON.stringify([['d', 'x', 'beaucoup', 'X', []]]))],
  ['facteur négatif', btoa(JSON.stringify([['d', 'x', -2, 'X', []]]))],
  ['facteur démesuré', btoa(JSON.stringify([['d', 'x', 1e6, 'X', []]]))],
  ['facteur neutre (bruit inutile)', btoa(JSON.stringify([['d', 'x', 1, 'X', []]]))],
  ['identifiant vide', btoa(JSON.stringify([['d', '', 0.5, 'X', []]]))],
  ['identifiant démesuré', btoa(JSON.stringify([['d', 'x'.repeat(500), 0.5, 'X', []]]))],
];
for (const [label, charge] of mauvais) {
  ok(label, decoderScenario(charge) === null);
}

console.log("\n4. Aller-retour par une URL complète");
const base = 'https://exemple.fr/finances/?vue=graphe';
const avecScenario = urlAvecScenario(base, aj);
ok('le paramètre existant est conservé', avecScenario.includes('vue=graphe'));
ok('le scénario est relu depuis l\'URL', nbAjustements(scenarioDepuisUrl(avecScenario)!) === 3);
ok('une URL sans scénario ne donne rien', scenarioDepuisUrl(base) === null);
ok(
  'un scénario vide retire le paramètre',
  !urlAvecScenario(avecScenario, AUCUN).includes('s='),
  urlAvecScenario(avecScenario, AUCUN),
);
ok(
  'réencoder ne cumule pas les paramètres',
  (urlAvecScenario(avecScenario, aj).match(/[?&]s=/g) ?? []).length === 1,
);

console.log('\n5. Un ajustement retiré disparaît du lien');
const sansValreas = avecAjustement(aj, 'com:84138', 'rec', 1, 'Valréas', []);
const reluSans = decoderScenario(encoderScenario(sansValreas))!;
ok('2 ajustements restants', nbAjustements(reluSans) === 2);
ok('libellé de la cible retirée absent', !('com:84138' in reluSans.labels));

console.log('\n6. Mesures créées et variation de taux voyagent aussi dans le lien');
{
  const avecExtras: Ajustements = {
    ...aj,
    mesures: [
      { id: 'libre:1', label: 'Taxe sur les rachats d\'actions', cote: 'rec', montant: 2e9, instrument: 'impot_entreprises' },
    ],
    pointsDeTaux: -0.5,
  };
  const relu2 = scenarioDepuisUrl(urlAvecScenario(base, avecExtras))!;
  ok('la mesure créée est restituée', relu2.mesures?.length === 1);
  ok('son libellé accentué survit', relu2.mesures?.[0].label === "Taxe sur les rachats d'actions");
  ok('son montant survit', relu2.mesures?.[0].montant === 2e9);
  ok('la variation de taux survit', relu2.pointsDeTaux === -0.5);
  ok('les ajustements de nœuds sont toujours là', nbAjustements(relu2) === 3);

  // Un scénario réduit à une variation de taux doit rester partageable.
  const seulTaux: Ajustements = { ...AUCUN, pointsDeTaux: 0.25 };
  const reluTaux = scenarioDepuisUrl(urlAvecScenario(base, seulTaux));
  ok('un scénario limité au taux est relu', reluTaux?.pointsDeTaux === 0.25);
}

console.log('\n7. Extras malformés rejetés');
{
  const url = (p: string, v: string) => `${base}&${p}=${v}`;
  ok('taux démesuré ignoré', scenarioDepuisUrl(url('t', '999')) === null);
  ok('taux non numérique ignoré', scenarioDepuisUrl(url('t', 'beaucoup')) === null);
  ok('mesure au montant négatif rejetée', scenarioDepuisUrl(url('x', btoa(JSON.stringify([['a', 'X', 'rec', -5, 'impot_menages']])))) === null);
  ok('mesure au côté inconnu rejetée', scenarioDepuisUrl(url('x', btoa(JSON.stringify([['a', 'X', 'zz', 5, 'impot_menages']])))) === null);
  ok('mesure sans libellé rejetée', scenarioDepuisUrl(url('x', btoa(JSON.stringify([['a', '', 'rec', 5, 'impot_menages']])))) === null);
}

console.log('\n8. Les chantiers voyagent aussi');
{
  const avecChantiers: Ajustements = {
    ...AUCUN,
    chantiers: [
      { id: 'ch:epr2', ref: 'epr2', debut: 0 },
      { id: 'ch:libre:1', ref: 'libre', debut: 3, label: 'Une université neuve', cout: 2e9, dureeAnnees: 4 },
    ],
  };
  const relu3 = scenarioDepuisUrl(urlAvecScenario(base, avecChantiers))!;
  ok('les deux chantiers sont restitués', relu3.chantiers?.length === 2);
  ok('la référence au catalogue survit', relu3.chantiers?.[0].ref === 'epr2');
  ok('un chantier du catalogue ne transporte pas son coût', relu3.chantiers?.[0].cout === undefined,
    'il est retrouvé par sa référence');
  ok('le chantier sur mesure garde ses caractéristiques',
    relu3.chantiers?.[1].cout === 2e9 && relu3.chantiers?.[1].dureeAnnees === 4);
  ok('l\'année de démarrage survit', relu3.chantiers?.[1].debut === 3);

  const mauvais = (v: unknown) => scenarioDepuisUrl(`${base}&c=${btoa(JSON.stringify(v))}`);
  ok('coût négatif rejeté', mauvais([{ id: 'a', ref: 'libre', debut: 0, cout: -5 }]) === null);
  ok('durée nulle rejetée', mauvais([{ id: 'a', ref: 'libre', debut: 0, dureeAnnees: 0 }]) === null);
  ok('démarrage négatif rejeté', mauvais([{ id: 'a', ref: 'epr2', debut: -2 }]) === null);
  ok('référence manquante rejetée', mauvais([{ id: 'a', debut: 0 }]) === null);
}

console.log(`\n${echecs === 0 ? 'Tous les contrôles passent.' : `${echecs} ÉCHEC(S)`}`);
process.exitCode = echecs === 0 ? 0 : 1;
