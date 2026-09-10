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

## Ce qu'est ce projet, et ce qu'il n'est pas

**Projet indépendant, sans lien avec une administration.** Il n'émane d'aucun service
public, n'est ni validé ni soutenu par les organismes dont il réutilise les données, et ne
saurait engager leur responsabilité. Ni le nom ni l'identité visuelle de l'État n'y
figurent : la Licence Ouverte / Etalab 2.0, sous laquelle les données sont réutilisées,
interdit de laisser croire à un statut officiel ou à un aval du producteur.

**Il n'émet aucune recommandation ni conclusion.** Il affiche des données publiques et
calcule les scénarios que l'utilisateur construit, sous des hypothèses affichées et
modifiables. L'onglet « Comparer les modèles » existe précisément pour montrer que la
réponse dépend d'hypothèses sur lesquelles les économistes ne s'accordent pas : la même
coupe de 10 Md€ rapporte entre 4,3 et 10 Md€ selon la calibration retenue.

**Les chiffres sont sourcés, les hypothèses affichées — et la distinction entre les deux
est maintenue.** La législation fiscale vient d'OpenFisca et renvoie à l'article 197 du
CGI ; les agrégats budgétaires viennent des portails publics, chacun référencé dans
`sources.json`. Les **multiplicateurs macroéconomiques, eux, ne sont pas des valeurs
officielles, ni extraites d'un modèle institutionnel** : ce sont des ordres de grandeur
propres à ce projet, visibles dans l'interface, réglables, et affichés à côté d'estimations
publiées pour que l'écart se voie. Aucun résultat n'a valeur de prévision.
Tout montant dérivé plutôt que publié porte la mention correspondante.

**Le visiteur est prévenu avant d'avoir vu un chiffre.** Un message d'accueil
(`src/Accueil.tsx`) énonce l'indépendance du projet, les millésimes et la nature de chaque
source, la possibilité d'erreurs, et l'adresse à laquelle les signaler. Trois montants côte
à côte ressemblent à un compte officiel : mieux vaut avoir prévenu du contraire que d'avoir
à corriger l'impression ensuite. Il ne paraît qu'à la première visite — un avertissement
qui reparaît à chaque fois se ferme sans être lu — et son contenu reste consultable en
entier depuis « Méthodologie et sources ».

**Développé avec l'assistance de Claude** (Anthropic). Le code, les sources et les
contrôles de cohérence sont publics et vérifiables — c'est le sens du choix de l'AGPL.

**Aucune donnée personnelle traitée.** Ni compte, ni traceur, ni cookie, ni mesure
d'audience : vérifiable dans le code, il n'existe aucun appel réseau vers un tiers. Les
données affichées portent sur des personnes morales — collectivités, ministères,
organismes — jamais sur des personnes physiques ; les foyers types du barème sont fictifs.

**Où vit le scénario de l'utilisateur.** Dans son navigateur, sous une clé de
`localStorage`, et dans l'URL. Ni l'un ni l'autre n'est transmis à quiconque : contrairement
aux cookies, le `localStorage` n'accompagne aucune requête, et l'application n'appelle que
ses propres fichiers de données. Un lien partagé n'existe que si l'utilisateur le copie
lui-même. Trois précisions honnêtes, cependant :

- « non transmis » ne veut pas dire « protégé » : le `localStorage` est stocké en clair dans
  le profil du navigateur, lisible par les outils de développement, par une extension ayant
  accès à la page, et par toute personne ayant accès à la machine ;
- il est cloisonné par **origine**, pas par chemin. Publier sur un hébergement partagé —
  `compte.github.io`, où tous les projets d'un même compte cohabitent — le rend lisible par
  les autres pages de cette origine. Un domaine dédié, ou un dépôt `compte.github.io/projet`
  servi depuis sa propre origine, évite ce partage ;
- l'URL, elle, voyage par nature : historique du navigateur, journaux de l'hébergeur,
  aperçus générés par les messageries. Les liens externes portent tous `rel="noreferrer"` et
  une politique `no-referrer` globale évite qu'elle parte vers un site tiers.

Le contenu concerné reste un scénario budgétaire — identifiants de postes, coefficients,
libellés — sans information personnelle.

**Garantie.** Le logiciel est fourni sans garantie, dans les termes des articles 15 et 16
de l'AGPL-3.0.

**Contact.** [administrateur@monplf.fr](mailto:administrateur@monplf.fr) — pour signaler une
erreur de données, une incohérence de calcul ou un manquement dans les mentions de sources.

## Démarrer

Prérequis : **Node.js 20 ou plus** (`node --version`). Rien d'autre.

```bash
git clone https://github.com/MrL0utre/france_finance.git && cd france_finance
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

**Publication automatique vers un hébergement OVH.**
`.github/workflows/deploy.yml` rejoue les tests, construit le site, puis synchronise `dist/`
vers `/www/` par FTP à chaque poussée sur `main`. **Un test qui échoue interrompt la
publication** : la vérification continue tourne en parallèle de ce workflow et n'aurait rien
bloqué de son côté. Il attend trois secrets de dépôt — `FTP_SERVER`,
`FTP_USERNAME`, `FTP_PASSWORD` — à créer dans *Settings → Secrets and variables → Actions*.
Sans eux le job échoue à l'envoi, sans rien publier.

L'action tient à distance un fichier d'état (`.ftp-deploy-sync-state.json`) et n'envoie
ensuite que les fichiers modifiés : la première publication transfère les 155 fichiers du
site, environ 20 Mo dont l'essentiel est constitué des données ; les suivantes sont brèves.
Supprimer ce fichier sur le serveur force un envoi complet.

Le dépôt contient les sources, pas le site : sans l'étape de construction, l'hébergement
recevrait un `index.html` appelant `/src/main.tsx`, que le navigateur ne sait pas exécuter.
Le `base: './'` de Vite fait le reste, que le site soit servi à la racine du domaine ou dans
un sous-chemin.

### Reconstruire les données

```bash
npm run data:build
```

Le pipeline interroge l'OFGL, data.economie.gouv.fr et OpenFisca, puis met les fichiers
sources en cache dans `data/cache/` — **156 Mo**, dont 150 Mo pour le seul CSV des comptes
communaux, non versionnés. Les exécutions suivantes réutilisent ce cache ;
`npm run data:build:force` force le retéléchargement. Comptez quelques minutes au premier
lancement, une dizaine de secondes ensuite.

La construction se termine par 54 assertions bloquantes : en cas d'échec, elle renvoie un
code de sortie non nul et n'écrit pas de données incohérentes.

## Licence

Code sous **GNU Affero General Public License v3 ou ultérieure** ([`LICENSE`](LICENSE)).
Chacun peut l'utiliser, l'étudier, l'héberger, le modifier et le redistribuer ; toute
version modifiée mise à disposition — **y compris à travers un réseau** — doit publier son
code source.

Ce choix n'est pas une formalité pour cet outil en particulier. Ses multiplicateurs
déterminent ses conclusions : la même coupe de 10 Md€ rapporte entre 4,3 et 10 Md€ selon la
calibration retenue. Une version hébergée aux coefficients discrètement ajustés serait
indiscernable de celle-ci pour un visiteur — mêmes graphes, mêmes sources affichées, autres
chiffres. La GPL ordinaire ne couvrirait pas ce cas, l'hébergement n'étant pas une
redistribution ; l'AGPL le couvre. C'est le même raisonnement qui a conduit
[France Budget](https://github.com/cturkieh/france-budget-simulateur) au même choix.

Ce garde-fou protège aussi tout repreneur : un organisme publiant des chiffrages budgétaires
est structurellement exposé au soupçon d'avoir ajusté ses hypothèses ; sous AGPL, ses
modifications sont publiques et vérifiables.

L'article 13 de l'AGPL impose que les utilisateurs interagissant avec une version modifiée à
travers un réseau puissent en obtenir la source : l'adresse du dépôt est donc affichée dans
le panneau Méthodologie, et se règle dans `src/depot.ts`. **Si vous forkez ce projet pour
l'héberger, faites-y pointer votre propre dépôt** — sans quoi vos modifications resteraient
introuvables pour vos visiteurs.

### Licence des données

Les données relèvent de leurs licences propres, indépendantes de celle du code :

| Source | Licence |
|---|---|
| OFGL, Direction du Budget, Insee, AFT | Licence Ouverte / Etalab 2.0 — mention de paternité requise, assurée par `sources.json` et le panneau Méthodologie |
| Eurostat (comptes nationaux) | © Union européenne — décision 2011/833/UE : réutilisation autorisée, y compris commerciale, moyennant mention de la source, assurée par `pib.json` et l'onglet « L'économie française (PIB) » |
| OpenFisca France | AGPL-3.0 |
| Chiffres clés de la Sécurité sociale | publication institutionnelle, saisie manuelle sourcée dans `data/manual/reference.json` |

Aucune de ces licences n'est à réciprocité : toutes demandent la paternité, aucune n'impose
sa propre licence à ce qui la réutilise. Le choix de l'AGPL pour le code est donc entier, et
ne leur doit rien. La mention de source ne vaut pas non plus aval du producteur — c'est une
obligation de la Licence Ouverte, et c'est aussi ce qu'attend la Commission européenne.

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
| Multiplicateurs faibles | 0,3–0,6 | +7,6 Md€ |
| Multiplicateurs standards | 0,6–1,0 | +5,6 Md€ |
| Multiplicateurs élevés | 0,9–1,4 | +4,3 Md€ |

**Le modèle « Comptable » n'est pas l'absence de modèle** : c'est l'hypothèse, très forte,
que l'activité ne réagit pas. En faire un choix explicite plutôt qu'un défaut implicite est
le principal gain d'honnêteté de cette étape.

**Ce ne sont pas des implémentations de Mésange, et les coefficients n'en sont pas issus.**
[Le code de Mésange est publié par l'Insee](https://github.com/InseeFr/Mesange) sous CeCILL,
mais écrit en TROLL — logiciel propriétaire — sans données ni instructions d'exécution :
« ouvert » n'y signifie pas « exécutable ». **Aucune ligne de son code ni aucune de ses
données ne figure dans ce projet.** Ce sont quatre calibrations d'un même moteur simplifié
(`src/modeles/moteur.ts`), statique et linéaire.

Les multiplicateurs sont des **valeurs propres à ce projet**, choisies rondes, traduisant
des régularités largement admises — la dépense pèse plus que l'impôt à euro égal,
l'investissement plus que le fonctionnement. Mésange publie ses propres variantes chiffrées ;
elles ne sont pas reprises ici. Le [document de travail
G2017/04](https://www.insee.fr/fr/statistiques/2848300) est cité pour approfondir, non comme
provenance des valeurs — les attribuer à l'Insee serait faux et abusif envers ses auteurs.

### Comparaison avec les estimations publiées

Des valeurs choisies rondes restent invérifiables tant qu'on ne les met pas en regard de
quelque chose. L'application les affiche donc à côté d'estimations publiées, dans le
dépliant **« Comparer aux estimations publiées »** du panneau *Piloter*
(`src/modeles/references.ts`) — non pour les justifier, mais pour rendre visible l'écart
là où il existe.

| Estimation publiée | Valeur | Standards | Faibles | Élevés |
|---|---|---|---|---|
| Investissement public — Mésange (2017) | 1,4 à 2 ans · 0,9 à 5 ans | 1,0 | 0,6 | 1,4 |
| Investissements publics — OCDE (2013), France | 1,0 | 1,0 | 0,6 | 1,4 |
| Toutes dépenses publiques — Mésange (2017) | 1,1 à 2 ans · 0,9 à 5 ans | 0,9 | 0,5 | 1,1 |
| Prestations en espèces — OCDE (2013) | 0,6 | 0,6 | 0,3 | 0,9 |
| Impôt sur le revenu des ménages — OCDE (2013) | 0,6 | 0,6 | 0,3 | 0,8 |
| Impôts indirects — OCDE (2013) | 0,3 | 0,3 | 0,2 | 0,5 |
| Baisse de CSG — Mésange (2017) | 0,8 à 2 ans · 0,8 à 5 ans | 0,7 | 0,5 | 0,9 |
| Baisse de cotisations employeurs — Mésange (2017) | 0,6 à 2 ans · 1,0 à 5 ans | 0,7 | 0,5 | 0,9 |

Ces valeurs sont reprises du [recensement qu'en fait
FIPECO](https://www.fipeco.fr/fiche/Leffet-multiplicateur-dune-variation-du-deficit-public),
**non des publications primaires** : le document de travail de Mésange présente ses variantes
sous forme de graphiques, dont on ne peut lire de valeur au dixième près. Annoncer une
vérification à la source serait donc inexact, et la chaîne d'attribution est affichée telle
quelle dans l'application.

Les nomenclatures ne se recouvrent pas exactement — « toutes dépenses publiques » n'est pas
notre poste *fonctionnement*, « impôts indirects » n'est pas exactement notre *impôt sur la
consommation*. Le rattachement est approximatif, et signalé comme tel.

Trois instruments n'ont **aucune estimation publiée qui s'y rattache** : impôt sur les
sociétés, charge de la dette, et le poste résiduel. Leurs valeurs relèvent du seul jugement,
et l'application le dit plutôt que de laisser croire le contraire.

Cette confrontation a servi à corriger deux coefficients nettement hors fourchette — l'impôt
sur la consommation (0,5 quand l'OCDE donne 0,3) et les cotisations (0,4 quand Mésange donne
0,6 à 1,0). Les tests portant sur des propriétés et non sur des valeurs, la recalibration est
passée sans qu'aucun ait eu à être réécrit.

Le moteur enchaîne trois étages : l'impulsion budgétaire agit sur l'activité via un
multiplicateur propre à chaque instrument ; l'activité modifiée fait varier les recettes
via leur élasticité au PIB ; le solde additionne effet direct et effets induits. **Le
multiplicateur intègre déjà la boucle revenu-dépense** — réinjecter les recettes induites
dans un second tour compterait deux fois le même mécanisme.

### Chaque prélèvement traverse son assiette

Un impôt ne réagit pas au PIB : il réagit à ce sur quoi il est assis. La chaîne est donc

```
activité  →  assiette  →  recette
```

et chaque maillon porte son propre coefficient, ce qui les rend vérifiables séparément. Une
élasticité directe au PIB mélangeait les deux et ne pouvait être qu'un nombre posé.

| Prélèvement | Assiette | Assiette → activité | Impôt → assiette | Total |
|---|---|---|---|---|
| Cotisations et contributions sociales | Masse salariale | 0,80 | 1,00 | 0,80 |
| Impôts sur les ménages | Masse salariale | 0,80 | **1,41** | 1,13 |
| Impôts sur la consommation | Consommation des ménages | 0,80 | 1,00 | 0,80 |
| Impôts sur les entreprises | Excédent brut d'exploitation | **1,29** | 1,00 | 1,29 |
| Fiscalité locale et recettes non fiscales | — | — | — | 0,50 |

**Deux des cinq coefficients ne sont plus choisis.**

La sensibilité du profit (**1,29**) se *déduit*. Dans l'optique des revenus, le PIB est la
somme exacte de la masse salariale, de l'excédent brut d'exploitation et des impôts sur la
production — le pipeline le vérifie au centime. Si le PIB varie de 1 % et que deux des trois
termes varient moins, le troisième doit varier plus, d'un montant que l'arithmétique fixe.
C'est aussi le mécanisme réel : le profit est un solde, et un solde absorbe le choc.

L'élasticité de l'impôt sur le revenu (**1,41**) se *calcule*, sur le barème publié : en
chaque foyer, taux marginal divisé par taux moyen, pondéré par l'impôt payé sur les cas types
validés contre OpenFisca. Un test le contrôle en aplatissant le barème à taux unique —
l'élasticité retombe alors à 1,000, ce qui prouve que c'est bien la progressivité qui est
mesurée. Réformer les tranches dans le simulateur change du même coup cette élasticité, sans
qu'aucun coefficient n'ait à être révisé à la main.

Restent trois valeurs posées : la sensibilité de la masse salariale (0,80 — l'emploi et les
salaires réagissent avec retard), celle de la consommation (0,80 — les ménages lissent), et
celle du poste résiduel (0,50 — fiscalité locale cyclique mêlée à des recettes non fiscales
qui ne le sont pas).

**Ce que cette décomposition a changé, et ce qu'elle omet.** L'élasticité moyenne des
recettes passe de 0,95 à **0,82**. Une part de cette baisse est une correction — l'ancien
1,8 sur l'impôt sur le revenu était trop haut, le barème donne 1,41 sur son assiette. Une
autre part est une **omission assumée** : le calcul déplace tous les revenus à nombre de
foyers imposables constant, alors qu'une récession fait sortir des foyers de l'impôt.

**Le sens de cette omission est inconnu, et il ne faut pas le prétendre.** Deux effets s'y
opposent. Des foyers sortent de l'impôt et leur contribution tombe à zéro, ce qui amplifie
la baisse ; mais les pertes d'activité frappent d'abord des revenus modestes, qui paient peu
d'impôt, là où un choc uniforme atteindrait aussi le haut de la distribution, où le rendement
est concentré — ce qui l'amortit. Sur un barème progressif, le second effet peut l'emporter.
Trancher demanderait la distribution des revenus imposables par tranche, que les données
ouvertes ne publient qu'en fichiers tableurs (IRCOM), non exploités ici. Un test garde
l'ensemble entre 0,6 et 1,3.

Assiettes publiées par le pipeline depuis Eurostat : masse salariale 1 505,5 Md€, excédent
brut d'exploitation 1 036,6 Md€, impôts sur la production 393,1 Md€, consommation des ménages
1 595,5 Md€.

L'interface affiche le détail : pour un scénario donné, quel impôt recule, de combien, et
avec quelle sensibilité. Un total agrégé ne répondait pas à la question qu'on lui pose.

Le bandeau de synthèse et le panneau portent les deux chiffres, dans cet ordre : le
**résultat du scénario** en tête, le montant **décidé** entre parenthèses dessous. L'ordre
inverse invitait à une conclusion fausse — lire des recettes intactes après une coupe
massive, et en déduire qu'elle rapporte, alors que le modèle venait de dire l'activité
contractée. Les confondre en un seul chiffre effacerait, à l'inverse, la distinction entre
une décision et une hypothèse de modèle.

La rétroaction n'apparaît que sur le total national : c'est un agrégat, et l'attribuer à un
ministère supposerait une clé de répartition que le modèle ne donne pas.

**Le modèle « Comptable » ne calcule aucune rétroaction, et c'est celui par défaut.** Un
visiteur qui coupe massivement sans changer de calibration voit donc les recettes ne pas
bouger. L'interface le dit désormais explicitement plutôt que d'afficher une colonne de
tirets sans explication.

`npm test` valide des **propriétés** plutôt que des valeurs, les coefficients étant
destinés à évoluer : sens des effets, linéarité, symétrie, monotonie, hiérarchie des
multiplicateurs, ordre entre modèles, et surtout qu'un taux de récupération reste dans
`[0, 1[` — une hausse de dépense qui améliorerait le solde serait une affirmation
extraordinaire, que le test rend impossible par inadvertance.

### L'assiette réagit au taux — le mécanisme le plus grossier du modèle

Doubler un impôt ne double pas sa recette : les revenus élevés et les capitaux sont mobiles,
les entreprises ferment ou se déplacent, une part de l'activité cesse d'être déclarée. Pour
un prélèvement de rendement R dont le taux monte d'une proportion x, l'assiette recule de εx
et le supplément réellement encaissé vaut

```
ΔR = R · x · (1 − ε(1 + x))       au lieu de   R · x
```

| Prélèvement | ε retenu | Le taux cesse de rapporter au-delà de |
|---|---|---|
| Impôts sur les entreprises | 0,6 | +33 % |
| Cotisations | 0,4 | +75 % |
| Impôts sur les ménages | 0,3 | +117 % |
| Impôts sur la consommation | 0,2 | +200 % |
| Fiscalité locale et non fiscal | 0,2 | +200 % |

Trois propriétés en découlent, toutes testées : une hausse rapporte toujours moins que
proportionnellement ; au-delà du point de retournement elle rapporte moins en valeur absolue,
ce que le modèle produit sans qu'on l'y mette ; et supprimer entièrement un prélèvement coûte
exactement son rendement, puisqu'il n'y a plus d'assiette à éroder.

**Ces coefficients sont des ordres de grandeur choisis, extraits d'aucune publication.** Ils
ne sont ni déduits comme la sensibilité du profit, ni calculés comme l'élasticité du barème :
seule leur hiérarchie a du contenu — le bénéfice des sociétés est la base la plus mobile, la
consommation taxée la moins. L'interface le dit à chaque fois qu'elle affiche le résultat.

**Ce que ce mécanisme ne fait pas.** L'assiette qui s'érode part quelque part : une entreprise
qui ferme détruit de l'activité, un capital qui s'expatrie la déplace, un revenu non déclaré
reste dépensé sur place. Ces trois cas n'ont pas le même effet macroéconomique et le moteur ne
les distingue pas — il ne retient que le manque à gagner fiscal. La perte d'activité
correspondante n'est portée que par le multiplicateur, qui en couvre une partie sans qu'on
sache laquelle.

**Ce qui était déjà modélisé et n'a donc pas été ajouté deux fois.** Une perte d'emploi qui
réduit l'impôt sur le revenu et la consommation, une baisse d'investissement public qui réduit
l'activité et les recettes : ce sont le multiplicateur et la chaîne `activité → assiette →
recette` décrits plus haut. Les traiter comme des effets supplémentaires les compterait deux
fois.

### Humeur de la population

Un budget se lit mal en euros seuls : couper 40 Md€ et lever 40 Md€ produisent le même solde
et n'ont pas le même effet sur qui les subit. Un visage — 🙂 😐 🙁 😠 — compose trois
quantités que le moteur calcule déjà.

| Canal | Ce qu'il mesure | Poids |
|---|---|---|
| Ce qui est prélevé | recettes effectivement encaissées, érosion comprise | 1 |
| Activité et emploi | écart de PIB | 1,5 |
| Services publics rendus | dépense publique hors charge de la dette | 1 |

**Ce visage n'est pas une mesure**, et l'interface le dit sous lui. Aucune enquête d'opinion
n'entre ici, aucun travail de science politique non plus : c'est une composition arithmétique
à coefficients choisis. Elle dit dans quel sens penche un scénario, pas ce que les gens en
penseraient.

**Trois canaux et non quatre, et c'est une limite du moteur.** L'emploi et l'activité n'en
font qu'un : le moteur déduit le premier du second par une division, si bien que les compter
séparément pèserait deux fois le même nombre sous deux noms.

La charge de la dette est exclue des services rendus — elle rembourse des créanciers et
n'achète aucune prestation. Un test vérifie que la couper n'apparaît pas comme une
dégradation de service. À l'inverse, un euro de dépense coupé pèse **deux fois** : par
l'activité qu'il ne soutient plus et par le service qu'il ne rend plus. C'est délibéré — un
hôpital fermé se remarque autrement qu'un point de PIB — mais cela reste une pondération
choisie. Sept propriétés sont testées, dont le fait que le score est exactement la somme des
canaux affichés, et que les quatre visages sont atteignables.

### Domaine de validité

Un modèle linéaire à multiplicateurs constants rend un nombre pour n'importe quel choc, y
compris ceux qu'aucune économie n'a connus. Au-delà de **5 % de PIB** d'écart d'activité,
l'application le dit désormais : les coefficients employés sont estimés sur des variations
de quelques dixièmes de point, la linéarité ne tient plus, et le résultat n'illustre qu'un
mécanisme. Un test vérifie que le signal se déclenche.

La rétroaction porte sur les recettes **que le scénario laisse**, non sur les recettes
publiées. Doubler la TVA double aussi ce que coûte un recul d'activité : mesurer la perte
sur l'ancien rendement la sous-estimait exactement dans la proportion de la hausse décidée.
Conséquence assumée, et testée : les mesures de recette ne sont plus additives entre elles,
alors que celles de dépense le restent.

Hors périmètre du moteur : l'étalement des effets dans le temps, la dépendance des
multiplicateurs à la conjoncture, et la dette avec sa charge d'intérêt.

## L'économie française (PIB)

Un onglet d'information, qui n'entre dans aucun calcul. L'outil affichait 1 490,9 Md€ de
dépense publique sans jamais montrer l'économie dans laquelle ce montant s'inscrit : le PIB
n'y apparaissait que sous forme de variation. On y lit désormais **2 935,2 Md€ de PIB 2024**,
et la dépense publique à **50,8 %** de ce total.

Deux lectures du même agrégat, avec deux formes distinctes parce qu'elles ne font pas le même
travail. **Par la demande**, les termes portent des signes opposés — les importations se
retranchent — donc des barres divergentes de part et d'autre d'une ligne zéro. **Par les
branches**, onze parts positives d'un même total : des barres triées d'une seule teinte, la
longueur portant la grandeur. Onze teintes distinctes seraient illisibles et n'ajouteraient
rien au tri.

Les deux décompositions se referment au centime sur le même total — quatre contrôles
bloquants du pipeline le vérifient.

**Le piège que cet onglet doit désamorcer** : la « consommation des administrations
publiques » (705,6 Md€) n'est pas la dépense publique affichée ailleurs (1 490,9 Md€). Le PIB
mesure une production ; les transferts — retraites, allocations, remboursements — n'y
figurent pas, puisqu'ils ne produisent rien par eux-mêmes : ils sont comptés plus tard, quand
le ménage qui les reçoit consomme. Soustraire un total de l'autre n'aurait aucun sens, et la
seule mise en regard des deux graphes y invite. L'avertissement est donc en tête de page,
pas en note.

Source : Eurostat, comptes nationaux transmis par l'Insee. L'Insee ne rediffuse pas ces
séries sans clé d'API ; Eurostat le fait sous licence de réutilisation. Les libellés anglais
sont traduits, les codes d'origine conservés à côté pour que le rattachement reste
vérifiable. Ce PIB diffère de celui qui sert de dénominateur aux modèles — même producteur,
millésime différent — d'un écart qu'un contrôle maintient sous 2 %.

**Le total réagit aux scénarios, les décompositions non.** Le PIB affiché et le ratio de
dépense publique se recalculent avec l'écart d'activité que le moteur estime, la valeur
d'origine restant entre parenthèses. Le ratio bouge alors des deux côtés à la fois — ce qui
est dépensé, et l'économie sur laquelle on le rapporte : couper une dépense peut ainsi le
relever, si l'activité recule davantage que la dépense.

Les deux décompositions, elles, restent celles du compte publié. Répartir un écart d'activité
entre composantes de la demande demanderait de savoir où il se loge ; le répartir entre
branches demanderait un tableau entrées-sorties, que ce projet n'utilise pas. Les afficher
modifiées sans ces hypothèses reviendrait à inventer une précision. La page le dit, faute de
quoi un visiteur conclurait à une panne.

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

| Périmètre | Source | Nature | Exercice |
|---|---|---|---|
| Collectivités | [OFGL](https://data.ofgl.fr) — comptes individuels, budgets principaux, dépenses et recettes | **comptes exécutés** | 2024 |
| État — dépenses | [data.economie.gouv.fr](https://data.economie.gouv.fr) — PLF, budget général, crédits de paiement | **prévision** | 2025 |
| État — recettes | `plf25-recettes-du-budget-general` | **prévision** | 2025 |
| Sécurité sociale | Chiffres clés de la Sécurité sociale (PDF, saisie manuelle) | **constaté** | 2024 |
| Barème de l'IR | [OpenFisca France](https://openfisca.org/doc/) — art. 197 du CGI | législation | 2025 |
| Dette | [Agence France Trésor](https://www.aft.gouv.fr/fr) — encours et programme de financement | constaté | 2026 |
| Grands chantiers | Cour des comptes, EDF, France 2030 — voir `data/manual/chantiers.json` | repères | — |
| Repère consolidé | Insee, compte des administrations publiques | repère | 2024 |

### Prévision, exécution : une distinction affichée

**Les chiffres de l'État sont ceux d'un *projet* de loi de finances, pas des dépenses
constatées.** Ce projet n'a de surcroît pas été adopté en l'état : après la censure du
4 décembre 2024, une loi spéciale a assuré l'intérim et la loi de finances a été promulguée
le 14 février 2025 dans une version de compromis moins ambitieuse. Les montants affichés en
diffèrent. Aucune loi de finances votée n'étant publiée en données ouvertes sur le portail —
seuls des jeux PLF le sont — ce projet reste la source la plus fine disponible.

Les collectivités, à l'inverse, sont des **comptes exécutés** : de l'argent réellement
dépensé et encaissé.

Deux conséquences, dites dans l'application et non reléguées ici :

- une prévision et une exécution cohabitent dans le même total ; les additionner mêle une
  intention et un fait ;
- les **exercices diffèrent** — 2025 pour l'État, 2024 pour le reste — de sorte que la somme
  des trois sphères ne décrit aucune année en particulier.

Chaque sphère porte sa nature et son exercice **à côté de son montant** dans le bandeau de
synthèse, en ambre pour une prévision. Le panneau de détail rappelle la réserve complète au
contact du chiffre. La nature est portée par `sources.json` : l'ajouter à une source la fait
apparaître partout, sans code supplémentaire.

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
