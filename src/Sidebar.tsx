export type Vue = 'explorer' | 'piloter' | 'comparer';

const VUES: { cle: Vue; label: string }[] = [
  { cle: 'explorer', label: 'Explorer' },
  { cle: 'piloter', label: 'Piloter' },
  { cle: 'comparer', label: 'Comparer les modèles' },
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

      <ul className="barre__liens">
        {VUES.map((v) => (
          <li key={v.cle}>
            <button
              type="button"
              className={vue === v.cle ? 'actif' : undefined}
              onClick={() => onVue(v.cle)}
            >
              {v.label}
            </button>
          </li>
        ))}
        <li>
          <button type="button" onClick={onMethodologie}>
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
