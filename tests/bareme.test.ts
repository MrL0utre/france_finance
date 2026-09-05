/**
 * Contrôles du calcul de l'impôt sur le revenu.
 *
 * Le contrôle central confronte notre moteur aux montants qu'OpenFisca a
 * calculés pour les mêmes foyers, tels qu'ils ont été figés dans les données.
 * Réimplémenter une législation fiscale est risqué : sans cette confrontation à
 * une implémentation de référence, une erreur y resterait invisible.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { baremeParPart, baremeReforme, impotFoyer } from '../src/impot/bareme.ts';
import type { BaremeIR } from '../src/schema.ts';

const bareme = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '../public/data/bareme.json'), 'utf8'),
) as BaremeIR;

const P = {
  tranches: bareme.tranches,
  decote: bareme.decote,
  plafondDemiPart: bareme.plafondDemiPart,
};

let echecs = 0;
function ok(label: string, condition: boolean, detail = '') {
  if (!condition) echecs++;
  console.log(`${condition ? '  ok  ' : 'ÉCHEC '} ${label}${detail ? ` — ${detail}` : ''}`);
}

console.log("\n1. Notre moteur reproduit OpenFisca sur tous les cas types");
{
  let pire = 0;
  let cas = '';
  for (const c of bareme.casTypes) {
    const calcule = impotFoyer(c.rni, c.parts, c.declarants, P);
    const ecart = Math.abs(calcule - c.impot);
    if (ecart > pire) {
      pire = ecart;
      cas = `${c.libelle} à ${c.salaire} €`;
    }
  }
  ok(`${bareme.casTypes.length} foyers vérifiés`, bareme.casTypes.length >= 20);
  ok('écart maximal sous 2 €', pire < 2, `${pire.toFixed(2)} € (${cas})`);
}

console.log('\n2. Propriétés du barème');
{
  ok('la première tranche est à taux nul', bareme.tranches[0].taux === 0);
  ok('les seuils sont strictement croissants', bareme.tranches.every((t, i) => i === 0 || t.seuil > bareme.tranches[i - 1].seuil));
  ok('les taux sont croissants', bareme.tranches.every((t, i) => i === 0 || t.taux >= bareme.tranches[i - 1].taux));
  ok('aucun revenu sous le premier seuil n\'est imposé', baremeParPart(bareme.tranches[1].seuil - 1, bareme.tranches) === 0);
  ok('le barème est croissant avec le revenu', baremeParPart(60_000, bareme.tranches) > baremeParPart(40_000, bareme.tranches));
}

console.log('\n3. Progressivité : le taux moyen croît avec le revenu');
{
  const tauxMoyen = (r: number) => impotFoyer(r, 1, 1, P) / r;
  const revenus = [20_000, 40_000, 80_000, 160_000, 400_000];
  let croissant = true;
  for (let i = 1; i < revenus.length; i++) {
    if (tauxMoyen(revenus[i]) <= tauxMoyen(revenus[i - 1])) croissant = false;
  }
  ok('taux moyen strictement croissant', croissant,
    revenus.map((r) => `${(tauxMoyen(r) * 100).toFixed(1)} %`).join(' → '));
  ok('le taux moyen reste sous le taux marginal le plus élevé',
    tauxMoyen(400_000) < bareme.tranches[bareme.tranches.length - 1].taux);
}

console.log('\n4. Quotient familial');
{
  const rni = 60_000;
  const seul = impotFoyer(rni, 1, 1, P);
  const couple = impotFoyer(rni, 2, 2, P);
  const avecEnfants = impotFoyer(rni, 3, 2, P);
  ok('à revenu égal, un couple paie moins qu\'un célibataire', couple < seul);
  ok('les enfants réduisent encore l\'impôt', avecEnfants < couple);
  ok('l\'impôt ne devient jamais négatif', impotFoyer(5_000, 3, 2, P) === 0);
}

console.log('\n5. Plafonnement du quotient familial');
{
  // À revenu élevé, l'avantage procuré par deux demi-parts est ramené au plafond.
  const rni = 200_000;
  const sansEnfants = impotFoyer(rni, 2, 2, P);
  const avecEnfants = impotFoyer(rni, 3, 2, P);
  const avantage = sansEnfants - avecEnfants;
  ok('l\'avantage est plafonné à deux demi-parts',
    Math.abs(avantage - 2 * bareme.plafondDemiPart) < 1,
    `${Math.round(avantage)} € pour un plafond de ${2 * bareme.plafondDemiPart} €`);
}

console.log('\n6. Effet d\'une réforme');
{
  const indiceTrente = bareme.tranches.findIndex((t) => t.taux === 0.3);
  ok('la tranche à 30 % existe', indiceTrente > 0);

  const reforme = baremeReforme(bareme.tranches, { [indiceTrente]: { taux: 0.32 } });
  ok('seule la tranche visée change',
    reforme.filter((t, i) => t.taux !== bareme.tranches[i].taux).length === 1);

  const avant = impotFoyer(45_000, 1, 1, P);
  const apres = impotFoyer(45_000, 1, 1, { ...P, tranches: reforme });
  const attendu = (45_000 - bareme.tranches[indiceTrente].seuil) * 0.02;
  ok('la hausse égale 2 points sur la part du revenu dans cette tranche',
    Math.abs(apres - avant - attendu) < 1,
    `${Math.round(apres - avant)} € contre ${Math.round(attendu)} € attendus`);

  const bas = impotFoyer(20_000, 1, 1, { ...P, tranches: reforme });
  const basAvant = impotFoyer(20_000, 1, 1, P);
  ok('un revenu sous la tranche réformée n\'est pas touché', bas === basAvant);

  // Baisser un taux ne peut pas augmenter l'impôt.
  const baisse = baremeReforme(bareme.tranches, { [indiceTrente]: { taux: 0.25 } });
  ok('baisser un taux réduit l\'impôt',
    impotFoyer(45_000, 1, 1, { ...P, tranches: baisse }) < avant);
}

console.log('\n7. Décote');
{
  // La décote annule l'impôt des revenus les plus modestes puis s'éteint.
  ok('impôt nul juste au-dessus du premier seuil', impotFoyer(12_500, 1, 1, P) === 0);
  const extinction = bareme.decote.seuilCelibataire / bareme.decote.taux;
  ok('la décote s\'éteint au-delà de son point de sortie', extinction > 1_000 && extinction < 5_000,
    `${Math.round(extinction)} € d'impôt brut`);
}

console.log(`\n${echecs === 0 ? 'Tous les contrôles passent.' : `${echecs} ÉCHEC(S)`}`);
process.exitCode = echecs === 0 ? 0 : 1;
