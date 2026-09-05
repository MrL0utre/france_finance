import type { Mode, Node } from '../schema';
import { euros, eurosSigne } from '../format';
import type { Cote } from '../data/simulation';

/**
 * Curseur d'ajustement d'un nœud.
 *
 * Il n'agit qu'en mode dépenses ou recettes : ce sont les deux grandeurs qu'on
 * décide réellement. Le solde n'est pas un levier, c'est un résultat — proposer
 * de le régler directement laisserait croire qu'on peut le fixer sans rien
 * changer d'autre.
 */
export function Curseur({
  node,
  mode,
  facteur,
  herite,
  simule,
  onChange,
}: {
  node: Node;
  mode: Mode;
  facteur: number;
  /** Montant après les ajustements des parents, avant celui-ci. */
  herite: number;
  simule: number;
  onChange: (facteur: number) => void;
}) {
  if (mode === 'solde') {
    return (
      <section className="curseur">
        <h3>Simuler</h3>
        <p className="curseur__indispo">
          Le solde est un résultat, pas un levier. Passez en <strong>Dépenses</strong> ou{' '}
          <strong>Recettes</strong> pour agir, et revenez ici pour en lire l'effet.
        </p>
      </section>
    );
  }

  const cote: Cote = mode === 'recettes' ? 'rec' : 'dep';
  const base = node[cote];

  if (base === 0) {
    return (
      <section className="curseur">
        <h3>Simuler</h3>
        <p className="curseur__indispo">
          Ce poste n'a pas de {mode === 'recettes' ? 'recette' : 'dépense'} à ajuster.
        </p>
      </section>
    );
  }

  const pourcent = Math.round((facteur - 1) * 100);
  // L'écart est mesuré depuis le montant hérité, pas depuis le montant publié :
  // c'est ce que ce curseur ajoute réellement au scénario.
  const ecart = simule - herite;
  const partHeritee = herite - base;

  return (
    <section className="curseur">
      <h3>
        Simuler {mode === 'recettes' ? 'les recettes' : 'les dépenses'}
        {facteur !== 1 && (
          <button type="button" className="curseur__reset" onClick={() => onChange(1)}>
            Annuler
          </button>
        )}
      </h3>

      <div className="curseur__ligne">
        <span className="curseur__borne">−100 %</span>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={pourcent}
          onChange={(e) => onChange(1 + Number(e.target.value) / 100)}
          aria-label={`Ajuster ${node.label}`}
        />
        <span className="curseur__borne">+100 %</span>
      </div>

      <div className={`curseur__valeur${ecart === 0 ? '' : ecart > 0 ? ' curseur__valeur--hausse' : ' curseur__valeur--baisse'}`}>
        <strong>{pourcent > 0 ? `+${pourcent}` : pourcent} %</strong>
        <span>
          {euros(herite)} → {euros(simule)}
        </span>
        <span className="curseur__ecart">{ecart === 0 ? '—' : eurosSigne(ecart)}</span>
      </div>

      {Math.abs(partHeritee) > 1 && (
        <p className="curseur__portee">
          Ce poste est publié à {euros(base)} ; il part de {euros(herite)} parce qu'un ajustement
          posé plus haut lui applique déjà {eurosSigne(partHeritee)}.
        </p>
      )}

      {facteur !== 1 && (
        <p className="curseur__portee">
          L'ajustement s'applique à tout ce que contient ce poste, et remonte dans les totaux
          au-dessus de lui.
        </p>
      )}
    </section>
  );
}
