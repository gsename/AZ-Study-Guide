# Study Guide

App de révision pour certifications Microsoft (AZ-500, et d'autres à venir),
sélectionnables via le dropdown du bandeau du haut.

Application 100% statique : React + Vite + TypeScript, aucune dépendance à un
backend ou à un service externe. Les données de progression sont stockées
côté navigateur dans IndexedDB (via Dexie.js), isolées par certification.

## Lancer le projet (avec Node.js installé)

```bash
npm install
npm run dev      # serveur de dev sur http://localhost:5173
npm run build    # build statique dans dist/
npm run preview  # prévisualiser le build de production
```

## Lancer le projet sans Node.js installé (via Docker)

Si Node.js n'est pas installé localement, les mêmes commandes peuvent être
exécutées dans un conteneur Node — c'est une simple commodité de
développement, l'application elle-même ne dépend pas de Docker :

```powershell
docker run --rm -v "${PWD}:/app" -w /app node:20 npm install
docker run --rm --name study-guide-dev -p 5173:5173 -v "${PWD}:/app" -w /app node:20 npm run dev
# Dans un autre terminal, pour arrêter :
docker stop study-guide-dev
```

## Partager l'app avec quelqu'un

Deux builds sont disponibles selon le besoin — le point important : **une app
Vite ne peut pas s'ouvrir en double-cliquant `dist/index.html`**. Les
navigateurs bloquent par CORS le chargement des `<script type="module">`
depuis une origine `file://` (comportement standard de tout navigateur
moderne, pas spécifique à ce projet) — vérifié : ça échoue silencieusement
(page blanche) sans build dédié.

**Option A — dossier à héberger (`dist/`)** : le build normal. Fonctionne
servi par n'importe quel serveur statique, sans configuration (le routing par
`#/...` évite d'avoir besoin d'une règle de réécriture serveur) :

```bash
npm run build   # génère dist/
npx serve dist  # ou tout autre serveur statique, ou double-clic si Node est absent : voir option B
```

**Option B — fichier unique à envoyer (`dist-single/index.html`)** : tout
(JS + CSS) est inliné dans un seul fichier HTML autonome. **Vérifié** :
s'ouvre directement en double-clic (`file://`), navigation et sauvegarde de
la progression (IndexedDB) fonctionnent sans aucun serveur :

```bash
npm run build:single   # génère dist-single/index.html
```

C'est la façon la plus simple de partager l'app : envoie juste ce fichier
(par mail, clé USB, Teams…), la personne le double-clique et l'app tourne
entièrement en local, hors-ligne, avec sa propre progression sauvegardée dans
son navigateur.

## Certifications gérées

Le dropdown du bandeau permet de basculer entre les certifications
disponibles ; changer de certification adapte les domaines, fiches de cours,
quiz et examens blancs affichés. Chaque certification a sa propre progression
(pas de partage entre certifications).

- **AZ-500** — Microsoft Azure Security Technologies
- **SC-500** — Implementing End-to-End Security Controls for Cloud and AI
  Workloads (*Microsoft Certified: Cloud and AI Security Engineer Associate*)

Pour ajouter une certification, voir `src/content/registry.ts` : il suffit
d'ajouter un dossier `src/content/<certId>/` avec le même contenu que
`src/content/az500/` (référentiel, fiches de cours, banque de questions,
études de cas, labs) — aucune autre modification de code n'est nécessaire.

## Honnêteté sur le contenu — à lire avant de se fier à un score

Les questions de cette application **ne proviennent pas de la banque officielle
Microsoft**. Elles sont rédigées à partir du référentiel « Skills measured »
publié et de la documentation Azure. Aucune source prétendant divulguer de
vraies questions d'examen n'a été utilisée.

### Écarts connus, SC-500

Le référentiel SC-500 a été vérifié le **2026-08-03** contre le
[study guide officiel](https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/sc-500)
(4 domaines, 12 sous-compétences, **87 puces reprises mot pour mot** dans
`officialSkills[]`). Quatre réserves subsistent :

1. **Le nombre de questions n'est pas publié.** Microsoft ne l'indique ni sur le
   study guide ni sur la page de certification. La fourchette `40-60` affichée
   est une **estimation communautaire**, marquée comme telle par
   `questionCountRangeSource` dans `domains.json`.
2. **Le score affiché est linéaire, le vrai ne l'est pas.** `scaleScore` calcule
   `round(correct/total × 1000)`, ce qui place le seuil de 700 à exactement
   70,0 % de bonnes réponses. La notation réelle est basée sur l'IRT : les items
   sont pondérés par difficulté, donc le même taux brut ne donne pas le même
   score selon la forme d'examen. **Le score de l'app est une approximation.**
3. **Le statut « beta » n'est affirmé nulle part officiellement.** Le titre de la
   certification ne porte pas « (beta) », mais aucune évaluation d'entraînement
   Microsoft n'existe encore. `retirementDate` indique donc « Not announced by
   Microsoft » plutôt qu'une supposition.
4. **Les formats d'items ne sont pas énumérés par Microsoft.** La seule
   affirmation officielle est : « This exam will be proctored. You may have
   interactive components to complete as part of this exam. » Les dix formats
   simulés ici sont déduits de l'exam sandbox et des types d'items publiés par
   Microsoft, pas d'une liste officielle.

### Couverture des fiches de cours SC-500

Les 87 puces officielles sont couvertes par la banque de questions **et** par les
13 fiches. Cinq d'entre elles étaient testées sans être enseignées — un item qui
sanctionne une connaissance qu'aucune fiche ne transmet est une question piège, pas
une révision. Elles ont été ajoutées à l'objectif dont elles relèvent :

| Puce | Objectif | Sujet |
|---|---|---|
| `d1c7` | `o1-4` | évaluer et remédier un accès surprivilégié en Azure RBAC (dont `--include-inherited`) |
| `d2c9` | `o2-3` | règles de sécurité effectives et diagnostics Network Watcher |
| `d3a11` | `o3-1` | gestion des agents dans le centre d'administration Microsoft 365 |
| `d3c4` | `o3-3` | contrôles de sécurité pour Azure Container Instances et Container Apps |
| `d4b7` | `o4-2` | tables de logs personnalisées et transformation dans la DCR |

### État de la remédiation de la banque SC-500

`npm run check:bank` mesure ce qu'un `tsc -b` ne peut pas voir, en particulier
le seul indice qui **survit au mélange des options à l'exécution** : « la bonne
réponse est la plus longue et la plus qualifiée ».

| Mesure | Avant | Maintenant |
|---|---|---|
| Score en cochant toujours l'option la plus longue | 63,6 % | **2,8 %** |
| Items où la plus longue option est la bonne | 65,4 % | **3,1 %** |
| Puces officielles couvertes | 84/87 | **87/87** |
| Puces couvertes par un seul item | 11 | **0** |
| Items portant une provenance `src` | 0 % | **100 %** |
| Items portant un `skillRef` traçable | 0 % | **100 %** |
| Tells de longueur d'options | 368 | **0** |
| Explications sans marqueur de contraste | 249 | **0** |
| Formats interactifs | 4,0 % | **15,1 %** (86/568) |
| Items à réponses multiples utilisant le même ensemble `[0,1]` | 40/40 | **26/33** (6 ensembles sur 6 utilisés) |
| `strictObjectives` | 2/13 | **13/13** |
| Items | 543 | **568** |

Le seuil brut est à 70,0 % : à **2,8 %**, cocher la plus longue ne fait plus rien
gagner. Les 13 objectifs sont inscrits dans `strictObjectives`, donc l'amnistie
`legacy` ne s'applique plus à aucun item SC-500 — et **`npm run check:banks`
exécute désormais SC-500 avec `--no-legacy`**, ce qui referme le cliquet : une
régression sur n'importe quel objectif fait échouer la CI, plus seulement un
avertissement. **AZ-500 passe désormais `--no-legacy` aussi**, donc `check:banks`
exécute les deux banques sans amnistie.

Le seul avertissement subsistant est positionnel : sur 26 des 33 items à réponses
multiples, les deux bonnes réponses sont écrites en positions 0 et 1. Le tirage
mélange les options à l'exécution (`seededShuffle` par item), donc la position
rédigée ne survit pas à l'affichage — c'est pourquoi ce contrôle est un
avertissement et pas une erreur.

**« Remédié » veut dire une seule chose.** Le contrôle du marqueur de contraste
était un avertissement inconditionnel, donc en dehors de `strictObjectives` : un
objectif pouvait être inscrit comme fini tout en portant des explications qui
franchissaient les 120 caractères par remplissage sans nommer aucun distracteur.
`o1-1` et `o2-1` en comptaient 21 et 22. Le contrôle est passé sous `rule()` et
ces 43 explications ont été réécrites, chacune nommant le distracteur le plus
tentant et disant pourquoi il échoue.

**Un passage par item, pas trois.** Sur les 11 objectifs restants, le tell de
longueur, l'explication et le choix du format ont été traités ensemble — 310 items
remplacés en entier via `scripts/apply-items.mjs`, plutôt que trois passes sur les
mêmes fichiers. Le format a changé là où le QCM nuisait activement :

| Conversion | Items | Motif |
|---|---|---|
| `drag-match` | +16 | un quadruplet de terminologie interrogé par 4 ou 5 items séparés (NSG/Firewall/WAF/DDoS, les rôles Sentinel, les types de chiffrement de disque) |
| `statement-grid` | +12 | quatre faits indépendants qu'un QCM ne pouvait tester qu'un à la fois |
| `dropdown-sentence` | +10 | une décision en 2-3 temps, ou une syntaxe dont seuls les paramètres portent la connaissance |
| `build-list` | +10 | une séquence dont l'ordre a une conséquence réelle, avec des actions nuisibles à exclure |

### État de la banque AZ-500 — et ce qui a été délibérément laissé de côté

AZ-500 **est retirée le 31 août 2026** (`retirementSource` dans
`src/content/az500/domains.json` porte la citation Microsoft mot pour mot et la date
de vérification). Le travail a d'abord été trié sur le seul critère du rendement de
révision avant cette date. Les tells de longueur étaient explicitement hors périmètre
à ce titre, puis ont été traités quand même : ils tenaient dans le temps disponible.

| Mesure | Avant | Maintenant |
|---|---|---|
| Explications sous 120 caractères ou sans marqueur de contraste | 387/492 | **0** |
| Réponses correctes qui sont une ligne de commande complète | 45 | **0** |
| Formats interactifs | 0 % | **6,8 %** |
| Tells de longueur d'options | 300 | **0** |
| La plus longue option est la bonne réponse | 70,0 % | **2,7 %** |
| Score en cochant toujours l'option la plus longue | 69,5 % | **2,5 %** |
| Items | 492 | **556** |
| Questions à contrainte, par examen blanc de 50 | 0 | **9 (18 %)** |

Le seuil brut est à 70,0 % : à **2,5 %**, la stratégie ne rapporte plus rien.
`bankStatus.freeScorePercent` suit cette valeur, et l'avertissement de fiabilité de
`src/components/ExamMetaNotices.tsx` **disparaît de lui-même** — son seuil n'est plus
franchi. Le bandeau de retrait, lui, reste : c'est une date, pas une mesure.

`check-bank --cert=az500 --no-legacy` sort à 0. Les avertissements restants sont
positionnels (les deux bonnes réponses écrites en positions 0 et 1 sur les items à
réponses multiples, ce que `seededShuffle` défait à l'affichage) et des énoncés
partageant le squelette d'un format.

### Ce que 90 % sur l'examen blanc ne prédisait pas

Deux évaluations officielles Microsoft, passées les 16 et 17 août 2026, ont donné
**42 % puis 56 %** alors que la banque rendait 90 %. Le dépouillement des 100
questions a isolé deux causes, et les deux ont été traitées.

**Des sujets absents.** Un sondage a trouvé **25 sujets testés par Microsoft et
couverts par aucun des 492 items** — concentrés sur Key Vault, dont la banque ne
connaissait que l'accès par identité managée. **39 items ont été ajoutés** via le
nouveau `scripts/add-items.mjs` ; le sondage retourne désormais **0 sujet à 0 item**.

| Objectif | + | Ce qui manquait |
|---|---|---|
| `o4-1` | 9 | matrice RBAC Key Vault, niveaux de coffre, FIPS 140-2, purge protection, BYOK, rotation par Event Grid, RGPD sans initiative intégrée |
| `o1-2` | 5 | étendues OIDC, types de consentement, rôle Application Developer, certificat vs secret client |
| `o1-1` `o4-2` `o4-4` | 4 chacun | MFA hors ligne et rôles PIM · EASM et exportation continue · types de règles Sentinel et DCR |
| `o3-1` `o4-3` | 3 chacun | cmdlets JIT et CNI/kubenet · périmètre Defender for SQL |
| `o3-2` `o3-3` | 3 chacun | SAS de service et `signedIP` · masquage vs RLS, étiquetage |
| `o2-2` | 1 | intégration VNet requise par passerelle |

**Un défaut de forme, plus grave car il touchait les 492 items d'un coup.** L'énoncé
médian de la banque faisait 102 caractères contre 350-500 chez Microsoft, et
**aucun item ne portait de clause de contrainte** (« la solution doit suivre le
principe du privilège minimum », « doit réduire au maximum les coûts ») là où ~17 des
100 questions officielles sont départagées par elle. C'est le raisonnement que la
banque n'entraînait pas : plusieurs options sont techniquement correctes et une seule
respecte la contrainte. **37 items en portent une**, et leur explication dit
*pourquoi l'option écartée était juste mais trop large, trop coûteuse ou trop
lacunaire*.

### Le vivier n'est pas le tirage — et c'est le tirage qui compte

Les 12 premiers items à contrainte faisaient 2,3 % du vivier, ce qui ressemblait à un
progrès. Le calcul de l'espérance a montré le contraire : le tirage alloue par poids de
domaine puis choisit au hasard, donc un examen blanc de 40 questions en contenait
**0,90** — jamais plus d'un. Les items existaient, la voie de l'examen blanc n'y menait
pas.

Deux leviers ont été écartés **après mesure**, pas par principe :

| Levier | Mesuré | Pourquoi non |
|---|---|---|
| Supprimer les doublons | 4 doublons réels | supprimer 120 items n'économiserait que 24 ajouts : le ratio est gouverné par les ajouts |
| Ajouter une clause aux items existants | 0 sur 5 échantillonnés convertibles | la banque est majoritairement du rappel — on ne greffe pas « privilège minimum » sur « que fait un point de terminaison de service ? » |

D'où un **quota au tirage**, `constraintShare` dans `domains.json`, appliqué **à
l'intérieur** de l'allocation par domaine : `allocateByWeight` est intact, donc la
pondération du blueprint n'a pas été troquée contre celle-ci. Résultat mesuré sur
300 tirages : **7,00 sur 40 (17,5 %) et 10,00 sur 60 (16,7 %)**, et le nombre que
`ExamStart` annonce à l'apprenant est exactement celui que le tirage livre.

Trois choses que cela a coûté ou révélé, à dire plutôt qu'à taire :

- **Le quota est une cible, pas un plancher.** Première version : le reliquat pouvait
  retirer d'autres items à contrainte, ce qui montait à ~22 %. La page annonçant un
  nombre, le tirage lui doit ce nombre — le reliquat ne pioche donc que dans les items
  ordinaires, avec rattrapage seulement si un domaine en manque.
- **Le recouplement monte de 7,6 % à 8,9 %** entre deux examens consécutifs de
  40 questions : 37 items tournent sur 7 places au lieu d'être noyés dans 556. Prix
  assumé de la fidélité.
- **17 % n'est pas un chiffre Microsoft.** C'est un comptage à la main sur les
  100 questions de deux évaluations d'entraînement (19 au comptage inclusif, 17 au
  comptage prudent). `constraintShare.source` le dit, et la page d'examen le dit à
  l'apprenant — même traitement que `questionCountRangeSource`.

**Un marqueur, pas une expression régulière.** `QuizQuestion.decision`
(`least-privilege` | `cost` | `coverage`) est ce que lit le tirage. `check-bank`
assère l'équivalence **dans les deux sens** : marqueur sans clause fabriquerait un
quota creux, clause sans marqueur rendrait l'item invisible au tirage. Le contrôle a
immédiatement attrapé quatre erreurs à moi — deux items marqués `coverage` dont
l'énoncé n'employait pas le vocabulaire reconnu, et un item SC-500 oublié.

Deux leçons de rédaction méritent d'être notées, parce qu'elles se reposeront :

- **Certains sujets ne tiennent pas en QCM.** `offline_access` est intrinsèquement la
  plus longue étendue OIDC *et* une bonne réponse ; les noms de règles Sentinel vont
  de 6 à 21 caractères. Le tell y est insoluble sans inventer des noms de
  fonctionnalités qui n'existent pas. Ces deux items sont donc une grille Oui/Non et
  un glisser-déposer, formats sans règle de longueur d'options.
- **Un énoncé long *améliore* le contrôle de quasi-doublons.** Mesuré avant d'écrire :
  quatre énoncés scénarisés donnent un Jaccard par paire de **0,09-0,40** contre un
  seuil à 0,60, parce qu'un texte long porte plus de tokens distinctifs. C'est
  l'inverse de l'intuition, et c'est pourquoi `check-bank` n'a eu besoin d'aucun
  ajustement.
- **`normalise()` dans `check-bank.mjs` est une liste blanche.** Un champ qui n'y est
  pas recopié est invisible à *tous* les contrôles en aval. `decision` et le bloc
  `exam` ont chacun été perdus ainsi une fois, avec le même symptôme : un garde-fou
  qui passe en lisant `undefined` des deux côtés de sa comparaison.

**Trois faux positifs à ne pas repayer** en cherchant des doublons dans cette banque.
Une même bonne réponse ne suffit pas à conclure :

- les 36 items `solution-goal` répondent littéralement `Yes` ou `No` — c'est le format ;
- les items `case-study` re-testent volontairement un fait dans un scénario, et
  `check-bank` exige ≥ 4 questions par étude de cas, donc les retirer casserait
  l'amortissement du scénario ;
- deux questions différentes peuvent partager une réponse : `q-o2-1-37` et `q-o2-2-40`
  répondent tous deux `az network vnet subnet update`, l'un pour attacher un NSG,
  l'autre pour activer un point de terminaison de service.

Sur 14 candidats détectés, **4 étaient de vrais doublons**. Ils ont été repointés sur
des faits que la banque ne testait pas (client natif Bastion, chiffrement
d'infrastructure au moment de la création, tables ledger, fonctions de masquage) plutôt
que supprimés, pour que chaque objectif garde son compte d'items.

**Hors périmètre, assumé :** le référentiel vérifié contre le study guide (celui
d'AZ-500 est paraphrasé, le même défaut que SC-500 avait), la provenance `src`, la
traçabilité `skillRef`, et la fiche de faits. Aucun de ces chantiers ne fait gagner de
points à quelqu'un qui passe l'examen avant le 31 août, et la certification disparaît
ensuite.

### Réviser la syntaxe Azure CLI et PowerShell

Les ressources Microsoft enseignent et testent ces commandes, donc le sujet reste.
C'est le **format** qui a changé, parce qu'une seule des trois compétences cachées
derrière « une question CLI » se prête au QCM :

| Compétence testée | Volatilité | Format |
|---|---|---|
| **Quelle** commande fait le travail | faible | **QCM** — inchangé |
| **Quels** paramètres et valeurs | élevée | **phrase à compléter** |
| **Dans quel ordre** enchaîner les commandes | moyenne | **construction de liste** |
| L'écrire de mémoire | — | saisie libre auto-évaluée, ou rien — jamais de notation par regex |

**Pourquoi, mesuré sur les deux banques (55 items) :** quand la bonne réponse était
une ligne de commande complète, c'était l'option la plus longue dans **82 % des
cas**, ratio médian **1,88**, 39 sur 55 au-dessus du budget de 1,6. Ce n'est pas de
la rédaction négligée, c'est ce que le format produit : une commande correcte porte
tous ses paramètres obligatoires, une commande fausse est fausse précisément parce
qu'elle en omet ou en déforme un. La bonne réponse est donc structurellement la plus
longue, et rallonger les distracteurs demanderait d'inventer de fausses commandes
longues et crédibles.

`check-bank.mjs` refuse désormais une ligne de commande complète comme réponse d'un
item à choix, et indique quel format utiliser. **Les deux banques sont conformes :
0 item concerné.** Les 45 items AZ-500 ont été convertis suivant le tableau
ci-dessus — 28 en phrase à compléter, 5 en construction de liste, et 12 ramenés à un
QCM sur des **noms de commande nus** (là où les paramètres n'étaient que du
remplissage : `az vm identity assign` contre `az identity create` est une question
système/utilisateur, pas une question de syntaxe).

Effet propre de cette conversion sur AZ-500, avant la remédiation des longueurs qui
a suivi : le score « toujours la plus longue » passe de **69,5 % à 66,4 %** et la
part de formats interactifs de **0 % à 6,7 %**. La conversion n'était pas une
opération cosmétique : sur ces 45 items, un candidat qui ne lisait que la longueur
des options avait la bonne réponse 4 fois sur 5.

Pour reprendre le travail : `node scripts/show-tells.mjs sc500 <objectif>`
liste les items à retoucher, les plus nuisibles d'abord, avec la longueur cible
de chaque distracteur. Deux outils appliquent les corrections par lot :

| Outil | Portée | Garde-fous |
|---|---|---|
| `apply-rewrites.mjs` | un texte de distracteur | refuse une cible qui n'apparaît pas exactement une fois, une cible qui est la bonne réponse, tout raccourcissement non déclaré |
| `apply-explanations.mjs` | l'explication, par id | refuse sous 120 caractères, sans marqueur de contraste, ou citant une lettre d'option |
| `apply-items.mjs` | **l'item entier**, par id | refuse un id inconnu, un `objectiveId` déplacé, une réponse encore sous forme de ligne de commande, et tout écrit qui casserait le JSON |
| `apply-choices.mjs` | `choices` et `correctAnswers` seuls | refuse un doublon d'option, une bonne réponse absente de `choices`, un rapport > 1,6, et **la plus longue option encore correcte** |
| `add-items.mjs` | **de nouveaux items**, en fin de fichier | refuse un id qui existe déjà, un id dont le préfixe ne désigne pas le fichier visé, un `objectiveId` en désaccord avec l'id, un doublon dans le lot |

`add-items.mjs` est séparé d'`apply-items.mjs` et non un drapeau de celui-ci : les
deux refus sont exactement inverses — l'un exige que l'id existe, l'autre qu'il
n'existe pas. Les fusionner supposerait une option qui désactive un garde-fou, et un
id mal tapé ajouterait alors un doublon en silence au lieu d'être refusé.

`apply-items.mjs` existe parce qu'un changement de format n'est pas une édition de
champ : convertir un QCM en `drag-match` doit faire disparaître `choices` et
apparaître `sources`/`targets`, ce qu'un éditeur champ-par-champ ne sait pas
exprimer. C'est aussi ce qui a permis de traiter le tell, l'explication et le
format **en un seul passage par item**.

**Un défaut que le validateur ne voyait pas.** Les 16 nouveaux `drag-match` ont été
écrits avec `text` sur chaque cible alors que le composant lit `label` : `id` et
`correctSource` étaient présents et l'item était notable, donc `check-bank.mjs`
passait — et le rendu jetait `undefined.length` au montage, ce qui se présentait
comme « cet objectif affiche une page blanche ». Corrigé, et le validateur assère
désormais le champ que le composant lit réellement. La leçon n'est pas « relire
mieux » : c'est qu'un contrôle de structure doit porter sur les champs **consommés
par le rendu**, pas seulement sur ceux qui suffisent à la notation.

**Le piège, mesuré sur mes propres ajouts.** Les 16 items à choix écrits pendant
cette refonte avaient d'abord la bonne réponse comme option la plus longue dans
**14 cas sur 16** — pire que les 62 % de la banque en cours de correction. Une
bonne réponse rédigée avec assez de qualification pour se justifier finit
naturellement plus longue que des distracteurs écrits pour être seulement
plausibles. C'est une règle d'**écriture**, pas de relecture : le validateur ne
fait que constater après coup. Après correction : 1 sur 16.

### Formats d'items

SC-500, 568 items :

| Format | Part |
|---|---|
| Réponse unique | 59,5 % |
| Étude de cas · solution/objectif · réponses multiples | 7,0 % · 6,9 % · 5,5 % |
| Réordonnancement · active screen | 3,7 % · 2,3 % |
| **Interactifs** — glisser-déposer 4,4 % · grille Oui/Non 4,0 % · phrase à compléter 3,5 % · construction de liste 3,2 % | **15,1 %** (86 items) |

Les quatre formats interactifs sont livrés et vérifiés comme se montant réellement
— `verify:offline` monte chacun **par identifiant** via la route de rejeu, au lieu
d'espérer qu'un tirage mélangé finisse par en produire un. La cible de ≈ 15 % est
atteinte en convertissant des items existants pendant la remédiation : corriger un
tell de longueur et changer le format d'un item sont la même modification.

Sur AZ-500 les interactifs restent à 6,7 % : la conversion n'y a servi qu'à sortir
les 45 lignes de commande, sans objectif de composition pour une banque qui
disparaît le 31 août.

## Contrôles avant de livrer

```bash
npm run check:banks      # les deux banques : structure, provenance, tells, couverture
npm run verify:exam      # le tirage d'examen : allocation pondérée, groupage des études de cas
npm run verify:offline   # dist-single en file:// : rendu, routage, IndexedDB, renderers, bandeaux
npm run verify:review    # la file « À revoir » : une question réussie en sort bien
```

**Un chiffre rendu à l'apprenant doit être vérifié comme du code.**
`bankStatus.freeScorePercent` alimente l'avertissement de fiabilité, et les deux
banques ont livré ce chiffre périmé une fois chacune : remédier la banque sans le
mettre à jour laisse l'app se dénigrer elle-même à tort. `check-bank` compare
désormais la valeur stockée au score « toujours la plus longue » qu'il mesure et
**échoue** au-delà de 0,15 point d'écart ; `verify:offline` vérifie ensuite que
l'UI suit ce chiffre, dans les deux sens — bandeau affiché quand il le faut, et
**absent quand il ne le faut plus**.

`check:banks` et `verify:exam` tournent en CI **avant** le build, parce qu'un
`tsc -b` vert ne voit ni qu'une banque divulgue ses réponses par la longueur des
options, ni qu'une entrée de `correctAnswers` est absente de `choices`, ni qu'un
départage d'allocation dépend d'un détail d'implémentation du tri.

**Ce dépôt n'a ni test unitaire ni lint** en dehors de `verify:exam`. Un `tsc -b`
vert plus une banque propre ne sont pas « les tests passent ».

## Fonctionnalités

- **À revoir** : les questions dont la **dernière** réponse était fausse, avec
  ta réponse affichée à côté de celle attendue et l'explication. Filtrable par
  objectif et par compétence officielle, et rejouable en une session restreinte
  à ces questions. Répondre juste à une question la retire de la liste — c'est
  ce qui fait que le compteur veut dire quelque chose, là où « a été raté au
  moins une fois » ne redescendrait jamais.

  Le rejeu **ne met pas à jour** la date de révision de l'objectif : il ne tire
  que tes erreurs, ce n'est donc pas un échantillon représentatif, et l'alimenter
  dans la répétition espacée corromprait le calendrier. Les tentatives sont
  enregistrées quand même, ce qui suffit à vider la liste.

- **Dashboard** : progression globale pondérée par domaine, objectifs à risque
  (score faible ou révision en retard), compteur « à revoir », historique des
  examens blancs.
- **Domaines → objectifs** : navigation par les domaines officiels de la
  certification active (pondération Microsoft affichée), fiche de cours
  condensée par objectif (résumé, points clés, pièges fréquents, liens
  Microsoft Learn). Quand la certification s'y prête, chaque fiche inclut
  aussi les commandes Azure CLI et PowerShell testées à l'examen, avec des
  questions dédiées à leur syntaxe exacte.
- **Quiz ciblé** : banque de questions par objectif. Chaque session tire un
  sous-ensemble au hasard (10, 20, ou tout), l'ordre des réponses est mélangé
  (stable pendant la session, différent à chaque passage), feedback immédiat
  avec explication, et mise à jour de la répétition espacée (SM-2) à la fin.
  Les distracteurs sont plausibles et dans le même domaine pour éviter la
  devinette par élimination.
- **Types de questions** : QCM simple/multiple, étude de cas, **réordonnancement**
  (glisser-déposer, façon "build list"), **active screen** (mini-écran simulé
  à configurer — pas une réplique du vrai portail Azure), et **solution/objectif**
  (plusieurs solutions proposées pour un même objectif, réponse Oui/Non, **sans
  retour en arrière possible** une fois passé à la question suivante — comme
  dans le vrai examen). Ce mix sert à s'entraîner à la logique de chaque
  format ; ce n'est **pas** une reconstitution fidèle de la vraie répartition,
  que Microsoft ne publie pas.
- **Examen blanc** : tirage pondéré selon les % officiels des domaines,
  chronométré à la durée officielle de la certification active, résultat
  détaillé par domaine avec score ramené sur 1000.
- **Répétition espacée** : algorithme SM-2 simplifié, calculé par objectif à
  partir du taux de bonnes réponses de chaque session (quiz ciblé ou tranche
  d'examen blanc concernant cet objectif).
- **Labs** : scénarios pratiques à réaliser sur ton propre tenant Azure
  (portal.azure.com), avec checklist de complétion persistée.

Toutes les données de contenu (référentiel, fiches de cours, banque de
questions, études de cas, labs) sont versionnées en JSON dans
`src/content/<certId>/`. Toutes les données utilisateur (progression,
tentatives, résultats d'examen, complétion des labs) sont stockées côté
navigateur dans IndexedDB via Dexie, avec un champ `certId` qui isole la
progression de chaque certification — rien n'est envoyé à un serveur. Pour
repartir de zéro, vide les données du site dans les outils de développement
du navigateur (Application ▸ IndexedDB ▸ study-guide-db ▸ Delete database).

## Vérification end-to-end (Playwright)

Un script pilote un vrai navigateur headless pour vérifier que les
principaux parcours fonctionnent (dashboard, navigation, quiz, examen blanc,
labs) :

```bash
npm run dev &                 # dans un terminal
npm run test:e2e              # dans un autre (installe Chromium au besoin)
```

Avec Docker (pas de Node local), tout se fait dans le même conteneur — voir
`scripts/smoke-test.mjs` pour le détail des vérifications effectuées.
