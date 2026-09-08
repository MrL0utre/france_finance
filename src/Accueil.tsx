import { useEffect, useRef } from 'react';
import { DEPOT } from './depot';

/**
 * Message d'accueil, affiché à la première visite.
 *
 * Il ne dit rien que la page « Méthodologie et sources » ne dise déjà, mais il
 * le dit avant que le visiteur ait vu un chiffre : trois montants côte à côte
 * ressemblent à un compte officiel, et il vaut mieux avoir prévenu du contraire
 * que d'avoir à corriger l'impression ensuite.
 *
 * Une seule fois par navigateur, cependant. Un avertissement qui reparaît à
 * chaque visite se ferme sans être lu, ce qui le rend inutile au moment même où
 * il compterait.
 */

const CLE_VU = 'finances-france:accueil-vu';

export function accueilDejaVu(): boolean {
  try {
    return localStorage.getItem(CLE_VU) === '1';
  } catch {
    // Navigation privée ou stockage refusé : mieux vaut le montrer une fois de
    // trop que pas du tout.
    return false;
  }
}

export function marquerAccueilVu(): void {
  try {
    localStorage.setItem(CLE_VU, '1');
  } catch {
    // Sans stockage, le message reparaîtra au prochain chargement. C'est le
    // défaut le moins grave.
  }
}

export function Accueil({ onFermer }: { onFermer: () => void }) {
  const bouton = useRef<HTMLButtonElement>(null);

  // Le focus part sur le bouton de fermeture : au clavier comme au lecteur
  // d'écran, la première action possible doit être de sortir du message.
  useEffect(() => {
    bouton.current?.focus();
  }, []);

  useEffect(() => {
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFermer();
    };
    document.addEventListener('keydown', auClavier);
    return () => document.removeEventListener('keydown', auClavier);
  }, [onFermer]);

  return (
    <div
      className="modale"
      role="dialog"
      aria-modal="true"
      aria-labelledby="accueil-titre"
      // Cliquer à côté ferme, comme partout ailleurs ; le clic sur le contenu
      // lui-même ne doit évidemment pas remonter jusqu'ici.
      onClick={onFermer}
    >
      <div className="modale__contenu accueil" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 id="accueil-titre">Avant de commencer</h2>
        </header>

        <section className="modale__alerte">
          <p>
            <strong>Projet indépendant, sans lien avec une administration.</strong> Il n'émane
            d'aucun service public, n'est ni validé ni soutenu par les organismes dont il
            réutilise les données ouvertes, et ne saurait engager leur responsabilité.
          </p>
          <p>
            <strong>Il peut comporter des erreurs et des approximations.</strong> Les données sont
            recomposées, agrégées et parfois estimées ; les hypothèses de simulation sont des
            ordres de grandeur, affichés et modifiables. Aucun résultat n'a valeur de prévision,
            et aucun chiffre n'est à citer sans remonter à sa source.
          </p>
        </section>

        <section>
          <h3>Ce que vous allez voir</h3>
          <ul className="accueil__sources">
            <li>
              <strong>État</strong> — projet de loi de finances pour 2025 (PLF 2025), budget
              général. Ce sont des <strong>montants prévus, jamais votés</strong> : ce texte n'a
              pas été adopté. Ils ne décrivent aucune dépense réellement effectuée.
            </li>
            <li>
              <strong>Collectivités territoriales</strong> — comptes <strong>exécutés 2024</strong>{' '}
              des régions, départements, groupements et communes (OFGL). Dépenses réalisées, donc,
              et non prévues.
            </li>
            <li>
              <strong>Sécurité sociale</strong> — chiffres clés <strong>constatés 2024</strong>{' '}
              (Direction de la sécurité sociale).
            </li>
          </ul>
          <p>
            Les millésimes diffèrent d'un périmètre à l'autre, et la nature des montants aussi.
            Chaque chiffre porte la sienne au contact ; la page « Méthodologie et sources » les
            détaille toutes.
          </p>
        </section>

        <section>
          <h3>Contribuer, corriger</h3>
          <p>
            Une donnée fausse, un calcul incohérent, une source mal créditée : signalez-les à{' '}
            <a href="mailto:administrateur@monplf.fr">administrateur@monplf.fr</a>. Les
            corrections sont bienvenues, les désaccords méthodologiques aussi.
          </p>
          <p>
            Le code, les données et les contrôles de cohérence sont publics et vérifiables —
            c'est le sens de la licence retenue.{' '}
            <a href={DEPOT} target="_blank" rel="noreferrer">
              Consulter ou contribuer au code source
            </a>
            .
          </p>
        </section>

        <div className="accueil__actions">
          <button type="button" ref={bouton} onClick={onFermer}>
            J'ai compris, explorer les données
          </button>
        </div>
      </div>
    </div>
  );
}
