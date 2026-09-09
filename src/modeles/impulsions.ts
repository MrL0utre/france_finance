import type { Store } from '../data/store';
import { listeAjustements, type Ajustements } from '../data/simulation';
import { instrumentDe } from './instruments';
import { effetTaux } from './dette';
import { ELASTICITE_IR_DEFAUT } from './assiettes';
import { elasticiteBareme } from './progressivite';
import { profilChantier, type Impulsions } from './trajectoire';
import type { Contexte, Impulsion } from './types';

/**
 * Traduit un scénario en impulsions budgétaires exploitables par un modèle.
 *
 * On repart de `listeAjustements`, dont les contributions sont marginales : leur
 * somme égale exactement l'écart total. Mesurer chaque impulsion depuis le
 * montant publié compterait deux fois la part héritée d'un ajustement supérieur,
 * et surestimerait l'effet sur l'activité.
 */
export function impulsionsDe(store: Store, aj: Ajustements): Impulsion[] {
  const impulsions: Impulsion[] = [];

  for (const ligne of listeAjustements(store, aj)) {
    const node = store.nodes.get(ligne.id);
    if (!node) continue;
    const delta = ligne.simule - ligne.base;
    if (delta === 0) continue;
    impulsions.push({
      id: ligne.id,
      label: ligne.label,
      cote: ligne.cote,
      instrument: instrumentDe(node, ligne.cote),
      delta,
    });
  }

  // Mesures créées de toutes pièces : leur montant est déjà l'impulsion.
  for (const m of aj.mesures ?? []) {
    if (m.montant === 0) continue;
    impulsions.push({
      id: m.id,
      label: m.label,
      cote: m.cote,
      instrument: m.instrument as Impulsion['instrument'],
      delta: m.montant,
    });
  }

  // Une variation de taux se traduit par un surcoût de charge la première année.
  if (aj.pointsDeTaux && store.macro) {
    const effet = effetTaux(store.macro.dette, aj.pointsDeTaux);
    if (effet.chargeAnnee1 !== 0) {
      impulsions.push({
        id: 'taux',
        label: `Taux d'emprunt ${aj.pointsDeTaux > 0 ? '+' : '−'}${Math.abs(aj.pointsDeTaux).toFixed(2).replace('.', ',')} pt`,
        cote: 'dep',
        instrument: 'charge_dette',
        delta: effet.chargeAnnee1,
      });
    }
  }

  return impulsions;
}

/**
 * Sépare le scénario en deux natures d'impulsion.
 *
 * Les ajustements de postes et les mesures créées sont reconduits chaque année :
 * baisser un budget de 10 % le baisse aussi l'an prochain. Les chantiers, eux,
 * ont un début et une fin — c'est ce qui rend la projection pluriannuelle utile
 * plutôt que décorative.
 */
export function impulsionsPluriannuelles(
  store: Store,
  aj: Ajustements,
  horizon: number,
): Impulsions {
  const permanentes = impulsionsDe(store, aj);
  const parAnnee = new Map<number, Impulsion[]>();

  for (const retenu of aj.chantiers ?? []) {
    const fiche = store.chantiers.find((c) => c.id === retenu.ref);
    const cout = retenu.cout ?? fiche?.cout ?? 0;
    const duree = retenu.dureeAnnees ?? fiche?.dureeAnnees ?? 0;
    const label = retenu.label ?? fiche?.label ?? 'Chantier';
    if (cout <= 0 || duree <= 0) continue;

    const profil = profilChantier(cout, duree, retenu.debut, horizon);
    for (const [annee, montant] of profil.entries()) {
      if (montant === 0) continue;
      const liste = parAnnee.get(annee) ?? [];
      liste.push({
        id: retenu.id,
        label,
        cote: 'dep',
        instrument: (fiche?.instrument ?? 'investissement') as Impulsion['instrument'],
        delta: montant,
      });
      parAnnee.set(annee, liste);
    }
  }

  return { permanentes, parAnnee };
}

/** Cadrage de référence : totaux du budget et agrégats macroéconomiques. */
export function contexteDe(store: Store): Contexte | null {
  const racine = store.nodes.get('racine');
  if (!racine || !store.macro) return null;
  return {
    pib: store.macro.pib,
    pibParEmploi: store.macro.pibParEmploi,
    recettes: racine.rec,
    // Un navigateur peut avoir gardé en cache un macro.json antérieur à la
    // ventilation, pendant que le code, lui, est à jour. Sans cette tolérance,
    // parcourir un objet absent faisait planter tous les modèles à rétroaction
    // — et avec eux la page de comparaison, qui les exécute tous.
    recettesParInstrument: (store.macro.recettesParInstrument ??
      {}) as Contexte['recettesParInstrument'],
    assiettes: store.pib?.assiettes ?? null,
    // Calculée sur le barème actif : réformer les tranches change du même coup
    // la façon dont le rendement de l'impôt réagit à l'activité.
    elasticiteIR: (store.bareme && elasticiteBareme(store.bareme)) || ELASTICITE_IR_DEFAUT,
    depenses: racine.dep,
    soldeBase: racine.solde ?? racine.rec - racine.dep,
  };
}
