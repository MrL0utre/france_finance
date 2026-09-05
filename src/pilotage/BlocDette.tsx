import type { Dette } from '../schema';
import { effetTaux } from '../modeles/dette';
import { euros, eurosSigne } from '../format';

/** Pas d'un clic, en points de pourcentage. */
const PAS = 0.1;
const BORNE = 3;

/**
 * Pilotage de la charge de la dette.
 *
 * Le levier n'est pas un pourcentage appliqué à une ligne budgétaire mais une
 * variation du taux d'emprunt, dont l'effet dépend du rythme de renouvellement
 * de la dette. La distinction entre la première année et le terme est le cœur du
 * bloc : c'est elle qui distingue une estimation défendable d'un chiffre faux
 * d'un facteur dix.
 */
export function BlocDette({
  dette,
  points,
  onPoints,
  onVoirCharge,
}: {
  dette: Dette;
  points: number;
  onPoints: (points: number) => void;
  onVoirCharge: () => void;
}) {
  const effet = effetTaux(dette, points);
  const chargeSimulee = dette.charge + effet.chargeAnnee1;

  return (
    <section className="dette">
      <h3>Dette et taux d'emprunt</h3>

      <dl className="dette__reperes">
        <div>
          <dt>Encours négociable</dt>
          <dd>{euros(dette.encours)}</dd>
        </div>
        <div>
          <dt>Charge annuelle</dt>
          <dd>
            <button type="button" className="dette__lien" onClick={onVoirCharge}>
              {euros(dette.charge)}
            </button>
          </dd>
        </div>
        <div>
          <dt>Taux apparent</dt>
          <dd>{(effet.tauxApparent * 100).toFixed(2).replace('.', ',')} %</dd>
        </div>
        <div>
          <dt>Durée de vie moyenne</dt>
          <dd>{dette.dureeVieMoyenneAnnees.toFixed(1).replace('.', ',')} ans</dd>
        </div>
      </dl>

      <div className="dette__levier">
        <span className="dette__label">Variation du taux d'emprunt</span>
        <span className="pilotage__stepper">
          <button
            type="button"
            onClick={() => onPoints(arrondir(points - PAS))}
            disabled={points <= -BORNE}
            aria-label="Diminuer le taux d'emprunt"
          >
            −
          </button>
          <input
            type="number"
            value={points}
            min={-BORNE}
            max={BORNE}
            step={PAS}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) onPoints(Math.max(-BORNE, Math.min(BORNE, v)));
            }}
            aria-label="Variation du taux d'emprunt, en points"
          />
          <span className="pilotage__unite">pt</span>
          <button
            type="button"
            onClick={() => onPoints(arrondir(points + PAS))}
            disabled={points >= BORNE}
            aria-label="Augmenter le taux d'emprunt"
          >
            +
          </button>
        </span>
        {points !== 0 && (
          <button type="button" className="dette__annuler" onClick={() => onPoints(0)}>
            Annuler
          </button>
        )}
      </div>

      {points !== 0 && (
        <dl className="dette__effets">
          <div>
            <dt>Charge la première année</dt>
            <dd>
              {euros(chargeSimulee)} <em>{eurosSigne(effet.chargeAnnee1)}</em>
            </dd>
          </div>
          <div>
            <dt>Charge à terme, dette entièrement renouvelée</dt>
            <dd>
              {euros(dette.charge + effet.chargeATerme)}{' '}
              <em>{eurosSigne(effet.chargeATerme)}</em>
            </dd>
          </div>
        </dl>
      )}

      <p className="dette__note">
        <strong>Un État ne renégocie pas sa dette.</strong> {dette.note} Seul l'effet de la
        première année entre dans le solde simulé ; celui à terme n'est donné qu'en repère, et
        serait atteint dans {dette.dureeVieMoyenneAnnees.toFixed(1).replace('.', ',')} ans environ.
      </p>

      <p className="dette__source">
        <a href={dette.source.url} target="_blank" rel="noreferrer">
          {dette.source.label}
        </a>{' '}
        · encours au {dette.dateEncours}
      </p>
    </section>
  );
}

function arrondir(v: number): number {
  return Math.round(v * 100) / 100;
}
