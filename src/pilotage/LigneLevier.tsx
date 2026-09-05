import { nbEnfants, type Node } from '../schema';
import type { Store } from '../data/store';
import {
  facteurDe,
  montantHerite,
  montantSimule,
  type Ajustements,
  type Cote,
} from '../data/simulation';
import { euros, eurosSigne } from '../format';

/** Un clic sur « + » ou « − » déplace le taux d'un point. */
export const PAS = 1;
export const BORNE = 100;

export type Levier = {
  id: string;
  label: string;
  cote: Cote;
  /** Montant publié, avant toute simulation. */
  base: number;
};

/**
 * Ligne de réglage d'un poste, commune au tableau de bord et aux panneaux de
 * détail. Elle affiche le montant simulé, l'écart au montant publié, et signale
 * le cas où le poste part déjà d'un montant modifié par un ajustement supérieur.
 */
export function LigneLevier({
  levier,
  store,
  ajustements,
  onRegler,
  onOuvrir,
}: {
  levier: Levier;
  store: Store;
  ajustements: Ajustements;
  onRegler: (levier: Levier, facteur: number) => void;
  /** Fourni quand le poste se décompose : ouvre son panneau de détail. */
  onOuvrir?: (id: string) => void;
}) {
  const noeud = store.nodes.get(levier.id);
  const facteur = facteurDe(ajustements, levier.id, levier.cote);
  const pourcent = Math.round((facteur - 1) * 100);

  const herite = noeud ? montantHerite(store, ajustements, noeud, levier.cote) : levier.base;
  const simule = noeud ? montantSimule(store, ajustements, noeud, levier.cote) : levier.base;
  const ecart = simule - levier.base;

  const decomposable = !!onOuvrir && !!noeud && nombreEnfants(noeud, levier.cote) > 0;

  return (
    <li className={pourcent === 0 ? undefined : 'pilotage__ligne--modifiee'}>
      <span className="pilotage__label" title={levier.label}>
        {levier.label}
      </span>

      <span className="pilotage__stepper">
        <button
          type="button"
          onClick={() => onRegler(levier, (pourcent - PAS) / 100 + 1)}
          disabled={pourcent <= -BORNE}
          aria-label={`Diminuer ${levier.label}`}
        >
          −
        </button>
        <input
          type="number"
          value={pourcent}
          min={-BORNE}
          max={BORNE}
          step={PAS}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v)) onRegler(levier, v / 100 + 1);
          }}
          aria-label={`Taux appliqué à ${levier.label}, en pourcentage`}
        />
        <span className="pilotage__unite">%</span>
        <button
          type="button"
          onClick={() => onRegler(levier, (pourcent + PAS) / 100 + 1)}
          disabled={pourcent >= BORNE}
          aria-label={`Augmenter ${levier.label}`}
        >
          +
        </button>
      </span>

      <span className="pilotage__montant">
        {euros(simule)}
        {Math.abs(ecart) > 1 && <em>{eurosSigne(ecart)}</em>}
        {Math.abs(herite - levier.base) > 1 && (
          <span
            className="pilotage__herite"
            title={`Ce poste est publié à ${euros(levier.base)}. Un ajustement posé plus haut le fait partir de ${euros(herite)}.`}
          >
            hérité
          </span>
        )}
      </span>

      <span className="pilotage__ouvrir">
        {decomposable && (
          <button
            type="button"
            onClick={() => onOuvrir?.(levier.id)}
            aria-label={`Détailler ${levier.label}`}
            title="Voir le détail de ce poste"
          >
            ›
          </button>
        )}
      </span>
    </li>
  );
}

/**
 * Un nœud peut n'être décomposé que d'un côté du budget : les ministères n'ont
 * d'enfants que côté dépense, les lignes fiscales que côté recette.
 */
function nombreEnfants(node: Node, cote: Cote): number {
  return nbEnfants(node, cote === 'rec' ? 'recettes' : 'depenses');
}
