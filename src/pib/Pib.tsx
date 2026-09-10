import { libellesNature, type Pib as DonneesPib } from '../schema';
import { euros, eurosSigne } from '../format';
import type { Effets } from '../modeles/types';

/**
 * Décomposition du produit intérieur brut.
 *
 * Onglet d'information : rien ici ne réagit aux curseurs. Il répond à une
 * question que l'outil laissait sans réponse — 1 490,9 Md € de dépense
 * publique, rapportés à quoi ? — en donnant l'échelle, et il prévient du piège
 * que cette mise en regard tend aussitôt.
 *
 * Deux formes, parce que les deux jeux ne font pas le même travail. Les
 * composantes de la demande portent des signes opposés : certaines s'ajoutent,
 * les importations se retranchent. C'est une polarité, donc des barres
 * divergentes de part et d'autre d'une ligne zéro. Les branches, elles, sont
 * onze parts positives d'un même total : c'est une comparaison d'ampleur, donc
 * des barres triées d'une seule teinte, la longueur portant la grandeur. Onze
 * teintes distinctes seraient illisibles et n'apporteraient aucune information
 * que le tri ne donne déjà.
 */

const PART = (montant: number, total: number) => (montant / total) * 100;
// Le signe moins typographique, comme partout ailleurs dans l'application : le
// trait d'union se distingue mal d'un tiret de coupure devant un chiffre.
const pct = (v: number) => `${v.toFixed(1).replace('.', ',').replace('-', '−')} %`;

export function Pib({
  pib,
  depensePublique,
  depenseSimulee,
  effets,
}: {
  pib: DonneesPib | null;
  depensePublique: number;
  /** Dépense publique telle que le scénario la laisse. */
  depenseSimulee: number;
  effets: Effets | null;
}) {
  if (!pib) {
    return (
      <p className="pilotage__vide">
        La décomposition du produit intérieur brut n'a pas pu être chargée. Rechargez la page.
      </p>
    );
  }

  const nature = libellesNature(pib.source.nature);

  /**
   * Effet du scénario sur le total, et sur lui seul.
   *
   * L'écart d'activité que le moteur calcule est un agrégat. Le répartir entre
   * composantes ou entre branches demanderait des hypothèses supplémentaires —
   * un tableau entrées-sorties pour les secondes — que ce projet ne pose pas.
   * Les deux décompositions restent donc celles du compte publié, et la page le
   * dit plutôt que de laisser croire qu'elles ont bougé.
   */
  const scenario =
    effets && effets.pib !== 0
      ? {
          pib: pib.total + effets.pib,
          ecart: effets.pib,
          ecartPct: (effets.pib / pib.total) * 100,
        }
      : null;
  // L'échelle des barres divergentes est donnée par le plus gros terme, quel
  // que soit son signe : sans quoi les importations sortiraient du cadre.
  const ampleur = Math.max(...pib.composantes.map((c) => Math.abs(c.montant)));
  const plusGrandeBranche = Math.max(...pib.branches.map((b) => b.montant));

  return (
    <div className="pib">
      <section className="pib__echelle">
        <div>
          <span>Produit intérieur brut {pib.exercice}</span>
          <strong>{euros(scenario ? scenario.pib : pib.total)}</strong>
          {scenario && <em className="pib__avant">({euros(pib.total)} sans scénario)</em>}
        </div>
        <div>
          <span>Dépense publique affichée par cet outil</span>
          <strong>{euros(scenario ? depenseSimulee : depensePublique)}</strong>
          <em>
            {pct(
              scenario ? PART(depenseSimulee, scenario.pib) : PART(depensePublique, pib.total),
            )}{' '}
            du PIB
          </em>
          {scenario && (
            <em className="pib__avant">
              ({euros(depensePublique)} et {pct(PART(depensePublique, pib.total))} sans scénario)
            </em>
          )}
        </div>
      </section>

      {scenario && (
        <p className="pib__scenario">
          <strong>Votre scénario déplace l'activité de {eurosSigne(scenario.ecart)}</strong>, soit{' '}
          {pct(scenario.ecartPct)} du produit intérieur brut. Le ratio de dépense publique
          bouge des deux côtés à la fois : ce qui est dépensé, et l'économie sur laquelle on
          le rapporte. Couper une dépense peut ainsi relever ce ratio, si l'activité recule
          davantage que la dépense.
        </p>
      )}

      <p className="pib__alerte">
        <strong>Ces deux montants ne se soustraient pas.</strong> {pib.noteDepensePublique}
      </p>

      <section className="pib__bloc">
        <h3>Par la demande</h3>
        <p className="pib__intro">
          Ce qui est consommé, investi et exporté, moins ce qui est importé. Les termes en rouge
          se retranchent&nbsp;: ils portent un montant négatif dans l'équation.
        </p>
        <ul className="pib__divergent">
          {pib.composantes.map((c) => {
            const largeur = (Math.abs(c.montant) / ampleur) * 50;
            const negatif = c.montant < 0;
            return (
              <li key={c.code}>
                <span className="pib__nom">{c.label}</span>
                <span className="pib__piste" aria-hidden>
                  <span
                    className={negatif ? 'pib__barre pib__barre--negative' : 'pib__barre'}
                    style={
                      negatif
                        ? { right: '50%', width: `${largeur}%` }
                        : { left: '50%', width: `${largeur}%` }
                    }
                  />
                </span>
                <span className="pib__valeur">{eurosSigne(c.montant)}</span>
              </li>
            );
          })}
        </ul>
        <p className="pib__somme">
          Somme&nbsp;: {euros(pib.composantes.reduce((s, c) => s + c.montant, 0))} — le produit
          intérieur brut lui-même. Le pipeline le vérifie à chaque construction.
        </p>
      </section>

      <section className="pib__bloc">
        <h3>Par les branches</h3>
        <p className="pib__intro">
          La valeur ajoutée de chaque branche, plus les impôts sur les produits nets des
          subventions. Même total, lu autrement.
        </p>
        <ul className="pib__barres">
          {[...pib.branches]
            .sort((a, b) => b.montant - a.montant)
            .map((b) => (
              <li key={b.code}>
                <span className="pib__nom">{b.label}</span>
                <span className="pib__piste" aria-hidden>
                  <span
                    className="pib__barre"
                    style={{ width: `${(b.montant / plusGrandeBranche) * 100}%` }}
                  />
                </span>
                <span className="pib__valeur">
                  {euros(b.montant)}
                  <em>{pct(PART(b.montant, pib.total))}</em>
                </span>
              </li>
            ))}
        </ul>
      </section>

      <section className="pib__bloc">
        <h3>Lire ces chiffres</h3>
        <p className="pib__note">{pib.note}</p>
        <p className="pib__note">{pib.noteDenominateur}</p>
        <p className="pib__note">
          <strong>Les deux décompositions ci-dessus ne bougent pas avec vos scénarios</strong>,
          seul le total le fait. Répartir un écart d'activité entre composantes de la demande
          demanderait de savoir où il se loge&nbsp;; le répartir entre branches demanderait un
          tableau entrées-sorties, que cet outil n'utilise pas. Les afficher modifiées sans ces
          hypothèses reviendrait à inventer une précision.
        </p>
        <p className="pib__source">
          <a href={pib.source.url} target="_blank" rel="noreferrer">
            {pib.source.label}
          </a>{' '}
          <span className="sommaire__nature" title={nature.long}>
            {nature.court} {pib.source.exercice}
          </span>
        </p>
        {/* Mention de paternité : c'est la seule obligation attachée à ces
            données, et elle appelle un lecteur, pas un fichier de données. */}
        <p className="pib__source pib__paternite">
          Jeux de données {pib.source.dataset}. © Union européenne — réutilisation autorisée
          moyennant mention de la source, qui ne vaut pas aval du producteur.
        </p>
      </section>
    </div>
  );
}
