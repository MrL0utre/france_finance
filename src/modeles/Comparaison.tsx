import type { Store } from '../data/store';
import { nbElements, type Ajustements } from '../data/simulation';
import { CALIBRATIONS, MODELES } from './registre';
import { CALIBRATION_NEUTRE } from './moteur';
import { contexteDe, impulsionsDe, impulsionsPluriannuelles } from './impulsions';
import { projeter } from './trajectoire';
import { Projection } from './Projection';
import { HORIZON } from '../pilotage/BlocChantiers';
import { euros, eurosSigne, nombre } from '../format';

/** Première année projetée : l'exercice qui suit celui des données. */
const PREMIERE_ANNEE = 2026;

/**
 * Tableau de bord comparatif.
 *
 * Le même scénario passé dans chaque modèle. L'écart entre les colonnes est
 * l'information principale : il mesure ce que le choix d'hypothèses, et non les
 * données, apporte au résultat.
 */
export function Comparaison({
  store,
  ajustements,
  actif,
  onChoisir,
}: {
  store: Store;
  ajustements: Ajustements;
  actif: string;
  onChoisir: (id: string) => void;
}) {
  const contexte = contexteDe(store);
  if (!contexte) return <p className="pilotage__vide">Chargement du cadrage macroéconomique…</p>;

  // `nbElements` et non `nbAjustements` : un scénario peut n'être fait que d'un
  // chantier, d'une mesure créée ou d'une variation de taux, sans toucher aucun
  // poste publié.
  if (nbElements(ajustements) === 0) {
    return (
      <div className="comparaison__attente">
        <h2>Comparer les projections</h2>
        <p>
          Construisez d'abord un scénario, dans <strong>Piloter</strong> ou dans
          l'explorateur. Ses effets seront ensuite calculés par chacun des modèles, côte à côte.
        </p>
      </div>
    );
  }

  const impulsions = impulsionsDe(store, ajustements);
  const resultats = MODELES.map((m) => ({ modele: m, effets: m.calculer(impulsions, contexte) }));

  const pluriannuelles = impulsionsPluriannuelles(store, ajustements, HORIZON);
  const calibrationActive = CALIBRATIONS[actif] ?? CALIBRATION_NEUTRE;
  const trajectoire = projeter(calibrationActive, pluriannuelles, contexte, {
    horizonAnnees: HORIZON,
    tauxApparent: store.macro ? store.macro.dette.charge / store.macro.dette.encours : 0,
    premiereAnnee: PREMIERE_ANNEE,
  });

  const soldes = resultats.map((r) => r.effets.soldeVariation);
  const min = Math.min(...soldes);
  const max = Math.max(...soldes);
  const etendue = max - min;
  const echelle = Math.max(...resultats.map((r) => Math.abs(r.effets.soldeVariation)), 1);

  return (
    <div className="comparaison">
      <header className="comparaison__entete">
        <div>
          <h2>Comparer les projections</h2>
          <p>
            Le même scénario, passé dans chaque modèle. Cliquez sur une colonne pour en faire le
            modèle actif des autres vues.
          </p>
        </div>
        {etendue > 0 && (
          <p className="comparaison__ecart">
            <span>Écart entre modèles</span>
            <strong>{euros(etendue)}</strong>
            <em>
              sur l'effet au solde, pour un même scénario de {euros(Math.abs(resultats[0].effets.soldeDirect))}
            </em>
          </p>
        )}
      </header>

      {/* Une seule mention pour toute la page : si un modèle sort du domaine, la
          comparaison entre modèles n'a pas plus de sens que chacun pris à part. */}
      {resultats.some((r) => r.effets.horsDomaine) && (
        <p className="effets__hors-domaine">
          <strong>Ce scénario sort du domaine des modèles.</strong> L'écart d'activité qu'ils
          calculent atteint{' '}
          {Math.max(...resultats.map((r) => Math.abs(r.effets.pibPct)))
            .toFixed(1)
            .replace('.', ',')}{' '}
          % du PIB, quand leurs multiplicateurs sont estimés sur des variations de quelques
          dixièmes de point. Les écarts entre colonnes ci-dessous restent lisibles comme un
          ordre de grandeur relatif ; les montants, non.
        </p>
      )}

      <div className="comparaison__grille">
        {resultats.map(({ modele, effets }) => (
          <button
            key={modele.id}
            type="button"
            className={
              modele.id === actif ? 'comparaison__carte comparaison__carte--actif' : 'comparaison__carte'
            }
            onClick={() => onChoisir(modele.id)}
            aria-pressed={modele.id === actif}
          >
            <h3>
              {modele.nom}
              {modele.id === actif && <span className="comparaison__badge">actif</span>}
            </h3>

            <p className="comparaison__solde">
              <span>Solde final</span>
              <strong className={effets.solde >= 0 ? 'pilotage--positif' : 'pilotage--negatif'}>
                {eurosSigne(effets.solde)}
              </strong>
            </p>

            <div className="comparaison__barre" aria-hidden>
              <span
                className={effets.soldeVariation >= 0 ? 'comparaison--gain' : 'comparaison--perte'}
                style={{ width: `${(Math.abs(effets.soldeVariation) / echelle) * 100}%` }}
              />
            </div>

            <dl>
              <div>
                <dt>Effet au solde</dt>
                <dd>{eurosSigne(effets.soldeVariation)}</dd>
              </div>
              <div>
                <dt>Activité</dt>
                <dd>
                  {effets.pib === 0
                    ? '—'
                    : `${effets.pibPct >= 0 ? '+' : '−'}${Math.abs(effets.pibPct).toFixed(2).replace('.', ',')} %`}
                </dd>
              </div>
              <div>
                <dt>Recettes induites</dt>
                <dd>{effets.recettesInduites === 0 ? '—' : eurosSigne(effets.recettesInduites)}</dd>
              </div>
              <div>
                <dt>Emplois</dt>
                <dd>
                  {effets.emploi === 0
                    ? '—'
                    : `${effets.emploi >= 0 ? '+' : '−'}${nombre(Math.round(Math.abs(effets.emploi)))}`}
                </dd>
              </div>
            </dl>

            <p className="comparaison__limite">{modele.limite}</p>
          </button>
        ))}
      </div>

      <section className="comparaison__projection">
        <h3>
          Projection sur {HORIZON} ans — {resultats.find((r) => r.modele.id === actif)?.modele.nom}
        </h3>
        <Projection trajectoire={trajectoire} />
      </section>

      <p className="pilotage__avertissement">
        <strong>Ces écarts ne mesurent pas une incertitude statistique.</strong> Ils montrent
        combien la conclusion dépend d'hypothèses choisies, sur lesquelles les économistes ne
        s'accordent pas. Aucune des colonnes n'est « la bonne » : leur dispersion est le résultat
        le plus solide de cette page.
      </p>
    </div>
  );
}
