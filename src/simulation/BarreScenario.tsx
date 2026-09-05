import { useRef, useState } from 'react';
import type { Store } from '../data/store';
import { listeAjustements, nbElements, soldeSimule, type Ajustements } from '../data/simulation';
import { urlAvecScenario } from '../data/partage';
import type { Effets, Modele } from '../modeles/types';
import { euros, eurosSigne } from '../format';

/**
 * Bandeau de scénario. Il n'apparaît qu'une fois un ajustement posé : tant qu'il
 * n'y a rien à comparer, il n'aurait qu'à afficher deux fois le même chiffre.
 */
export function BarreScenario({
  store,
  ajustements,
  venuDunLien,
  modele,
  effets,
  onRetirer,
  onToutRetirer,
  onNaviguer,
}: {
  store: Store;
  ajustements: Ajustements;
  venuDunLien: boolean;
  modele: Modele;
  effets: Effets | null;
  onRetirer: (id: string, cote: 'dep' | 'rec') => void;
  onToutRetirer: () => void;
  onNaviguer: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [partage, setPartage] = useState<'inactif' | 'copie' | 'manuel'>('inactif');
  const champUrl = useRef<HTMLInputElement>(null);
  const racine = store.nodes.get('racine');
  // Compte tout le scénario, pas seulement les postes ajustés : un chantier ou
  // une variation de taux suffit à en constituer un.
  const n = nbElements(ajustements);
  if (!racine || n === 0) return null;

  const partager = async () => {
    const url = urlAvecScenario(window.location.href, ajustements);
    try {
      await navigator.clipboard.writeText(url);
      setPartage('copie');
      window.setTimeout(() => setPartage('inactif'), 2500);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé, permission) : le lien est
      // affiché et présélectionné pour une copie manuelle.
      setPartage('manuel');
      window.setTimeout(() => champUrl.current?.select(), 0);
    }
  };

  const soldeBase = racine.solde ?? racine.rec - racine.dep;
  // Le modèle actif a le dernier mot sur le solde : sans rétroaction il retombe
  // sur la soustraction comptable, avec rétroaction il en diffère.
  const soldeSim = effets ? effets.solde : soldeSimule(store, ajustements, racine);
  const gain = soldeSim - soldeBase;
  const lignes = listeAjustements(store, ajustements);

  return (
    <div className="scenario">
      <div className="scenario__resume">
        <button
          type="button"
          className="scenario__bascule"
          onClick={() => setOuvert(!ouvert)}
          aria-expanded={ouvert}
        >
          {ouvert ? '▾' : '▸'} Scénario · {n} ajustement{n > 1 ? 's' : ''}
        </button>

        <div className="scenario__solde">
          <span>Solde</span>
          <s>{eurosSigne(soldeBase)}</s>
          <strong className={soldeSim >= 0 ? 'scenario--positif' : 'scenario--negatif'}>
            {eurosSigne(soldeSim)}
          </strong>
          <em className={gain >= 0 ? 'scenario--positif' : 'scenario--negatif'}>
            {gain >= 0 ? 'déficit réduit de ' : 'déficit creusé de '}
            {euros(Math.abs(gain))}
          </em>
          <span className="scenario__modele" title={modele.resume}>
            {modele.nom}
          </span>
        </div>

        <button type="button" className="scenario__partager" onClick={() => void partager()}>
          {partage === 'copie' ? 'Lien copié ✓' : 'Partager'}
        </button>

        <button type="button" className="scenario__reset" onClick={onToutRetirer}>
          Tout réinitialiser
        </button>
      </div>

      {partage === 'manuel' && (
        <p className="scenario__lien">
          <label htmlFor="lien-scenario">Copiez ce lien :</label>
          <input
            id="lien-scenario"
            ref={champUrl}
            type="text"
            readOnly
            value={urlAvecScenario(window.location.href, ajustements)}
            onFocus={(e) => e.target.select()}
          />
        </p>
      )}

      {venuDunLien && (
        <p className="scenario__origine">
          Scénario ouvert depuis un lien partagé. Il ne remplacera le vôtre qu'à votre première
          modification.
        </p>
      )}

      {ouvert && (
        <ul className="scenario__liste">
          {lignes.map((l) => {
            const ecart = l.simule - l.base;
            return (
              <li key={`${l.cote}:${l.id}`}>
                <button
                  type="button"
                  className="scenario__cible"
                  onClick={() => onNaviguer(l.id)}
                  title={l.label}
                >
                  <span className={`scenario__cote scenario__cote--${l.cote}`}>
                    {l.cote === 'dep' ? 'Dépense' : 'Recette'}
                  </span>
                  <span className="scenario__label">{l.label}</span>
                  <span className="scenario__pct">
                    {l.facteur > 1 ? '+' : ''}
                    {Math.round((l.facteur - 1) * 100)} %
                  </span>
                  <span className="scenario__montant">{eurosSigne(ecart)}</span>
                </button>
                <button
                  type="button"
                  className="scenario__retirer"
                  onClick={() => onRetirer(l.id, l.cote)}
                  aria-label={`Retirer l'ajustement sur ${l.label}`}
                >
                  ×
                </button>
              </li>
            );
          })}

          <li className="scenario__avertissement">
            <strong>{modele.nom}.</strong> {modele.limite}
          </li>
        </ul>
      )}
    </div>
  );
}
