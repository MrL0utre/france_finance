import type { Contexte, Effets } from './types';

/**
 * Indicateur d'humeur de la population.
 *
 * CE N'EST PAS UNE MESURE. Aucune enquête d'opinion n'entre ici, aucun travail
 * de science politique non plus. C'est une composition arithmétique de trois
 * quantités que le moteur calcule déjà, pondérées par des coefficients que nous
 * avons choisis. L'indicateur dit dans quel sens penche un scénario ; il ne dit
 * pas ce que les gens en penseraient, et rien ne l'y autorise.
 *
 * Il est affiché parce qu'un budget se lit mal en euros seuls : couper
 * 40 Md € et lever 40 Md € produisent le même solde et n'ont pas le même effet
 * sur qui les subit. Le rendre visible vaut mieux que de laisser chacun faire
 * cette pondération dans sa tête sans la formuler.
 *
 * ─── Pourquoi trois canaux et non quatre ───
 *
 * L'emploi et l'activité n'en font qu'un. Le moteur convertit l'un en l'autre
 * par une simple division — emploi = écart de PIB / PIB par emploi — si bien que
 * les compter séparément pèserait deux fois le même nombre sous deux noms. Le
 * canal s'appelle donc « activité et emploi », et c'est une limite du moteur,
 * pas un choix de présentation.
 *
 * ─── Ce que chaque canal mesure ───
 *
 *   prélèvements    ce qui est effectivement prélevé, érosion comprise
 *   activité        l'écart de PIB, dont l'emploi est ici l'image exacte
 *   services        la dépense publique hors charge de la dette
 *
 * La charge de la dette est exclue des services : elle rembourse des créanciers
 * et n'achète aucune prestation. La couper n'améliorerait aucun service, et
 * l'augmenter n'en dégrade aucun.
 *
 * Un même euro de dépense coupée pèse ici deux fois : une fois par l'activité
 * qu'il ne soutient plus, une fois par le service qu'il ne rend plus. C'est
 * délibéré — un hôpital fermé se remarque autrement qu'un point de PIB — mais
 * cela reste une pondération choisie, pas un fait établi.
 */

export type Canal = 'prelevements' | 'activite' | 'services';

export const LIBELLES_CANAL: Record<Canal, string> = {
  prelevements: 'Ce qui est prélevé',
  activite: 'Activité et emploi',
  services: 'Services publics rendus',
};

/**
 * Poids relatifs des trois canaux.
 *
 * Choisis, ronds, et sans prétention : l'activité pèse un peu plus parce qu'elle
 * porte aussi l'emploi. Les modifier changerait le visage sans rien changer aux
 * chiffres qui le composent, lesquels restent affichés à côté.
 */
export const POIDS: Record<Canal, number> = {
  activite: 1.5,
  prelevements: 1,
  services: 1,
};

export type Humeur = 'content' | 'neutre' | 'mecontent' | 'colere';

/**
 * Bornes des quatre visages, en points de l'indicateur.
 *
 * Elles sont calées pour qu'un scénario ordinaire — quelques milliards déplacés
 * — reste au neutre, et qu'il faille un bouleversement pour atteindre le rouge.
 * Un indicateur qui vire au rouge au premier réglage n'apprendrait rien.
 */
const BORNES: { max: number; humeur: Humeur }[] = [
  { max: -5, humeur: 'colere' },
  { max: -1, humeur: 'mecontent' },
  { max: 1, humeur: 'neutre' },
  { max: Infinity, humeur: 'content' },
];

export const VISAGES: Record<Humeur, { emoji: string; label: string; couleur: string }> = {
  content: { emoji: '🙂', label: 'Plutôt satisfaite', couleur: '#16a34a' },
  neutre: { emoji: '😐', label: 'Indifférente', couleur: '#ca8a04' },
  mecontent: { emoji: '🙁', label: 'Mécontente', couleur: '#ea580c' },
  colere: { emoji: '😠', label: 'En colère', couleur: '#dc2626' },
};

export type Satisfaction = {
  score: number;
  humeur: Humeur;
  /** Contribution de chaque canal au score, dans son ordre de lecture. */
  canaux: { canal: Canal; variation: number; contribution: number }[];
};

export function satisfaction(effets: Effets, contexte: Contexte): Satisfaction {
  const pct = (x: number, base: number) => (base === 0 ? 0 : (x / base) * 100);

  const variations: Record<Canal, number> = {
    // Prélever davantage pèse : le signe s'inverse. On retient ce qui est
    // effectivement encaissé, érosion comprise — un impôt décidé mais non
    // collecté n'est payé par personne.
    prelevements: -pct(effets.recettesEncaissees, contexte.recettes),
    activite: effets.pibPct,
    services: pct(effets.depensesHorsDette, contexte.depenses),
  };

  const total = POIDS.prelevements + POIDS.activite + POIDS.services;
  const canaux = (['prelevements', 'activite', 'services'] as const).map((canal) => ({
    canal,
    variation: variations[canal],
    contribution: (variations[canal] * POIDS[canal]) / total,
  }));

  const score = canaux.reduce((s, c) => s + c.contribution, 0);
  const humeur = BORNES.find((b) => score < b.max)?.humeur ?? 'content';

  return { score, humeur, canaux };
}
