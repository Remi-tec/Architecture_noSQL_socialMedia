const DATA_FILES = {
  users: "./json/users.json",
  posts: "./json/posts.json",
  comments: "./json/comments.json",
  likes: "./json/likes.json"
};

const el = (id) => document.getElementById(id);

const parseDate = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  const parts = value.split("/");
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts.map((part) => parseInt(part, 10));
    return new Date(yyyy, mm - 1, dd);
  }
  return null;
};

const formatNumber = (value) => {
  return new Intl.NumberFormat("en-US").format(value);
};

const formatShortDate = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
};

const sum = (arr, key) => arr.reduce((acc, item) => acc + (item[key] || 0), 0);

const groupBy = (arr, key) => {
  const map = new Map();
  arr.forEach((item) => {
    const k = item[key];
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  });
  return map;
};

const loadJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Cannot load ${path}`);
  }
  return response.json();
};

const computeHealth = (posts, comments, likes) => {
  const postIds = new Set(posts.map((post) => post.post_id));
  const missingComments = comments.filter((c) => !postIds.has(c.post_id)).length;
  const missingLikes = likes.filter((l) => !postIds.has(l.post_id)).length;
  return {
    missingComments,
    missingLikes
  };
};

const buildBarList = (items, maxValue, labelKey, valueKey) => {
  return items
    .map((item) => {
      const value = item[valueKey];
      const width = maxValue === 0 ? 0 : Math.round((value / maxValue) * 100);
      return `
        <div class="bar-item">
          <div class="bar-label" title="${item[labelKey]}">${item[labelKey]}</div>
          <div class="bar-track">
            <div class="bar" style="width: ${width}%"></div>
          </div>
          <div class="bar-value">${formatNumber(value)}</div>
        </div>
      `;
    })
    .join("");
};

const buildTableRows = (rows) => {
  return rows
    .map(
      (row) => `
      <div class="table-row">
        <div class="table-title" title="${row.title}">${row.title}</div>
        <div class="table-meta">${row.meta}</div>
        <div class="table-meta">${row.value}</div>
      </div>
    `
    )
    .join("");
};

const buildEngagement = (items) => {
  return items
    .map(
      (item) => `
      <div class="engagement-item">
        <span>${item.label}</span>
        <span>${item.value}</span>
      </div>
    `
    )
    .join("");
};

const buildHealth = (items) => {
  return items
    .map(
      (item) => `
      <div class="health-item">
        <span>${item.label}</span>
        <span class="health-flag ${item.ok ? "health-ok" : "health-warn"}">${item.status}</span>
      </div>
    `
    )
    .join("");
};

const init = async () => {
  const [users, posts, comments, likes] = await Promise.all([
    loadJson(DATA_FILES.users),
    loadJson(DATA_FILES.posts),
    loadJson(DATA_FILES.comments),
    loadJson(DATA_FILES.likes)
  ]);

  const now = new Date();
  el("currentDate").textContent = formatShortDate(now);

  const totalUsers = users.length;
  const totalPosts = posts.length;
  const totalComments = comments.length;
  const totalLikes = likes.length;

  const avgLikes = totalPosts ? totalLikes / totalPosts : 0;
  const avgComments = totalPosts ? totalComments / totalPosts : 0;

  el("kpiUsers").textContent = formatNumber(totalUsers);
  el("kpiUsersMeta").textContent = "registered users";

  el("kpiPosts").textContent = formatNumber(totalPosts);
  el("kpiPostsMeta").textContent = "total posts";

  el("kpiComments").textContent = formatNumber(totalComments);
  el("kpiCommentsMeta").textContent = "total comments";

  el("kpiLikes").textContent = formatNumber(totalLikes);
  el("kpiLikesMeta").textContent = "likes stored";

  const postsByUser = groupBy(posts, "user_id");
  const topUsers = Array.from(postsByUser.entries())
    .map(([userId, userPosts]) => {
      const user = users.find((u) => u.user_id === Number(userId));
      return {
        label: user ? user.username : `User ${userId}`,
        value: userPosts.length
      };
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const topPosts = [...posts]
    .sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0))
    .slice(0, 5)
    .map((post) => ({
      label: `Post #${post.post_id}`,
      value: post.likes_count || 0
    }));

  el("topUsers").innerHTML = buildBarList(
    topUsers,
    topUsers[0] ? topUsers[0].value : 0,
    "label",
    "value"
  );
  el("topPosts").innerHTML = buildBarList(
    topPosts,
    topPosts[0] ? topPosts[0].value : 0,
    "label",
    "value"
  );

  const recentPosts = [...posts]
    .map((post) => ({
      ...post,
      created_at_date: parseDate(post.created_at)
    }))
    .sort((a, b) => {
      const timeA = a.created_at_date ? a.created_at_date.getTime() : 0;
      const timeB = b.created_at_date ? b.created_at_date.getTime() : 0;
      return timeB - timeA;
    })
    .slice(0, 8)
    .map((post) => ({
      title: post.content.slice(0, 48) + (post.content.length > 48 ? "..." : ""),
      meta: formatShortDate(post.created_at_date),
      value: `${formatNumber(post.likes_count || 0)} likes`
    }));

  el("recentPosts").innerHTML = buildTableRows(recentPosts);

  const activeUsers = users
    .map((user) => {
      const userPosts = postsByUser.get(user.user_id) || [];
      const commentCount = comments.filter((c) => c.user_id === user.user_id).length;
      const likeCount = likes.filter((l) => l.user_id === user.user_id).length;
      return {
        title: user.username,
        meta: `${userPosts.length} posts`,
        value: `${commentCount + likeCount} actions`
      };
    })
    .sort((a, b) => {
      const aValue = parseInt(a.value, 10) || 0;
      const bValue = parseInt(b.value, 10) || 0;
      return bValue - aValue;
    })
    .slice(0, 8);

  el("activeUsers").innerHTML = buildTableRows(activeUsers);

  const engagementItems = [
    { label: "Avg likes per post", value: avgLikes.toFixed(1) },
    { label: "Avg comments per post", value: avgComments.toFixed(1) },
    { label: "Posts per user", value: (totalPosts / totalUsers).toFixed(2) },
    { label: "Comments per user", value: (totalComments / totalUsers).toFixed(2) }
  ];

  el("engagement").innerHTML = buildEngagement(engagementItems);

  const health = computeHealth(posts, comments, likes);
  const healthItems = [
    {
      label: "Comments with missing post",
      status: health.missingComments === 0 ? "OK" : `${health.missingComments} missing`,
      ok: health.missingComments === 0
    },
    {
      label: "Likes with missing post",
      status: health.missingLikes === 0 ? "OK" : `${health.missingLikes} missing`,
      ok: health.missingLikes === 0
    }
  ];

  el("dataHealth").innerHTML = buildHealth(healthItems);
};

init().catch((error) => {
  console.error(error);
  el("kpis").insertAdjacentHTML(
    "afterend",
    `<div class="card">Failed to load JSON data. Use a local server (Live Server) to allow fetch.</div>`
  );
});
