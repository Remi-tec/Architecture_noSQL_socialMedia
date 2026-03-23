const express = require("express");
const { MongoClient } = require("mongodb");

const PORT = process.env.PORT || 3000;
const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017";
const DB_NAME = process.env.DB_NAME || "ProjetBnoSQL";
const ALLOWED_COLLECTIONS = new Set(["users", "posts", "comments", "likes"]);

const app = express();
app.use(express.static(__dirname));

let client;
let db;

const connect = async () => {
  client = new MongoClient(MONGO_URL);
  await client.connect();
  db = client.db(DB_NAME);
};

app.get("/api/:collection", async (req, res) => {
  const collection = req.params.collection;
  if (!ALLOWED_COLLECTIONS.has(collection)) {
    return res.status(404).json({ error: "Unknown collection" });
  }

  try {
    const data = await db.collection(collection).find({}).toArray();
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
