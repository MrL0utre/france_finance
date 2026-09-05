import { useMemo, useState } from 'react';
import {
  COULEUR_DEFICIT,
  COULEUR_EXCEDENT,
  SPHERE_COLORS,
  soldeInterpretable,
  valeur,
  type Mode,
  type Node,
} from '../schema';
import type { Store } from '../data/store';
import {
  facteurDe,
  montantHerite,
  montantSimule,
  nbAjustements,
  soldeSimule,
  type Ajustements,
  type Cote,
} from '../data/simulation';
import { Curseur } from '../simulation/Curseur';
import { euros, eurosPrecis, eurosSigne, nombre, parHabitant, pourcent } from '../format';

type Props = {
  store: Store;
  node: Node;
  mode: Mode;
  ajustements: Ajustements;
  /**
   * Incrémenté à chaque shard chargé. Sans cette dépendance, les mémos
   * ci-dessous garderaient la liste d'enfants calculée avant l'arrivée des
   * données, et le panneau affirmerait qu'aucun détail n'est publié.
   */
  version: number;
  parHabitantActif: boolean;
  onAjuster: (id: string, cote: Cote, facteur: number, label: string) => void;
  onClose: () => void;
  onNavigate: (id: string) => void;
};

type Onglet = 'apercu' | 'details';

export function Panel({
  store,
  node,
  mode,
  ajustements,
  version,
  parHabitantActif,
  onAjuster,
  onClose,
  onNavigate,
}: Props) {
  const [onglet, setOnglet] = useState<Onglet>('apercu');
  const source = store.sources.get(node.src);
  const ancetres = useMemo(() => store.ancestors(node.id), [store, node.id, version]);
  const enfants = useMemo(
    () => store.resolveChildren(node.id, mode),
    [store, node.id, mode, version],
  );
  const ventilation = useMemo(() => store.ventilation(node, mode), [store, node, mode]);

  const simule = nbAjustements(ajustements) > 0;
  const depSim = montantSimule(store, ajustements, node, 'dep');
  const recSim = montantSimule(store, ajustements, node, 'rec');
  const soldeSim = soldeSimule(store, ajustements, node);

  const montant = mode === 'depenses' ? depSim : mode === 'recettes' ? recSim : soldeSim;
  const base = valeur(node, mode);
  const solde = soldeSim;
  const avecSolde = soldeInterpretable(node);
  const couleur =
    mode === 'solde'
      ? montant >= 0
        ? COULEUR_EXCEDENT
        : COULEUR_DEFICIT
      : node.level === 'racine'
        ? SPHERE_COLORS.racine
        : SPHERE_COLORS[node.sphere];

  const parHab = parHabitant(montant, node.population);

  return (
    <aside className="panel">
      <header className="panel__entete">
        <div>
          {ancetres.length > 0 && (
            <nav className="panel__fil" aria-label="Chemin">
              {ancetres.slice(-2).map((a) => (
                <button key={a.id} type="button" onClick={() => onNavigate(a.id)}>
                  {a.label}
                </button>
              ))}
            </nav>
          )}
          <h2>
            <span className="panel__pastille" style={{ background: couleur }} aria-hidden />
            {node.label}
          </h2>
          <p className="panel__montant">
            {parHabitantActif && parHab ? parHab : formater(montant, mode)}
            {parHabitantActif && parHab && (
              <span className="panel__montant-alt"> · {formater(montant, mode)}</span>
            )}
            {simule && Math.abs(montant - base) > 1 && (
              <span className="panel__montant-base"> au lieu de {formater(base, mode)}</span>
            )}
          </p>
        </div>
        <button type="button" className="panel__fermer" onClick={onClose} aria-label="Fermer">
          ×
        </button>
      </header>

      {/* Les trois chiffres restent visibles quel que soit le mode : c'est leur
          mise en regard qui informe, pas chacun pris isolément. */}
      <div className="bilan">
        <div>
          <span>Dépenses</span>
          <strong>{node.dep ? euros(depSim) : '—'}</strong>
        </div>
        <div>
          <span>Recettes</span>
          <strong>{node.rec ? euros(recSim) : '—'}</strong>
        </div>
        <div className={avecSolde ? (solde >= 0 ? 'bilan--positif' : 'bilan--negatif') : undefined}>
          <span>Solde</span>
          <strong>{avecSolde ? eurosSigne(solde) : '—'}</strong>
        </div>
      </div>

      <Curseur
        node={node}
        mode={mode}
        facteur={facteurDe(ajustements, node.id, mode === 'recettes' ? 'rec' : 'dep')}
        herite={montantHerite(store, ajustements, node, mode === 'recettes' ? 'rec' : 'dep')}
        simule={mode === 'recettes' ? recSim : depSim}
        onChange={(f) => onAjuster(node.id, mode === 'recettes' ? 'rec' : 'dep', f, node.label)}
      />

      {!avecSolde && (node.dep !== 0 || node.rec !== 0) && (
        <p className="avertissement avertissement--info">
          Ce poste n'existe que d'un côté du budget : un ministère ne perçoit pas de recettes, une
          ligne d'impôt ne porte pas de dépenses. Leur différence n'aurait pas de sens.
        </p>
      )}

      {!node.consolide && (
        <p className="avertissement">
          <strong>Montant brut.</strong> Ce total additionne des flux entre lesquels circulent des
          transferts (dotations, subventions croisées). Une partie de l'argent y est donc comptée
          deux fois : ce chiffre décrit une répartition, il ne peut pas être rapproché tel quel des
          comptes nationaux.
        </p>
      )}

      {node.derive && (
        <p className="avertissement avertissement--derive">
          <strong>Répartition indicative.</strong> Ce montant n'est pas publié tel quel : il
          résulte de l'application d'une clé de répartition à un total.
        </p>
      )}

      <div className="panel__onglets" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'apercu'}
          onClick={() => setOnglet('apercu')}
        >
          Aperçu
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={onglet === 'details'}
          onClick={() => setOnglet('details')}
        >
          Détails
        </button>
      </div>

      <div className="panel__corps">
        {onglet === 'apercu' ? (
          <>
            {node.note && <p className="panel__note">{node.note}</p>}

            {enfants.length > 0 && (
              <Repartition
                titre={titreRepartition(node, mode)}
                mode={mode}
                lignes={enfants.map((e) => ({
                  id: e.id,
                  label: e.label,
                  amount:
                    mode === 'solde'
                      ? soldeSimule(store, ajustements, e)
                      : montantSimule(store, ajustements, e, mode === 'recettes' ? 'rec' : 'dep'),
                }))}
                total={montant}
                couleur={couleur}
                onNavigate={onNavigate}
              />
            )}

            {enfants.length === 0 && !node.note && (
              <p className="panel__vide">
                {mode === 'solde'
                  ? "Le solde ne se ventile pas plus finement : au-delà des grandes sections, les postes de dépense et de recette ne se correspondent pas."
                  : "Aucun niveau de détail n'est publié en données ouvertes pour ce poste."}
              </p>
            )}
          </>
        ) : (
          <>
            <dl className="panel__faits">
              <div>
                <dt>Dépenses</dt>
                <dd>{eurosPrecis(node.dep)}</dd>
              </div>
              <div>
                <dt>Recettes</dt>
                <dd>{eurosPrecis(node.rec)}</dd>
              </div>
              {node.population ? (
                <>
                  <div>
                    <dt>Population</dt>
                    <dd>{nombre(node.population)} hab.</dd>
                  </div>
                  <div>
                    <dt>Par habitant</dt>
                    <dd>{parHab}</dd>
                  </div>
                </>
              ) : null}
              <div>
                <dt>Consolidé</dt>
                <dd>{node.consolide ? 'Oui' : 'Non'}</dd>
              </div>
            </dl>

            {ventilation.length > 0 && (
              <>
                <h3>Ventilation comptable — {mode === 'recettes' ? 'recettes' : 'dépenses'}</h3>
                <table className="panel__table">
                  <tbody>
                    {ventilation.map((v) => (
                      <tr key={v.label}>
                        <th scope="row">{v.label}</th>
                        <td>{euros(v.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        {source && (
          <section className="panel__source">
            <h3>Source</h3>
            <p>{source.label}</p>
            <p className="panel__source-meta">
              Exercice {source.exercice} · <code>{source.dataset}</code>
            </p>
            <a href={source.url} target="_blank" rel="noreferrer">
              Consulter le jeu de données
            </a>
          </section>
        )}
      </div>
    </aside>
  );
}

function formater(montant: number, mode: Mode): string {
  return mode === 'solde' ? eurosSigne(montant) : euros(montant);
}

function titreRepartition(node: Node, mode: Mode): string {
  if (mode === 'solde') return 'Solde par section';
  const quoi = mode === 'recettes' ? 'des recettes' : 'des dépenses';
  switch (node.level) {
    case 'racine':
      return `Répartition ${quoi} par sphère`;
    case 'sphere':
      if (node.sphere === 'etat') {
        return mode === 'recettes' ? 'Répartition par nature de recette' : 'Répartition par ministère';
      }
      return `Répartition ${quoi}`;
    case 'region':
      return 'Région et départements';
    case 'departement':
      return 'Département et intercommunalités';
    case 'epci':
      return 'Intercommunalité et communes';
    default:
      return `Répartition ${quoi}`;
  }
}

function Repartition({
  titre,
  mode,
  lignes,
  total,
  couleur,
  onNavigate,
}: {
  titre: string;
  mode: Mode;
  lignes: { id: string; label: string; amount: number }[];
  total: number;
  couleur: string;
  onNavigate: (id: string) => void;
}) {
  const [tout, setTout] = useState(false);
  const visibles = tout ? lignes : lignes.slice(0, 8);
  const max = Math.max(...lignes.map((l) => Math.abs(l.amount)), 1);

  // Un pourcentage n'a de sens que si les lignes décomposent réellement le
  // total. Une épargne brute de +1,3 M€ face à un solde de +7 k€ donnerait
  // « 18 151 % », ce qui n'informe sur rien.
  const partsUtiles =
    total !== 0 && (mode !== 'solde' || lignes.every((l) => Math.sign(l.amount) === Math.sign(total)));

  return (
    <section className="repartition">
      <div className="repartition__entete">
        <h3>{titre}</h3>
        <span>En Md €</span>
      </div>
      <ul>
        {visibles.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              className={partsUtiles ? undefined : 'repartition__ligne--sans-part'}
              onClick={() => onNavigate(l.id)}
              title={l.label}
            >
              <span className="repartition__label">{l.label}</span>
              <span className="repartition__barre" aria-hidden>
                <span
                  style={{
                    width: `${(Math.abs(l.amount) / max) * 100}%`,
                    background:
                      mode === 'solde'
                        ? l.amount >= 0
                          ? COULEUR_EXCEDENT
                          : COULEUR_DEFICIT
                        : couleur,
                  }}
                />
              </span>
              <span className="repartition__valeur">
                {mode === 'solde' ? eurosSigne(l.amount) : euros(l.amount)}
              </span>
              {partsUtiles && (
                <span className="repartition__part">{pourcent(l.amount / total)}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {lignes.length > 8 && (
        <button type="button" className="repartition__plus" onClick={() => setTout(!tout)}>
          {tout ? 'Réduire' : `Voir les ${lignes.length} lignes`}
        </button>
      )}
    </section>
  );
}
