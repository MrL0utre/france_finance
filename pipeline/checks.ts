/**
 * Contrôles de cohérence du pipeline.
 *
 * Les résultats sont à la fois affichés au terminal et conservés, pour être
 * écrits dans public/data/controles.json : l'application les republie tels quels,
 * de sorte qu'on puisse vérifier la cohérence des budgets sans relancer le build
 * ni lire une console.
 */

export type Controle = {
  label: string;
  groupe: string;
  ok: boolean;
  attendu: number;
  obtenu: number;
  ecart: number;
  unite: 'euros' | 'nombre';
};

export type Rapport = {
  genereLe: string;
  passes: number;
  echecs: number;
  controles: Controle[];
};

const controles: Controle[] = [];
let groupeCourant = 'Divers';

/** Les contrôles enregistrés ensuite appartiennent à ce groupe. */
export function groupe(nom: string): void {
  groupeCourant = nom;
}

/**
 * Compare deux montants. La tolérance est relative, avec un plancher absolu pour
 * les comparaisons dont la valeur attendue est nulle ou minuscule.
 */
export function check(
  label: string,
  attendu: number,
  obtenu: number,
  tolerance = 0.0001,
  plancherAbsolu = 0,
): void {
  const ecart = Math.abs(attendu - obtenu);
  const ok = ecart <= plancherAbsolu || ecart / Math.max(Math.abs(attendu), 1) <= tolerance;
  controles.push({ label, groupe: groupeCourant, ok, attendu, obtenu, ecart, unite: 'euros' });
  if (ok) return;
  console.error(
    `  ÉCHEC  ${label}\n         attendu ${fmt(attendu)} · obtenu ${fmt(obtenu)} · écart ${fmt(ecart)}`,
  );
}

/** Égalité stricte, pour les effectifs. */
export function checkCount(label: string, attendu: number, obtenu: number): void {
  const ok = attendu === obtenu;
  controles.push({
    label,
    groupe: groupeCourant,
    ok,
    attendu,
    obtenu,
    ecart: Math.abs(attendu - obtenu),
    unite: 'nombre',
  });
  if (ok) return;
  console.error(`  ÉCHEC  ${label} : attendu ${attendu}, obtenu ${obtenu}`);
}

export function rapport(): Rapport {
  const echecs = controles.filter((c) => !c.ok).length;
  return {
    genereLe: new Date().toISOString(),
    passes: controles.length - echecs,
    echecs,
    controles,
  };
}

export function report(): void {
  const { passes, echecs } = rapport();
  console.log(`  ${passes} contrôles passés, ${echecs} en échec`);
  if (echecs > 0) {
    console.error("\nLes données produites sont incohérentes : corrigez avant de servir l'app.");
    process.exitCode = 1;
  }
}

function fmt(n: number): string {
  return Math.abs(n) < 1e6 ? `${Math.round(n)} €` : `${(n / 1e6).toFixed(1)} M€`;
}
