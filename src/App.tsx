import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Store } from './data/store';
import { Graph } from './graph/Graph';
import { computeView, isAutres, parentOfAutres } from './graph/model';
import { Panel } from './panel/Panel';
import { Search } from './search/Search';
import { Sidebar, type Vue } from './Sidebar';
import { Methodologie } from './Methodologie';
import { Accueil, accueilDejaVu, marquerAccueilVu } from './Accueil';
import { Pilotage } from './pilotage/Pilotage';
import { Pib } from './pib/Pib';
import { PanneauDetail, shardsPourDetail } from './pilotage/PanneauDetail';
import { BarreScenario } from './simulation/BarreScenario';
import {
  AUCUN,
  avecAjustement,
  avecMesure,
  avecChantier,
  avecPointsDeTaux,
  avecTranche,
  sansChantier,
  sansMesure,
  chargerScenario,
  enregistrerScenario,
  montantSimule,
  purgerObsoletes,
  shardsPour,
  shardsRequis,
  soldeSimule,
  type Ajustements,
  type Cote,
} from './data/simulation';
import { modeleDepuisUrl, scenarioDepuisUrl, urlAvecScenario } from './data/partage';
import { Comparaison } from './modeles/Comparaison';
import { MODELES, MODELE_DEFAUT, modeleParId } from './modeles/registre';
import { contexteDe, impulsionsDe } from './modeles/impulsions';
import { euros, eurosSigne } from './format';
import { libellesNature, SPHERE_COLORS, type Mode, type SearchEntry } from './schema';
import './styles.css';

/**
 * URL d'entrée, figée au chargement du module.
 *
 * Elle ne peut pas être relue depuis `window` au moment de l'initialisation :
 * l'effet qui reflète le scénario dans la barre d'adresse l'a peut-être déjà
 * réécrite. Sous StrictMode, l'effet d'initialisation rejoue après cette
 * réécriture et croirait alors ouvrir un lien partagé alors que le scénario
 * vient du stockage local.
 */
const URL_INITIALE = window.location.href;

const MODES: { cle: Mode; label: string }[] = [
  { cle: 'depenses', label: 'Dépenses' },
  { cle: 'recettes', label: 'Recettes' },
  { cle: 'solde', label: 'Solde' },
];

export function App() {
  const storeRef = useRef(new Store());
  const store = storeRef.current;

  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set(['racine']));
  const [developpes, setDeveloppes] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<string | null>('racine');
  const [parHabitantActif, setParHabitantActif] = useState(false);
  const [methodologie, setMethodologie] = useState(false);
  /** Message d'accueil : à la première visite seulement, lu au montage. */
  const [accueil, setAccueil] = useState(() => !accueilDejaVu());
  const [vue, setVue] = useState<Vue>('explorer');
  const [modeleId, setModeleId] = useState<string>(
    () => modeleDepuisUrl(URL_INITIALE, MODELES.map((m) => m.id)) ?? MODELE_DEFAUT,
  );
  const [mode, setMode] = useState<Mode>('depenses');
  const [ajustements, setAjustements] = useState<Ajustements>(AUCUN);
  /** Nombre d'ajustements écartés à la restauration, à signaler une fois. */
  const [scenarioPurge, setScenarioPurge] = useState(0);
  /** Le scénario affiché provient d'un lien partagé, pas du stockage local. */
  const [venuDunLien, setVenuDunLien] = useState(false);
  /** Nœud ouvert dans le panneau de détail du pilotage. */
  const [detail, setDetail] = useState<{ id: string; cote: Cote } | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        await store.init();
        // Les shards des nœuds visés doivent arriver avant l'application du
        // scénario : sinon ses ajustements seraient comptés dans le total sans
        // être appliqués, et le solde annoncé serait faux.
        // Un lien partagé l'emporte sur le scénario local : l'utilisateur vient
        // de cliquer dessus. Il n'est pas enregistré pour autant, afin de ne pas
        // écraser le travail en cours de celui qui l'ouvre ; la sauvegarde
        // reprend à sa première modification.
        const partage = scenarioDepuisUrl(URL_INITIALE);
        const enregistre = partage ?? chargerScenario();
        await Promise.all(shardsRequis(enregistre).map((s) => store.loadShard(s)));
        const { ajustements: valides, retires } = purgerObsoletes(store, enregistre);
        setAjustements(valides);
        setVenuDunLien(!!partage);
        if (retires > 0) {
          if (!partage) enregistrerScenario(valides);
          setScenarioPurge(retires);
        }
        setPret(true);
      } catch (e: unknown) {
        setErreur(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [store]);

  const ajuster = useCallback(
    (id: string, cote: Cote, facteur: number, label: string) => {
      const shards = shardsPour(store, id);
      setAjustements((prev) => {
        const suivant = avecAjustement(prev, id, cote, facteur, label, shards);
        enregistrerScenario(suivant);
        return suivant;
      });
      // La sauvegarde locale vient de reprendre la main : l'avertissement sur
      // l'origine du scénario n'a plus lieu d'être.
      setVenuDunLien(false);
    },
    [store],
  );

  /** Applique un scénario déjà construit, et l'enregistre. */
  const majScenario = useCallback((suivant: Ajustements) => {
    enregistrerScenario(suivant);
    setAjustements(suivant);
    setVenuDunLien(false);
  }, []);

  const toutRetirer = useCallback(() => {
    enregistrerScenario(AUCUN);
    setAjustements(AUCUN);
    setVenuDunLien(false);
  }, []);

  // La barre d'adresse reflète en permanence le scénario : partager se réduit
  // ainsi à copier l'URL, et un rafraîchissement conserve l'état. Attendre
  // `pret` est indispensable, sinon le paramètre entrant serait effacé avant
  // d'avoir été lu.
  useEffect(() => {
    if (pret) {
      const modele = modeleId === MODELE_DEFAUT ? undefined : modeleId;
      window.history.replaceState(
        null,
        '',
        urlAvecScenario(window.location.href, ajustements, modele),
      );
    }
  }, [pret, ajustements, modeleId]);

  const modele = modeleParId(modeleId);
  const contexteMacro = pret ? contexteDe(store) : null;
  const effets = useMemo(
    () =>
      contexteMacro ? modele.calculer(impulsionsDe(store, ajustements), contexteMacro) : null,
    [store, ajustements, modele, contexteMacro],
  );

  const marquer = useCallback((id: string, actif: boolean) => {
    setLoading((prev) => {
      const next = new Set(prev);
      if (actif) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  /**
   * Ouvre un poste dans le panneau de détail. Les shards menant au nœud sont
   * chargés d'abord : sans eux, le panneau s'ouvrirait sur une liste vide le
   * temps que les données arrivent.
   */
  const ouvrirDetail = useCallback(
    async (id: string) => {
      const node = store.nodes.get(id);
      if (!node) return;
      // Un nœud qui n'existe que du côté recettes se regarde de ce côté.
      const cote: Cote = node.rec !== 0 && node.dep === 0 ? 'rec' : 'dep';
      marquer(id, true);
      try {
        await Promise.all(shardsPourDetail(store, id).map((s) => store.loadShard(s)));
      } catch (e) {
        setErreur(e instanceof Error ? e.message : String(e));
        return;
      } finally {
        marquer(id, false);
      }
      setDetail({ id, cote });
      setVersion((v) => v + 1);
    },
    [store, marquer],
  );

  /** Déplie un nœud, en chargeant son shard au préalable si besoin. */
  const deplier = useCallback(
    async (id: string) => {
      const node = store.nodes.get(id);
      if (node?.shard) {
        marquer(id, true);
        try {
          await store.loadShard(node.shard);
        } catch (e) {
          setErreur(e instanceof Error ? e.message : String(e));
          return;
        } finally {
          marquer(id, false);
        }
      }
      setExpanded((prev) => new Set(prev).add(id));
      setVersion((v) => v + 1);
    },
    [store, marquer],
  );

  const basculer = useCallback(
    (id: string) => {
      if (isAutres(id)) {
        setDeveloppes((prev) => new Set(prev).add(parentOfAutres(id)));
        return;
      }
      if (expanded.has(id)) {
        setExpanded((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }
      void deplier(id);
    },
    [expanded, deplier],
  );

  /** Ouvre le chemin complet jusqu'à un nœud, en chargeant les shards manquants. */
  const naviguer = useCallback(
    async (entry: Pick<SearchEntry, 'i' | 's'>) => {
      if (entry.s?.length) {
        marquer(entry.i, true);
        try {
          await Promise.all(entry.s.map((s) => store.loadShard(s)));
        } catch (e) {
          setErreur(e instanceof Error ? e.message : String(e));
          return;
        } finally {
          marquer(entry.i, false);
        }
      }

      const complet = store.ancestors(entry.i);
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const a of complet) next.add(a.id);
        return next;
      });
      // Un département peut compter des centaines de communes : sans cela la
      // cible resterait cachée derrière le nœud « Autres ».
      setDeveloppes((prev) => {
        const next = new Set(prev);
        const parent = store.nodes.get(entry.i)?.parentId;
        if (parent) next.add(parent);
        return next;
      });
      setSelected(entry.i);
      setVersion((v) => v + 1);
    },
    [store, marquer],
  );

  const view = useMemo(
    () =>
      pret
        ? computeView(store, mode, expanded, developpes, ajustements)
        : { nodes: [], links: [] },
    [pret, store, mode, expanded, developpes, ajustements, version],
  );

  const ajustes = useMemo(
    () => new Set([...Object.keys(ajustements.dep), ...Object.keys(ajustements.rec)]),
    [ajustements],
  );

  const chemin = useMemo(() => {
    const ids = new Set<string>();
    if (!selected || !pret) return ids;
    ids.add(selected);
    for (const a of store.ancestors(selected)) ids.add(a.id);
    return ids;
  }, [selected, pret, store, version]);

  const racine = store.nodes.get('racine');
  const spheres = pret ? store.resolveChildren('racine', mode) : [];
  const noeudSelectionne = selected ? store.nodes.get(selected) : undefined;

  const valeurAffichee = useCallback(
    (n: { id: string; dep: number; rec: number; solde?: number }) =>
      mode === 'solde'
        ? soldeSimule(store, ajustements, n as never)
        : montantSimule(store, ajustements, n, mode === 'recettes' ? 'rec' : 'dep'),
    [store, ajustements, mode],
  );

  const totalAffiche = racine ? valeurAffichee(racine) : 0;

  /**
   * Le total une fois la rétroaction prise en compte.
   *
   * Sans lui, l'application affichait un total de recettes qui ignorait
   * l'activité pendant que le panneau des effets, lui, en tenait compte : couper
   * toute la dépense publique laissait les recettes intactes à l'écran, alors
   * que le modèle disait l'activité effondrée. Deux chiffres pour un même
   * scénario, dont un faux.
   *
   * Le montant décidé reste en tête — c'est ce que l'utilisateur a réglé — et
   * celui-ci vient dessous, comme conséquence. Confondre les deux effacerait la
   * distinction entre une décision et une hypothèse de modèle.
   */
  const totalApresRetroaction = useMemo(() => {
    if (!effets || effets.pib === 0) return null;
    if (mode === 'recettes') return totalAffiche + effets.recettesInduites;
    if (mode === 'depenses') return totalAffiche + effets.depensesInduites;
    return effets.solde;
  }, [effets, mode, totalAffiche]);
  const formater = (n: number) => (mode === 'solde' ? eurosSigne(n) : euros(n));
  // Même garde que dans le panneau : une part n'a de sens que si les sphères
  // décomposent réellement le total.
  const partsUtiles =
    totalAffiche !== 0 &&
    (mode !== 'solde' ||
      spheres.every((s) => Math.sign(valeurAffichee(s)) === Math.sign(totalAffiche)));

  if (erreur) {
    return (
      <div className="erreur-page">
        <h1>Données indisponibles</h1>
        <p>{erreur}</p>
        <p>
          Lancez <code>npm run data:build</code> pour produire les fichiers de{' '}
          <code>public/data/</code>, puis rechargez la page.
        </p>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar vue={vue} onVue={setVue} onMethodologie={() => setMethodologie(true)} />

      {accueil && (
        <Accueil
          onFermer={() => {
            marquerAccueilVu();
            setAccueil(false);
          }}
        />
      )}

      {methodologie && (
        <Methodologie sources={store.sources} onClose={() => setMethodologie(false)} />
      )}

      {/* Le modificateur ne sert qu'au téléphone : lui seul ouvre le
          défilement de la page, les autres vues gérant déjà le leur. */}
      <main className={vue === 'explorer' ? 'contenu contenu--explorer' : 'contenu'}>
        <header className="entete">
          <div className="entete__titre">
            <h1>
              {vue === 'piloter'
                ? 'Piloter les finances publiques'
                : vue === 'comparer'
                  ? 'Comparer les modèles'
                  : vue === 'pib'
                    ? "L'économie française"
                    : 'Explorer les finances publiques'}
            </h1>
            <p>
              {vue === 'piloter'
                ? "Réglez les grands postes de recette et de dépense, et lisez l'effet sur le solde."
                : vue === 'comparer'
                  ? 'Le même scénario vu par chaque modèle de bouclage, pour mesurer ce que les hypothèses ajoutent au résultat.'
                  : vue === 'pib'
                    ? "L'échelle dans laquelle s'inscrit le budget : ce que produit le pays, et par quoi."
                    : "Suivez l'argent public, du niveau global jusqu'à la commune — ce qu'il coûte, ce qu'il rapporte, ce qu'il manque."}
            </p>
          </div>
          {pret && vue === 'explorer' && (
            <Search store={store} onSelect={(e) => void naviguer(e)} />
          )}
        </header>

        {scenarioPurge > 0 && (
          <p className="scenario__purge" role="status">
            {scenarioPurge} ajustement{scenarioPurge > 1 ? 's ont' : ' a'} été écarté
            {scenarioPurge > 1 ? 's' : ''} de votre scénario : {scenarioPurge > 1 ? 'leurs' : 'sa'}{' '}
            cible{scenarioPurge > 1 ? 's ne correspondent' : ' ne correspond'} plus aux données
            actuelles.
            <button type="button" onClick={() => setScenarioPurge(0)}>
              Fermer
            </button>
          </p>
        )}

        {pret && vue === 'pib' && (
          <Pib
            pib={store.pib}
            depensePublique={racine?.dep ?? 0}
            depenseSimulee={racine ? montantSimule(store, ajustements, racine, 'dep') : 0}
            effets={effets}
          />
        )}

        {pret && vue === 'piloter' && (
          <>
            <BarreScenario
              store={store}
              ajustements={ajustements}
              venuDunLien={venuDunLien}
              modele={modele}
              effets={effets}
              onRetirer={(id, cote) => ajuster(id, cote, 1, '')}
              onToutRetirer={toutRetirer}
              onNaviguer={(id) => {
                setVue('explorer');
                setSelected(id);
              }}
            />
            <Pilotage
              store={store}
              ajustements={ajustements}
              modele={modele}
              effets={effets}
              modeleId={modeleId}
              onModele={setModeleId}
              onAjuster={(id, cote, facteur, label) => ajuster(id, cote, facteur, label)}
              onMesure={(m) => majScenario(avecMesure(ajustements, m))}
              onRetirerMesure={(id) => majScenario(sansMesure(ajustements, id))}
              onPointsDeTaux={(p) => majScenario(avecPointsDeTaux(ajustements, p))}
              onTranche={(i, champ, v) => majScenario(avecTranche(ajustements, i, champ, v))}
              onVoirNoeud={(id) => {
                setVue('explorer');
                setSelected(id);
              }}
              onChantier={(c) => majScenario(avecChantier(ajustements, c))}
              onRetirerChantier={(id) => majScenario(sansChantier(ajustements, id))}
              onOuvrirDetail={(id) => void ouvrirDetail(id)}
            />
          </>
        )}

        {pret && vue === 'piloter' && detail && racine && (
          <PanneauDetail
            store={store}
            noeudId={detail.id}
            cote={detail.cote}
            ajustements={ajustements}
            soldeSimule={effets ? effets.solde : racine.solde ?? racine.rec - racine.dep}
            soldeBase={racine.solde ?? racine.rec - racine.dep}
            onNaviguer={(id) => void ouvrirDetail(id)}
            onRegler={(levier, facteur) =>
              ajuster(levier.id, levier.cote, facteur, levier.label)
            }
            onFermer={() => setDetail(null)}
          />
        )}

        {pret && vue === 'comparer' && (
          <Comparaison
            store={store}
            ajustements={ajustements}
            actif={modeleId}
            onChoisir={setModeleId}
          />
        )}

        {vue === 'explorer' && (
        <>
        <div className="modes" role="tablist" aria-label="Mesure affichée">
          {MODES.map((m) => (
            <button
              key={m.cle}
              type="button"
              role="tab"
              aria-selected={mode === m.cle}
              className={mode === m.cle ? 'modes__onglet modes__onglet--actif' : 'modes__onglet'}
              onClick={() => setMode(m.cle)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {pret && racine && (
          <div className="sommaire">
            <div className="sommaire__bloc">
              <span className="sommaire__label">
                {mode === 'solde' ? 'Solde des périmètres explorés' : 'Somme des périmètres explorés'}
              </span>
              {/* Le résultat du scénario passe devant, le montant décidé recule
                  entre parenthèses. L'ordre inverse invitait à la conclusion
                  fausse : lire des recettes intactes après une coupe massive, et
                  en déduire qu'elle rapporte, alors que le modèle vient
                  précisément de dire que l'activité s'est contractée. */}
              <strong
                className={
                  (totalApresRetroaction ?? totalAffiche) < 0 && mode === 'solde'
                    ? 'sommaire--negatif'
                    : undefined
                }
              >
                {formater(totalApresRetroaction ?? totalAffiche)}
              </strong>
              {totalApresRetroaction !== null ? (
                <span className="sommaire__retroaction">
                  après effet sur l'activité
                  <em>({formater(totalAffiche)} décidés)</em>
                </span>
              ) : (
                <span className="sommaire__note">montants bruts, voir méthodologie</span>
              )}
            </div>
            {spheres.map((s) => {
              const v = valeurAffichee(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  className="sommaire__bloc sommaire__bloc--cliquable"
                  onClick={() => {
                    setSelected(s.id);
                    void deplier(s.id);
                  }}
                >
                  <span className="sommaire__label">
                    <span
                      className="sommaire__pastille"
                      style={{ background: SPHERE_COLORS[s.sphere] }}
                      aria-hidden
                    />
                    {s.label}
                  </span>
                  <strong className={mode === 'solde' && v < 0 ? 'sommaire--negatif' : undefined}>
                    {formater(v)}
                  </strong>
                  <span className="sommaire__note">
                    {partsUtiles
                      ? `${((v / totalAffiche) * 100).toFixed(1).replace('.', ',')} % du total`
                      : mode === 'solde'
                        ? 'excédent ou déficit'
                        : '—'}
                  </span>
                  {/* Nature et exercice affichés au plus près du montant : un
                      chiffre prévu et un chiffre dépensé ne se lisent pas de la
                      même façon, et les deux cohabitent ici. */}
                  {(() => {
                    const src = store.sources.get(s.src);
                    if (!src) return null;
                    return (
                      <span
                        className={
                          src.nature === 'prevision'
                            ? 'sommaire__nature sommaire__nature--prevision'
                            : 'sommaire__nature'
                        }
                        title={src.reserve ?? libellesNature(src.nature).long}
                      >
                        {libellesNature(src.nature).court} {src.exercice}
                      </span>
                    );
                  })()}
                </button>
              );
            })}
          </div>
        )}

        {pret && (
          <BarreScenario
            store={store}
            ajustements={ajustements}
            venuDunLien={venuDunLien}
            modele={modele}
            effets={effets}
            onRetirer={(id, cote) => ajuster(id, cote, 1, '')}
            onToutRetirer={toutRetirer}
            onNaviguer={(id) => setSelected(id)}
          />
        )}

        <div className="scene">
          {!pret ? (
            <p className="chargement">Chargement des données…</p>
          ) : (
            <Graph
              view={view}
              mode={mode}
              selected={selected}
              chemin={chemin}
              expanded={expanded}
              loading={loading}
              ajustes={ajustes}
              onSelect={(id) => {
                setSelected(id);
                if (isAutres(id)) basculer(id);
              }}
              onToggle={basculer}
            />
          )}

          <div className="scene__aide">
            <button
              type="button"
              className={parHabitantActif ? 'bascule bascule--active' : 'bascule'}
              onClick={() => setParHabitantActif((v) => !v)}
              aria-pressed={parHabitantActif}
            >
              € par habitant
            </button>
            <p>Cliquez sur « + » pour déplier un niveau, sur un cercle pour voir le détail.</p>
          </div>

          {noeudSelectionne && (
            <Panel
              store={store}
              node={noeudSelectionne}
              mode={mode}
              ajustements={ajustements}
              effets={effets}
              version={version}
              onAjuster={ajuster}
              parHabitantActif={parHabitantActif}
              onClose={() => setSelected(null)}
              onNavigate={(id) => {
                setSelected(id);
                void deplier(id);
              }}
            />
          )}
        </div>
        </>
        )}
      </main>
    </div>
  );
}
