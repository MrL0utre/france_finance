import { CALIBRATIONS, MODELES } from './registre';
import {
  NOTE_CONJONCTURE,
  REFERENCES,
  SANS_REFERENCE,
  SOURCE_REFERENCES,
} from './references';
import { LIBELLES_CANAL, satisfaction, VISAGES } from './satisfaction';
import type { Contexte, Effets, Modele } from './types';
import { LIBELLES_ASSIETTE } from './assiettes';
import { LIBELLES, libelleRecette } from './instruments';
import { euros, eurosSigne, nombre } from '../format';

export function SelecteurModele({
  actif,
  onChoisir,
}: {
  actif: string;
  onChoisir: (id: string) => void;
}) {
  const modele = MODELES.find((m) => m.id === actif) ?? MODELES[0];
  const calibration = CALIBRATIONS[modele.id];

  return (
    <section className="modeles">
      <h3>Modèle de bouclage</h3>
      <p className="modeles__intro">
        Un seul modèle à la fois : en changer recalcule l'ensemble des chiffres.
      </p>

      <div className="modeles__choix" role="radiogroup" aria-label="Modèle de bouclage">
        {MODELES.map((m) => (
          <label key={m.id} className={m.id === actif ? 'modeles__option--actif' : undefined}>
            <input
              type="radio"
              name="modele"
              value={m.id}
              checked={m.id === actif}
              onChange={() => onChoisir(m.id)}
            />
            <span>{m.nom}</span>
          </label>
        ))}
      </div>

      <p className="modeles__resume">{modele.resume}</p>
      <p className="modeles__limite">
        <strong>Ce que ce modèle ne fait pas.</strong> {modele.limite}
      </p>
      {modele.source && (
        <p className="modeles__source">
          <a href={modele.source.url} target="_blank" rel="noreferrer">
            {modele.source.label}
          </a>
        </p>
      )}

      <details className="modeles__references">
        <summary>Comparer aux estimations publiées</summary>
        <p className="modeles__avertissement-ref">
          Nos coefficients ne sont pas extraits de ces travaux : ils sont donnés ici en regard,
          pour que leur plausibilité se juge. Les nomenclatures ne se recouvrent pas exactement,
          le rattachement est donc approximatif.
        </p>
        <table>
          <thead>
            <tr>
              <th scope="col">Estimation publiée</th>
              <th scope="col">Valeur</th>
              <th scope="col">Ici</th>
            </tr>
          </thead>
          <tbody>
            {REFERENCES.map((r) => (
              <tr key={`${r.instrument}-${r.source}-${r.intitule}`}>
                <th scope="row">
                  {r.intitule}
                  <span>{r.source}</span>
                </th>
                <td>{r.valeur}</td>
                <td className="modeles__notre-valeur">
                  {calibration
                    ? calibration.multiplicateurs[r.instrument].toFixed(1).replace('.', ',')
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="modeles__avertissement-ref">
          Aucune estimation publiée ne se rattache directement à{' '}
          {SANS_REFERENCE.map((i) => LIBELLES[i].toLowerCase()).join(', ')} : ces valeurs
          relèvent du seul jugement. {NOTE_CONJONCTURE}
        </p>
        <p className="modeles__source">
          <a href={SOURCE_REFERENCES.url} target="_blank" rel="noreferrer">
            {SOURCE_REFERENCES.label}
          </a>
        </p>
      </details>
    </section>
  );
}

/** Décomposition de l'effet : ce qui vient de la décision, ce qui en découle. */
export function PanneauEffets({
  modele,
  effets,
  contexte,
}: {
  modele: Modele;
  effets: Effets;
  contexte: Contexte;
}) {
  const neutre = effets.pib === 0;

  return (
    <section className="effets">
      <h3>Effets estimés — {modele.nom}</h3>

      {(() => {
        const h = satisfaction(effets, contexte);
        const v = VISAGES[h.humeur];
        return (
          <section className="humeur">
            <div className="humeur__visage" style={{ borderColor: v.couleur }}>
              <span aria-hidden>{v.emoji}</span>
              <div>
                <strong style={{ color: v.couleur }}>{v.label}</strong>
                <em>{h.score >= 0 ? '+' : '−'}{Math.abs(h.score).toFixed(1).replace('.', ',')} points</em>
              </div>
            </div>
            <ul className="humeur__canaux">
              {h.canaux.map((c) => (
                <li key={c.canal}>
                  <span>{LIBELLES_CANAL[c.canal]}</span>
                  <strong className={c.contribution < 0 ? 'humeur--negatif' : undefined}>
                    {c.contribution >= 0 ? '+' : '−'}
                    {Math.abs(c.contribution).toFixed(1).replace('.', ',')}
                  </strong>
                </li>
              ))}
            </ul>
            <p className="humeur__reserve">
              <strong>Ce visage n'est pas une mesure.</strong> Aucune enquête d'opinion n'entre
              ici : c'est une composition des trois quantités ci-dessus, pondérées par des
              coefficients que nous avons choisis. Il dit dans quel sens penche un scénario,
              pas ce que les gens en penseraient. L'activité et l'emploi n'y font qu'un canal,
              parce que le moteur déduit le second du premier par une division.
            </p>
          </section>
        );
      })()}

      <dl className="effets__chaine">
        <div>
          <dt>Décision budgétaire</dt>
          <dd>
            {eurosSigne(effets.soldeDirect)}
            {effets.erosion > 0 && <em>après érosion de l'assiette</em>}
          </dd>
        </div>
        <div className={neutre ? 'effets--inactif' : undefined}>
          <dt>Effet sur l'activité</dt>
          <dd>
            {neutre ? '—' : eurosSigne(effets.pib)}
            {!neutre && (
              <em>
                {effets.pibPct >= 0 ? '+' : '−'}
                {Math.abs(effets.pibPct).toFixed(2).replace('.', ',')} % de PIB
              </em>
            )}
          </dd>
        </div>
        <div className={neutre ? 'effets--inactif' : undefined}>
          <dt>Recettes induites</dt>
          <dd>{neutre ? '—' : eurosSigne(effets.recettesInduites)}</dd>
        </div>
        <div className={neutre ? 'effets--inactif' : undefined}>
          <dt>Emplois, ordre de grandeur</dt>
          <dd>
            {neutre
              ? '—'
              : `${effets.emploi >= 0 ? '+' : '−'}${nombre(Math.round(Math.abs(effets.emploi)))}`}
          </dd>
        </div>
        <div className="effets__total">
          <dt>Effet net sur le solde</dt>
          <dd>{eurosSigne(effets.soldeVariation)}</dd>
        </div>
      </dl>

      {/* Le modèle « Comptable » est celui par défaut : sans cette mention, un
          visiteur qui coupe massivement voit les recettes ne pas bouger et
          conclut que l'outil ignore la rétroaction, alors qu'il a simplement
          choisi — sans le savoir — la calibration qui n'en calcule aucune. */}
      {neutre && effets.lignes.length > 0 && (
        <p className="effets__sans-retroaction">
          <strong>Cette calibration ne calcule aucune rétroaction.</strong> Les recettes
          affichées ne tiennent donc pas compte de l'effet du scénario sur l'activité : ni le
          recul des impôts si elle se contracte, ni leur reprise si elle repart. Choisissez une
          autre calibration ci-dessus pour le voir chiffré.
        </p>
      )}

      {/* Un modèle linéaire à multiplicateurs constants rend un nombre pour
          n'importe quel choc, y compris ceux qu'aucune économie n'a connus.
          Sans cette mention, rien ne distingue à l'écran un chiffrage d'une
          extrapolation cinquante fois hors de portée. */}
      {effets.horsDomaine && (
        <p className="effets__hors-domaine">
          <strong>Ce résultat sort du domaine du modèle.</strong> L'écart d'activité atteint{' '}
          {Math.abs(effets.pibPct).toFixed(1).replace('.', ',')} % du PIB, quand les
          multiplicateurs employés ici sont estimés sur des variations de quelques dixièmes de
          point. La linéarité ne tient plus à cette échelle : les chiffres ci-dessous
          illustrent le sens d'un mécanisme, ils ne chiffrent rien.
        </p>
      )}

      {/* Cadrage incomplet : l'activité bouge mais aucune assiette n'est
          disponible pour y répondre. Le cas se produit quand un navigateur a
          gardé en cache un fichier de cadrage antérieur. Le dire vaut mieux
          qu'afficher une rétroaction nulle qui passerait pour un résultat. */}
      {effets.pib !== 0 && effets.recettesInduitesParInstrument.length === 0 && (
        <p className="effets__sans-retroaction">
          <strong>Cadrage des recettes indisponible.</strong> L'effet sur l'activité est
          calculé, mais la ventilation des recettes par nature manque : l'effet sur les
          prélèvements ne peut pas l'être. Rechargez la page pour récupérer le cadrage à jour.
        </p>
      )}

      {effets.erosion > 0 && (
        <p className="effets__erosion">
          <strong>{euros(effets.erosion)} de la hausse décidée ne seront pas encaissés.</strong>{' '}
          Une assiette réagit au taux qu'on lui applique : les revenus élevés et les capitaux
          sont mobiles, les entreprises ferment ou se déplacent, une part de l'activité cesse
          d'être déclarée.{' '}
          {effets.saturation && (
            <>
              <strong>Au moins un prélèvement est relevé au-delà du point où il rapporte
              encore&nbsp;:</strong> en augmenter le taux réduit désormais son rendement.{' '}
            </>
          )}
          <em>
            Ce mécanisme est le plus grossier du modèle. Ses coefficients sont des ordres de
            grandeur choisis, extraits d'aucune publication : ils disent un sens et une
            hiérarchie, pas une ampleur. La perte d'activité que cette érosion entraîne n'est
            pas comptée à part — seul le manque à gagner fiscal l'est.
          </em>
        </p>
      )}

      {effets.recettesInduitesParInstrument.length > 0 && (
        <table className="effets__table effets__impots">
          <caption>
            Ce que l'activité fait aux prélèvements. Chacun la reçoit par son assiette : le
            facteur combine la réaction de l'assiette à l'activité et celle de l'impôt à son
            assiette.
          </caption>
          <thead>
            <tr>
              <th scope="col">Prélèvement</th>
              <th scope="col">Assiette</th>
              <th scope="col">Facteur</th>
              <th scope="col">Effet</th>
            </tr>
          </thead>
          <tbody>
            {effets.recettesInduitesParInstrument.map((l) => (
              <tr key={l.instrument}>
                <th scope="row">{libelleRecette(l.instrument)}</th>
                <td>{l.assiette ? LIBELLES_ASSIETTE[l.assiette] : 'aucune'}</td>
                <td>{l.facteur.toFixed(2).replace('.', ',')}</td>
                <td>{eurosSigne(l.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!neutre && (
        <p className="effets__recuperation">
          {(() => {
            const recup = effets.soldeDirect === 0
              ? 0
              : 1 - Math.abs(effets.soldeVariation) / Math.abs(effets.soldeDirect);
            return `La rétroaction récupère ${Math.round(recup * 100)} % de l'effort budgétaire : sur ${euros(Math.abs(effets.soldeDirect))} décidés, ${euros(Math.abs(effets.soldeVariation))} se retrouvent au solde.`;
          })()}
        </p>
      )}

      {effets.lignes.length > 0 && (
        <table className="effets__table">
          <thead>
            <tr>
              <th scope="col">Mesure</th>
              <th scope="col">Instrument retenu</th>
              <th scope="col">Encaissé</th>
              <th scope="col">Multiplicateur</th>
              <th scope="col">Effet activité</th>
            </tr>
          </thead>
          <tbody>
            {effets.lignes.map((l) => (
              <tr key={l.label}>
                <th scope="row">{l.label}</th>
                <td>{LIBELLES[l.instrument]}</td>
                <td>
                  {l.rendementReel === l.delta ? '—' : eurosSigne(l.rendementReel)}
                </td>
                <td>{l.multiplicateur.toFixed(2).replace('.', ',')}</td>
                <td>{l.effetPib === 0 ? '—' : eurosSigne(l.effetPib)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
