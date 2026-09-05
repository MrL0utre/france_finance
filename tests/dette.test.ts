/**
 * Contrôles du levier « taux d'emprunt ».
 *
 * L'erreur que ces tests existent pour empêcher : appliquer une variation de
 * taux à l'encours entier dès la première année. Un État ne renégocie pas sa
 * dette — ses titres portent un taux fixé à l'émission — si bien que seule la
 * dette réémise dans l'année est concernée. Confondre les deux surestime le
 * surcoût d'un facteur dix.
 */
import { effetTaux } from '../src/modeles/dette.ts';
import type { Dette } from '../src/schema.ts';

const DETTE: Dette = {
  encours: 2_881_914_332_661,
  dateEncours: '31 juillet 2026',
  dureeVieMoyenneAnnees: 8.45,
  programmeFinancementAnnuel: 300e9,
  charge: 54_210_000_000,
  chargeId: 'etat:min:d1/0/0',
  source: { label: 'AFT', url: 'https://www.aft.gouv.fr/fr' },
  note: '',
  noteCharge: '',
};

let echecs = 0;
function ok(label: string, condition: boolean, detail = '') {
  if (!condition) echecs++;
  console.log(`${condition ? '  ok  ' : 'ÉCHEC '} ${label}${detail ? ` — ${detail}` : ''}`);
}
const md = (n: number) => `${(n / 1e9).toFixed(1)} Md €`;

console.log('\n1. Un taux inchangé ne coûte rien');
{
  const e = effetTaux(DETTE, 0);
  ok('première année', e.chargeAnnee1 === 0);
  ok('à terme', e.chargeATerme === 0);
}

console.log("\n2. La première année ne porte que sur la dette réémise");
{
  const e = effetTaux(DETTE, 1);
  ok('+1 pt coûte le taux × le programme de financement', e.chargeAnnee1 === 0.01 * 300e9, md(e.chargeAnnee1));
  ok(
    "l'effet immédiat est très inférieur à celui sur l'encours",
    e.chargeAnnee1 < e.chargeATerme / 5,
    `${md(e.chargeAnnee1)} contre ${md(e.chargeATerme)} à terme`,
  );
  // Le piège : 1 % de 2 882 Md € donnerait 28,8 Md € dès la première année.
  ok('pas un centième de l\'encours dès la première année', e.chargeAnnee1 < 0.01 * DETTE.encours / 5);
}

console.log("\n3. L'effet à terme porte sur tout l'encours");
{
  const e = effetTaux(DETTE, 1);
  ok('+1 pt sur 2 882 Md €', Math.abs(e.chargeATerme - 0.01 * DETTE.encours) < 1, md(e.chargeATerme));
  ok('horizon = durée de vie moyenne', e.horizonAnnees === DETTE.dureeVieMoyenneAnnees);
}

console.log('\n4. Symétrie et proportionnalité');
{
  const hausse = effetTaux(DETTE, 0.5);
  const baisse = effetTaux(DETTE, -0.5);
  ok('une baisse est exactement l\'opposé', hausse.chargeAnnee1 === -baisse.chargeAnnee1);
  ok('une baisse de taux allège la charge', baisse.chargeAnnee1 < 0);
  const double = effetTaux(DETTE, 1);
  ok('doubler la variation double l\'effet', Math.abs(double.chargeAnnee1 - 2 * hausse.chargeAnnee1) < 1);
}

console.log('\n5. Taux apparent');
{
  const e = effetTaux(DETTE, 0);
  const attendu = DETTE.charge / DETTE.encours;
  ok('charge rapportée à l\'encours', Math.abs(e.tauxApparent - attendu) < 1e-9);
  ok(
    'ordre de grandeur plausible pour la France',
    e.tauxApparent > 0.005 && e.tauxApparent < 0.05,
    `${(e.tauxApparent * 100).toFixed(2)} %`,
  );
}

console.log(`\n${echecs === 0 ? 'Tous les contrôles passent.' : `${echecs} ÉCHEC(S)`}`);
process.exitCode = echecs === 0 ? 0 : 1;
