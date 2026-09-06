/**
 * Adresse du code source, telle qu'affichée dans l'application.
 *
 * L'article 13 de l'AGPL impose que les utilisateurs qui interagissent avec une
 * version modifiée à travers un réseau puissent en obtenir la source. Un lien
 * visible dans l'interface est la façon la plus simple de s'en acquitter, et
 * reste de toute manière utile : c'est ce qui permet à un lecteur de vérifier
 * qu'aucun coefficient n'a été discrètement ajusté.
 *
 * À renseigner avant tout déploiement. Tant que la valeur reste celle du gabarit,
 * l'application n'affiche pas de lien mort : elle indique simplement que le
 * projet est sous AGPL.
 */
const GABARIT = 'https://github.com/<compte>/finance-france';

export const DEPOT = GABARIT;

export const depotRenseigne = (): boolean => DEPOT !== GABARIT;
