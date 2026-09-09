import { useEffect, useRef, useState } from 'react';

export type Vue = 'explorer' | 'piloter' | 'comparer' | 'pib';

const VUES: { cle: Vue; label: string }[] = [
  { cle: 'explorer', label: 'Explorer' },
  { cle: 'piloter', label: 'Piloter' },
  { cle: 'comparer', label: 'Comparer les modèles' },
  { cle: 'pib', label: "L'économie française" },
];

export function Sidebar({
  vue,
  onVue,
  onMethodologie,
}: {
  vue: Vue;
  onVue: (v: Vue) => void;
  onMethodologie: () => void;
}) {
  /**
   * Menu déroulant des écrans étroits.
   *
   * Sous 1100 px la barre passe en bandeau horizontal et les liens n'y tiennent
   * plus : ils étaient simplement masqués, donc les vues « Piloter » et
   * « Comparer » devenaient inatteignables. Un bouton les rappelle à la demande,
   * ce qui les rend accessibles sans rien prendre à la vue le reste du temps.
   */
  const [ouvert, setOuvert] = useState(false);
  const bouton = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLUListElement>(null);

  // À l'ouverture, le focus entre dans le menu ; à la fermeture, il revient au
  // bouton. Sans quoi la navigation au clavier repartirait du haut de la page.
  useEffect(() => {
    if (ouvert) liste.current?.querySelector('button')?.focus();
  }, [ouvert]);

  const fermer = () => {
    setOuvert(false);
    bouton.current?.focus();
  };

  useEffect(() => {
    if (!ouvert) return;
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer();
    };
    document.addEventListener('keydown', auClavier);
    return () => document.removeEventListener('keydown', auClavier);
  }, [ouvert]);

  const choisir = (action: () => void) => {
    action();
    setOuvert(false);
  };

  return (
    <nav className="barre">
      <div className="barre__marque">
        <span className="barre__embleme" aria-hidden>
          ▮▮▮
        </span>
        <div>
          <strong>Finances Publiques</strong>
          {/* Projet indépendant : ni le nom ni l'identité visuelle de l'État ne
              doivent figurer ici. La Licence Ouverte sous laquelle les données
              sont réutilisées interdit de laisser croire à un aval officiel. */}
          <span>Projet indépendant · données ouvertes</span>
        </div>
      </div>

      {/* Masqué sur écran large, où les liens sont déjà tous visibles. */}
      <button
        type="button"
        ref={bouton}
        className="barre__menu"
        aria-expanded={ouvert}
        aria-controls="barre-liens"
        aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
        onClick={() => (ouvert ? fermer() : setOuvert(true))}
      >
        <span aria-hidden>{ouvert ? '✕' : '☰'}</span>
      </button>

      {/* Referme le menu au premier geste à côté, comme n'importe quel menu. */}
      {ouvert && <div className="barre__voile" onClick={fermer} />}

      <ul
        id="barre-liens"
        ref={liste}
        className={ouvert ? 'barre__liens barre__liens--ouvert' : 'barre__liens'}
      >
        {VUES.map((v) => (
          <li key={v.cle}>
            <button
              type="button"
              className={vue === v.cle ? 'actif' : undefined}
              onClick={() => choisir(() => onVue(v.cle))}
            >
              {v.label}
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={() => choisir(onMethodologie)}>
            Méthodologie et sources
          </button>
        </li>
      </ul>

      <footer className="barre__pied">
        <p>Sources</p>
        <p>OFGL · Direction du Budget · Direction de la sécurité sociale · Insee</p>
        <p>Exercices 2024–2025</p>
      </footer>
    </nav>
  );
}
