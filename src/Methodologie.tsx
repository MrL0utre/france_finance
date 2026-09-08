import { useState } from 'react';
import type { SourceRef } from './schema';
import { Controles } from './Controles';
import { DEPOT } from './depot';

export function Methodologie({
  sources,
  onClose,
}: {
  sources: Map<string, SourceRef>;
  onClose: () => void;
}) {
  const [onglet, setOnglet] = useState<'methode' | 'controles'>('methode');

  return (
    <div className="modale" role="dialog" aria-modal="true" aria-label="Méthodologie et sources">
      <div className="modale__contenu">
        <header>
          <h2>Méthodologie et sources</h2>
          <button type="button" onClick={onClose} aria-label="Fermer">
            ×
          </button>
        </header>

        <div className="modale__onglets" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={onglet === 'methode'}
            onClick={() => setOnglet('methode')}
          >
            Méthodologie
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={onglet === 'controles'}
            onClick={() => setOnglet('controles')}
          >
            Contrôles de cohérence
          </button>
        </div>

        {onglet === 'controles' && <Controles />}

        {onglet === 'methode' && (
          <>
        <section className="modale__alerte">
          <h3>Ce qu'est ce projet, et ce qu'il n'est pas</h3>
          <p>
            <strong>Projet indépendant, sans lien avec une administration.</strong> Il n'émane
            d'aucun service public, n'est ni validé ni soutenu par les organismes dont il
            réutilise les données, et ne saurait engager leur responsabilité.
          </p>
          <p>
            <strong>Il n'émet aucune recommandation ni conclusion.</strong> Il affiche des données
            publiques et calcule les scénarios que vous construisez, sous des hypothèses affichées
            et modifiables. Il ne dit pas ce qu'il faudrait faire ; l'onglet « Comparer les
            modèles » existe précisément pour montrer que la réponse dépend d'hypothèses sur
            lesquelles les économistes ne s'accordent pas.
          </p>
          <p>
            <strong>Les chiffres sont sourcés, les hypothèses sont affichées.</strong> La
            législation fiscale provient d'OpenFisca et renvoie au Code général des impôts. Les
            multiplicateurs, en revanche, ne sont pas des valeurs officielles : ce sont des ordres
            de grandeur repris de la littérature publique, visibles dans l'interface et réglables.
            Aucun résultat n'a valeur de prévision.
          </p>
          <p>
            <strong>Développé avec l'assistance de Claude</strong> (Anthropic). L'intégralité du
            code, des sources et des contrôles de cohérence est publique et vérifiable, sous
            licence AGPL.
          </p>
          <p>
            <strong>Aucune donnée personnelle.</strong> Ni compte, ni traceur, ni cookie, ni
            mesure d'audience. Votre scénario reste dans votre navigateur et dans l'URL, et
            n'est transmis à personne : contrairement à un cookie, il n'accompagne aucune
            requête, et l'application n'appelle que ses propres fichiers. Un lien partagé
            n'existe que si vous le copiez vous-même. Il reste lisible sur votre machine, en
            clair, comme toute donnée de site.
          </p>
          <p>
            <strong>Signaler une erreur.</strong>{' '}
            <a href="mailto:administrateur@monplf.fr">administrateur@monplf.fr</a> — une donnée
            fausse, un calcul incohérent ou une source mal créditée méritent d'être corrigés.
          </p>
        </section>

        <section>
          <h3>Ce que montre cet outil</h3>
          <p>
            Trois périmètres de finances publiques, explorables jusqu'au dernier niveau publié en
            données ouvertes : les crédits de l'État par ministère, mission, programme et action et
            ses recettes par nature d'impôt ; les comptes de chaque région, département,
            intercommunalité et commune, des deux côtés du budget ; les prestations et produits de
            la sécurité sociale.
          </p>
          <p>
            Le sélecteur <strong>Dépenses / Recettes / Solde</strong> change la mesure affichée sans
            changer l'endroit où vous vous trouvez dans le graphe.
          </p>
        </section>

        <section>
          <h3>Ce que le mode Solde peut et ne peut pas montrer</h3>
          <p>
            Pour les collectivités, le solde a un sens à chaque échelon, car les deux côtés
            décrivent la même entité. L'OFGL publie d'ailleurs lui-même une « capacité ou besoin de
            financement » : le pipeline vérifie que recettes − dépenses lui est égal pour les
            36 249 collectivités, et l'écart maximal constaté est nul. Le solde de la section de
            fonctionnement correspond à l'épargne brute.
          </p>
          <p>
            Pour l'État et la Sécurité sociale, le solde ne descend pas plus bas que la sphère : un
            ministère ne perçoit pas de recettes et une ligne d'impôt ne porte pas de dépenses, leur
            différence n'aurait aucun sens. Le solde de la Sécurité sociale est en outre celui
            publié (−15,3 Md € en 2024) plutôt qu'une soustraction, car ses dépenses affichées
            (prestations par branche, brutes) et ses recettes (produits consolidés) ne couvrent pas
            le même périmètre.
          </p>
        </section>

        <section className="modale__alerte">
          <h3>Ce que fait — et ne fait pas — le simulateur</h3>
          <p>
            Régler le curseur d'un poste met à l'échelle tout ce qu'il contient et remonte l'écart
            dans les totaux au-dessus de lui. Les ajustements se composent : réduire un ministère de
            10 % puis l'une de ses missions de 50 % laisse cette mission à 45 % de son montant
            initial. Dans la liste du scénario, chaque ligne affiche ce qu'elle retire ou ajoute
            <em> en propre</em>, de sorte que les lignes somment exactement à l'effet annoncé.
          </p>
          <p>
            <strong>La simulation est purement comptable.</strong> Les montants sont recalculés par
            arithmétique : une baisse de dépense ne modifie pas les recettes, une hausse d'impôt ne
            modifie ni l'activité, ni l'emploi, ni les prestations sociales versées. Or ces effets
            en retour sont réels et parfois du même ordre de grandeur que la mesure elle-même. Les
            chiffres produits ici décrivent donc une arithmétique budgétaire, pas une prévision.
          </p>
          <p>
            Le solde n'est pas réglable directement : c'est un résultat. On agit sur les dépenses ou
            sur les recettes, et on lit la conséquence.
          </p>
        </section>

        <section className="modale__alerte">
          <h3>Les modèles de bouclage</h3>
          <p>
            Un modèle décrit comment l'économie réagit aux décisions budgétaires. Quatre sont
            proposés, un seul actif à la fois. Le modèle <strong>Comptable</strong> — un euro coupé
            est un euro économisé — n'est pas l'absence de modèle : c'est l'hypothèse, très forte,
            que l'activité ne réagit pas du tout. Les trois autres appliquent des multiplicateurs
            croissants.
          </p>
          <p>
            <strong>Ce ne sont pas des implémentations de Mésange ni d'aucun modèle
            institutionnel.</strong> Mésange compte environ 1 800 équations et ne s'exécute qu'avec
            un logiciel propriétaire ; il est hors de portée d'une application sans serveur. Ce sont
            quatre calibrations d'un même moteur simplifié, statique et linéaire.
          </p>
          <p>
            <strong>Les coefficients sont les nôtres.</strong> Choisis ronds, ils traduisent des
            régularités largement admises — la dépense pèse plus que l'impôt à euro égal,
            l'investissement plus que le fonctionnement — mais ne sont extraits d'aucun modèle
            institutionnel, et notamment pas des variantes chiffrées que Mésange publie. Le lien
            vers sa documentation est donné pour approfondir, non comme provenance. Le panneau
            <strong>Piloter</strong> les affiche en regard d'estimations publiées, recensées par
            FIPECO, pour que l'écart se voie plutôt que de nous croire sur parole.
          </p>
          <p>
            L'onglet <strong>Comparer les modèles</strong> passe un même scénario dans les quatre.
            L'écart entre les résultats n'est pas une incertitude statistique : il mesure ce que le
            choix d'hypothèses, et non les données, apporte à la conclusion. C'est le chiffre le
            plus solide que cette page puisse produire.
          </p>
          <p>
            Trois limites communes à tous : les effets sont supposés se produire en un an, les
            multiplicateurs ne dépendent pas de la conjoncture, et ni la dette ni sa charge
            d'intérêt n'interviennent. Le classement d'un poste en instrument — investissement,
            transfert, impôt sur les entreprises — est affiché dans le tableau des effets, car il
            détermine le multiplicateur appliqué.
          </p>
        </section>

        <section>
          <h3>Le barème de l'impôt sur le revenu</h3>
          <p>
            Le barème, la décote et le plafond du quotient familial proviennent d'OpenFisca, moteur
            ouvert de la législation socio-fiscale française, interrogé au moment de la construction
            des données. Chaque tranche est réglable en taux comme en seuil.
          </p>
          <p>
            Réimplémenter une législation fiscale est risqué : une erreur y est invisible. Le
            pipeline demande donc aussi à OpenFisca l'impôt dû par 28 foyers types, puis confronte
            notre propre calcul au sien. <strong>L'écart maximal constaté est de 0,45 €</strong>,
            plafonnement du quotient familial compris. Un cas type qui ne concorderait pas serait
            retiré de l'affichage plutôt que corrigé à l'aveugle.
          </p>
          <p>
            <strong>Cet effet ne remonte pas au solde.</strong> Chiffrer le rendement d'une réforme
            du barème supposerait de connaître le revenu imposable présent dans chaque tranche —
            relever le taux à 11 % renchérit l'impôt de tous les foyers situés au-dessus du seuil,
            pas des seuls foyers de cette tranche. Cette statistique n'est pas publiée en données
            ouvertes exploitables. Le panneau dit donc qui paie combien, pas ce que la mesure
            rapporte ; le levier agrégé reste dans la colonne Recettes.
          </p>
        </section>

        <section className="modale__alerte">
          <h3>La dette et les taux d'emprunt</h3>
          <p>
            La charge de la dette — 54,2 Md € au budget général 2025 — figure dans la mission
            « Engagements financiers de l'État ». Elle est reprise dans la vue Piloter pour être
            réglable directement.
          </p>
          <p>
            <strong>Un État ne renégocie pas sa dette.</strong> Ses titres déjà émis portent un
            taux fixé à l'émission et sont remboursés à l'échéance : il n'existe pas d'équivalent
            souverain au rachat de crédit immobilier. Une variation de taux ne s'applique donc
            qu'à la dette réémise dans l'année — de l'ordre du programme de financement, environ
            300 Md € — puis se propage à l'encours au rythme de son renouvellement, soit près de
            neuf ans en France.
          </p>
          <p>
            L'écart est considérable : un point de taux en plus coûte environ{' '}
            <strong>3 Md € la première année</strong>, contre <strong>28,8 Md € à terme</strong>.
            Appliquer d'emblée le point de taux à tout l'encours — l'erreur la plus répandue —
            surestimerait le surcoût immédiat d'un facteur dix. Seul l'effet de la première année
            entre dans le solde simulé ; celui à terme n'est donné qu'en repère.
          </p>
        </section>

        <section>
          <h3>Créer une taxe ou une dépense</h3>
          <p>
            Modifier ou supprimer un poste existant se fait avec son curseur, en le portant au
            besoin à −100 %. Pour ce qui n'existe pas encore, la vue Piloter permet de créer une
            mesure : un intitulé, un montant, et la nature économique qui détermine son
            multiplicateur. Ces mesures voyagent dans le lien partagé au même titre que les autres
            ajustements.
          </p>
        </section>

        <section className="modale__alerte">
          <h3>Projections pluriannuelles et grands chantiers</h3>
          <p>
            L'onglet « Comparer les modèles » déroule le scénario sur dix ans. Deux mécanismes y
            deviennent visibles : les chantiers, dont la dépense s'étale puis cesse, et la boucle
            dette-intérêts, où un déficit accru alourdit la charge, qui creuse à son tour le
            déficit suivant. Les intérêts portent sur la dette des années précédentes, si bien que
            la première année n'en supporte aucun.
          </p>
          <p>
            <strong>Tout y est exprimé en écart au scénario de référence.</strong> Aucune prévision
            de croissance, d'inflation ou de solde tendanciel n'est faite : la projection dit ce que
            le scénario change, pas où en seront les finances publiques. Un ajustement de poste est
            supposé reconduit chaque année ; un chantier s'arrête au terme de sa durée, sa dépense
            étant répartie également faute de calendrier publié.
          </p>
          <p>
            Le catalogue de chantiers donne des repères de coût sourcés. <strong>Il ne prétend pas
            que ces projets restent à financer</strong> — plusieurs sont engagés ou achevés : ils
            servent de calibre pour un chantier d'ampleur comparable. Chaque fiche porte sa source
            et ses réserves, dont l'écart entre l'estimation d'EDF et celle de la Cour des comptes
            pour les EPR2, et le précédent de Flamanville 3, devisé 3,3 Md € pour un coût final de
            23,7 Md €.
          </p>
        </section>

        <section>
          <h3>Descendre dans le détail</h3>
          <p>
            Le tableau de bord reste haut niveau. Le chevron placé au bout d'un poste ouvre un
            panneau qui en montre la décomposition — d'un ministère à ses missions, puis à ses
            programmes et à ses actions — où chaque niveau se règle comme le précédent, avec le
            solde mis à jour en direct.
          </p>
          <p>
            Ce panneau est unique et générique : la liste des thèmes se déduit de l'arbre publié
            plutôt que d'être écrite à la main. Le chevron n'apparaît donc que là où un niveau
            supplémentaire existe réellement dans les données ouvertes, et du seul côté du budget
            où le poste est décomposé.
          </p>
        </section>

        <section>
          <h3>La vue « Piloter »</h3>
          <p>
            Elle réunit les grands leviers sur un écran : les impôts d'État au-dessus de 3 Md €,
            les prélèvements sociaux, les ministères et les branches de la Sécurité sociale. Le
            seuil écarte la longue traîne des 59 lignes de recettes fiscales, dont beaucoup pèsent
            quelques centaines de millions et noieraient les trois impôts qui font l'essentiel de
            la recette. Tout poste plus fin reste réglable dans l'explorateur, et les deux vues
            partagent le même scénario.
          </p>
          <p>
            Les prélèvements sur recettes n'y figurent pas volontairement : les réduire
            augmenterait la recette de l'État sans diminuer celle des collectivités ou de l'Union
            européenne qui les perçoivent. La simulation étant comptable, elle ne répercute pas ce
            transfert, et le levier afficherait un gain qui n'existe pas.
          </p>
        </section>

        <section>
          <h3>Partager un scénario</h3>
          <p>
            La barre d'adresse reflète en permanence le scénario en cours : le partager revient à
            copier l'URL, et le bouton <strong>Partager</strong> le fait pour vous. Le lien contient
            l'intégralité des ajustements, rien n'est enregistré sur un serveur.
          </p>
          <p>
            Ouvrir un lien partagé affiche le scénario reçu sans effacer le vôtre : votre travail
            n'est remplacé qu'à votre première modification. Chaque ajustement transporte le libellé
            de sa cible ; si les données ont changé depuis la création du lien au point que le
            libellé ne corresponde plus, l'ajustement est écarté et signalé plutôt qu'appliqué au
            mauvais poste.
          </p>
        </section>

        <section>
          <h3>Les prélèvements sur recettes de l'État</h3>
          <p>
            L'État encaisse 520,9 Md € puis en reverse 67,5 Md € à l'Union européenne et aux
            collectivités territoriales. Ces prélèvements apparaissent en négatif : les additionner
            au reste surestimerait les recettes de l'État de près de 70 Md €. Le prélèvement de
            44,2 Md € au profit des collectivités est aussi la matérialisation la plus visible des
            flux croisés qui interdisent d'additionner les trois sphères.
          </p>
        </section>

        <section className="modale__alerte">
          <h3>Ce que mesurent réellement ces chiffres</h3>
          <p>
            Les trois sphères ne sont pas de même nature, et la différence est essentielle.
          </p>
          <ul>
            <li>
              <strong>État — prévision 2025.</strong> Ce sont les crédits d'un{' '}
              <em>projet</em> de loi de finances, pas des dépenses constatées. Ce projet n'a
              d'ailleurs pas été adopté en l'état : après la censure du 4 décembre 2024, une loi
              spéciale a assuré l'intérim et la loi de finances a été promulguée le 14 février
              2025 dans une version de compromis. Les montants affichés en diffèrent. Aucune loi
              de finances votée n'étant publiée en données ouvertes, ce projet reste la source la
              plus fine disponible.
            </li>
            <li>
              <strong>Collectivités — comptes exécutés 2024.</strong> Des montants réellement
              dépensés et encaissés, publiés après clôture des comptes.
            </li>
            <li>
              <strong>Sécurité sociale — constaté 2024.</strong> Des montants établis a
              posteriori par la Direction de la sécurité sociale.
            </li>
          </ul>
          <p>
            Deux conséquences. D'abord, une prévision et une exécution cohabitent dans le même
            total : les additionner mêle une intention et un fait. Ensuite, les{' '}
            <strong>exercices diffèrent</strong> — 2025 pour l'État, 2024 pour le reste — de
            sorte que la somme des trois sphères ne décrit aucune année en particulier.
          </p>
          <p>
            Chaque sphère porte donc sa nature et son exercice à côté de son montant, et le
            panneau de détail rappelle la réserve au plus près du chiffre.
          </p>
        </section>

        <section className="modale__alerte">
          <h3>Pourquoi les totaux ne s'additionnent pas comme on l'attendrait</h3>
          <p>
            Les administrations publiques se versent beaucoup d'argent entre elles : l'État dote
            les collectivités, les départements subventionnent les communes, les intercommunalités
            reversent de la fiscalité à leurs membres. Additionner leurs budgets compte donc
            plusieurs fois les mêmes euros.
          </p>
          <p>
            Les montants agrégés affichés ici sont <strong>bruts</strong> : ils servent à comparer
            des ordres de grandeur et à voir comment la dépense se répartit, pas à mesurer le poids
            réel de la dépense publique. Pour ce dernier, la référence est le compte des
            administrations publiques de l'Insee, qui consolide ces flux et établit la dépense
            publique 2024 à <strong>1 670 Md €</strong>, soit 57,2 % du PIB.
          </p>
          <p>
            Chaque nœud concerné porte cet avertissement dans son panneau de détail.
          </p>
        </section>

        <section>
          <h3>Choix de périmètre</h3>
          <ul>
            <li>
              <strong>État</strong> — budget général du PLF 2025, en crédits de paiement. Les
              comptes d'affectation spéciale et budgets annexes sont exclus : leur logique
              d'affectation ne se compare pas aux crédits ministériels.
            </li>
            <li>
              <strong>Collectivités</strong> — budgets principaux de l'exercice 2024, agrégats
              « dépenses totales hors remboursement de dette » et « recettes totales hors
              emprunts », qui se correspondent exactement. Les budgets annexes (eau, assainissement,
              transport) sont exclus, car toutes les collectivités n'y recourent pas et leur
              inclusion fausserait les comparaisons.
            </li>
            <li>
              <strong>Sécurité sociale</strong> — prestations nettes et produits consolidés 2024 de
              l'ensemble des régimes de base. Ces données n'étant publiées qu'en PDF, elles sont
              saisies à la main ; la ventilation de la branche Maladie applique la structure de
              l'Ondam et n'est qu'indicative. Dans la structure des recettes, les trois postes
              majeurs sont identifiables sans ambiguïté ; les trois plus petits sont regroupés
              plutôt qu'attribués au hasard.
            </li>
          </ul>
        </section>

        <section>
          <h3>Territoires sans collectivité départementale</h3>
          <p>
            La Corse, la Martinique, la Guyane et Mayotte sont administrées par une collectivité
            unique, et le Bas-Rhin et le Haut-Rhin par la Collectivité européenne d'Alsace. Ces
            territoires apparaissent dans le graphe pour rendre leurs communes accessibles, mais
            ne portent aucune dépense départementale propre.
          </p>
        </section>

        <section>
          <h3>Licence</h3>
          <p>
            Code sous <strong>GNU Affero General Public License v3</strong> ou ultérieure.
            Chacun peut l'utiliser, l'étudier, l'héberger et le modifier ; toute version
            modifiée mise à disposition, y compris à travers un réseau, doit publier son code
            source.
          </p>
          <p>
            Ce n'est pas une formalité pour cet outil : ses multiplicateurs déterminent ses
            conclusions, et une version hébergée aux coefficients discrètement ajustés serait
            indiscernable de celle-ci pour un visiteur. L'AGPL rend ces modifications
            vérifiables. Le code de cette installation est disponible{' '}
            <a href={DEPOT} target="_blank" rel="noreferrer">
              sur son dépôt
            </a>
            .
          </p>
          <p>
            Les données relèvent de leurs licences propres, indépendantes de celle du code :
            <strong> Licence Ouverte / Etalab 2.0</strong> pour les jeux de l'OFGL, de la
            Direction du Budget et de l'Insee, qui impose la mention de leur paternité —
            assurée par la liste ci-dessous.
          </p>
        </section>

        <section>
          <h3>Jeux de données</h3>
          <ul className="modale__sources">
            {[...sources.values()].map((s) => (
              <li key={s.dataset}>
                <a href={s.url} target="_blank" rel="noreferrer">
                  {s.label}
                </a>
                <span>
                  exercice {s.exercice} · <code>{s.dataset}</code>
                </span>
              </li>
            ))}
          </ul>
        </section>
          </>
        )}
      </div>
    </div>
  );
}
