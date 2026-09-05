import type { BaremeIR } from '../schema';
import { baremeReforme, impotFoyer } from './bareme';
import { euros, eurosPrecis, eurosPrecisSigne, nombre, pourcent } from '../format';

/** Pas d'un clic sur un taux, en points. */
const PAS_TAUX = 0.5;

export function PanneauBareme({
  bareme,
  reformes,
  onTranche,
}: {
  bareme: BaremeIR;
  reformes: Record<string, { taux?: number; seuil?: number }>;
  onTranche: (indice: number, champ: 'taux' | 'seuil', valeur: number | undefined) => void;
}) {
  const indices: Record<number, { taux?: number; seuil?: number }> = {};
  for (const [k, v] of Object.entries(reformes)) indices[Number(k)] = v;

  const reforme = baremeReforme(bareme.tranches, indices);
  const modifie = Object.keys(reformes).length > 0;

  const parametres = {
    tranches: bareme.tranches,
    decote: bareme.decote,
    plafondDemiPart: bareme.plafondDemiPart,
  };
  const parametresReformes = { ...parametres, tranches: reforme };

  return (
    <section className="bareme">
      <h3>Barème de l'impôt sur le revenu</h3>
      <p className="bareme__intro">
        Revenus {bareme.exercice}. Les seuils s'appliquent au revenu net imposable divisé par le
        nombre de parts. Législation reprise d'OpenFisca, référencée à l'{bareme.reference}.
      </p>

      <table className="bareme__table">
        <thead>
          <tr>
            <th scope="col">Tranche</th>
            <th scope="col">Seuil d'entrée</th>
            <th scope="col">Taux</th>
          </tr>
        </thead>
        <tbody>
          {bareme.tranches.map((t, i) => {
            const tauxReforme = indices[i]?.taux;
            const seuilReforme = indices[i]?.seuil;
            const taux = tauxReforme ?? t.taux;
            const seuil = seuilReforme ?? t.seuil;
            const suivant = bareme.tranches[i + 1];

            return (
              <tr key={i} className={indices[i] ? 'bareme__ligne--modifiee' : undefined}>
                <th scope="row">
                  {suivant
                    ? `De ${nombre(seuil)} à ${nombre(seuilReforme !== undefined || indices[i + 1]?.seuil !== undefined ? (indices[i + 1]?.seuil ?? suivant.seuil) : suivant.seuil)} €`
                    : `Au-delà de ${nombre(seuil)} €`}
                </th>

                <td>
                  {i === 0 ? (
                    <span className="bareme__fixe">—</span>
                  ) : (
                    <input
                      type="number"
                      className="bareme__seuil"
                      value={seuil}
                      min={0}
                      step={100}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        onTranche(i, 'seuil', Number.isFinite(v) && v !== t.seuil ? v : undefined);
                      }}
                      aria-label={`Seuil d'entrée de la tranche ${i + 1}`}
                    />
                  )}
                  {seuilReforme !== undefined && (
                    <em className="bareme__initial">au lieu de {nombre(t.seuil)}</em>
                  )}
                </td>

                <td>
                  <span className="pilotage__stepper">
                    <button
                      type="button"
                      onClick={() => regler(i, taux - PAS_TAUX / 100, t.taux, onTranche)}
                      disabled={taux <= 0}
                      aria-label={`Diminuer le taux de la tranche ${i + 1}`}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      value={Math.round(taux * 1000) / 10}
                      min={0}
                      max={100}
                      step={PAS_TAUX}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        if (Number.isFinite(v)) regler(i, v / 100, t.taux, onTranche);
                      }}
                      aria-label={`Taux de la tranche ${i + 1}`}
                    />
                    <span className="pilotage__unite">%</span>
                    <button
                      type="button"
                      onClick={() => regler(i, taux + PAS_TAUX / 100, t.taux, onTranche)}
                      disabled={taux >= 1}
                      aria-label={`Augmenter le taux de la tranche ${i + 1}`}
                    >
                      +
                    </button>
                  </span>
                  {tauxReforme !== undefined && (
                    <em className="bareme__initial">au lieu de {pourcent(t.taux)}</em>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4>
        Effet sur des foyers types
        {modifie && <span className="bareme__badge">barème modifié</span>}
      </h4>

      <table className="bareme__cas">
        <thead>
          <tr>
            <th scope="col">Foyer</th>
            <th scope="col">Salaire annuel</th>
            <th scope="col">Impôt actuel</th>
            <th scope="col">Impôt simulé</th>
            <th scope="col">Écart</th>
          </tr>
        </thead>
        <tbody>
          {bareme.casTypes.map((c) => {
            const simule = impotFoyer(c.rni, c.parts, c.declarants, parametresReformes);
            const ecart = simule - c.impot;
            return (
              <tr key={c.id}>
                <th scope="row">{c.libelle}</th>
                <td>{nombre(c.salaire)} €</td>
                <td>{eurosPrecis(c.impot)}</td>
                <td>{eurosPrecis(simule)}</td>
                <td
                  className={
                    Math.abs(ecart) < 1
                      ? undefined
                      : ecart > 0
                        ? 'bareme--hausse'
                        : 'bareme--baisse'
                  }
                >
                  {Math.abs(ecart) < 1 ? '—' : eurosPrecisSigne(ecart)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <p className="bareme__avertissement">
        <strong>Cet effet ne remonte pas au solde.</strong> Connaître le rendement d'une réforme du
        barème suppose de savoir combien de foyers occupent chaque tranche et quels revenus s'y
        trouvent — une statistique que la DGFiP ne publie pas en données ouvertes exploitables. Ce
        panneau dit donc <em>qui</em> paie combien, pas <em>combien cela rapporte</em>. Pour agir
        sur l'agrégat, utilisez le levier « Impôt sur le revenu » dans la colonne Recettes.
      </p>

      <p className="bareme__note">
        Le calcul couvre le barème, le quotient familial et son plafonnement à{' '}
        {euros(bareme.plafondDemiPart)} par demi-part, ainsi que la décote. Il ne couvre ni les
        réductions et crédits d'impôt, ni les demi-parts particulières, ni les abattements
        d'outre-mer. Chaque cas type affiché a été vérifié contre OpenFisca à la construction des
        données — écart maximal constaté {eurosPrecis(bareme.ecartMaximal)}.
      </p>

      <p className="bareme__source">
        <a href={bareme.source.url} target="_blank" rel="noreferrer">
          {bareme.source.label}
        </a>{' '}
        · millésime {bareme.millesime}
      </p>
    </section>
  );
}

function regler(
  indice: number,
  valeur: number,
  origine: number,
  onTranche: (i: number, champ: 'taux' | 'seuil', v: number | undefined) => void,
): void {
  const borne = Math.max(0, Math.min(1, Math.round(valeur * 1000) / 1000));
  onTranche(indice, 'taux', Math.abs(borne - origine) < 1e-9 ? undefined : borne);
}
