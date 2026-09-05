import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  CLES_DEPENSES,
  CLES_RECETTES,
  SOLDE_PUBLIE,
  TOTAL_DEPENSES,
  TOTAL_RECETTES,
} from '../src/schema.ts';

const here = dirname(fileURLToPath(import.meta.url));

export const ROOT = resolve(here, '..');
export const CACHE_DIR = resolve(ROOT, 'data/cache');
export const MANUAL_DIR = resolve(ROOT, 'data/manual');
export const OUT_DIR = resolve(ROOT, 'public/data');

/** Exercice de référence pour les comptes locaux (OFGL). */
export const EXERCICE_OFGL = 2024;

export const OFGL_API = 'https://data.ofgl.fr/api/explore/v2.1/catalog/datasets';
export const ECO_API = 'https://data.economie.gouv.fr/api/explore/v2.1/catalog/datasets';

/** Instance publique d'OpenFisca France, interrogée à la construction. */
export const OPENFISCA_API = 'https://api.fr.openfisca.org/latest';
/** Année de revenus pour laquelle le barème et les cas types sont calculés. */
export const EXERCICE_IR = 2025;

export const PLF_DEPENSES = 'plf25-depenses-2025-selon-destination';
export const PLF_RECETTES = 'plf25-recettes-du-budget-general';
export const EXERCICE_PLF = 2025;

/**
 * Agrégats téléchargés. Le solde publié par l'OFGL est inclus : il sert
 * uniquement à vérifier que recettes − dépenses tombe juste.
 */
export const AGREGATS: string[] = [
  TOTAL_DEPENSES,
  TOTAL_RECETTES,
  SOLDE_PUBLIE,
  ...CLES_DEPENSES,
  ...CLES_RECETTES,
];

/** Au-delà de ce nombre d'enfants, les plus petits sont regroupés en « Autres ». */
export const MAX_ENFANTS_AFFICHES = 40;
