import { AGREGATS, EXERCICE_OFGL, OFGL_API } from '../config.ts';
import { download, readCsv } from '../fetch.ts';

export type Kind = 'region' | 'departement' | 'epci' | 'commune';

export type Collectivite = {
  kind: Kind;
  code: string;
  name: string;
  siren: string;
  regCode: string;
  regName: string;
  depCode?: string;
  depName?: string;
  epciCode?: string;
  epciName?: string;
  population: number;
  agregats: Map<string, number>;
};

type DatasetSpec = {
  kind: Kind;
  dataset: string;
  columns: string[];
  code: (r: Record<string, string>) => string;
  name: (r: Record<string, string>) => string;
};

const SPECS: DatasetSpec[] = [
  {
    kind: 'region',
    dataset: 'ofgl-base-regions',
    columns: ['reg_code', 'reg_name', 'siren'],
    code: (r) => r.reg_code,
    name: (r) => r.reg_name,
  },
  {
    kind: 'departement',
    dataset: 'ofgl-base-departements',
    columns: ['reg_code', 'reg_name', 'dep_code', 'dep_name', 'siren'],
    code: (r) => r.dep_code,
    name: (r) => r.dep_name,
  },
  {
    kind: 'epci',
    dataset: 'ofgl-base-gfp',
    columns: ['reg_code', 'reg_name', 'dep_code', 'dep_name', 'epci_code', 'epci_name', 'siren'],
    code: (r) => r.epci_code,
    name: (r) => r.epci_name,
  },
  {
    kind: 'commune',
    dataset: 'ofgl-base-communes',
    columns: [
      'reg_code',
      'reg_name',
      'dep_code',
      'dep_name',
      'epci_code',
      'epci_name',
      'com_code',
      'com_name',
      'siren',
    ],
    code: (r) => r.com_code,
    name: (r) => r.com_name,
  },
];

/**
 * L'API refuse le budget annexe ici : on ne garde que le budget principal,
 * car les budgets annexes (eau, assainissement, transport) sont des services
 * à part dont l'ajout brut fausserait les comparaisons entre collectivités.
 */
function exportUrl(spec: DatasetSpec, exercice: number): string {
  const agregats = AGREGATS.map((a) => `"${a}"`).join(',');
  const where = `type_de_budget="Budget principal" and agregat in (${agregats})`;
  const select = [...spec.columns, 'agregat', 'montant', 'ptot'].join(',');
  const params = new URLSearchParams({
    refine: `exer:${exercice}`,
    where,
    select,
    delimiter: ';',
  });
  return `${OFGL_API}/${spec.dataset}/exports/csv?${params}`;
}

export async function loadNiveau(kind: Kind, exercice = EXERCICE_OFGL): Promise<Collectivite[]> {
  const spec = SPECS.find((s) => s.kind === kind)!;
  const file = await download(exportUrl(spec, exercice), `ofgl-${kind}-${exercice}.csv`);

  const byCode = new Map<string, Collectivite>();
  for await (const row of readCsv(file)) {
    const code = spec.code(row);
    if (!code) continue;

    let c = byCode.get(code);
    if (!c) {
      c = {
        kind,
        code,
        name: spec.name(row) || code,
        siren: row.siren ?? '',
        regCode: row.reg_code ?? '',
        regName: row.reg_name ?? '',
        depCode: row.dep_code || undefined,
        depName: row.dep_name || undefined,
        epciCode: row.epci_code || undefined,
        epciName: row.epci_name || undefined,
        population: Number(row.ptot) || 0,
        agregats: new Map(),
      };
      byCode.set(code, c);
    }

    const montant = Number(row.montant);
    if (!Number.isFinite(montant)) continue;
    // Une collectivité peut avoir plusieurs lignes pour un même agrégat
    // (budgets fusionnés côté OFGL) : on cumule.
    c.agregats.set(row.agregat, (c.agregats.get(row.agregat) ?? 0) + montant);
  }

  console.log(`  parsed  ${kind}: ${byCode.size} collectivités`);
  return [...byCode.values()];
}

export function datasetOf(kind: Kind): string {
  return SPECS.find((s) => s.kind === kind)!.dataset;
}
