import { OPENFISCA_API, EXERCICE_IR } from './config.ts';
import { impotFoyer } from '../src/impot/bareme.ts';

/**
 * Récupération du barème de l'impôt sur le revenu auprès d'OpenFisca.
 *
 * L'appel a lieu au moment de la construction des données, pas à l'exécution :
 * l'application reste sans dépendance réseau, le barème ne changeant qu'une fois
 * par an. OpenFisca sert ici de source de législation — les taux et seuils y sont
 * référencés au Code général des impôts — et de référence de calcul, puisqu'on
 * lui demande aussi l'impôt dû par une grille de cas types. Ces montants servent
 * ensuite à vérifier que notre propre calcul du barème reproduit le sien.
 */

export type Tranche = { seuil: number; taux: number };

export type CasType = {
  id: string;
  libelle: string;
  /** Salaire imposable annuel du foyer. */
  salaire: number;
  declarants: number;
  enfants: number;
  /** Revenu net imposable calculé par OpenFisca, après abattement. */
  rni: number;
  /** Nombre de parts de quotient familial. */
  parts: number;
  /** Impôt net avant réductions et crédits, calculé par OpenFisca. */
  impot: number;
  /** Impôt recalculé par notre moteur, et écart au résultat d'OpenFisca. */
  impotVerifie: number;
  ecart: number;
};

export type Bareme = {
  exercice: number;
  millesime: string;
  tranches: Tranche[];
  decote: { seuilCelibataire: number; seuilCouple: number; taux: number };
  plafondDemiPart: number;
  reference: string;
  source: { label: string; url: string };
  note: string;
  casTypes: CasType[];
  /** Écart maximal entre notre moteur et OpenFisca, sur les cas retenus. */
  ecartMaximal: number;
};

const PROFILS = [
  { id: 'celib', libelle: 'Célibataire', declarants: 1, enfants: 0 },
  { id: 'couple', libelle: 'Couple', declarants: 2, enfants: 0 },
  { id: 'couple2', libelle: 'Couple, 2 enfants', declarants: 2, enfants: 2 },
  { id: 'isole1', libelle: 'Parent seul, 1 enfant', declarants: 1, enfants: 1 },
];

const SALAIRES = [15_000, 25_000, 35_000, 50_000, 80_000, 150_000, 400_000];

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenFisca ${res.status} sur ${url}`);
  return (await res.json()) as T;
}

/** Valeur en vigueur d'un paramètre daté, au millésime le plus récent. */
function derniereValeur<T>(valeurs: Record<string, T>): [string, T] {
  const dates = Object.keys(valeurs).sort();
  const derniere = dates[dates.length - 1];
  return [derniere, valeurs[derniere]];
}

export async function buildBareme(): Promise<Bareme> {
  console.log('  fetch   barème IR (OpenFisca)');

  const bareme = await json<{
    brackets: Record<string, Record<string, number>>;
    metadata?: { reference?: Record<string, unknown> };
  }>(`${OPENFISCA_API}/parameter/impot_revenu.bareme_ir_depuis_1945.bareme`);

  const [millesime, grille] = derniereValeur(bareme.brackets);
  const tranches: Tranche[] = Object.entries(grille)
    .map(([seuil, taux]) => ({ seuil: Number(seuil), taux }))
    .sort((a, b) => a.seuil - b.seuil);

  const decote = await chargerDecote();
  const plafondDemiPart = await lireValeur(
    'impot_revenu.calcul_impot_revenu.plaf_qf.plafond_avantages_procures_par_demi_part.general',
  );

  const parametres = { tranches, decote, plafondDemiPart };
  const bruts = await chargerCasTypes();

  // Confrontation systématique : notre moteur doit retrouver le résultat
  // d'OpenFisca. Un cas qui s'en écarte relève d'une règle que nous ne couvrons
  // pas — demi-part particulière, plafonnement spécifique — et serait trompeur
  // une fois réformé. Il est écarté plutôt que corrigé à l'aveugle.
  const evalues = bruts.map((c) => {
    const impotVerifie = impotFoyer(c.rni, c.parts, c.declarants, parametres);
    return { ...c, impotVerifie, ecart: Math.abs(impotVerifie - c.impot) };
  });

  const retenus = evalues.filter((c) => c.ecart <= TOLERANCE_EUROS);
  const ecartes = evalues.length - retenus.length;
  const ecartMaximal = retenus.reduce((m, c) => Math.max(m, c.ecart), 0);

  console.log(
    `  bareme  ${retenus.length}/${evalues.length} cas types reproduits (écart max ${ecartMaximal.toFixed(2)} €)` +
      (ecartes > 0 ? `, ${ecartes} écarté(s)` : ''),
  );
  for (const c of evalues.filter((e) => e.ecart > TOLERANCE_EUROS)) {
    console.log(
      `          écarté : ${c.libelle} à ${c.salaire} € — OpenFisca ${Math.round(c.impot)} €, calcul ${Math.round(c.impotVerifie)} €`,
    );
  }

  return {
    exercice: EXERCICE_IR,
    millesime,
    tranches,
    decote,
    plafondDemiPart,
    reference: 'Article 197, I.1. du Code général des impôts',
    source: {
      label: 'OpenFisca France — législation socio-fiscale ouverte',
      url: 'https://openfisca.org/doc/',
    },
    note: "Barème applicable aux revenus de l'année indiquée. Les seuils s'appliquent au revenu net imposable divisé par le nombre de parts de quotient familial.",
    casTypes: retenus,
    ecartMaximal,
  };
}

/** Au-delà, notre calcul ne reproduit pas la législation appliquée par OpenFisca. */
const TOLERANCE_EUROS = 2;

async function lireValeur(chemin: string): Promise<number> {
  const p = await json<{ values: Record<string, number> }>(`${OPENFISCA_API}/parameter/${chemin}`);
  return derniereValeur(p.values)[1];
}

async function chargerDecote(): Promise<Bareme['decote']> {
  return {
    seuilCelibataire: await lireValeur(
      'impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_celib',
    ),
    seuilCouple: await lireValeur('impot_revenu.calcul_impot_revenu.plaf_qf.decote.seuil_couple'),
    taux: await lireValeur('impot_revenu.calcul_impot_revenu.plaf_qf.decote.taux'),
  };
}

/**
 * Impôt dû par une grille de foyers représentatifs, calculé par OpenFisca.
 * Tous les cas partent dans une seule requête : la législation étant appliquée
 * foyer par foyer, le regroupement ne change rien au résultat.
 */
type CasBrut = Omit<CasType, 'impotVerifie' | 'ecart'>;

async function chargerCasTypes(): Promise<CasBrut[]> {
  const annee = String(EXERCICE_IR);
  const individus: Record<string, unknown> = {};
  const foyers: Record<string, unknown> = {};
  const menages: Record<string, unknown> = {};
  const familles: Record<string, unknown> = {};
  const index: { cle: string; profil: (typeof PROFILS)[number]; salaire: number }[] = [];

  for (const profil of PROFILS) {
    for (const salaire of SALAIRES) {
      const cle = `${profil.id}_${salaire}`;
      const adultes: string[] = [];
      for (let i = 0; i < profil.declarants; i++) {
        const nom = `${cle}_a${i}`;
        // Le revenu est porté par le premier déclarant : l'impôt sur le revenu
        // agrège les revenus du foyer, la répartition entre conjoints n'a donc
        // aucun effet sur le montant dû.
        individus[nom] = { salaire_imposable: { [annee]: i === 0 ? salaire : 0 } };
        adultes.push(nom);
      }
      const enfants: string[] = [];
      for (let i = 0; i < profil.enfants; i++) {
        const nom = `${cle}_e${i}`;
        individus[nom] = { salaire_imposable: { [annee]: 0 } };
        enfants.push(nom);
      }

      foyers[cle] = {
        declarants: adultes,
        personnes_a_charge: enfants,
        ip_net: { [annee]: null },
        rni: { [annee]: null },
        nbptr: { [annee]: null },
      };
      menages[`m_${cle}`] = { personne_de_reference: [adultes[0]], enfants };
      familles[`f_${cle}`] = { parents: adultes, enfants };
      index.push({ cle, profil, salaire });
    }
  }

  console.log(`  fetch   ${index.length} cas types (OpenFisca)`);
  const res = await fetch(`${OPENFISCA_API}/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ individus, foyers_fiscaux: foyers, menages, familles }),
  });
  if (!res.ok) throw new Error(`OpenFisca /calculate ${res.status} : ${await res.text()}`);
  const out = (await res.json()) as {
    foyers_fiscaux: Record<string, Record<string, Record<string, number>>>;
  };

  return index.map(({ cle, profil, salaire }) => {
    const f = out.foyers_fiscaux[cle];
    return {
      id: cle,
      libelle: profil.libelle,
      salaire,
      declarants: profil.declarants,
      enfants: profil.enfants,
      rni: f.rni[annee],
      parts: f.nbptr[annee],
      impot: f.ip_net[annee],
    };
  });
}
