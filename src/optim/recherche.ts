import type { Contexte, Effets, Impulsion } from '../modeles/types';
import type { Calibration } from '../modeles/moteur';
import { calculerAvec } from '../modeles/moteur';
import { satisfaction } from '../modeles/satisfaction';

/**
 * Recherche d'un scénario sous contraintes.
 *
 * ─── Pourquoi pas un solveur linéaire ───
 *
 * Le premier réflexe serait d'écrire le problème pour un solveur du type PuLP.
 * Deux obstacles s'y opposent, et le second est le plus important.
 *
 * PuLP est une bibliothèque Python, quand cette application est un fichier
 * statique servi à un navigateur : il n'y a pas d'interpréteur pour l'exécuter,
 * et en ajouter un pour cela seul reviendrait à donner un serveur à un outil qui
 * a été construit pour s'en passer.
 *
 * Surtout, le modèle n'est pas linéaire. L'érosion rend le rendement d'un impôt
 * quadratique en la hausse décidée, le plafond par assiette introduit des
 * ruptures de pente, et le report d'activité couple les années entre elles. Un
 * solveur linéaire optimiserait donc une approximation — et proposerait des
 * scénarios que le reste de l'outil contredirait aussitôt en les évaluant. Un
 * optimum faux est pire qu'une recherche approximative honnête.
 *
 * ─── Ce qui est fait à la place ───
 *
 * Une descente par coordonnées : on parcourt les leviers un à un, on cherche
 * pour chacun la position qui améliore le plus l'objectif, on recommence
 * jusqu'à ce que plus rien ne bouge. La fonction objectif appelle le moteur
 * réel, celui-là même qui alimente le reste de l'application, si bien que le
 * scénario proposé donne exactement les mêmes chiffres partout ailleurs.
 *
 * Ce n'est pas garanti d'atteindre l'optimum global — aucune méthode simple ne
 * le serait sur un problème non convexe — mais c'est reproductible, sans
 * dépendance, et lisible ligne à ligne.
 */

export type Levier = {
  id: string;
  label: string;
  cote: 'dep' | 'rec';
  instrument: Impulsion['instrument'];
  /** Montant publié du poste, sur lequel le facteur s'applique. */
  base: number;
  /** Facteurs extrêmes autorisés. 1 signifie « inchangé ». */
  min: number;
  max: number;
};

export type Objectif = {
  /** Amélioration du solde visée, en euros. */
  cibleSolde: number;
  /** Perte d'emplois au-delà de laquelle le scénario est refusé. */
  plancherEmploi: number;
  /** Poids de l'activité dans ce qu'on cherche à préserver. */
  poidsActivite: number;
  /** Poids de l'humeur de la population. */
  poidsHumeur: number;
};

export type Resultat = {
  facteurs: Map<string, number>;
  effets: Effets;
  /** La cible de solde est-elle atteinte ? */
  cibleAtteinte: boolean;
  /** Le plancher d'emploi est-il respecté ? */
  emploiRespecte: boolean;
  /** Nombre de passes effectuées avant stabilisation. */
  passes: number;
};

/** Positions essayées sur chaque levier, du plus fort recul à la plus forte hausse. */
const PAS = [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];

/** Au-delà, on considère que la descente ne progresse plus. */
const PASSES_MAX = 6;

/**
 * Pénalité de remuement.
 *
 * Sans elle, la recherche proposait de couper 140 Md € de dépenses locales et
 * 135 Md € de recettes locales — 275 Md € déplacés pour un gain net de cinq. Les
 * deux gestes s'annulaient au solde et se compensaient à l'humeur, si bien que
 * rien ne les distinguait de l'immobilité. Un plan qui bouleverse un quart du
 * budget sans rien changer n'est pas un plan.
 *
 * Le coefficient est faible à dessein : il départage des scénarios équivalents
 * sans peser sur un arbitrage réel. Il exprime une préférence pour la moindre
 * intervention, qui est un choix — mais un choix que toute proposition
 * budgétaire fait implicitement.
 */
const PARCIMONIE = 0.4;

/**
 * Score d'un scénario. Plus il est haut, mieux c'est.
 *
 * Les deux contraintes — solde et emploi — entrent comme des pénalités très
 * lourdes plutôt que comme des bornes dures : une pénalité laisse la descente
 * traverser une zone infaisable pour en trouver une meilleure, là où une borne
 * dure l'y bloquerait au premier levier essayé.
 */
function score(effets: Effets, contexte: Contexte, o: Objectif): number {
  const humeur = satisfaction(effets, contexte).score;

  // Tout est ramené en points de pourcentage pour que les poids se comparent.
  const activite = effets.pibPct;
  let valeur = o.poidsActivite * activite + o.poidsHumeur * humeur;

  // À résultat égal, le scénario qui dérange le moins l'emporte.
  const remue = effets.lignes.reduce((t, l) => t + Math.abs(l.delta), 0);
  valeur -= PARCIMONIE * (remue / Math.max(contexte.pib, 1)) * 100;

  const manqueSolde = Math.max(0, o.cibleSolde - effets.soldeVariation);
  const manqueEmploi = Math.max(0, -effets.emploi - o.plancherEmploi);

  // Exprimées dans la même unité que le reste : un point de PIB manquant au
  // solde, ou un point d'emploi total perdu au-delà du plancher.
  valeur -= 1000 * (manqueSolde / Math.max(contexte.pib, 1)) * 100;
  valeur -= 1000 * (manqueEmploi / Math.max(contexte.pib / contexte.pibParEmploi, 1)) * 100;

  return valeur;
}

function impulsionsDe(leviers: Levier[], facteurs: Map<string, number>): Impulsion[] {
  const out: Impulsion[] = [];
  for (const l of leviers) {
    const f = facteurs.get(l.id) ?? 1;
    const delta = l.base * (f - 1);
    if (delta === 0) continue;
    out.push({ id: l.id, label: l.label, cote: l.cote, instrument: l.instrument, delta });
  }
  return out;
}

export function optimiser(
  leviers: Levier[],
  calibration: Calibration,
  contexte: Contexte,
  objectif: Objectif,
): Resultat {
  const facteurs = new Map<string, number>(leviers.map((l) => [l.id, 1]));

  const evaluer = (f: Map<string, number>) => calculerAvec(calibration, impulsionsDe(leviers, f), contexte);
  let effets = evaluer(facteurs);
  let meilleur = score(effets, contexte, objectif);
  let passes = 0;

  for (; passes < PASSES_MAX; passes++) {
    let progresse = false;

    for (const levier of leviers) {
      const actuel = facteurs.get(levier.id) ?? 1;
      let meilleurFacteur = actuel;

      for (const pas of PAS) {
        if (pas < levier.min || pas > levier.max || pas === actuel) continue;
        facteurs.set(levier.id, pas);
        const candidat = score(evaluer(facteurs), contexte, objectif);
        // Une amélioration doit être franche : sans ce seuil, la descente
        // oscillerait indéfiniment entre deux positions équivalentes.
        if (candidat > meilleur + 1e-9) {
          meilleur = candidat;
          meilleurFacteur = pas;
        }
      }

      facteurs.set(levier.id, meilleurFacteur);
      if (meilleurFacteur !== actuel) progresse = true;
    }

    if (!progresse) break;
  }

  effets = evaluer(facteurs);

  return {
    facteurs,
    effets,
    cibleAtteinte: effets.soldeVariation >= objectif.cibleSolde - 1e6,
    emploiRespecte: -effets.emploi <= objectif.plancherEmploi + 1,
    passes: passes + 1,
  };
}
