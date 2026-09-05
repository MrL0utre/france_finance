import { useEffect, useState } from 'react';
import { euros, nombre } from './format';

type Controle = {
  label: string;
  groupe: string;
  ok: boolean;
  attendu: number;
  obtenu: number;
  ecart: number;
  unite: 'euros' | 'nombre';
};

type Rapport = {
  genereLe: string;
  passes: number;
  echecs: number;
  controles: Controle[];
};

/** Au-delà, le groupe est replié par défaut pour rester survolable. */
const SEUIL_REPLI = 6;

export function Controles() {
  const [rapport, setRapport] = useState<Rapport | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/controles.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setRapport)
      .catch((e: unknown) => setErreur(e instanceof Error ? e.message : String(e)));
  }, []);

  if (erreur) {
    return (
      <section>
        <p className="controles__vide">
          Rapport indisponible ({erreur}). Lancez <code>npm run data:build</code> pour le produire.
        </p>
      </section>
    );
  }

  if (!rapport) return <p className="controles__vide">Chargement du rapport…</p>;

  const groupes = [...new Map(rapport.controles.map((c) => [c.groupe, [] as Controle[]])).keys()].map(
    (nom) => ({ nom, lignes: rapport.controles.filter((c) => c.groupe === nom) }),
  );

  return (
    <>
      <section>
        <div className={rapport.echecs === 0 ? 'controles__bilan' : 'controles__bilan controles__bilan--echec'}>
          <strong>
            {rapport.echecs === 0
              ? `${rapport.passes} contrôles passés`
              : `${rapport.echecs} contrôle${rapport.echecs > 1 ? 's' : ''} en échec sur ${rapport.passes + rapport.echecs}`}
          </strong>
          <span>
            Rapport produit avec les données, le{' '}
            {new Date(rapport.genereLe).toLocaleString('fr-FR', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </span>
        </div>

        <p>
          Chaque construction des données rejoue ces assertions et échoue si l'une d'elles casse.
          Elles vérifient que les montants s'emboîtent — un parent égale toujours la somme de ses
          enfants, des deux côtés du budget — et qu'aucune entité présente dans les sources n'a été
          perdue en chemin.
        </p>
        <p className="controles__limite">
          <strong>Ce que cela ne prouve pas.</strong> Ces contrôles portent sur la cohérence
          interne, pas sur l'exactitude des sources : une erreur de correspondance qui resterait
          cohérente avec elle-même passerait sans être détectée. Les liens vers les jeux de données
          d'origine, plus bas, restent le seul moyen de vérifier les montants eux-mêmes.
        </p>
      </section>

      {groupes.map((g) => (
        <Groupe key={g.nom} nom={g.nom} lignes={g.lignes} />
      ))}
    </>
  );
}

function Groupe({ nom, lignes }: { nom: string; lignes: Controle[] }) {
  const echecs = lignes.filter((l) => !l.ok);
  // Un groupe qui casse s'ouvre toujours : c'est ce qu'on vient regarder.
  const [ouvert, setOuvert] = useState(echecs.length > 0 || lignes.length <= SEUIL_REPLI);
  const repliable = lignes.length > SEUIL_REPLI && echecs.length === 0;

  return (
    <section className="controles__groupe">
      <h3>
        {repliable ? (
          <button type="button" className="controles__bascule" onClick={() => setOuvert(!ouvert)}>
            {ouvert ? '▾' : '▸'} {nom}
          </button>
        ) : (
          nom
        )}
        <span className={echecs.length ? 'controles__badge--echec' : 'controles__badge'}>
          {echecs.length ? `${echecs.length} en échec` : `${lignes.length}/${lignes.length} ✓`}
        </span>
      </h3>

      {ouvert && (
        <table className="controles__table">
          <thead>
            <tr>
              <th scope="col">Contrôle</th>
              <th scope="col">Attendu</th>
              <th scope="col">Obtenu</th>
              <th scope="col">Écart</th>
            </tr>
          </thead>
          <tbody>
            {lignes.map((l) => (
              <tr key={l.label} className={l.ok ? undefined : 'controles__ligne--echec'}>
                <th scope="row">
                  <span aria-hidden>{l.ok ? '✓' : '✗'}</span> {l.label}
                </th>
                <td>{formater(l.attendu, l.unite)}</td>
                <td>{formater(l.obtenu, l.unite)}</td>
                <td>{l.ecart === 0 ? '—' : formater(l.ecart, l.unite)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function formater(valeur: number, unite: Controle['unite']): string {
  return unite === 'euros' ? euros(valeur) : nombre(valeur, 0);
}
