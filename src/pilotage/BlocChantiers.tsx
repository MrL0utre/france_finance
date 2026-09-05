import { useState } from 'react';
import type { Chantier } from '../schema';
import type { ChantierRetenu } from '../data/simulation';
import { euros } from '../format';

/** Horizon de la projection, et donc décalage maximal d'un démarrage. */
export const HORIZON = 10;

/**
 * Grands chantiers.
 *
 * Le catalogue donne des repères de coût sourcés, chacun assorti de sa fiche.
 * Ces entrées ne prétendent pas que les projets cités restent à financer —
 * plusieurs sont engagés ou achevés : elles servent de calibre pour un chantier
 * d'ampleur comparable. Un chantier sur mesure permet de traiter ce que le
 * catalogue ne couvre pas, à condition d'en fournir soi-même le coût.
 */
export function BlocChantiers({
  catalogue,
  retenus,
  premiereAnnee,
  onAjouter,
  onRetirer,
}: {
  catalogue: Chantier[];
  retenus: ChantierRetenu[];
  premiereAnnee: number;
  onAjouter: (c: ChantierRetenu) => void;
  onRetirer: (id: string) => void;
}) {
  const [libre, setLibre] = useState(false);
  const [label, setLabel] = useState('');
  const [milliards, setMilliards] = useState('');
  const [duree, setDuree] = useState('5');

  const cout = Number(milliards.replace(',', '.')) * 1e9;
  const dureeNum = Number(duree);
  const valide =
    label.trim().length > 1 &&
    Number.isFinite(cout) &&
    cout > 0 &&
    Number.isInteger(dureeNum) &&
    dureeNum > 0 &&
    dureeNum <= 30;

  const fiche = (r: ChantierRetenu) => catalogue.find((c) => c.id === r.ref);

  return (
    <section className="chantiers">
      <h3>Grands chantiers</h3>
      <p className="chantiers__intro">
        Un investissement dont la dépense s'étale sur plusieurs années, puis s'arrête. Son effet
        n'apparaît qu'en projection pluriannuelle, dans <strong>Comparer les modèles</strong>.
      </p>

      <ul className="chantiers__catalogue">
        {catalogue.map((c) => {
          const dejaRetenu = retenus.some((r) => r.ref === c.id);
          return (
            <li key={c.id}>
              <div className="chantiers__fiche">
                <strong>{c.label}</strong>
                <span>
                  {euros(c.cout)} sur {c.dureeAnnees} ans · {euros(c.cout / c.dureeAnnees)} par an
                </span>
                <p title={c.note}>{c.note}</p>
                <a href={c.source.url} target="_blank" rel="noreferrer">
                  {c.source.label}
                </a>
              </div>
              <button
                type="button"
                disabled={dejaRetenu}
                onClick={() =>
                  onAjouter({ id: `ch:${c.id}`, ref: c.id, debut: 0 })
                }
              >
                {dejaRetenu ? 'Retenu' : 'Ajouter'}
              </button>
            </li>
          );
        })}
      </ul>

      <button type="button" className="chantiers__bascule" onClick={() => setLibre(!libre)}>
        {libre ? '▾' : '▸'} Créer un chantier sur mesure
      </button>

      {libre && (
        <form
          className="chantiers__formulaire"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valide) return;
            onAjouter({
              id: `ch:libre:${Date.now().toString(36)}`,
              ref: 'libre',
              debut: 0,
              label: label.trim(),
              cout,
              dureeAnnees: dureeNum,
            });
            setLabel('');
            setMilliards('');
          }}
        >
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Intitulé du chantier"
            aria-label="Intitulé du chantier"
            maxLength={80}
          />
          <span className="chantiers__champ">
            <input
              type="text"
              inputMode="decimal"
              value={milliards}
              onChange={(e) => setMilliards(e.target.value)}
              placeholder="0"
              aria-label="Coût total en milliards d'euros"
            />
            <span>Md €</span>
          </span>
          <span className="chantiers__champ">
            <input
              type="number"
              value={duree}
              min={1}
              max={30}
              onChange={(e) => setDuree(e.target.value)}
              aria-label="Durée en années"
            />
            <span>ans</span>
          </span>
          <button type="submit" disabled={!valide}>
            Ajouter
          </button>
        </form>
      )}

      {retenus.length > 0 && (
        <ul className="chantiers__retenus">
          {retenus.map((r) => {
            const f = fiche(r);
            const cout = r.cout ?? f?.cout ?? 0;
            const duree = r.dureeAnnees ?? f?.dureeAnnees ?? 0;
            return (
              <li key={r.id}>
                <span className="chantiers__label">{r.label ?? f?.label ?? 'Chantier'}</span>
                <span className="chantiers__montant">
                  {euros(cout)} sur {duree} ans
                </span>
                <span className="chantiers__debut">
                  démarrage&nbsp;
                  <select
                    value={r.debut}
                    onChange={(e) => onAjouter({ ...r, debut: Number(e.target.value) })}
                    aria-label={`Année de démarrage de ${r.label ?? f?.label ?? 'ce chantier'}`}
                  >
                    {Array.from({ length: HORIZON }, (_, i) => (
                      <option key={i} value={i}>
                        {/* Une année n'est pas un montant : pas de séparateur de milliers. */}
                        {premiereAnnee + i}
                      </option>
                    ))}
                  </select>
                </span>
                <button type="button" onClick={() => onRetirer(r.id)} aria-label="Retirer">
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
