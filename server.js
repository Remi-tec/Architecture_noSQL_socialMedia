const express = require("express");
const { MongoClient } = require("mongodb");

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "ProjetBnoSQL";
const ALLOWED_COLLECTIONS = new Set(["users", "posts", "comments", "likes"]);
const VIEW_KEYS = new Set([
  "top-users",
  "top-posts",
  "recent-posts",
  "active-users",
  "health-comments",
  "health-likes"
]);
const SORT_FIELDS = {
  users: new Set(["user_id", "username", "created_at"]),
  posts: new Set(["post_id", "user_id", "created_at", "likes_count"]),
  comments: new Set(["comment_id", "post_id", "user_id", "created_at"]),
  likes: new Set(["like_id", "post_id", "user_id", "created_at"])
};

const app = express();
app.use(express.static(__dirname));

let client;
let db;

const connect = async () => {
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
};

const parsePositiveInt = (value, fallback) => {
  const parsed = parseInt(value, 10);
  if (Number.isInteger(parsed) && parsed > 0) return parsed;
  return fallback;
};

const getViewSource = (viewKey) => {
  switch (viewKey) {
    case "top-users":
      return "posts";
    case "top-posts":
    case "recent-posts":
      return "posts";
    case "active-users":
      return "users";
    case "health-comments":
      return "comments";
    case "health-likes":
      return "likes";
    default:
      return "posts";
  }
};

const buildViewPipeline = (viewKey, detail) => {
  switch (viewKey) {
    case "top-users": {
      const pipeline = [
        {
          $group: {
            _id: "$user_id",
            posts: { $sum: 1 }
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "_id",
            foreignField: "user_id",
            as: "user"
          }
        },
        {
          $addFields: {
            user: { $arrayElemAt: ["$user", 0] }
          }
        },
        {
          $project: detail
            ? {
                userId: "$_id",
                username: { $ifNull: ["$user.username", "-"] },
                email: { $ifNull: ["$user.email", "-"] },
                created_at: "$user.created_at",
                bio: { $ifNull: ["$user.bio", "-"] },
                posts: 1,
                metric: "$posts",
                metricLabel: "Posts"
              }
            : {
                userId: "$_id",
                username: { $ifNull: ["$user.username", "-"] },
                posts: 1
              }
        },
        { $sort: { posts: -1 } }
      ];
      return pipeline;
    }
    case "top-posts": {
      const pipeline = [
        { $sort: { likes_count: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "user_id",
            as: "user"
          }
        },
        {
          $addFields: {
            user: { $arrayElemAt: ["$user", 0] }
          }
        },
        {
          $project: detail
            ? {
                postId: "$post_id",
                title: { $concat: ["Post #", { $toString: "$post_id" }] },
                created_at: "$created_at",
                likes: { $ifNull: ["$likes_count", 0] },
                author: {
                  $ifNull: [
                    "$user.username",
                    { $concat: ["User #", { $toString: "$user_id" }] }
                  ]
                },
                content: { $ifNull: ["$content", "-"] }
              }
            : {
                postId: "$post_id",
                post: { $concat: ["Post #", { $toString: "$post_id" }] },
                likes: { $ifNull: ["$likes_count", 0] }
              }
        }
      ];
      return pipeline;
    }
    case "recent-posts": {
      const pipeline = [
        { $sort: { created_at: -1 } },
        {
          $lookup: {
            from: "users",
            localField: "user_id",
            foreignField: "user_id",
            as: "user"
          }
        },
        {
          $addFields: {
            user: { $arrayElemAt: ["$user", 0] }
          }
        },
        {
          $project: detail
            ? {
                postId: "$post_id",
                title: { $concat: ["Post #", { $toString: "$post_id" }] },
                created_at: "$created_at",
                likes: { $ifNull: ["$likes_count", 0] },
                author: {
                  $ifNull: [
                    "$user.username",
                    { $concat: ["User #", { $toString: "$user_id" }] }
                  ]
                },
                content: { $ifNull: ["$content", "-"] }
              }
            : {
                postId: "$post_id",
                post: { $concat: ["Post #", { $toString: "$post_id" }] },
                created_at: "$created_at",
                likes: { $ifNull: ["$likes_count", 0] },
                content: { $ifNull: ["$content", "-"] }
              }
        }
      ];
      return pipeline;
    }
    case "active-users": {
      const pipeline = [
        {
          $lookup: {
            from: "posts",
            localField: "user_id",
            foreignField: "user_id",
            as: "posts"
          }
        },
        {
          $lookup: {
            from: "comments",
            localField: "user_id",
            foreignField: "user_id",
            as: "comments"
          }
        },
        {
          $lookup: {
            from: "likes",
            localField: "user_id",
            foreignField: "user_id",
            as: "likes"
          }
        },
        {
          $addFields: {
            postsCount: { $size: "$posts" },
            actions: { $add: [{ $size: "$comments" }, { $size: "$likes" }] }
          }
        },
        {
          $project: detail
            ? {
                userId: "$user_id",
                username: { $ifNull: ["$username", "-"] },
                email: { $ifNull: ["$email", "-"] },
                created_at: "$created_at",
                bio: { $ifNull: ["$bio", "-"] },
                postsCount: 1,
                actions: 1,
                metric: "$actions",
                metricLabel: "Actions"
              }
            : {
                userId: "$user_id",
                username: { $ifNull: ["$username", "-"] },
                actions: 1
              }
        },
        { $sort: { actions: -1 } }
      ];
      return pipeline;
    }
    case "health-comments": {
      const pipeline = [
        {
          $lookup: {
            from: "posts",
            localField: "post_id",
            foreignField: "post_id",
            as: "post_info"
          }
        },
        { $match: { post_info: { $size: 0 } } },
        {
          $project: {
            itemId: "$comment_id",
            postId: "$post_id",
            userId: "$user_id",
            created_at: "$created_at",
            content: { $ifNull: ["$content", "-"] }
          }
        },
        { $sort: { created_at: -1 } }
      ];
      return pipeline;
    }
    case "health-likes": {
      const pipeline = [
        {
          $lookup: {
            from: "posts",
            localField: "post_id",
            foreignField: "post_id",
            as: "post_info"
          }
        },
        { $match: { post_info: { $size: 0 } } },
        {
          $project: {
            itemId: "$like_id",
            postId: "$post_id",
            userId: "$user_id",
            created_at: "$created_at"
          }
        },
        { $sort: { created_at: -1 } }
      ];
      return pipeline;
    }
    default:
      return [];
  }
};

const buildViewCountPipeline = (viewKey) => {
  const pipeline = buildViewPipeline(viewKey, false);
  return [...pipeline, { $count: "total" }];
};

app.get("/api/view/:viewKey", async (req, res) => {
  const viewKey = req.params.viewKey;
  if (!VIEW_KEYS.has(viewKey)) {
    return res.status(404).json({ error: "Unknown view" });
  }

  try {
    const limit = parsePositiveInt(req.query.limit, null);
    const page = parsePositiveInt(req.query.page, 1);
    const detail = req.query.detail === "1" || req.query.detail === "true";

    const pipeline = buildViewPipeline(viewKey, detail);
    if (limit) {
      pipeline.push({ $skip: (page - 1) * limit }, { $limit: limit });
    }

    const sourceCollection = getViewSource(viewKey);
    const [items, totalResult] = await Promise.all([
      db.collection(sourceCollection).aggregate(pipeline).toArray(),
      db.collection(sourceCollection).aggregate(buildViewCountPipeline(viewKey)).toArray()
    ]);

    const total = totalResult[0]?.total || 0;
    return res.json({ items, total });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/stats/kpis", async (req, res) => {
  try {
    const [totalUsers, totalPosts, totalComments, totalLikes] = await Promise.all([
      db.collection("users").countDocuments(),
      db.collection("posts").countDocuments(),
      db.collection("comments").countDocuments(),
      db.collection("likes").countDocuments()
    ]);

    const avgLikes = totalPosts ? totalLikes / totalPosts : 0;
    const avgComments = totalPosts ? totalComments / totalPosts : 0;
    const postsPerUser = totalUsers ? totalPosts / totalUsers : 0;
    const commentsPerUser = totalUsers ? totalComments / totalUsers : 0;

    return res.json({
      totalUsers,
      totalPosts,
      totalComments,
      totalLikes,
      avgLikes,
      avgComments,
      postsPerUser,
      commentsPerUser
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/stats/health", async (req, res) => {
  try {
    const [missingCommentsResult, missingLikesResult] = await Promise.all([
      db
        .collection("comments")
        .aggregate([
          {
            $lookup: {
              from: "posts",
              localField: "post_id",
              foreignField: "post_id",
              as: "post_info"
            }
          },
          { $match: { post_info: { $size: 0 } } },
          { $count: "total" }
        ])
        .toArray(),
      db
        .collection("likes")
        .aggregate([
          {
            $lookup: {
              from: "posts",
              localField: "post_id",
              foreignField: "post_id",
              as: "post_info"
            }
          },
          { $match: { post_info: { $size: 0 } } },
          { $count: "total" }
        ])
        .toArray()
    ]);

    return res.json({
      missingComments: missingCommentsResult[0]?.total || 0,
      missingLikes: missingLikesResult[0]?.total || 0
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/api/:collection", async (req, res) => {
  const collection = req.params.collection;
  if (!ALLOWED_COLLECTIONS.has(collection)) {
    return res.status(404).json({ error: "Unknown collection" });
  }

  try {
    const sortField = req.query.sort;
    const sortOrder = String(req.query.order || "desc").toLowerCase() === "asc" ? 1 : -1;
    const limit = parseInt(req.query.limit, 10);
    const page = parseInt(req.query.page, 10);

    const cursor = db.collection(collection).find({});

    if (sortField && SORT_FIELDS[collection]?.has(sortField)) {
      cursor.sort({ [sortField]: sortOrder });
    }

    if (Number.isInteger(limit) && limit > 0) {
      const safePage = Number.isInteger(page) && page > 0 ? page : 1;
      cursor.skip((safePage - 1) * limit).limit(limit);
    }

    const data = await cursor.toArray();
    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
});

connect()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Using DB: ${DB_NAME}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to MongoDB", error);
    process.exit(1);
  });
