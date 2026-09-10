import { useMemo, useState } from 'react';
import type { Store } from '../data/store';
import { construireLeviers } from '../pilotage/leviers';
import { instrumentDe } from '../modeles/instruments';
import { CALIBRATIONS, MODELES } from '../modeles/registre';
import { satisfaction, VISAGES, LIBELLES_CANAL } from '../modeles/satisfaction';
import { optimiser, type Levier } from './recherche';
import { euros, eurosSigne, nombre } from '../format';
import type { Contexte } from '../modeles/types';
import type { Cote } from '../data/simulation';

/**
 * Recherche du « meilleur » scénario sous contraintes.
 *
 * C'est l'onglet le plus délicat de l'outil, et la raison tient en une phrase :
 * partout ailleurs, l'application calcule ce que l'utilisateur décide ; ici,
 * elle propose. Le projet s'est construit sur le refus d'émettre des
 * recommandations, et un onglet qui désigne un optimum en émet une, quelle que
 * soit la prudence des mots.
 *
 * La sortie retenue est de le prendre au sérieux plutôt que de le déguiser. Ce
 * que la page montre n'est pas « voici la bonne politique » mais « voici ce que
 * cette calibration-là tient pour le meilleur compromis — et voici ce que les
 * autres en pensent ». La comparaison entre calibrations est donc affichée à
 * côté du résultat, parce que c'est elle qui établit le point : l'optimum n'est
 * pas une propriété du budget, mais une conséquence des hypothèses retenues.
 *
 * La page a d'abord exposé des curseurs de préférence — activité contre humeur
 * — avant qu'une vérification ne montre qu'ils ne changeaient rien au scénario
 * retenu. Ils ont été retirés : voir la note sur les poids ci-dessous.
 */

const MD = 1e9;

export function Optimisation({
  store,
  modeleId,
  contexte,
  onAppliquer,
}: {
  store: Store;
  modeleId: string;
  contexte: Contexte | null;
  onAppliquer: (facteurs: { id: string; cote: Cote; facteur: number; label: string }[]) => void;
}) {
  const [cible, setCible] = useState(50);
  const [plancher, setPlancher] = useState(300);

  /**
   * Poids de l'objectif, fixes et non réglables.
   *
   * Ils l'ont été un temps, jusqu'à ce qu'une vérification montre qu'ils ne
   * changent rien au scénario retenu, seulement au score qui le note. La raison
   * est structurelle : le canal « prélèvements » de l'humeur pèse les euros
   * levés à l'identique quel que soit l'impôt, et le canal « services » ne
   * réagit qu'à la dépense. Aucun des deux ne départage donc deux impôts, et
   * les deux objectifs classent les leviers dans le même ordre — celui du
   * multiplicateur et de l'érosion.
   *
   * Plus profondément : ce modèle ignore qui paie. Sans dimension distributive,
   * une préférence pour l'humeur n'a rien à quoi mordre. Des curseurs qui ne
   * changeraient rien promettraient un arbitrage inexistant.
   */
  const POIDS_ACTIVITE = 1;
  const POIDS_HUMEUR = 1;

  const leviers = useMemo<Levier[]>(() => {
    const groupes = construireLeviers(store);
    const tous = [...groupes.recettes, ...groupes.depenses].flatMap((g) => g.leviers);
    return tous.flatMap((l) => {
      const node = store.nodes.get(l.id);
      if (!node) return [];
      return [
        {
          id: l.id,
          label: l.label,
          cote: l.cote,
          instrument: instrumentDe(node, l.cote),
          base: l.base,
          // Bornes volontairement larges d'un côté, prudentes de l'autre : on
          // laisse doubler un impôt, mais pas supprimer entièrement un service.
          min: 0.5,
          max: l.cote === 'rec' ? 2 : 1.5,
        },
      ];
    });
  }, [store]);

  const resultat = useMemo(() => {
    if (!contexte || leviers.length === 0) return null;
    return optimiser(leviers, CALIBRATIONS[modeleId] ?? CALIBRATIONS.comptable, contexte, {
      cibleSolde: cible * MD,
      plancherEmploi: plancher * 1000,
      poidsActivite: POIDS_ACTIVITE,
      poidsHumeur: POIDS_HUMEUR,
    });
  }, [leviers, modeleId, contexte, cible, plancher]);

  /** La même recherche passée dans chaque calibration : c'est la démonstration. */
  const parModele = useMemo(() => {
    if (!contexte || leviers.length === 0) return [];
    return MODELES.filter((m) => m.id !== 'comptable').map((m) => ({
      id: m.id,
      nom: m.nom,
      r: optimiser(leviers, CALIBRATIONS[m.id], contexte, {
        cibleSolde: cible * MD,
        plancherEmploi: plancher * 1000,
        poidsActivite: POIDS_ACTIVITE,
        poidsHumeur: POIDS_HUMEUR,
      }),
    }));
  }, [leviers, contexte, cible, plancher]);

  if (!contexte || !resultat) {
    return <p className="pilotage__vide">Chargement du cadrage macroéconomique…</p>;
  }

  const { effets } = resultat;
  const humeur = satisfaction(effets, contexte);
  const visage = VISAGES[humeur.humeur];
  const bouges = leviers
    .map((l) => ({ levier: l, facteur: resultat.facteurs.get(l.id) ?? 1 }))
    .filter((x) => x.facteur !== 1)
    .sort((a, b) => Math.abs(b.facteur - 1) * b.levier.base - Math.abs(a.facteur - 1) * a.levier.base);

  return (
    <div className="optim">
      <p className="optim__avertissement">
        <strong>Cette page propose, là où le reste de l'outil calcule.</strong> Elle ne dit pas
        quelle politique serait bonne — rien ici ne le permettrait. Elle dit ce que{' '}
        <em>ce modèle-là</em> tient pour le meilleur compromis, et le tableau du bas montre que
        les trois calibrations n'y répondent pas la même chose. L'optimum n'est pas une
        propriété du budget : c'est une conséquence des hypothèses macroéconomiques retenues.
      </p>

      <section className="optim__reglages">
        <label>
          <span>Améliorer le solde de</span>
          <input
            type="range"
            min={0}
            max={200}
            step={5}
            value={cible}
            onChange={(e) => setCible(Number(e.target.value))}
          />
          <strong>{cible} Md €</strong>
        </label>

        <label>
          <span>Sans détruire plus de</span>
          <input
            type="range"
            min={0}
            max={1500}
            step={50}
            value={plancher}
            onChange={(e) => setPlancher(Number(e.target.value))}
          />
          <strong>{nombre(plancher * 1000)} emplois</strong>
        </label>

      </section>

      {!resultat.cibleAtteinte && (
        <p className="optim__inatteignable">
          <strong>Cette cible n'est pas atteignable</strong> avec les leviers proposés et sous
          cette contrainte d'emploi. La recherche s'arrête à{' '}
          {eurosSigne(effets.soldeVariation)}. C'est un résultat, pas une panne : il dit que le
          compromis demandé n'existe pas dans ce modèle.
        </p>
      )}
      {!resultat.emploiRespecte && (
        <p className="optim__inatteignable">
          <strong>Le plancher d'emploi est franchi.</strong> Aucune combinaison trouvée ne tient
          la cible budgétaire en restant au-dessus.
        </p>
      )}

      <section className="optim__resultat">
        <div>
          <span>Solde</span>
          <strong className={effets.soldeVariation >= 0 ? 'pilotage--positif' : 'pilotage--negatif'}>
            {eurosSigne(effets.soldeVariation)}
          </strong>
        </div>
        <div>
          <span>Activité</span>
          <strong>
            {effets.pibPct >= 0 ? '+' : '−'}
            {Math.abs(effets.pibPct).toFixed(2).replace('.', ',')} %
          </strong>
        </div>
        <div>
          <span>Emplois</span>
          <strong>
            {effets.emploi >= 0 ? '+' : '−'}
            {nombre(Math.round(Math.abs(effets.emploi)))}
          </strong>
        </div>
        <div>
          <span>Humeur</span>
          <strong style={{ color: visage.couleur }}>
            {visage.emoji} {humeur.score.toFixed(1).replace('.', ',')}
          </strong>
        </div>
      </section>

      <section className="optim__bloc">
        <h3>Le scénario trouvé</h3>
        {bouges.length === 0 ? (
          <p className="pib__note">
            Aucun levier n'est déplacé : la cible est déjà atteinte sans rien changer.
          </p>
        ) : (
          <>
            <table className="effets__table">
              <thead>
                <tr>
                  <th scope="col">Poste</th>
                  <th scope="col">Réglage</th>
                  <th scope="col">Écart décidé</th>
                </tr>
              </thead>
              <tbody>
                {bouges.map(({ levier, facteur }) => (
                  <tr key={levier.id}>
                    <th scope="row">{levier.label}</th>
                    <td>{Math.round(facteur * 100)} %</td>
                    <td>{eurosSigne(levier.base * (facteur - 1))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className="optim__appliquer"
              onClick={() =>
                onAppliquer(
                  bouges.map(({ levier, facteur }) => ({
                    id: levier.id,
                    cote: levier.cote,
                    facteur,
                    label: levier.label,
                  })),
                )
              }
            >
              Charger ce scénario dans le simulateur
            </button>
          </>
        )}
      </section>

      <section className="optim__bloc">
        <h3>La même cible, vue par chaque calibration</h3>
        <p className="pib__intro">
          Rien n'a changé du budget ni de la contrainte : seules les hypothèses
          macroéconomiques diffèrent. Elles suffisent à désigner un autre compromis.
        </p>
        <table className="effets__table">
          <thead>
            <tr>
              <th scope="col">Calibration</th>
              <th scope="col">Solde</th>
              <th scope="col">Activité</th>
              <th scope="col">Ce qu'elle retient</th>
            </tr>
          </thead>
          <tbody>
            {parModele.map(({ id, nom, r }) => (
              <tr key={id} className={id === modeleId ? 'optim--actif' : undefined}>
                <th scope="row">{nom}</th>
                <td>{eurosSigne(r.effets.soldeVariation)}</td>
                <td>
                  {r.effets.pibPct >= 0 ? '+' : '−'}
                  {Math.abs(r.effets.pibPct).toFixed(2).replace('.', ',')} %
                </td>
                <td className="optim__choix">
                  {leviers
                    .map((l) => ({ l, f: r.facteurs.get(l.id) ?? 1 }))
                    .filter((x) => x.f !== 1)
                    .map((x) => `${x.l.label} ${Math.round(x.f * 100)} %`)
                    .join(' · ') || 'rien'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="optim__bloc">
        <h3>Ce que cette recherche ne fait pas</h3>
        <ul className="optim__limites">
          <li>
            <strong>Elle exploite les coefficients, elle ne les valide pas.</strong> Si elle
            privilégie un impôt, c'est parce que le modèle lui prête le multiplicateur le plus
            faible et l'érosion la plus douce — deux valeurs choisies. Le tableau ci-dessus le
            montre : changer de calibration change le gagnant.
          </li>
          <li>
            <strong>Elle ignore qui paie.</strong> Le modèle n'a aucune dimension distributive :
            un euro prélevé pèse autant qu'il vienne d'un ménage modeste ou d'une grande
            fortune. C'est pourquoi une préférence pour l'humeur plutôt que pour l'activité ne
            change pas le scénario retenu — elle n'a rien à quoi mordre.
          </li>
          <li>
            <strong>Elle ne connaît ni la justice, ni le droit, ni le possible.</strong> Répartir
            un effort entre ménages et entreprises, ce que la Constitution autorise, ce qu'un
            Parlement voterait : rien de tout cela n'entre dans le calcul.
          </li>
          <li>
            <strong>Elle cherche, elle ne démontre pas.</strong> La descente par coordonnées
            trouve un bon point, pas nécessairement le meilleur : le problème n'est pas convexe,
            et aucune méthode simple ne garantirait l'optimum global.
          </li>
          <li>
            <strong>Elle raisonne sur une seule année.</strong> Le report d'activité d'une année
            sur l'autre, visible dans la projection, n'entre pas dans ce qu'elle optimise.
          </li>
        </ul>
        <p className="pib__note">
          Décomposition de l'humeur obtenue&nbsp;:{' '}
          {humeur.canaux
            .map(
              (c) =>
                `${LIBELLES_CANAL[c.canal]} ${c.contribution >= 0 ? '+' : '−'}${Math.abs(c.contribution).toFixed(1).replace('.', ',')}`,
            )
            .join(' · ')}
          . Recherche stabilisée en {resultat.passes} passe{resultat.passes > 1 ? 's' : ''} sur{' '}
          {leviers.length} leviers. Solde de départ&nbsp;: {euros(Math.abs(contexte.soldeBase))} de
          déficit.
        </p>
      </section>
    </div>
  );
}
