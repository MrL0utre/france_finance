import type { Trajectoire } from './trajectoire';
import { euros, eurosSigne, nombre } from '../format';

/**
 * Sentier année par année d'un scénario.
 *
 * Tout est exprimé en écart au scénario de référence : aucune prévision de
 * croissance ni de solde tendanciel n'est faite. Le graphique répond à « ce que
 * le scénario change », pas à « où en seront les finances publiques ».
 */
export function Projection({ trajectoire }: { trajectoire: Trajectoire }) {
  const { annees } = trajectoire;
  if (annees.length === 0) return null;

  const echelleSolde = Math.max(...annees.map((a) => Math.abs(a.soldeVariation)), 1);
  const echelleDette = Math.max(...annees.map((a) => Math.abs(a.detteEcart)), 1);

  return (
    <div className="projection">
      <div className="projection__resume">
        <div>
          <span>Dette après {annees.length} ans</span>
          <strong className={trajectoire.detteFinale >= 0 ? 'pilotage--positif' : 'pilotage--negatif'}>
            {eurosSigne(trajectoire.detteFinale)}
          </strong>
        </div>
        <div>
          <span>dont intérêts cumulés</span>
          <strong className={trajectoire.interetsCumules > 0 ? 'pilotage--negatif' : undefined}>
            {trajectoire.interetsCumules > 0 ? `− ${euros(trajectoire.interetsCumules)}` : '—'}
          </strong>
        </div>
        <div>
          <span>Pic d'activité</span>
          <strong>
            {trajectoire.picActivite
              ? `${eurosSigne(trajectoire.picActivite.pib)} en ${trajectoire.picActivite.annee}`
              : '—'}
          </strong>
        </div>
      </div>

      <table className="projection__table">
        <thead>
          <tr>
            <th scope="col">Année</th>
            <th scope="col">Solde</th>
            <th scope="col">Dette cumulée</th>
            <th scope="col">Intérêts</th>
            <th scope="col">Recettes</th>
            <th scope="col">Activité</th>
            <th scope="col">Emplois</th>
          </tr>
        </thead>
        <tbody>
          {annees.map((a) => (
            <tr key={a.annee}>
              <th scope="row">{a.annee}</th>

              <td>
                <span className="projection__barre" aria-hidden>
                  <span
                    className={a.soldeVariation >= 0 ? 'projection--gain' : 'projection--perte'}
                    style={{ width: `${(Math.abs(a.soldeVariation) / echelleSolde) * 100}%` }}
                  />
                </span>
                {Math.abs(a.soldeVariation) < 1e6 ? '—' : eurosSigne(a.soldeVariation)}
              </td>

              <td>
                <span className="projection__barre" aria-hidden>
                  <span
                    className={a.detteEcart >= 0 ? 'projection--gain' : 'projection--perte'}
                    style={{ width: `${(Math.abs(a.detteEcart) / echelleDette) * 100}%` }}
                  />
                </span>
                {Math.abs(a.detteEcart) < 1e6 ? '—' : eurosSigne(a.detteEcart)}
              </td>

              <td className={a.chargeInterets > 0 ? 'pilotage--negatif' : undefined}>
                {a.chargeInterets < 1e6 ? '—' : `− ${euros(a.chargeInterets)}`}
              </td>

              {/* Ce que le scénario rapporte réellement, année après année :
                  la décision une fois l'assiette érodée et plafonnée, plus ce
                  que l'activité modifiée y ajoute ou en retire. */}
              <td className={a.recettesEcart < 0 ? 'pilotage--negatif' : undefined}>
                {Math.abs(a.recettesEcart) < 1e6 ? '—' : eurosSigne(a.recettesEcart)}
              </td>

              <td>
                {Math.abs(a.pib) < 1e6
                  ? '—'
                  : `${a.pibPct >= 0 ? '+' : '−'}${Math.abs(a.pibPct).toFixed(2).replace('.', ',')} %`}
              </td>

              <td>
                {Math.abs(a.emploi) < 100
                  ? '—'
                  : `${a.emploi >= 0 ? '+' : '−'}${nombre(Math.round(Math.abs(a.emploi)))}`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="projection__note">
        Écarts au scénario de référence, jamais des niveaux : la projection ne prévoit ni
        croissance, ni inflation, ni solde tendanciel. La dette cumule les écarts de solde et porte
        intérêt au taux apparent de la dette existante, ce qui alimente la boucle d'une année sur
        l'autre. Un ajustement de poste est supposé reconduit chaque année ; un chantier s'arrête
        au terme de sa durée.
      </p>
      <p className="projection__note">
        <strong>Une mesure permanente donne ici la même ligne chaque année</strong>, et c'est une
        limite du moteur plutôt qu'un résultat. Il est statique : l'assiette de l'année suivante
        reste celle des comptes publiés, alors qu'une activité durablement plus faible la
        réduirait, et que les mêmes taux y rapporteraient donc moins. Ce qui s'accumule d'une
        année sur l'autre, c'est la dette et sa charge — pas l'érosion de la matière imposable.
      </p>
    </div>
  );
}
