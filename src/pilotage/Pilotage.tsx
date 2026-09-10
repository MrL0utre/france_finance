import { useEffect, useMemo, useState } from 'react';
import { SPHERE_COLORS } from '../schema';
import type { Store } from '../data/store';
import { contexteDe, impulsionsPluriannuelles } from '../modeles/impulsions';
import { projeter } from '../modeles/trajectoire';
import { Projection } from '../modeles/Projection';
import { CALIBRATIONS } from '../modeles/registre';

/**
 * Même horizon et même première année que dans la comparaison : deux vues qui
 * projetteraient le même scénario sur des périodes différentes feraient douter
 * de l'une comme de l'autre.
 */
const HORIZON = 10;
const PREMIERE_ANNEE = 2026;
import {
  montantSimule,
  nbAjustements,
  shardsPour,
  soldeSimule,
  type Ajustements,
  type Cote,
  type Mesure,
  type ChantierRetenu,
} from '../data/simulation';
import { BlocChantiers } from './BlocChantiers';
import { BlocDette } from './BlocDette';
import { BORNE, LigneLevier, type Levier } from './LigneLevier';
import { MesuresLibres } from './MesuresLibres';
import { PanneauBareme } from '../impot/PanneauBareme';
import { PanneauEffets, SelecteurModele } from '../modeles/SelecteurModele';
import type { Effets, Modele } from '../modeles/types';
import { euros, eurosSigne } from '../format';
import { SHARDS_PILOTAGE, construireLeviers, type GroupeLeviers } from './leviers';

export function Pilotage({
  store,
  ajustements,
  modele,
  effets,
  modeleId,
  onModele,
  onAjuster,
  onMesure,
  onRetirerMesure,
  onPointsDeTaux,
  onTranche,
  onVoirNoeud,
  onChantier,
  onRetirerChantier,
  onOuvrirDetail,
}: {
  store: Store;
  ajustements: Ajustements;
  modele: Modele;
  effets: Effets | null;
  modeleId: string;
  onModele: (id: string) => void;
  onAjuster: (id: string, cote: Cote, facteur: number, label: string, shards: string[]) => void;
  onMesure: (m: Mesure) => void;
  onRetirerMesure: (id: string) => void;
  onPointsDeTaux: (points: number) => void;
  onTranche: (indice: number, champ: 'taux' | 'seuil', valeur: number | undefined) => void;
  onVoirNoeud: (id: string) => void;
  onChantier: (c: ChantierRetenu) => void;
  onRetirerChantier: (id: string) => void;
  onOuvrirDetail: (id: string) => void;
}) {
  const [pret, setPret] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    Promise.all(SHARDS_PILOTAGE.map((s) => store.loadShard(s)))
      .then(() => setPret(true))
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : String(e)));
  }, [store]);

  const groupes = useMemo(() => (pret ? construireLeviers(store) : null), [store, pret]);
  const racine = store.nodes.get('racine');
  // Le cadrage sert à rapporter les effets à leur base : sans lui, l'indicateur
  // d'humeur n'aurait rien à quoi comparer les montants.
  const contexte = pret ? contexteDe(store) : null;

  /**
   * Sentier sur dix ans du scénario en cours.
   *
   * Recalculé avec le modèle actif : la projection et le calcul annuel doivent
   * dire la même chose de la première année, sans quoi l'un des deux ment.
   */
  const trajectoire = useMemo(
    () =>
      contexte
        ? projeter(
            CALIBRATIONS[modeleId] ?? CALIBRATIONS.comptable,
            impulsionsPluriannuelles(store, ajustements, HORIZON),
            contexte,
            {
              horizonAnnees: HORIZON,
              tauxApparent: store.macro ? store.macro.dette.charge / store.macro.dette.encours : 0,
              premiereAnnee: PREMIERE_ANNEE,
            },
          )
        : null,
    [store, ajustements, contexte, modeleId],
  );

  if (erreur) return <p className="pilotage__vide">Chargement impossible : {erreur}</p>;
  if (!groupes || !racine) return <p className="pilotage__vide">Chargement des postes…</p>;

  const depSim = montantSimule(store, ajustements, racine, 'dep');
  const recSim = montantSimule(store, ajustements, racine, 'rec');
  const soldeBase = racine.solde ?? racine.rec - racine.dep;
  // Le solde affiché est celui du modèle actif ; les montants par poste, eux,
  // restent comptables : un ministère ne voit pas son budget bouger parce que
  // l'activité a varié.
  const soldeSim = effets ? effets.solde : soldeSimule(store, ajustements, racine);
  const gain = soldeSim - soldeBase;

  const regler = (levier: Levier, facteur: number) => {
    const borne = Math.max(1 - BORNE / 100, Math.min(1 + BORNE / 100, facteur));
    onAjuster(levier.id, levier.cote, borne, levier.label, shardsPour(store, levier.id));
  };

  return (
    <div className="pilotage">
      <header className="pilotage__entete">
        <div>
          <h2>Piloter le budget</h2>
          <p>
            Ajustez les grands postes de recette et de dépense, et lisez l'effet sur le solde. Les
            mêmes ajustements apparaissent dans l'explorateur, où tout poste plus fin reste
            réglable.
          </p>
        </div>

        <div className="pilotage__compteurs">
          <Compteur libelle="Recettes" base={racine.rec} simule={recSim} sens="hausseBonne" />
          <Compteur libelle="Dépenses" base={racine.dep} simule={depSim} sens="baisseBonne" />
          <div className="pilotage__solde">
            <span>Solde</span>
            <strong className={soldeSim >= 0 ? 'pilotage--positif' : 'pilotage--negatif'}>
              {eurosSigne(soldeSim)}
            </strong>
            {nbAjustements(ajustements) > 0 && (
              <em className={gain >= 0 ? 'pilotage--positif' : 'pilotage--negatif'}>
                {gain >= 0 ? '▲' : '▼'} {euros(Math.abs(gain))} vs {eurosSigne(soldeBase)}
              </em>
            )}
          </div>
        </div>
      </header>

      <div className="pilotage__modele">
        <SelecteurModele actif={modeleId} onChoisir={onModele} />
        {effets && contexte && (
          <PanneauEffets modele={modele} effets={effets} contexte={contexte} />
        )}
      </div>

      {/* La projection vivait dans l'onglet de comparaison, donc loin de l'endroit
          où le scénario se règle. Une stratégie qui tient la première année et se
          défait sur dix ans ne se voyait qu'en changeant de vue. */}
      {trajectoire && (
        <details className="pilotage__projection">
          <summary>Ce que ce scénario donne sur {HORIZON} ans</summary>
          <Projection trajectoire={trajectoire} />
        </details>
      )}

      <div className="pilotage__colonnes">
        <Colonne
          titre="Recettes"
          groupes={groupes.recettes}
          store={store}
          ajustements={ajustements}
          onRegler={regler}
          onOuvrirDetail={onOuvrirDetail}
        />
        <Colonne
          titre="Dépenses"
          groupes={groupes.depenses}
          store={store}
          ajustements={ajustements}
          onRegler={regler}
          onOuvrirDetail={onOuvrirDetail}
        />
      </div>

      <div className="pilotage__complements">
        {store.macro && (
          <BlocDette
            dette={store.macro.dette}
            points={ajustements.pointsDeTaux ?? 0}
            onPoints={onPointsDeTaux}
            onVoirCharge={() => {
              const id = store.macro?.dette.chargeId;
              if (id) onVoirNoeud(id);
            }}
          />
        )}
        <MesuresLibres
          mesures={ajustements.mesures ?? []}
          onAjouter={onMesure}
          onRetirer={onRetirerMesure}
        />
      </div>

      <BlocChantiers
        catalogue={store.chantiers}
        retenus={ajustements.chantiers ?? []}
        premiereAnnee={2026}
        onAjouter={onChantier}
        onRetirer={onRetirerChantier}
      />

      {store.bareme && (
        <PanneauBareme
          bareme={store.bareme}
          reformes={ajustements.bareme ?? {}}
          onTranche={onTranche}
        />
      )}

      <p className="pilotage__avertissement">
        <strong>{modele.nom}.</strong> {modele.limite} Pour confronter cette projection à celles
        des autres modèles, ouvrez <strong>Comparer les modèles</strong>.
      </p>
    </div>
  );
}

function Compteur({
  libelle,
  base,
  simule,
  sens,
}: {
  libelle: string;
  base: number;
  simule: number;
  sens: 'hausseBonne' | 'baisseBonne';
}) {
  const ecart = simule - base;
  const favorable = sens === 'hausseBonne' ? ecart > 0 : ecart < 0;
  return (
    <div className="pilotage__compteur">
      <span>{libelle}</span>
      <strong>{euros(simule)}</strong>
      {Math.abs(ecart) > 1 && (
        <em className={favorable ? 'pilotage--positif' : 'pilotage--negatif'}>
          {eurosSigne(ecart)}
        </em>
      )}
    </div>
  );
}

function Colonne({
  titre,
  groupes,
  store,
  ajustements,
  onRegler,
  onOuvrirDetail,
}: {
  titre: string;
  groupes: GroupeLeviers[];
  store: Store;
  ajustements: Ajustements;
  onRegler: (levier: Levier, facteur: number) => void;
  onOuvrirDetail: (id: string) => void;
}) {
  return (
    <section className="pilotage__colonne">
      <h3 className="pilotage__titre-colonne">{titre}</h3>
      {groupes.map((g) => (
        <div key={`${titre}-${g.titre}`} className="pilotage__groupe">
          <h4>
            <span
              className="pilotage__pastille"
              style={{ background: SPHERE_COLORS[g.sphere] }}
              aria-hidden
            />
            {g.titre}
          </h4>
          <ul>
            {g.leviers.map((l) => (
              <LigneLevier
                key={l.id}
                levier={l}
                store={store}
                ajustements={ajustements}
                onRegler={onRegler}
                onOuvrir={onOuvrirDetail}
              />
            ))}
          </ul>
          {g.note && <p className="pilotage__note">{g.note}</p>}
        </div>
      ))}
    </section>
  );
}

