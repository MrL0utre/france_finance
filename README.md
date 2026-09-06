# Explorateur des finances publiques françaises

Visualisation en graphe des finances publiques, explorable du total national jusqu'à
**chacune des 34 869 communes**, en passant par les régions, départements et
intercommunalités — un niveau de détail que les simulateurs citoyens existants
n'atteignent pas.

Un sélecteur global bascule entre **Dépenses**, **Recettes** et **Solde** sans faire
perdre sa position dans le graphe. Un **simulateur** permet d'ajuster n'importe quel poste,
de choisir un modèle de bouclage macroéconomique, de projeter sur dix ans et de partager
le scénario par URL.

Application **entièrement statique** : les données sont pré-calculées, l'application ne
fait que les servir. Aucun backend, aucune clé d'API, aucune donnée envoyée nulle part.

## Démarrer

Prérequis : **Node.js 20 ou plus** (`node --version`). Rien d'autre.

```bash
git clone <url-du-depot> && cd finance_france
```

```bash
npm install
```

```bash
npm run dev
```

L'application est alors sur **http://localhost:5173**.

**Les données construites sont incluses dans le dépôt** : il n'y a rien à télécharger et
aucun réseau n'est nécessaire. Reconstruire les données est utile seulement pour changer de
millésime ou modifier le pipeline — voir *Reconstruire les données* plus bas.

### Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement sur le port 5173 |
| `npm test` | 6 suites de tests de comportement (simulation, partage, modèles, dette, barème, projection) |
| `npm run build` | vérification des types puis construction dans `dist/` |
| `npm run preview` | sert le résultat de `npm run build` |
| `npm run data:build` | reconstruit `public/data/` depuis les portails ouverts |
| `npm run data:build:force` | idem, en ignorant le cache local |

### Déployer

`npm run build` produit un `dist/` statique, publiable tel quel sur GitHub Pages, Netlify,
Vercel ou n'importe quel serveur de fichiers. `vite.config.ts` fixe `base: './'`, ce qui
fonctionne aussi bien à la racine d'un domaine que dans un sous-chemin.

La vérification continue (`.github/workflows/ci.yml`) rejoue tests et construction à chaque
poussée, **hors ligne** — précisément parce que les données sont versionnées.

### Reconstruire les données

```bash
npm run data:build
```

Le pipeline interroge l'OFGL, data.economie.gouv.fr et OpenFisca, puis met les fichiers
sources en cache dans `data/cache/` — **environ 155 Mo**, dont 157 Mo pour le seul CSV des
comptes communaux, non versionnés. Les exécutions suivantes réutilisent ce cache ;
`npm run data:build:force` force le retéléchargement. Comptez quelques minutes au premier
lancement, une dizaine de secondes ensuite.

La construction se termine par 54 assertions bloquantes : en cas d'échec, elle renvoie un
code de sortie non nul et n'écrit pas de données incohérentes.

### Licence

Le code n'est pas encore sous licence (`UNLICENSED` dans `package.json`) : à choisir avant
toute publication. Les données proviennent de portails en Licence Ouverte / Etalab, dont
les conditions de réutilisation s'appliquent indépendamment.

## Simulateur

Le curseur d'un poste pose un facteur multiplicatif : il met à l'échelle tout son
sous-arbre et remonte l'écart dans les totaux au-dessus de lui. Les ajustements se
composent (−10 % sur un ministère puis −50 % sur une de ses missions laisse celle-ci à
45 %).

La contrainte structurante est que l'arbre est **chargé paresseusement** : on ne peut pas
recalculer un total en sommant ses enfants, puisqu'un département en compte des centaines
absentes de la mémoire. Le montant simulé est donc un produit de facteurs le long du
chemin, corrigé des seuls écarts des nœuds effectivement ajustés — dont le nombre reste
petit. Voir `src/data/simulation.ts`.

`npm test` vérifie cette algèbre sur un arbre minimal : propagation vers le haut, mise à
l'échelle vers le bas, composition d'ajustements imbriqués sans double comptage,
préservation des soldes publiés, et le fait que les contributions marginales affichées
somment exactement à l'écart total.

La simulation est **comptable, pas macroéconomique** : une baisse de dépense ne modifie pas
les recettes. C'est écrit dans l'interface, à côté des résultats.

## Modèles de bouclage macroéconomique

Quatre modèles sélectionnables, un seul actif à la fois ; en changer recalcule tous les
chiffres. L'onglet **Comparer les modèles** passe un même scénario dans les quatre.

| Modèle | Multiplicateur dépense | 10 Md€ de coupe donnent |
|---|---|---|
| Comptable | 0 | +10,0 Md€ de solde |
| Multiplicateurs faibles | 0,3–0,5 | +8,5 Md€ |
| Multiplicateurs standards | 0,5–1,0 | +6,1 Md€ |
| Multiplicateurs élevés | 0,9–1,5 | +3,8 Md€ |

**Le modèle « Comptable » n'est pas l'absence de modèle** : c'est l'hypothèse, très forte,
que l'activité ne réagit pas. En faire un choix explicite plutôt qu'un défaut implicite est
le principal gain d'honnêteté de cette étape.

**Ce ne sont pas des implémentations de Mésange.** [Le code de Mésange est publié par
l'Insee](https://github.com/InseeFr/Mesange) sous CeCILL, mais écrit en TROLL — logiciel
propriétaire — sans données ni instructions d'exécution : « ouvert » n'y signifie pas
« exécutable ». Ce sont quatre calibrations d'un même moteur simplifié
(`src/modeles/moteur.ts`), statique et linéaire, dont les ordres de grandeur s'inspirent de
la littérature (Mésange, OFCE, FMI).

Le moteur enchaîne trois étages : l'impulsion budgétaire agit sur l'activité via un
multiplicateur propre à chaque instrument ; l'activité modifiée fait varier les recettes
via leur élasticité au PIB ; le solde additionne effet direct et effets induits. **Le
multiplicateur intègre déjà la boucle revenu-dépense** — réinjecter les recettes induites
dans un second tour compterait deux fois le même mécanisme.

`npm test` valide des **propriétés** plutôt que des valeurs, les coefficients étant
destinés à évoluer : sens des effets, linéarité, symétrie, monotonie, hiérarchie des
multiplicateurs, ordre entre modèles, et surtout qu'un taux de récupération reste dans
`[0, 1[` — une hausse de dépense qui améliorerait le solde serait une affirmation
extraordinaire, que le test rend impossible par inadvertance.

Hors périmètre du moteur : l'étalement des effets dans le temps, la dépendance des
multiplicateurs à la conjoncture, et la dette avec sa charge d'intérêt.

## Barème de l'impôt sur le revenu (OpenFisca)

Le barème, la décote et le plafond du quotient familial sont repris d'[OpenFisca
France](https://openfisca.org/doc/) **à la construction des données**, pas à l'exécution :
l'application reste sans dépendance réseau et le barème ne change qu'une fois l'an. Chaque
tranche est réglable en taux et en seuil.

OpenFisca sert deux rôles distincts, et le second est le plus important :

1. **Source de législation** — taux, seuils, décote et plafonds, référencés à l'article 197
   du CGI.
2. **Référence de calcul** — le pipeline lui demande l'impôt dû par 28 foyers types, puis
   confronte notre propre moteur (`src/impot/bareme.ts`) à ses résultats. Réimplémenter une
   législation fiscale est risqué : sans cette confrontation, une erreur y serait invisible.
   **Écart maximal constaté : 0,45 €**, plafonnement du quotient familial compris. Un cas
   type qui ne concorderait pas est **écarté de l'interface** plutôt que corrigé à l'aveugle.

Sont couverts : barème progressif, quotient familial et son plafonnement (1 807 €/demi-part),
décote. Ne le sont pas : réductions et crédits d'impôt, demi-parts particulières, abattements
d'outre-mer.

**Ce panneau ne remonte pas au solde**, et c'est délibéré. Chiffrer le rendement d'une
réforme du barème suppose de connaître le revenu imposable présent *dans chaque tranche* —
relever le taux à 11 % renchérit l'impôt de tous les foyers au-dessus du seuil, pas des seuls
foyers de cette tranche. Cette statistique n'est pas publiée en données ouvertes
exploitables. Le panneau dit donc **qui paie combien**, pas **combien cela rapporte** ; le
levier agrégé « Impôt sur le revenu » reste dans la colonne Recettes.

## Dette et taux d'emprunt

La charge de la dette (54,2 Md €) est extraite de la mission « Engagements financiers de
l'État » et rendue pilotable. Le levier n'est pas un pourcentage sur une ligne budgétaire
mais une **variation du taux d'emprunt**, dont l'effet dépend du rythme de renouvellement
de la dette.

**Le piège à ne pas réintroduire.** Un État ne renégocie pas sa dette : ses titres portent
un taux fixé à l'émission et sont remboursés à l'échéance. Une variation de taux ne touche
que la dette réémise dans l'année.

| | +1 point de taux |
|---|---|
| Première année (≈ programme de financement, 300 Md €) | **+3,0 Md €** |
| À terme, encours renouvelé (2 882 Md €, ~8,5 ans) | **+28,8 Md €** |

Appliquer d'emblée le point de taux à tout l'encours surestimerait le surcoût immédiat d'un
facteur dix. Seul l'effet de la première année entre dans le solde ; `tests/dette.test.ts`
verrouille cette distinction.

Le nœud portant la charge est **localisé par libellé au moment du build**, pas codé en dur :
son identifiant dépend du rang des lignes dans le CSV source. Un contrôle bloquant échoue
s'il devient introuvable.

## Créer une taxe ou une dépense

Supprimer ou modifier un poste existant se fait avec son curseur (−100 % pour supprimer).
Pour ce qui n'existe pas encore, la vue Piloter permet de créer une mesure libre : intitulé,
montant, et nature économique — cette dernière détermine le multiplicateur, faute de libellé
publié à analyser automatiquement.

## Projection pluriannuelle et grands chantiers

L'onglet **Comparer les modèles** projette le scénario sur dix ans. Deux mécanismes que
le moteur annuel ne pouvait pas montrer y apparaissent :

- **les chantiers**, dont la dépense s'étale puis s'arrête ;
- **la boucle dette-intérêts** : un déficit accru alourdit la charge, qui creuse le déficit
  de l'année suivante. Les intérêts portent sur la dette des années *précédentes* — la dette
  de l'année en cours ne coûte encore rien, ce qui rend la boucle progressive.

Tout est exprimé en **écart au scénario de référence**. Aucune prévision de croissance,
d'inflation ou de solde tendanciel n'est faite : la projection dit ce que le scénario
change, pas où en seront les finances publiques.

Un programme de 6 EPR2 (72,8 Md€ sur 15 ans) sur dix ans :

| | Comptable | Multiplicateurs standards |
|---|---|---|
| Dette accumulée | −52,9 Md€ | −27,0 Md€ |
| dont intérêts | 4,3 Md€ | 2,2 Md€ |
| Emplois soutenus | — | +50 034/an |

Le **catalogue de chantiers** (`data/manual/chantiers.json`) donne des repères de coût
sourcés — EPR2, Grand Paris Express, France 2030. Ces entrées ne prétendent pas que ces
projets restent à financer : plusieurs sont engagés ou achevés, elles servent de **calibre**
pour un chantier d'ampleur comparable, et le disent. Un chantier sur mesure couvre le reste,
à condition d'en fournir soi-même le coût.

`npm test` vérifie qu'un chantier dépense exactement son coût puis s'arrête, que les
intérêts n'apparaissent qu'à partir de la deuxième année, que la boucle s'alimente sans
diverger, et que la projection reste linéaire.

## Panneau de détail

Le tableau de bord reste volontairement haut niveau. Un chevron sur chaque poste
décomposable ouvre un **panneau de détail** qui descend niveau par niveau —
ministère → mission → programme → action — avec fil d'Ariane, réglage sur place et
solde mis à jour en direct.

**Un seul composant générique** (`src/pilotage/PanneauDetail.tsx`), piloté par l'arbre
publié : on lui passe un nœud, il affiche ses enfants. Il ne connaît ni ministère ni thème
en particulier. Écrire un panneau par thème aurait signifié une quinzaine de composants à
maintenir à chaque millésime ; celui-ci couvre les vingt ministères, les branches sociales
et les lignes fiscales, et suit les données quand elles changent.

Le chevron n'apparaît que si le nœud annonce des enfants **du côté regardé** : un ministère
n'est décomposé que côté dépense, une ligne fiscale que côté recette.

## Vue « Piloter »

Un tableau de bord réunit sur un écran les grands leviers — impôts d'État au-dessus de
3 Md €, prélèvements sociaux, ministères, branches de la Sécu — avec des boutons `+` / `−`
au pas de 1 % et un champ éditable. Le graphe sert à explorer, ce panneau à agir vite ;
les deux partagent le même état de simulation, et un ajustement posé d'un côté apparaît de
l'autre.

La liste est **construite depuis les données** (`src/pilotage/leviers.ts`), pas écrite en
dur : le seuil de 3 Md € écarte la longue traîne des 59 lignes fiscales, qui noierait les
trois impôts faisant l'essentiel de la recette.

Les **prélèvements sur recettes en sont volontairement absents**. Réduire celui versé aux
collectivités augmenterait la recette de l'État sans diminuer la leur : la simulation étant
comptable, elle ne propage pas ce transfert et le levier afficherait un gain qui n'existe
pas. Ils restent réglables dans l'explorateur, où le contexte est visible.

## Partage par URL

La barre d'adresse reflète en permanence le scénario (`?s=<base64url>`), si bien que
partager revient à copier l'URL et qu'un rafraîchissement conserve l'état. Rien n'est
stocké côté serveur. Un scénario de trois ajustements tient en ~250 caractères : les
ajustements sont sérialisés en tuples plutôt qu'en objets, les clés JSON répétées pesant
plus que les données elles-mêmes.

Le codec de `src/data/partage.ts` est **pur** — il reçoit l'URL en paramètre au lieu de
lire `window` — donc vérifiable hors du navigateur. `npm test` couvre l'aller-retour, la
préservation des paramètres d'URL existants, et le rejet de onze formes d'entrées
malformées : une URL est une entrée non fiable, un lien trafiqué ne doit pas produire un
scénario à moitié appliqué.

## Structure

```
pipeline/          construction des données (Node + tsx), hors du build de l'app
  sources/ofgl.ts  comptes des régions, départements, EPCI et communes
  etat.ts          crédits de l'État par ministère → mission → programme → action
  secu.ts          branches de sécurité sociale (saisie manuelle, cf. plus bas)
  openfisca.ts     barème de l'IR et cas types de référence
  checks.ts        contrôles de cohérence, bloquants
data/manual/       montants saisis à la main, avec leur source et leur page
public/data/       sortie du pipeline, versionnée : shards chargés à la demande
tests/             tests de comportement, exécutés par `npm test`
src/
  schema.ts        format de nœud partagé pipeline ↔ application
  data/            chargement, simulation, partage par URL
  graph/ panel/    explorateur en graphe et panneau de détail
  pilotage/        tableau de bord, dette, mesures libres, chantiers
  modeles/         bouclage macroéconomique, comparaison, projection
  impot/           barème de l'impôt sur le revenu
```

## Sources

| Périmètre | Source | Exercice |
|---|---|---|
| Collectivités | [OFGL](https://data.ofgl.fr) — comptes individuels, budgets principaux, dépenses et recettes | 2024 |
| État — dépenses | [data.economie.gouv.fr](https://data.economie.gouv.fr) — PLF, budget général, crédits de paiement | 2025 |
| État — recettes | `plf25-recettes-du-budget-general` | 2025 |
| Sécurité sociale | Chiffres clés de la Sécurité sociale (PDF, saisie manuelle) | 2024 |
| Barème de l'IR | [OpenFisca France](https://openfisca.org/doc/) — art. 197 du CGI | 2025 |
| Dette | [Agence France Trésor](https://www.aft.gouv.fr/fr) — encours et programme de financement | 2026 |
| Grands chantiers | Cour des comptes, EDF, France 2030 — voir `data/manual/chantiers.json` | — |
| Repère consolidé | Insee, compte des administrations publiques | 2024 |

## Quatre pièges traités, à ne pas réintroduire

**Les montants agrégés sont bruts.** Les administrations se versent beaucoup d'argent
entre elles. Additionner leurs budgets compte plusieurs fois les mêmes euros. Les nœuds
concernés portent `consolide: false` et affichent un avertissement. Le repère consolidé
(1 670 Md € en 2024) vient de l'Insee et n'est jamais reconstitué par addition.

**Le découpage territorial n'est pas la carte des collectivités.** La Corse, la
Martinique, la Guyane et Mayotte sont des collectivités uniques ; le Bas-Rhin et le
Haut-Rhin relèvent de la Collectivité européenne d'Alsace ; Paris cumule les compétences
communales et départementales, et l'OFGL publie ses comptes dans les deux jeux de
données. Le pipeline construit donc la hiérarchie par union des territoires observés, et
déduplique par SIREN. Sans cela, des milliers de communes deviennent inatteignables ou
Paris est compté deux fois.

**Les prélèvements sur recettes sortent, ils n'entrent pas.** L'État encaisse 520,9 Md €
et en reverse 67,5 Md € à l'UE et aux collectivités. Ces lignes sont portées en négatif ;
les additionner surestimerait ses recettes de près de 70 Md €.

**Un solde n'a de sens que si les deux côtés couvrent le même périmètre.** Pour les
collectivités il est calculé et vérifié. Pour la Sécurité sociale, les dépenses affichées
(prestations brutes par branche) et les recettes (produits consolidés) ne se correspondent
pas : le solde publié (−15,3 Md €) est porté explicitement via le champ `solde` du nœud,
qui court-circuite la soustraction. Sous l'État et la Sécu, aucun enfant n'a de solde
interprétable — d'où le champ `nSol`, qui ne se déduit pas de `nDep` et `nRec`.

## Contrôles

`npm run data:build` exécute des assertions bloquantes : chaque parent égale la somme de
ses enfants des deux côtés, aucune entité présente dans les sources n'est perdue, aucun
code de territoire n'est multivalué, et surtout **recettes − dépenses = capacité ou besoin
de financement publié par l'OFGL** pour les 36 249 collectivités (écart maximal constaté :
0 €). Un échec renvoie un code de sortie non nul.

Le résultat est écrit dans `public/data/controles.json` et republié par l'application, sous
**Méthodologie et sources → Contrôles de cohérence** : un tableau attendu / obtenu / écart,
groupé, consultable sans relancer le pipeline ni lire une console. Le fichier est écrit même
quand des contrôles échouent — c'est justement là qu'on veut le lire.

Pour ajouter un contrôle, appeler `check()` ou `checkCount()` de `pipeline/checks.ts` ; il
apparaît automatiquement dans l'interface, sous le dernier `groupe()` déclaré.

Ces assertions portent sur la **cohérence interne** : elles ne valident pas l'exactitude des
sources. Une erreur de correspondance qui resterait cohérente avec elle-même passerait sans
être détectée.

## Pièges du simulateur, à ne pas réintroduire

**Un scénario restauré doit charger ses shards avant d'être appliqué.** Les ajustements
persistés visent des nœuds qui ne sont pas en mémoire au démarrage. Sans chargement
préalable, ils sont comptés dans « n ajustements » mais silencieusement non appliqués : le
solde affiché est alors faux. La chaîne de shards est donc persistée avec chaque
ajustement, comme le fait l'index de recherche.

**Les identifiants de l'État dépendent du rang des lignes dans le CSV source.** Une
reconstruction des données peut les décaler et faire porter un ajustement sur le mauvais
ministère. Le libellé est persisté avec l'ajustement — dans le stockage local comme dans
l'URL — et revalidé au chargement ; en cas d'écart, l'ajustement est écarté et
l'utilisateur prévenu. Le risque est plus élevé pour un lien partagé, ouvert par
définition sur une autre installation.

**L'URL d'entrée doit être lue avant que quoi que ce soit ne la réécrive.** L'effet qui
synchronise la barre d'adresse et celui qui initialise l'application se courent après :
sous StrictMode, l'initialisation rejoue après la réécriture et croit alors ouvrir un lien
partagé alors que le scénario vient du stockage local. `URL_INITIALE` est donc figée au
chargement du module, pas relue depuis `window`.

## Hors périmètre

Syndicats et SDIS, budgets annexes, fiscalité par contribuable.

Restent **bloqués sur les données**, pas sur le code :

- **Rendement agrégé d'une réforme du barème.** Voir plus haut : il exige la répartition du
  revenu imposable par tranche, absente des données ouvertes. La voie serait la
  microsimulation sur données d'enquête (ERFS), non publiques.
- **Niches fiscales.** Le jeu [Voies et moyens tome II](https://www.data.gouv.fr/datasets/plf2023-voies-et-moyens-t2-liste-des-depenses-fiscales)
  liste chaque dépense fiscale avec son coût, mais n'est publié qu'en pièce jointe XLSX
  (l'API renvoie zéro enregistrement) et pour le PLF 2023, millésime différent de notre base
  PLF 2025. L'intégrer demande un lecteur XLSX dans le pipeline et une mention de millésime.
  OpenFisca expose en revanche les *paramètres* de nombreuses niches (taux, plafonds), qui
  pourraient être rendus réglables sur le même modèle que le barème.
