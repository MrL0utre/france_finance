import { useState } from 'react';
import type { Mesure } from '../data/simulation';
import { LIBELLES, type Instrument } from '../modeles/instruments';
import { euros } from '../format';

/**
 * Création de mesures absentes de la nomenclature publiée : une taxe nouvelle,
 * une dépense nouvelle. Supprimer ou modifier un poste existant se fait dans les
 * colonnes ci-dessus ; ce bloc sert à ce qui n'existe pas encore.
 *
 * L'utilisateur choisit lui-même la nature de la mesure, faute de libellé
 * publié à analyser : c'est elle qui détermine le multiplicateur appliqué.
 */
const NATURES: Instrument[] = [
  'impot_menages',
  'impot_consommation',
  'impot_entreprises',
  'cotisations',
  'investissement',
  'fonctionnement',
  'transferts',
];

export function MesuresLibres({
  mesures,
  onAjouter,
  onRetirer,
}: {
  mesures: Mesure[];
  onAjouter: (m: Mesure) => void;
  onRetirer: (id: string) => void;
}) {
  const [label, setLabel] = useState('');
  const [cote, setCote] = useState<'rec' | 'dep'>('rec');
  const [milliards, setMilliards] = useState('');
  const [instrument, setInstrument] = useState<Instrument>('impot_menages');

  const montant = Number(milliards.replace(',', '.')) * 1e9;
  const valide = label.trim().length > 1 && Number.isFinite(montant) && montant > 0;

  const soumettre = () => {
    if (!valide) return;
    onAjouter({
      id: `libre:${Date.now().toString(36)}`,
      label: label.trim(),
      cote,
      montant,
      instrument,
    });
    setLabel('');
    setMilliards('');
  };

  return (
    <section className="mesures">
      <h3>Créer une mesure</h3>
      <p className="mesures__intro">
        Pour une taxe ou une dépense qui n'existe pas encore. Modifier ou supprimer un poste
        existant se fait dans les colonnes ci-dessus, en le portant à −100 %.
      </p>

      <form
        className="mesures__formulaire"
        onSubmit={(e) => {
          e.preventDefault();
          soumettre();
        }}
      >
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Intitulé de la mesure"
          aria-label="Intitulé de la mesure"
          maxLength={80}
        />
        <select
          value={cote}
          onChange={(e) => setCote(e.target.value as 'rec' | 'dep')}
          aria-label="Nature budgétaire"
        >
          <option value="rec">Recette</option>
          <option value="dep">Dépense</option>
        </select>
        <select
          value={instrument}
          onChange={(e) => setInstrument(e.target.value as Instrument)}
          aria-label="Nature économique, qui détermine le multiplicateur"
        >
          {NATURES.map((n) => (
            <option key={n} value={n}>
              {LIBELLES[n]}
            </option>
          ))}
        </select>
        <span className="mesures__montant">
          <input
            type="text"
            inputMode="decimal"
            value={milliards}
            onChange={(e) => setMilliards(e.target.value)}
            placeholder="0"
            aria-label="Montant annuel en milliards d'euros"
          />
          <span>Md €</span>
        </span>
        <button type="submit" disabled={!valide}>
          Ajouter
        </button>
      </form>

      {mesures.length > 0 && (
        <ul className="mesures__liste">
          {mesures.map((m) => (
            <li key={m.id}>
              <span className={`scenario__cote scenario__cote--${m.cote}`}>
                {m.cote === 'rec' ? 'Recette' : 'Dépense'}
              </span>
              <span className="mesures__label">{m.label}</span>
              <span className="mesures__nature">{LIBELLES[m.instrument as Instrument]}</span>
              <span className="mesures__valeur">{euros(m.montant)}</span>
              <button
                type="button"
                onClick={() => onRetirer(m.id)}
                aria-label={`Retirer ${m.label}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
