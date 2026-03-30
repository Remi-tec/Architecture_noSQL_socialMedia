const DATA_FILES = {
  kpis: "/api/stats/kpis",
  health: "/api/stats/health",
  topUsers: "/api/view/top-users?limit=5&page=1",
  topPosts: "/api/view/top-posts?limit=5&page=1",
  recentPosts: "/api/view/recent-posts?limit=8&page=1&detail=1",
  activeUsers: "/api/view/active-users?limit=8&page=1&detail=1"
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

const loadJson = async (path) => {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Cannot load ${path}`);
  }
  return response.json();
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
  const [kpis, health, topUsersResponse, topPostsResponse, recentPostsResponse, activeUsersResponse] =
    await Promise.all([
      loadJson(DATA_FILES.kpis),
      loadJson(DATA_FILES.health),
      loadJson(DATA_FILES.topUsers),
      loadJson(DATA_FILES.topPosts),
      loadJson(DATA_FILES.recentPosts),
      loadJson(DATA_FILES.activeUsers)
    ]);

  const now = new Date();
  el("currentDate").textContent = formatShortDate(now);

  const totalUsers = kpis.totalUsers || 0;
  const totalPosts = kpis.totalPosts || 0;
  const totalComments = kpis.totalComments || 0;
  const totalLikes = kpis.totalLikes || 0;

  const avgLikes = kpis.avgLikes || 0;
  const avgComments = kpis.avgComments || 0;

  el("kpiUsers").textContent = formatNumber(totalUsers);
  el("kpiUsersMeta").textContent = "registered users";

  el("kpiPosts").textContent = formatNumber(totalPosts);
  el("kpiPostsMeta").textContent = "total posts";

  el("kpiComments").textContent = formatNumber(totalComments);
  el("kpiCommentsMeta").textContent = "total comments";

  el("kpiLikes").textContent = formatNumber(totalLikes);
  el("kpiLikesMeta").textContent = "likes stored";

  const topUsers = (topUsersResponse.items || []).map((user) => ({
    label: user.username || `User ${user.userId}`,
    value: user.posts || 0
  }));

  const topPosts = (topPostsResponse.items || []).map((post) => ({
    label: post.post || `Post #${post.postId}`,
    value: post.likes || 0
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

  const recentPosts = (recentPostsResponse.items || []).map((post) => {
    const created = parseDate(post.created_at);
    const content = post.content || "-";
    return {
      title: content.slice(0, 48) + (content.length > 48 ? "..." : ""),
      meta: formatShortDate(created),
      value: `${formatNumber(post.likes || 0)} likes`
    };
  });

  el("recentPosts").innerHTML = buildTableRows(recentPosts);

  const activeUsers = (activeUsersResponse.items || []).map((user) => ({
    title: user.username || "-",
    meta: "",
    value: `${formatNumber(user.actions || 0)} actions`
  }));

  el("activeUsers").innerHTML = buildTableRows(activeUsers);

  const engagementItems = [
    { label: "Avg likes per post", value: avgLikes.toFixed(1) },
    { label: "Avg comments per post", value: avgComments.toFixed(1) },
    { label: "Posts per user", value: (kpis.postsPerUser || 0).toFixed(2) },
    { label: "Comments per user", value: (kpis.commentsPerUser || 0).toFixed(2) }
  ];

  el("engagement").innerHTML = buildEngagement(engagementItems);

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
    `<div class="card">Failed to load data. Start the API server (node server.js) and reload.</div>`
  );
});
