# Mini Fight Kawaii

Un petit jeu de combat kawaii en local, écrit en HTML5 canvas et JavaScript pur (aucune dépendance).
Palette bleu et violet, petites combattantes chibi, menu avec boutons.

## Lancer le jeu

Ouvre simplement `index.html` dans ton navigateur (double-clic).

## Le menu

- **Nom du personnage** : obligatoire avant de jouer (12 caractères max).
- **Couleur** : violet, bleu ciel, indigo ou lilas.
- **Accessoire** : nœud, oreilles de chat ou étoiles.
- **Mode** : 2 joueuses en local, ou contre l'ordinateur (Mochi).
- Tes choix sont mémorisés dans le navigateur.

## Commandes

| Action   | Joueuse 1               | Joueuse 2         |
|----------|-------------------------|-------------------|
| Gauche   | `A` (`Q` en AZERTY)     | `←`               |
| Droite   | `D`                     | `→`               |
| Sauter   | `W` (`Z` en AZERTY)     | `↑`               |
| Frapper  | `F`                     | `L`               |
| Parer    | `G`                     | `K`               |

`P` ou `Échap` pour mettre en pause, `Entrée` pour valider / rejouer. Les boutons à l'écran font la même chose.

## Règles

- Chaque joueuse a 100 points de vie.
- Un coup fait 10 dégâts, un coup paré n'en fait que 2 (il faut faire face à l'adversaire).
- Le round dure 60 secondes. Si le temps est écoulé, celle qui a le plus de vie gagne.
- Les victoires sont comptées tant que tu enchaînes les revanches.

## Mettre en ligne avec GitHub Pages

1. Crée un dépôt sur GitHub et pousse les fichiers :
   ```bash
   git init
   git add .
   git commit -m "Premier commit"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/mini-fight.git
   git push -u origin main
   ```
2. Dans le dépôt : **Settings → Pages → Branch: `main` / root → Save**.
3. Le jeu sera jouable sur `https://TON-PSEUDO.github.io/mini-fight/`.

## Idées pour la suite

- Ajouter des sons et de la musique
- Plusieurs rounds (premier à 2 victoires)
- Attaques spéciales
