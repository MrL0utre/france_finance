import { useEffect, useRef, useState } from 'react';
import type { SearchEntry } from '../schema';
import type { Store } from '../data/store';
import { euros } from '../format';

type Props = {
  store: Store;
  onSelect: (entry: SearchEntry) => void;
};

export function Search({ store, onSelect }: Props) {
  const [terme, setTerme] = useState('');
  const [index, setIndex] = useState<SearchEntry[] | null>(null);
  const [chargement, setChargement] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const [actif, setActif] = useState(0);
  const conteneur = useRef<HTMLDivElement>(null);

  // L'index pèse plusieurs mégaoctets pour 36 000 entités : il n'est chargé
  // qu'au premier usage réel du champ, pas au démarrage de l'application.
  const charger = async () => {
    if (index || chargement) return;
    setChargement(true);
    try {
      setIndex(await store.search());
    } finally {
      setChargement(false);
    }
  };

  useEffect(() => {
    const clic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as globalThis.Node)) setOuvert(false);
    };
    document.addEventListener('mousedown', clic);
    return () => document.removeEventListener('mousedown', clic);
  }, []);

  const resultats = index && terme.trim().length >= 2 ? filtrer(index, terme) : [];

  const valider = (entry: SearchEntry) => {
    onSelect(entry);
    setTerme('');
    setOuvert(false);
  };

  return (
    <div className="recherche" ref={conteneur}>
      <input
        type="search"
        value={terme}
        placeholder="Rechercher une commune, un département, un ministère…"
        aria-label="Rechercher"
        autoComplete="off"
        onFocus={() => {
          void charger();
          setOuvert(true);
        }}
        onChange={(e) => {
          // Le focus ne suffit pas : un collage ou une saisie automatique peut
          // remplir le champ sans l'avoir déclenché.
          void charger();
          setTerme(e.target.value);
          setActif(0);
          setOuvert(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActif((a) => Math.min(a + 1, resultats.length - 1));
          }
          if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActif((a) => Math.max(a - 1, 0));
          }
          if (e.key === 'Enter' && resultats[actif]) valider(resultats[actif]);
          if (e.key === 'Escape') setOuvert(false);
        }}
      />

      {ouvert && terme.trim().length >= 2 && (
        <ul className="recherche__resultats" role="listbox">
          {/* Tant que l'index n'est pas là, l'absence de résultat ne veut rien
              dire : annoncer « aucun résultat » ferait croire à tort que la
              commune cherchée n'existe pas. */}
          {!index && <li className="recherche__info">Chargement de l'index…</li>}
          {index && resultats.length === 0 && (
            <li className="recherche__info">Aucun résultat.</li>
          )}
          {resultats.map((r, i) => (
            <li key={r.i}>
              <button
                type="button"
                role="option"
                aria-selected={i === actif}
                className={i === actif ? 'actif' : undefined}
                onMouseEnter={() => setActif(i)}
                onClick={() => valider(r)}
              >
                <span className="recherche__nom">{r.n}</span>
                <span className="recherche__contexte">{r.c}</span>
                <span className="recherche__montant">{euros(r.a)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function normaliser(texte: string): string {
  return texte
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Normaliser 36 000 libellés à chaque frappe serait perceptible : on le fait une fois. */
const cacheNoms = new WeakMap<SearchEntry[], string[]>();

function nomsNormalises(index: SearchEntry[]): string[] {
  let noms = cacheNoms.get(index);
  if (!noms) {
    noms = index.map((e) => normaliser(e.n));
    cacheNoms.set(index, noms);
  }
  return noms;
}

function filtrer(index: SearchEntry[], terme: string): SearchEntry[] {
  const q = normaliser(terme);
  if (!q) return [];

  const noms = nomsNormalises(index);
  const debuts: SearchEntry[] = [];
  const contient: SearchEntry[] = [];

  for (let i = 0; i < index.length; i++) {
    const nom = noms[i];
    if (nom.startsWith(q)) debuts.push(index[i]);
    else if (contient.length < 12 && nom.includes(q)) contient.push(index[i]);
    if (debuts.length >= 12) break;
  }

  return [...debuts, ...contient].slice(0, 12);
}
