/**
 * Contrôles de comportement des modèles de bouclage.
 *
 * On vérifie des propriétés plutôt que des valeurs : les coefficients sont
 * discutables et destinés à évoluer, mais un modèle qui violerait l'une de ces
 * règles serait faux quelle que soit sa calibration.
 */
import { instrumentDe, type Instrument } from '../src/modeles/instruments.ts';
import { readFileSync } from 'node:fs';
import { betaExcedentBrut, effetSurLesRecettes } from '../src/modeles/assiettes.ts';
import { elasticiteBareme } from '../src/modeles/progressivite.ts';
import type { BaremeIR } from '../src/schema.ts';
import { MODELES, modeleParId, KEYNESIEN, OFFRE, RELANCE } from '../src/modeles/registre.ts';
import type { Contexte, Impulsion } from '../src/modeles/types.ts';

const CTX: Contexte = {
  pib: 2_920e9,
  pibParEmploi: 97_000,
  recettes: 1_351e9,
  // Ventilation publiée par le pipeline, arrondie : sa somme fait la recette
  // totale, sans quoi la rétroaction porterait sur une assiette incomplète.
  recettesParInstrument: {
    cotisations: 623.7e9,
    autre: 256.7e9,
    impot_consommation: 213.0e9,
    impot_menages: 168.0e9,
    impot_entreprises: 89.6e9,
    investissement: 0,
    fonctionnement: 0,
    transferts: 0,
    charge_dette: 0,
  },
  // Assiettes réelles publiées par le pipeline. Les trois premières se
  // partagent exactement le PIB dans l'optique des revenus, ce qui est la
  // condition pour que la sensibilité du profit se déduise.
  assiettes: {
    masseSalariale: 1_505.5e9,
    excedentBrut: 1_036.6e9,
    impotsProduction: 393.1e9,
    consommation: 1_595.5e9,
  },
  elasticiteIR: 1.4,
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
  ok(
    `${nom} : le poste résiduel de recettes réagit à l'activité`,
    c.elasticiteAutre > 0 && c.elasticiteAutre <= 1,
  );

  // La chaîne activité → assiette → recette, mesurée bout en bout sur un choc
  // d'un point de PIB. On vérifie les rapports, pas les valeurs : ce sont eux
  // qui seraient des contresens s'ils s'inversaient.
  {
    const lignes = effetSurLesRecettes(
      CTX.recettesParInstrument,
      CTX.assiettes,
      0.01,
      CTX.elasticiteIR,
      c.elasticiteAutre,
    );
    const f = (i: Instrument) => lignes.find((l) => l.instrument === i)?.facteur ?? 0;
    ok(
      `${nom} : tous les prélèvements réagissent à l'activité`,
      (['impot_menages', 'impot_entreprises', 'impot_consommation', 'cotisations', 'autre'] as const)
        .every((i) => f(i) > 0),
    );
    // Le profit est un solde : il absorbe le choc que la masse salariale amortit.
    ok(`${nom} : le bénéfice réagit plus que la masse salariale`,
      f('impot_entreprises') > f('cotisations'));
    // À assiette égale, un barème progressif rend plus qu'un prélèvement
    // proportionnel : c'est toute la différence entre l'IR et les cotisations.
    ok(`${nom} : l'impôt progressif réagit plus que les cotisations`,
      f('impot_menages') > f('cotisations'));

    // Garde-fou d'ensemble : des facteurs plausibles un à un peuvent composer un
    // total qui ne l'est pas. La décomposition par assiettes donne un agrégat
    // plus bas que l'élasticité directe qu'elle remplace — la marge des foyers
    // qui entrent ou sortent de l'impôt n'y est pas modélisée.
    const total = Object.values(CTX.recettesParInstrument).reduce((s, v) => s + v, 0);
    const moyenne = lignes.reduce((s, l) => s + l.montant, 0) / (total * 0.01);
    ok(
      `${nom} : élasticité moyenne des recettes plausible`,
      moyenne > 0.6 && moyenne < 1.3,
      moyenne.toFixed(2).replace('.', ','),
    );
  }

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

console.log('\n12. Les deux valeurs qui ne sont plus choisies');
{
  // La sensibilité du profit se déduit de l'identité par les revenus : si le PIB
  // varie de 1 % et que salaires et impôts sur la production varient moins, le
  // profit doit varier plus, d'un montant que l'arithmétique fixe.
  const a = CTX.assiettes!;
  const beta = betaExcedentBrut(a);
  ok('le profit absorbe le choc que la masse salariale amortit', beta > 1, beta.toFixed(2));
  const reconstitue = 0.8 * a.masseSalariale + 1.0 * a.impotsProduction + beta * a.excedentBrut;
  const pibRevenus = a.masseSalariale + a.excedentBrut + a.impotsProduction;
  ok(
    "la déduction reconstitue exactement un point d'activité",
    Math.abs(reconstitue - pibRevenus) < 1e3,
    `${(reconstitue / 1e9).toFixed(1)} contre ${(pibRevenus / 1e9).toFixed(1)} Md €`,
  );

  // L'élasticité de l'IR se calcule sur le barème publié. Un barème progressif la
  // met au-dessus de 1 ; un barème à taux unique la ramène à 1 tout rond, ce qui
  // est le contrôle prouvant que c'est bien la progressivité qui est mesurée.
  const bareme = JSON.parse(readFileSync('public/data/bareme.json', 'utf8')) as BaremeIR;
  const e = elasticiteBareme(bareme);
  ok('le barème publié donne une élasticité supérieure à 1', e !== null && e > 1, e?.toFixed(2));

  const plat: BaremeIR = {
    ...bareme,
    tranches: [{ seuil: 0, taux: 0.2 }],
    decote: { seuilCelibataire: 0, seuilCouple: 0, taux: 0 },
  };
  const ePlat = elasticiteBareme(plat);
  ok(
    "un barème à taux unique la ramène à 1 : c'est bien la progressivité qui est mesurée",
    ePlat !== null && Math.abs(ePlat - 1) < 0.01,
    ePlat?.toFixed(3),
  );
}

console.log(`\n${echecs === 0 ? 'Tous les contrôles passent.' : `${echecs} ÉCHEC(S)`}`);
process.exitCode = echecs === 0 ? 0 : 1;
