/**
 * Calcul de l'impôt sur le revenu à partir du barème.
 *
 * Réimplémenter la législation fiscale est risqué : une erreur y est invisible.
 * Ce module est donc systématiquement confronté à OpenFisca au moment de la
 * construction des données — pour chaque cas type, on compare notre résultat au
 * sien, et tout cas qui ne concorde pas est écarté de l'interface plutôt que
 * présenté. Le fichier produit conserve l'écart constaté.
 *
 * Sont couverts : le barème progressif, le quotient familial et son
 * plafonnement dans le cas général, et la décote. Ne le sont pas : les
 * réductions et crédits d'impôt, les demi-parts particulières (invalidité,
 * ancien combattant, veuvage), les abattements d'outre-mer et le prélèvement
 * forfaitaire unique.
 */

export type Tranche = { seuil: number; taux: number };

export type ParametresBareme = {
  tranches: Tranche[];
  decote: { seuilCelibataire: number; seuilCouple: number; taux: number };
  plafondDemiPart: number;
};

/** Impôt dû sur un quotient, avant multiplication par le nombre de parts. */
export function baremeParPart(quotient: number, tranches: Tranche[]): number {
  let impot = 0;
  for (let i = 0; i < tranches.length; i++) {
    const { seuil, taux } = tranches[i];
    if (quotient <= seuil) break;
    const plafond = i + 1 < tranches.length ? Math.min(quotient, tranches[i + 1].seuil) : quotient;
    impot += (plafond - seuil) * taux;
  }
  return impot;
}

/**
 * Impôt d'un foyer, quotient familial et décote compris.
 *
 * `parts` inclut les demi-parts liées aux personnes à charge ; `declarants` sert
 * de référence pour mesurer l'avantage que le quotient procure, puisque c'est
 * cet avantage — et lui seul — que la loi plafonne.
 */
export function impotFoyer(
  rni: number,
  parts: number,
  declarants: number,
  p: ParametresBareme,
): number {
  const avecParts = parts * baremeParPart(rni / parts, p.tranches);
  const sansParts = declarants * baremeParPart(rni / declarants, p.tranches);

  const demiPartsSupplementaires = Math.max(0, (parts - declarants) * 2);
  const avantage = sansParts - avecParts;
  const plafond = demiPartsSupplementaires * p.plafondDemiPart;
  // L'avantage est ramené au plafond dès qu'il le dépasse.
  const apresPlafonnement = avantage > plafond ? sansParts - plafond : avecParts;

  const seuilDecote = declarants >= 2 ? p.decote.seuilCouple : p.decote.seuilCelibataire;
  const decote = Math.max(0, seuilDecote - p.decote.taux * apresPlafonnement);

  return Math.max(0, apresPlafonnement - decote);
}

/** Applique une réforme du barème : variation de taux et de seuil par tranche. */
export function baremeReforme(
  tranches: Tranche[],
  reformes: Record<number, { taux?: number; seuil?: number }>,
): Tranche[] {
  return tranches
    .map((t, i) => ({
      seuil: reformes[i]?.seuil ?? t.seuil,
      taux: reformes[i]?.taux ?? t.taux,
    }))
    .sort((a, b) => a.seuil - b.seuil);
}
