import type { Sphere } from '../schema';
import type { Store } from '../data/store';
import type { Cote } from '../data/simulation';
import type { Levier } from './LigneLevier';

/**
 * Sélection des postes proposés au pilotage.
 *
 * Le graphe permet d'ajuster n'importe quel nœud ; ce panneau vise l'inverse :
 * un petit nombre de leviers réellement décisifs, réunis sur un même écran pour
 * pouvoir bâtir un scénario sans naviguer.
 */

export type { Levier };

export type GroupeLeviers = {
  titre: string;
  sphere: Sphere;
  leviers: Levier[];
  note?: string;
};

/** Shards nécessaires au panneau, à charger avant de construire la liste. */
export const SHARDS_PILOTAGE = ['etat/r0.json', 'etat/r2.json'];

/**
 * Seuil des lignes fiscales retenues. Le budget général compte 59 lignes de
 * recettes fiscales, dont une longue traîne à quelques centaines de millions :
 * les afficher toutes noierait les trois impôts qui font l'essentiel de la
 * recette.
 */
const SEUIL_LIGNE_FISCALE = 3e9;

const ID_RECETTES_FISCALES = 'etat:rec:r0';
const ID_RECETTES_NON_FISCALES = 'etat:rec:r2';
const ID_COLLECTIVITES = 'sphere:collectivites';

/**
 * Les prélèvements sur recettes sont volontairement absents des leviers. Réduire
 * celui versé aux collectivités augmenterait la recette de l'État sans diminuer
 * la leur : le simulateur, purement comptable, ne propage pas ce transfert. Le
 * levier afficherait donc un gain net qui n'existe pas.
 */
export const NOTE_PRELEVEMENTS =
  "Les prélèvements sur recettes reversés aux collectivités et à l'Union européenne (67,5 Md €) ne figurent pas ici : les réduire augmenterait la recette de l'État sans diminuer celle de leurs bénéficiaires, ce que la simulation ne saurait pas répercuter.";

function enfants(store: Store, parentId: string, cote: Cote): Levier[] {
  const tous: Levier[] = [];
  for (const n of store.nodes.values()) {
    if (n.parentId !== parentId || n[cote] <= 0) continue;
    tous.push({ id: n.id, label: n.label, cote, base: n[cote] });
  }
  return tous.sort((a, b) => b.base - a.base);
}

export function construireLeviers(store: Store): {
  recettes: GroupeLeviers[];
  depenses: GroupeLeviers[];
} {
  const collectivites = store.nodes.get(ID_COLLECTIVITES);
  const nonFiscales = store.nodes.get(ID_RECETTES_NON_FISCALES);

  const lignesFiscales = enfants(store, ID_RECETTES_FISCALES, 'rec').filter(
    (l) => l.base >= SEUIL_LIGNE_FISCALE,
  );

  const recettes: GroupeLeviers[] = [
    {
      titre: "Impôts de l'État",
      sphere: 'etat',
      leviers: [
        ...lignesFiscales,
        ...(nonFiscales
          ? [
              {
                id: nonFiscales.id,
                label: 'Recettes non fiscales (ensemble)',
                cote: 'rec' as const,
                base: nonFiscales.rec,
              },
            ]
          : []),
      ],
      note: NOTE_PRELEVEMENTS,
    },
    {
      titre: 'Prélèvements sociaux',
      sphere: 'secu',
      leviers: enfants(store, 'sphere:secu', 'rec'),
    },
    {
      titre: 'Collectivités territoriales',
      sphere: 'collectivites',
      leviers: collectivites
        ? [
            {
              id: collectivites.id,
              label: 'Recettes locales (ensemble)',
              cote: 'rec',
              base: collectivites.rec,
            },
          ]
        : [],
      note: "La ventilation nationale des recettes locales par nature d'impôt n'est pas publiée : le levier porte sur l'ensemble. Le détail reste accessible collectivité par collectivité dans l'explorateur.",
    },
  ];

  const depenses: GroupeLeviers[] = [
    {
      titre: "Ministères de l'État",
      sphere: 'etat',
      leviers: enfants(store, 'sphere:etat', 'dep'),
    },
    {
      titre: 'Branches de la Sécurité sociale',
      sphere: 'secu',
      leviers: enfants(store, 'sphere:secu', 'dep'),
    },
    {
      titre: 'Collectivités territoriales',
      sphere: 'collectivites',
      leviers: collectivites
        ? [
            {
              id: collectivites.id,
              label: 'Dépenses locales (ensemble)',
              cote: 'dep',
              base: collectivites.dep,
            },
          ]
        : [],
    },
  ];

  return {
    recettes: recettes.filter((g) => g.leviers.length > 0),
    depenses: depenses.filter((g) => g.leviers.length > 0),
  };
}
