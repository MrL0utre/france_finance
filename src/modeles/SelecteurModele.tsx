import { CALIBRATIONS, MODELES } from './registre';
import {
  NOTE_CONJONCTURE,
  REFERENCES,
  SANS_REFERENCE,
  SOURCE_REFERENCES,
} from './references';
import type { Effets, Modele } from './types';
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
export function PanneauEffets({ modele, effets }: { modele: Modele; effets: Effets }) {
  const neutre = effets.pib === 0;

  return (
    <section className="effets">
      <h3>Effets estimés — {modele.nom}</h3>

      <dl className="effets__chaine">
        <div>
          <dt>Décision budgétaire</dt>
          <dd>{eurosSigne(effets.soldeDirect)}</dd>
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

      {effets.recettesInduitesParInstrument.length > 0 && (
        <table className="effets__table effets__impots">
          <caption>
            Ce que l'activité fait aux prélèvements — chaque impôt réagit selon sa propre
            sensibilité, un barème progressif plus vite qu'une taxe sur la consommation.
          </caption>
          <thead>
            <tr>
              <th scope="col">Prélèvement</th>
              <th scope="col">Sensibilité</th>
              <th scope="col">Effet</th>
            </tr>
          </thead>
          <tbody>
            {effets.recettesInduitesParInstrument.map((l) => (
              <tr key={l.instrument}>
                <th scope="row">{libelleRecette(l.instrument)}</th>
                <td>
                  {(CALIBRATIONS[modele.id]?.elasticitesRecettes[l.instrument] ?? 0)
                    .toFixed(1)
                    .replace('.', ',')}
                </td>
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
              <th scope="col">Multiplicateur</th>
              <th scope="col">Effet activité</th>
            </tr>
          </thead>
          <tbody>
            {effets.lignes.map((l) => (
              <tr key={l.label}>
                <th scope="row">{l.label}</th>
                <td>{LIBELLES[l.instrument]}</td>
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
