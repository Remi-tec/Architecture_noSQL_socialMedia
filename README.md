# Script récupération des données


## Script 1 — Nombre de publications par utilisateur

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


## Script 2 — Taux de participation (likes + publications) par utilisateur

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


## Script 3 — Nombre de commentaires par publication

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


## Script 4 — Top posts les plus likés (bonus)

db.posts.find(
  {},
  { content: 1, likes_count: 1, user_id: 1 }
).sort({ likes_count: -1 }).limit(5)