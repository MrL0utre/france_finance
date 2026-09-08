/**
 * Schéma partagé entre le pipeline de données et l'application.
 * Toute modification ici impose de relancer `npm run data:build`.
 */

export type Mode = 'depenses' | 'recettes' | 'solde';

/** Un poste comptable, et son emboîtement. */
export type Poste = {
  /** Libellé de l'agrégat OFGL, qui sert aussi de clé. */
  key: string;
  label: string;
  enfants?: Poste[];
};

/**
 * Ventilation des dépenses locales. Vérifié sur données réelles :
 * fonctionnement + investissement = total, et chaque groupe somme à son parent.
 */
export const DEPENSES: Poste[] = [
  {
    key: 'Dépenses de fonctionnement',
    label: 'Fonctionnement',
    enfants: [
      { key: 'Frais de personnel', label: 'Frais de personnel' },
      { key: 'Achats et charges externes', label: 'Achats et charges externes' },
      { key: "Dépenses d'intervention", label: "Dépenses d'intervention" },
      { key: 'Charges financières', label: 'Charges financières' },
      { key: 'Autres dépenses de fonctionnement', label: 'Autres dépenses' },
    ],
  },
  {
    key: "Dépenses d'investissement hors remb",
    label: 'Investissement',
    enfants: [
      { key: "Dépenses d'équipement", label: "Dépenses d'équipement" },
      { key: "Subventions d'équipement versées", label: "Subventions d'équipement versées" },
      { key: "Autres dépenses d'investissement", label: 'Autres dépenses' },
    ],
  },
];

/**
 * Ventilation des recettes locales. Les emboîtements ont été vérifiés à l'euro
 * près : impôts locaux + autres impôts = impôts et taxes, DGF + péréquations +
 * autres dotations = concours de l'État, et les cinq postes de fonctionnement
 * somment exactement aux recettes de fonctionnement.
 */
export const RECETTES: Poste[] = [
  {
    key: 'Recettes de fonctionnement',
    label: 'Fonctionnement',
    enfants: [
      {
        key: 'Impôts et taxes',
        label: 'Impôts et taxes',
        enfants: [
          { key: 'Impôts locaux', label: 'Impôts locaux' },
          { key: 'Autres impôts et taxes', label: 'Autres impôts et taxes' },
        ],
      },
      {
        key: "Concours de l'Etat",
        label: "Concours de l'État",
        enfants: [
          { key: 'Dotation globale de fonctionnement', label: 'Dotation globale de fonctionnement' },
          {
            key: 'Péréquations et compensations fiscales',
            label: 'Péréquations et compensations fiscales',
          },
          { key: 'Autres dotations de fonctionnement', label: 'Autres dotations' },
        ],
      },
      { key: 'Ventes de biens et services', label: 'Ventes de biens et services' },
      { key: 'Subventions reçues et participations', label: 'Subventions et participations' },
      { key: 'Autres recettes de fonctionnement', label: 'Autres recettes' },
    ],
  },
  {
    key: "Recettes d'investissement hors emprunts",
    label: 'Investissement',
    enfants: [
      { key: 'FCTVA', label: 'FCTVA' },
      { key: 'Autres dotations et subventions', label: 'Dotations et subventions' },
      { key: "Autres recettes d'investissement", label: 'Autres recettes' },
    ],
  },
];

export const TOTAL_DEPENSES = 'Dépenses totales hors remb';
export const TOTAL_RECETTES = 'Recettes totales hors emprunts';

/** Agrégat par lequel l'OFGL publie lui-même le solde, pour contrôle. */
export const SOLDE_PUBLIE = 'Capacité ou besoin de financement';

function aplatir(postes: Poste[]): string[] {
  return postes.flatMap((p) => [p.key, ...(p.enfants ? aplatir(p.enfants) : [])]);
}

/** Ordre canonique des tableaux `bd` et `br` portés par les nœuds territoriaux. */
export const CLES_DEPENSES = aplatir(DEPENSES);
export const CLES_RECETTES = aplatir(RECETTES);

export function postesDuMode(mode: Mode): Poste[] {
  return mode === 'recettes' ? RECETTES : DEPENSES;
}

export function clesDuMode(mode: Mode): string[] {
  return mode === 'recettes' ? CLES_RECETTES : CLES_DEPENSES;
}

/**
 * En mode solde, seules les deux sections se correspondent d'un côté à l'autre :
 * « frais de personnel » n'a pas de pendant en recettes. Le solde de la section
 * de fonctionnement est l'épargne brute, l'indicateur de référence des finances
 * locales.
 */
export const SECTIONS_SOLDE = [
  {
    label: 'Fonctionnement (épargne brute)',
    depense: 'Dépenses de fonctionnement',
    recette: 'Recettes de fonctionnement',
  },
  {
    label: 'Investissement',
    depense: "Dépenses d'investissement hors remb",
    recette: "Recettes d'investissement hors emprunts",
  },
] as const;

export function indexDepense(key: string): number {
  return CLES_DEPENSES.indexOf(key);
}

export function indexRecette(key: string): number {
  return CLES_RECETTES.indexOf(key);
}

export type Sphere = 'etat' | 'collectivites' | 'secu';

export type Level =
  | 'racine'
  | 'sphere'
  | 'categorie'
  | 'ministere'
  | 'mission'
  | 'programme'
  | 'action'
  | 'region'
  | 'departement'
  | 'epci'
  | 'commune'
  | 'propre'
  | 'section'
  | 'poste'
  | 'branche';

export type Node = {
  id: string;
  label: string;
  /** Dépenses. 0 si le nœud n'existe que du côté recettes. */
  dep: number;
  /** Recettes. 0 si le nœud n'existe que du côté dépenses. */
  rec: number;
  /**
   * Solde publié, à utiliser à la place de `rec - dep` quand les deux montants
   * relèvent de périmètres différents et que leur différence n'aurait pas de sens.
   */
  solde?: number;
  level: Level;
  sphere: Sphere;
  parentId: string | null;
  /**
   * Nombre d'enfants par mode, connu sans les charger. `nSol` n'est pas
   * déductible des deux autres : un ministère n'a pas de recettes, donc la
   * sphère État n'a aucun enfant dont le solde ait un sens.
   */
  nDep: number;
  nRec: number;
  nSol: number;
  /** Fichier de public/data/ à charger pour obtenir les enfants territoriaux. */
  shard?: string;
  /** false = montant brut, non consolidé des flux croisés entre niveaux. */
  consolide: boolean;
  population?: number;
  /** Ventilation des dépenses, dans l'ordre de CLES_DEPENSES. */
  bd?: number[];
  /** Ventilation des recettes, dans l'ordre de CLES_RECETTES. */
  br?: number[];
  /** Clé de source, résolue via sources.json. */
  src: string;
  /** Précision méthodologique affichée dans le panneau de détail. */
  note?: string;
  /** true = montant obtenu en appliquant une répartition à un total. */
  derive?: boolean;
};

export type Shard = { nodes: Node[] };

/** Cadrage macroéconomique, dénominateur des modèles de bouclage. */
export type Macro = {
  pib: number;
  exercice: number;
  libelle: string;
  note: string;
  url: string;
  pibParEmploi: number;
  noteEmploi: string;
  dette: Dette;
};

export type Dette = {
  encours: number;
  dateEncours: string;
  dureeVieMoyenneAnnees: number;
  /** Volume réémis chaque année, seul exposé à une variation de taux. */
  programmeFinancementAnnuel: number;
  /** Charge de la dette inscrite au budget général. */
  charge: number;
  /** Nœud correspondant, pour renvoyer vers l'explorateur. */
  chargeId: string | null;
  source: { label: string; url: string };
  note: string;
  noteCharge: string;
};

/** Repère de coût pour un grand investissement public, sourcé. */
export type Chantier = {
  id: string;
  label: string;
  cout: number;
  dureeAnnees: number;
  instrument: string;
  note: string;
  source: { label: string; url: string };
};

/** Barème de l'impôt sur le revenu, repris d'OpenFisca à la construction. */
export type BaremeIR = {
  exercice: number;
  millesime: string;
  tranches: { seuil: number; taux: number }[];
  decote: { seuilCelibataire: number; seuilCouple: number; taux: number };
  plafondDemiPart: number;
  reference: string;
  source: { label: string; url: string };
  note: string;
  ecartMaximal: number;
  casTypes: {
    id: string;
    libelle: string;
    salaire: number;
    declarants: number;
    enfants: number;
    rni: number;
    parts: number;
    impot: number;
    impotVerifie: number;
    ecart: number;
  }[];
};

/**
 * Ce que mesure réellement une donnée. Distinction décisive pour un lecteur :
 * un montant prévu dans un projet de loi et un montant effectivement dépensé ne
 * disent pas la même chose, et les confondre laisserait croire à des dépenses
 * réelles là où il n'y a qu'une intention budgétaire.
 */
export type NatureDonnee = 'prevision' | 'execute' | 'constate' | 'repere';

export const NATURES: Record<NatureDonnee, { court: string; long: string }> = {
  prevision: {
    court: 'prévision',
    long: "Montants prévus par un projet de loi de finances, non des dépenses constatées.",
  },
  execute: {
    court: 'comptes exécutés',
    long: 'Montants effectivement dépensés et encaissés, tels que publiés après clôture.',
  },
  constate: {
    court: 'constaté',
    long: "Montants constatés a posteriori, publiés par l'organisme responsable.",
  },
  repere: { court: 'repère', long: 'Agrégat de référence, donné à titre de comparaison.' },
};

/**
 * Libellés d'une nature, en tolérant l'absence.
 *
 * Un navigateur peut servir un `sources.json` mis en cache avant l'ajout de ce
 * champ : indexer directement le dictionnaire produisait alors une page blanche.
 * Une donnée d'intendance manquante ne doit pas emporter l'application entière.
 */
export function libellesNature(nature: NatureDonnee | undefined): {
  court: string;
  long: string;
} {
  return (
    (nature && NATURES[nature]) ?? {
      court: 'nature non précisée',
      long: "La nature de cette donnée n'est pas renseignée ; rechargez la page pour obtenir la version à jour des sources.",
    }
  );
}

export type SourceRef = {
  /** Ce que la donnée mesure : prévision, exécution, constat. */
  nature: NatureDonnee;
  /** Réserve majeure à afficher au plus près du chiffre, quand elle existe. */
  reserve?: string;
  label: string;
  dataset: string;
  exercice: number;
  url: string;
};

/** Une entrée de l'index de recherche, en clés courtes pour limiter le poids. */
export type SearchEntry = {
  i: string;
  n: string;
  /** contexte affiché sous le nom (ex. « Commune · Vaucluse ») */
  c: string;
  /** dépenses */
  a: number;
  /** shards à charger pour reconstituer la chaîne d'ancêtres */
  s?: string[];
};

/** Montant à afficher pour un nœud dans un mode donné. */
export function valeur(node: Pick<Node, 'dep' | 'rec' | 'solde'>, mode: Mode): number {
  if (mode === 'depenses') return node.dep;
  if (mode === 'recettes') return node.rec;
  return node.solde ?? node.rec - node.dep;
}

/**
 * Un nœud n'a de solde interprétable que si ses deux côtés couvrent le même
 * périmètre. Les ministères n'ont pas de recettes et les lignes d'impôt pas de
 * dépenses : leur différence ne voudrait rien dire.
 */
export function soldeInterpretable(node: Pick<Node, 'dep' | 'rec' | 'solde'>): boolean {
  return node.solde !== undefined || (node.dep !== 0 && node.rec !== 0);
}

export function nbEnfants(node: Pick<Node, 'nDep' | 'nRec' | 'nSol'>, mode: Mode): number {
  if (mode === 'recettes') return node.nRec;
  if (mode === 'solde') return node.nSol;
  return node.nDep;
}

export const SPHERE_COLORS: Record<Sphere | 'racine', string> = {
  etat: '#2563eb',
  collectivites: '#16a34a',
  secu: '#eab308',
  racine: '#0b1e3d',
};

export const COULEUR_EXCEDENT = '#0d9488';
export const COULEUR_DEFICIT = '#dc2626';
