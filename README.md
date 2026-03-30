# Projet B MongoDB - Documentation

## Structure de la base de donnees

Base: `ProjetBnoSQL`

Collections exposees par l'API:

- `users`
  - `user_id` (Number)
  - `username` (String)
  - `email` (String)
  - `created_at` (String / Date)
  - `bio` (String)

- `posts`
  - `post_id` (Number)
  - `user_id` (Number, reference `users.user_id`)
  - `content` (String)
  - `created_at` (String / Date)
  - `likes_count` (Number)

- `comments`
  - `comment_id` (Number)
  - `post_id` (Number, reference `posts.post_id`)
  - `user_id` (Number, reference `users.user_id`)
  - `content` (String)
  - `created_at` (String / Date)

- `likes`
  - `like_id` (Number)
  - `post_id` (Number, reference `posts.post_id`)
  - `user_id` (Number, reference `users.user_id`)
  - `created_at` (String / Date)

Notes:
- Les types peuvent etre String ou Date selon la source des donnees.
- Les champs ci-dessus sont ceux utilises par l'interface (index.html, users.html).

## Fonction des scripts qui extraient les informations

### API Node/Express

Le serveur expose les collections MongoDB via des endpoints JSON.

- [server.js](server.js)
  - Connexion a MongoDB (`MONGO_URL`, `DB_NAME`).
  - Route `GET /api/:collection` qui renvoie une collection (avec pre-tri cote serveur).
  - Collections autorisees: `users`, `posts`, `comments`, `likes`.
  - Parametres optionnels: `?sort=champ&order=asc|desc&limit=25&page=1`.
  - Route `GET /api/view/:viewKey` (pre-tri et pagination cote serveur) pour les vues:
    - `top-users`, `top-posts`, `recent-posts`, `active-users`
    - Parametres: `?page=1&limit=25&detail=0|1`
  - Route `GET /api/stats/kpis` pour les totaux et moyennes.
  - Route `GET /api/stats/health` pour les incoherences (posts manquants).

### Scripts front-end

- [app.js](app.js)
  - Charge les KPIs et les listes deja triees via `/api/stats/*` et `/api/view/*`.
  - Calcule les KPIs (totaux, moyennes), top utilisateurs/posts, activite recente.
  - Affiche les indicateurs de sante des donnees (likes/comments orphelins).

- [users.js](users.js)
  - Charge les donnees paginees par vue via `/api/view/*`.
  - Vues principales: top users, top posts, recent posts, active users.
  - Gere pagination et bascule entre tableau et cartes detaillees (detail cote serveur).

## Requetes MongoDB (exemples)

Ces requetes peuvent etre lancees dans le shell MongoDB pour verifier la coherence ou produire des statistiques.

## Index recommandes

Ces index ameliorent le tri et les jointures utilisees par l'API.

### users

db.users.createIndex({ user_id: 1 }, { unique: true })
db.users.createIndex({ created_at: -1 })
db.users.createIndex({ username: 1 })

### posts

db.posts.createIndex({ post_id: 1 }, { unique: true })
db.posts.createIndex({ user_id: 1 })
db.posts.createIndex({ created_at: -1 })
db.posts.createIndex({ likes_count: -1 })

### comments

db.comments.createIndex({ comment_id: 1 }, { unique: true })
db.comments.createIndex({ post_id: 1 })
db.comments.createIndex({ user_id: 1 })
db.comments.createIndex({ created_at: -1 })

### likes

db.likes.createIndex({ like_id: 1 }, { unique: true })
db.likes.createIndex({ post_id: 1 })
db.likes.createIndex({ user_id: 1 })
db.likes.createIndex({ created_at: -1 })

### Script 1 - Nombre de publications par utilisateur

db.posts.aggregate([
  {
    $group: {
      _id: "$user_id",
      nb_publications: { $sum: 1 }
    }
  },
  { $sort: { nb_publications: -1 } },
  { $limit: 10 }
])

### Script 2 - Taux de participation (likes + publications) par utilisateur

db.posts.aggregate([
  {
    $group: {
      _id: "$user_id",
      total_posts: { $sum: 1 },
      total_likes_recus: { $sum: "$likes_count" }
    }
  },
  {
    $lookup: {
      from: "likes",
      localField: "_id",
      foreignField: "user_id",
      as: "likes_donnes"
    }
  },
  {
    $addFields: {
      likes_donnes: { $size: "$likes_donnes" },
      score_participation: {
        $add: ["$total_posts", { $size: "$likes_donnes" }]
      }
    }
  },
  { $sort: { score_participation: -1 } }
])

### Script 3 - Nombre de commentaires par publication

db.comments.aggregate([
  {
    $group: {
      _id: "$post_id",
      nb_commentaires: { $sum: 1 }
    }
  },
  {
    $lookup: {
      from: "posts",
      localField: "_id",
      foreignField: "post_id",
      as: "post_info"
    }
  },
  {
    $project: {
      post_id: "$_id",
      nb_commentaires: 1,
      contenu: { $arrayElemAt: ["$post_info.content", 0] }
    }
  },
  { $sort: { nb_commentaires: -1 } }
])

### Script 4 - Top posts les plus likes

db.posts.find(
  {},
  { content: 1, likes_count: 1, user_id: 1 }
).sort({ likes_count: -1 }).limit(5)

### Teste Data Health

#### Créer et Supprimer un commentaire ou un like orphelin
db.comments.insertOne({ comment_id: 999999, post_id: -1, user_id: 1, content: "Test", created_at: new Date() })

db.comments.deleteOne({ comment_id: 999999 })

db.likes.insertOne({ like_id: 999999, post_id: -1, user_id: 1, created_at: new Date() })

db.likes.deleteOne({ like_id: 999999 })