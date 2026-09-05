import { useEffect, useMemo, useState } from 'react';
import { SPHERE_COLORS, nbEnfants, type Node } from '../schema';
import type { Store } from '../data/store';
import {
  montantSimule,
  shardsPour,
  type Ajustements,
  type Cote,
} from '../data/simulation';
import { LigneLevier, type Levier } from './LigneLevier';
import { euros, eurosSigne, pourcent } from '../format';

/**
 * Panneau de détail, générique.
 *
 * Il ne connaît aucun ministère ni aucun thème en particulier : on lui passe un
 * nœud, il affiche ses enfants en leviers et permet de descendre plus bas. La
 * liste des thèmes se déduit ainsi de l'arbre publié, au lieu d'être écrite en
 * dur — un même composant couvre les vingt ministères, les branches sociales et
 * les lignes fiscales, et suit les données quand elles changent de millésime.
 */
export function PanneauDetail({
  store,
  noeudId,
  cote,
  ajustements,
  soldeSimule,
  soldeBase,
  onNaviguer,
  onRegler,
  onFermer,
}: {
  store: Store;
  noeudId: string;
  cote: Cote;
  ajustements: Ajustements;
  soldeSimule: number;
  soldeBase: number;
  onNaviguer: (id: string) => void;
  onRegler: (levier: Levier, facteur: number) => void;
  onFermer: () => void;
}) {
  const [version, setVersion] = useState(0);
  const [chargement, setChargement] = useState(false);
  const noeud = store.nodes.get(noeudId);

  // Les enfants d'un nœud vivent souvent dans un shard qui n'a pas encore été
  // téléchargé : sans ce chargement, le panneau afficherait un poste vide.
  useEffect(() => {
    const shard = store.nodes.get(noeudId)?.shard;
    if (!shard) return;
    setChargement(true);
    store
      .loadShard(shard)
      .then(() => setVersion((v) => v + 1))
      .finally(() => setChargement(false));
  }, [store, noeudId]);

  const mode = cote === 'rec' ? 'recettes' : 'depenses';

  const enfants = useMemo(
    () => (noeud ? store.resolveChildren(noeudId, mode) : []),
    [store, noeudId, mode, version],
  );

  const chemin = useMemo(
    () => (noeud ? store.ancestors(noeudId) : []),
    [store, noeudId, version],
  );

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    window.addEventListener('keydown', auClavier);
    return () => window.removeEventListener('keydown', auClavier);
  }, [onFermer]);

  if (!noeud) return null;

  const total = montantSimule(store, ajustements, noeud, cote);
  const gain = soldeSimule - soldeBase;

  const leviers: Levier[] = enfants
    .map((e) => ({ id: e.id, label: e.label, cote, base: e[cote] }))
    .filter((l) => l.base !== 0)
    .sort((a, b) => b.base - a.base);

  return (
    <div className="detail" role="dialog" aria-modal="true" aria-label={`Détail : ${noeud.label}`}>
      <div className="detail__contenu">
        <header className="detail__entete">
          <div className="detail__titre">
            <nav className="detail__fil" aria-label="Chemin">
              {chemin
                .filter((a) => a.id !== 'racine')
                .map((a) => (
                  <button key={a.id} type="button" onClick={() => onNaviguer(a.id)}>
                    {a.label}
                  </button>
                ))}
              <span aria-current="page">{noeud.label}</span>
            </nav>
            <h2>
              <span
                className="detail__pastille"
                style={{ background: SPHERE_COLORS[noeud.sphere] }}
                aria-hidden
              />
              {noeud.label}
            </h2>
            <p className="detail__total">
              {euros(total)}
              <span>{cote === 'rec' ? 'de recettes' : 'de dépenses'}</span>
              {Math.abs(total - noeud[cote]) > 1 && (
                <em>{eurosSigne(total - noeud[cote])} vs publié</em>
              )}
            </p>
          </div>

          <div className="detail__solde">
            <span>Solde</span>
            <strong className={soldeSimule >= 0 ? 'pilotage--positif' : 'pilotage--negatif'}>
              {eurosSigne(soldeSimule)}
            </strong>
            {Math.abs(gain) > 1 && (
              <em className={gain >= 0 ? 'pilotage--positif' : 'pilotage--negatif'}>
                {gain >= 0 ? '▲' : '▼'} {euros(Math.abs(gain))}
              </em>
            )}
          </div>

          <button type="button" className="detail__fermer" onClick={onFermer} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="detail__corps">
          {chargement && leviers.length === 0 && (
            <p className="pilotage__vide">Chargement du détail…</p>
          )}

          {!chargement && leviers.length === 0 && (
            <p className="pilotage__vide">
              Aucun niveau de détail n'est publié en données ouvertes pour ce poste.
            </p>
          )}

          {leviers.length > 0 && (
            <ul className="pilotage__groupe detail__liste">
              {leviers.map((l) => (
                <LigneLevier
                  key={l.id}
                  levier={l}
                  store={store}
                  ajustements={ajustements}
                  onRegler={onRegler}
                  onOuvrir={peutDescendre(store, l.id, mode) ? onNaviguer : undefined}
                />
              ))}
            </ul>
          )}

          {leviers.length > 0 && (
            <p className="detail__note">
              {leviers.length} poste{leviers.length > 1 ? 's' : ''} · les montants les plus élevés
              d'abord. Le chevron ouvre le niveau suivant, quand il existe.
              {Math.abs(sommeLeviers(leviers) - noeud[cote]) > noeud[cote] * 0.001 && (
                <>
                  {' '}
                  Leur somme, {euros(sommeLeviers(leviers))}, diffère du total du poste :
                  {' '}
                  {pourcent(sommeLeviers(leviers) / noeud[cote] - 1)} d'écart, dû aux lignes de
                  montant nul ou négatif écartées de cette liste.
                </>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function sommeLeviers(leviers: Levier[]): number {
  return leviers.reduce((s, l) => s + l.base, 0);
}

/** Un nœud n'est ouvrable que s'il annonce des enfants du côté regardé. */
function peutDescendre(store: Store, id: string, mode: 'depenses' | 'recettes'): boolean {
  const n = store.nodes.get(id);
  return !!n && nbEnfants(n, mode) > 0;
}

/** Shards à charger avant d'ouvrir un nœud, pour que ses enfants existent. */
export function shardsPourDetail(store: Store, id: string): string[] {
  const propre = store.nodes.get(id)?.shard;
  return [...shardsPour(store, id), ...(propre ? [propre] : [])];
}

export type { Node };
