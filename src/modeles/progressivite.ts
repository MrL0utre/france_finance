import { impotFoyer } from '../impot/bareme';
import type { BaremeIR } from '../schema';

/**
 * Élasticité du rendement de l'impôt sur le revenu à sa base imposable.
 *
 * En un foyer donné, elle vaut le taux marginal divisé par le taux moyen : si
 * son revenu imposable monte de 1 %, son impôt monte de ce facteur. Sur un
 * barème progressif, ce rapport dépasse 1 partout où l'impôt est dû, et il est
 * d'autant plus grand que le taux moyen est faible.
 *
 * Le résultat n'est donc pas un paramètre posé mais une propriété du barème
 * publié : changer le barème dans le simulateur change cette élasticité, sans
 * qu'aucun coefficient n'ait à être révisé à la main.
 *
 * Deux réserves, de sens contraire, qui interdisent d'y voir un rendement
 * agrégé. Les cas types servent à valider un calcul, pas à représenter une
 * distribution de revenus : la pondération par l'impôt payé est indicative. Et
 * la mesure déplace tous les revenus à nombre de foyers imposables constant,
 * alors qu'une récession fait sortir des foyers de l'impôt — cette marge-là
 * manque, et elle joue à la hausse.
 */
export function elasticiteBareme(bareme: BaremeIR): number | null {
  const p = {
    tranches: bareme.tranches,
    decote: bareme.decote,
    plafondDemiPart: bareme.plafondDemiPart,
  };

  let numerateur = 0;
  let denominateur = 0;

  for (const cas of bareme.casTypes ?? []) {
    const impot = impotFoyer(cas.rni, cas.parts, cas.declarants, p);
    if (impot <= 0) continue;
    // Différence finie sur un demi-pour-cent : assez petit pour rester local,
    // assez grand pour ne pas se perdre dans les arrondis du barème.
    const pas = cas.rni * 0.005;
    const marginal = (impotFoyer(cas.rni + pas, cas.parts, cas.declarants, p) - impot) / pas;
    const elasticite = marginal * (cas.rni / impot);
    // Pondération par l'impôt payé : c'est le rendement qui varie, et un foyer y
    // pèse à hauteur de ce qu'il verse, non à hauteur de un.
    numerateur += impot * elasticite;
    denominateur += impot;
  }

  return denominateur === 0 ? null : numerateur / denominateur;
}
