import { readFileSync } from 'node:fs';
import { download } from './fetch.ts';
import type { PostePib, Pib } from '../src/schema.ts';

/**
 * Décomposition du produit intérieur brut.
 *
 * Elle n'entre dans aucun calcul — les modèles gardent leur propre dénominateur
 * — mais donne une échelle. L'application affiche 1 490,9 Md € de dépense
 * publique sans jamais montrer l'économie dans laquelle ce montant s'inscrit :
 * le PIB n'y apparaissait que sous forme de variation.
 *
 * Source : Eurostat, comptes nationaux annuels, chiffres transmis par l'Insee.
 * L'Insee ne rediffuse pas ces séries sans clé d'API ; Eurostat le fait sous
 * licence de réutilisation, à charge de citer l'origine. Les libellés anglais
 * sont traduits ici — une traduction, pas un choix de périmètre : les codes
 * d'origine restent à côté pour que le rattachement soit vérifiable.
 */

const EXERCICE = 2024;

const API = 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data';
const COMMUN = `format=JSON&geo=FR&unit=CP_MEUR&time=${EXERCICE}`;

/**
 * PIB par composante de la demande. L'ordre est celui de l'équation, et le
 * signe celui qu'y prend chaque terme : les importations se retranchent.
 */
const COMPOSANTES: { code: string; label: string; signe: 1 | -1 }[] = [
  { code: 'P31_S14_S15', label: 'Consommation des ménages et des associations', signe: 1 },
  { code: 'P3_S13', label: 'Consommation des administrations publiques', signe: 1 },
  { code: 'P51G', label: 'Investissement (formation brute de capital fixe)', signe: 1 },
  { code: 'P52_P53', label: 'Variation des stocks et objets de valeur', signe: 1 },
  { code: 'P6', label: 'Exportations de biens et services', signe: 1 },
  { code: 'P7', label: 'Importations de biens et services', signe: -1 },
];

/** Nomenclature A10. Les impôts nets sur les produits s'y ajoutent ensuite. */
const BRANCHES: Record<string, string> = {
  A: 'Agriculture, sylviculture et pêche',
  'B-E': 'Industrie hors construction',
  F: 'Construction',
  'G-I': 'Commerce, transports, hébergement et restauration',
  J: 'Information et communication',
  K: 'Activités financières et assurance',
  L: 'Activités immobilières',
  M_N: 'Activités scientifiques, techniques et de soutien',
  'O-Q': 'Administration, enseignement, santé et action sociale',
  'R-U': 'Autres activités de services',
};

type JsonStat = {
  value: Record<string, number>;
  dimension: Record<string, { category: { index: Record<string, number> } }>;
};

/**
 * Lit une réponse JSON-stat dont une seule dimension varie.
 *
 * L'ordre des valeurs y suit l'ordre des index de la dimension, jamais l'ordre
 * dans lequel on a demandé les codes : s'y fier donnerait des montants
 * silencieusement permutés.
 */
function valeurs(json: JsonStat, dimension: string): Map<string, number> {
  const index = json.dimension[dimension].category.index;
  const ordre = Object.entries(index).sort((a, b) => a[1] - b[1]);
  const out = new Map<string, number>();
  ordre.forEach(([code], i) => {
    const v = json.value[String(i)];
    if (typeof v === 'number') out.set(code, v * 1e6);
  });
  return out;
}

const lire = (chemin: string): JsonStat => JSON.parse(readFileSync(chemin, 'utf8')) as JsonStat;

export async function buildPib(): Promise<Pib> {
  const agregats = await download(
    `${API}/nama_10_gdp?${COMMUN}&na_item=B1GQ&na_item=B1G&na_item=D21X31&` +
      COMPOSANTES.map((c) => `na_item=${c.code}`).join('&'),
    'eurostat-pib.json',
  );
  const parBranche = await download(
    `${API}/nama_10_a10?${COMMUN}&na_item=B1G&` +
      Object.keys(BRANCHES)
        .map((c) => `nace_r2=${encodeURIComponent(c)}`)
        .join('&'),
    'eurostat-pib-branches.json',
  );

  const a = valeurs(lire(agregats), 'na_item');
  const b = valeurs(lire(parBranche), 'nace_r2');

  const total = a.get('B1GQ');
  if (total === undefined) throw new Error('PIB absent de la réponse Eurostat');

  const composantes: PostePib[] = COMPOSANTES.map((c) => {
    const v = a.get(c.code);
    if (v === undefined) throw new Error(`composante ${c.code} absente de la réponse Eurostat`);
    return { code: c.code, label: c.label, montant: v * c.signe };
  });

  const branches: PostePib[] = Object.entries(BRANCHES).map(([code, label]) => {
    const v = b.get(code);
    if (v === undefined) throw new Error(`branche ${code} absente de la réponse Eurostat`);
    return { code, label, montant: v };
  });

  const impots = a.get('D21X31');
  if (impots === undefined) throw new Error('impôts nets sur les produits absents');
  branches.push({
    code: 'D21X31',
    label: 'Impôts sur les produits, nets des subventions',
    montant: impots,
  });

  return {
    exercice: EXERCICE,
    total,
    valeurAjoutee: a.get('B1G') ?? 0,
    composantes,
    branches,
    source: {
      label: 'Produit intérieur brut et ses composantes — Eurostat, comptes nationaux transmis par l’Insee',
      dataset: 'nama_10_gdp · nama_10_a10',
      exercice: EXERCICE,
      url: 'https://ec.europa.eu/eurostat/databrowser/view/nama_10_gdp/',
      // Comptes transmis mais encore révisables : ni une prévision, ni un compte
      // définitif.
      nature: 'constate',
    },
    note: "Deux lectures d’un même total. Par la demande, le PIB est la somme de ce qui est consommé, investi et exporté, moins ce qui est importé. Par les branches, il est la somme des valeurs ajoutées, plus les impôts nets sur les produits. Les deux se referment exactement sur le même chiffre — le pipeline le vérifie à chaque construction.",
    noteDepensePublique:
      "La « consommation des administrations publiques » n’est pas la dépense publique affichée ailleurs dans cet outil. Le PIB mesure une production : les transferts — retraites, allocations, remboursements — n’y figurent pas, car ils ne produisent rien par eux-mêmes ; ils sont comptés plus tard, quand le ménage qui les reçoit consomme. L’investissement public, lui, relève de la formation brute de capital fixe et non de cette ligne. Soustraire un total de l’autre n’aurait aucun sens.",
    noteDenominateur:
      "Ce PIB n’est pas celui qui sert de dénominateur aux modèles de bouclage. Les deux viennent du même producteur, mais de millésimes différents : un compte national est révisé après sa première publication. L’écart est de l’ordre du demi-point, sans effet sur les ordres de grandeur d’une simulation.",
  };
}
