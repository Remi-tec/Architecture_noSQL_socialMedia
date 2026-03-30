const DATA_FILES = {
  users: "/api/users",
  posts: "/api/posts",
  comments: "/api/comments",
  likes: "/api/likes"
};

const el = (id) => document.getElementById(id);

const formatNumber = (value) => {
  return new Intl.NumberFormat("en-US").format(value);
};

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

const state = {
  users: [],
  posts: [],
  comments: [],
  likes: [],
  page: 1,
  pageSize: 25,
  view: "top-users",
  showDetails: false
};

const VIEW_ORDER = ["top-users", "top-posts", "recent-posts", "active-users"];

const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const VIEWS = {
  "top-users": {
    title: "Top Users by Posts",
    eyebrow: "Users",
    label: "users",
    columns: [
      { key: "username", label: "Username", width: "200px" },
      { key: "posts", label: "Posts", width: "120px" }
    ],
    load: ["users", "posts"],
    buildRows: ({ users, posts }) => {
      const postsCountByUser = new Map();
      posts.forEach((post) => {
        const key = post.user_id;
        postsCountByUser.set(key, (postsCountByUser.get(key) || 0) + 1);
      });

      return users
        .map((user) => {
          const count = postsCountByUser.get(user.user_id) || 0;
          return {
            userId: user.user_id,
            username: user.username || "-",
            posts: formatNumber(count),
            sortValue: count
          };
        })
        .sort((a, b) => b.sortValue - a.sortValue);
    }
  },
  "top-posts": {
    title: "Top Posts by Likes",
    eyebrow: "Posts",
    label: "posts",
    columns: [
      { key: "post", label: "Post", width: "140px" },
      { key: "likes", label: "Likes", width: "120px" }
    ],
    load: ["posts"],
    buildRows: ({ posts }) => {
      return [...posts]
        .map((post) => ({
          postId: post.post_id,
          post: `Post #${post.post_id}`,
          likes: formatNumber(post.likes_count || 0),
          sortValue: post.likes_count || 0
        }))
        .sort((a, b) => b.sortValue - a.sortValue);
    }
  },
  "recent-posts": {
    title: "Recent Posts",
    eyebrow: "Posts",
    label: "posts",
    columns: [
      { key: "post", label: "Post", width: "140px" },
      { key: "created", label: "Created", width: "140px" },
      { key: "likes", label: "Likes", width: "120px" },
      { key: "content", label: "Content", width: "1fr" }
    ],
    load: ["posts"],
    buildRows: ({ posts }) => {
      return [...posts]
        .map((post) => {
          const created = parseDate(post.created_at);
          return {
            postId: post.post_id,
            post: `Post #${post.post_id}`,
            created: formatShortDate(created),
            likes: formatNumber(post.likes_count || 0),
            content: post.content || "-",
            sortValue: created ? created.getTime() : 0
          };
        })
        .sort((a, b) => b.sortValue - a.sortValue);
    }
  },
  "active-users": {
    title: "Most Active Users",
    eyebrow: "Engagement",
    label: "users",
    columns: [
      { key: "username", label: "Username", width: "200px" },
      { key: "actions", label: "Actions", width: "120px" }
    ],
    load: ["users", "comments", "likes"],
    buildRows: ({ users, comments, likes }) => {
      const commentsByUser = new Map();
      const likesByUser = new Map();

      comments.forEach((comment) => {
        const key = comment.user_id;
        commentsByUser.set(key, (commentsByUser.get(key) || 0) + 1);
      });

      likes.forEach((like) => {
        const key = like.user_id;
        likesByUser.set(key, (likesByUser.get(key) || 0) + 1);
      });

      return users
        .map((user) => {
          const actions = (commentsByUser.get(user.user_id) || 0) + (likesByUser.get(user.user_id) || 0);
          return {
            userId: user.user_id,
            username: user.username || "-",
            actions: formatNumber(actions),
            sortValue: actions
          };
        })
        .sort((a, b) => b.sortValue - a.sortValue);
    }
  }
};

const buildHeader = (columns, template) => {
  const labels = columns
    .map((column) => `<div>${escapeHtml(column.label)}</div>`)
    .join("");

  return `
    <div class="table-head" style="grid-template-columns: ${template};">
      ${labels}
    </div>
  `;
};

const buildRows = (rows, columns, template) => {
  return rows
    .map((row) => {
      const cells = columns
        .map((column) => {
          const value = row[column.key] ?? "-";
          return `<div class="cell-truncate" title="${escapeHtml(value)}">${escapeHtml(value)}</div>`;
        })
        .join("");

      return `
        <div class="table-row-wide" style="grid-template-columns: ${template};">
          ${cells}
        </div>
      `;
    })
    .join("");
};

const computeRows = (viewKey) => {
  const view = VIEWS[viewKey];
  if (!view) return [];
  return view.buildRows({
    users: state.users,
    posts: state.posts,
    comments: state.comments,
    likes: state.likes
  });
};

const buildPostGridRows = (viewKey) => {
  const userMap = new Map(state.users.map((user) => [user.user_id, user]));
  const postMap = new Map(state.posts.map((post) => [post.post_id, post]));
  const viewRows = computeRows(viewKey);

  const postRows = (post) => {
    const created = parseDate(post.created_at);
    const user = userMap.get(post.user_id);
    return {
      postId: post.post_id,
      title: `Post #${post.post_id}`,
      created: formatShortDate(created),
      likes: formatNumber(post.likes_count || 0),
      author: user?.username || `User #${post.user_id}`,
      content: post.content || "-"
    };
  };

  if (viewKey === "top-posts" || viewKey === "recent-posts") {
    return viewRows
      .map((row) => postMap.get(row.postId))
      .filter(Boolean)
      .map((post) => postRows(post));
  }

  const postsByUser = new Map();
  state.posts.forEach((post) => {
    if (!postsByUser.has(post.user_id)) {
      postsByUser.set(post.user_id, []);
    }
    postsByUser.get(post.user_id).push(post);
  });

  return viewRows
    .flatMap((row) => postsByUser.get(row.userId) || [])
    .map((post) => postRows(post));
};

const buildUserGridRows = (viewKey) => {
  const userMap = new Map(state.users.map((user) => [user.user_id, user]));
  const viewRows = computeRows(viewKey);

  return viewRows.map((row) => {
    const user = userMap.get(row.userId);
    const created = parseDate(user?.created_at);
    const metric = row.posts ?? row.actions ?? "-";
    const metricLabel = row.posts ? "Posts" : row.actions ? "Actions" : "Score";

    return {
      userId: row.userId,
      username: user?.username || row.username || "-",
      email: user?.email || "-",
      created: formatShortDate(created),
      bio: user?.bio || "-",
      metric,
      metricLabel
    };
  });
};

const buildPostsGrid = (rows) => {
  return rows
    .map(
      (row) => `
        <article class="post-card">
          <div class="post-card-title">${escapeHtml(row.title)}</div>
          <div class="post-card-meta">
            <span>${escapeHtml(row.created)}</span>
            <span>${escapeHtml(row.likes)} likes</span>
          </div>
          <p class="post-card-body">${escapeHtml(row.content)}</p>
          <div class="post-card-footer">
            <span class="post-chip">${escapeHtml(row.author)}</span>
            <span class="post-chip">ID ${escapeHtml(row.postId)}</span>
          </div>
        </article>
      `
    )
    .join("");
};

const buildUserGrid = (rows) => {
  return rows
    .map(
      (row) => `
        <article class="profile-card">
          <div class="profile-card-title">${escapeHtml(row.username)}</div>
          <div class="profile-card-meta">
            <span>${escapeHtml(row.email)}</span>
            <span>${escapeHtml(row.created)}</span>
          </div>
          <p class="profile-card-body">${escapeHtml(row.bio)}</p>
          <div class="profile-card-footer">
            <span class="profile-chip">ID ${escapeHtml(row.userId)}</span>
            <span class="profile-chip">${escapeHtml(row.metric)} ${escapeHtml(row.metricLabel)}</span>
          </div>
        </article>
      `
    )
    .join("");
};

const render = () => {
  const view = VIEWS[state.view];
  const pageSize = state.pageSize;
  const tableEl = el("usersTable");
  const detailToggle = el("detailToggle");
  const isUserView = state.view === "top-users" || state.view === "active-users";

  let rows = [];
  if (state.showDetails) {
    rows = isUserView ? buildUserGridRows(state.view) : buildPostGridRows(state.view);
  } else {
    rows = computeRows(state.view);
  }

  const totalRows = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  state.page = Math.min(state.page, totalPages);

  const start = (state.page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  el("totalRows").textContent = formatNumber(totalRows);
  el("pageInfo").textContent = `Page ${state.page} of ${totalPages}`;
  el("prevPage").disabled = state.page <= 1;
  el("nextPage").disabled = state.page >= totalPages;

  if (state.showDetails) {
    detailToggle.textContent = "Table view";
    detailToggle.setAttribute("aria-pressed", "true");
    tableEl.classList.remove("table-wide");

    if (isUserView) {
      el("totalLabel").textContent = "users";
      tableEl.classList.add("profile-grid");
      tableEl.classList.remove("post-grid");
      tableEl.innerHTML = buildUserGrid(pageRows);
    } else {
      el("totalLabel").textContent = "posts";
      tableEl.classList.add("post-grid");
      tableEl.classList.remove("profile-grid");
      tableEl.innerHTML = buildPostsGrid(pageRows);
    }
  } else {
    const columns = view.columns;
    const template = columns.map((column) => column.width || "1fr").join(" ");
    el("totalLabel").textContent = view.label;
    el("viewTitle").textContent = view.title;
    el("viewEyebrow").textContent = view.eyebrow;
    detailToggle.textContent = "Classic";
    detailToggle.setAttribute("aria-pressed", "false");
    tableEl.classList.add("table-wide");
    tableEl.classList.remove("post-grid");
    tableEl.classList.remove("profile-grid");
    tableEl.innerHTML = buildHeader(columns, template) + buildRows(pageRows, columns, template);
  }
};

const getViewKey = () => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "top-users";
  return VIEWS[view] ? view : "top-users";
};

const loadData = async (viewKey) => {
  const view = VIEWS[viewKey];
  const requests = view.load.map((key) => loadJson(DATA_FILES[key]));
  const results = await Promise.all(requests);

  view.load.forEach((key, index) => {
    state[key] = results[index];
  });
};

const updateViewTooltips = () => {
  const currentIndex = VIEW_ORDER.indexOf(state.view);
  const prevKey = VIEW_ORDER[(currentIndex - 1 + VIEW_ORDER.length) % VIEW_ORDER.length];
  const nextKey = VIEW_ORDER[(currentIndex + 1) % VIEW_ORDER.length];

  el("prevView").setAttribute("title", VIEWS[prevKey].title);
  el("nextView").setAttribute("title", VIEWS[nextKey].title);
};

const applyView = async (viewKey, keepDetails = false) => {
  state.view = viewKey;
  state.showDetails = keepDetails;
  state.page = 1;
  await loadData(viewKey);
  if (state.showDetails) {
    await ensureLoaded("users");
    await ensureLoaded("posts");
  }
  const view = VIEWS[viewKey];
  el("viewTitle").textContent = view.title;
  el("viewEyebrow").textContent = view.eyebrow;
  document.title = `${VIEWS[viewKey].title} - Admin Dashboard`;
  updateViewTooltips();
  render();
};

const ensureLoaded = async (key) => {
  if (state[key] && state[key].length) return;
  state[key] = await loadJson(DATA_FILES[key]);
};

const init = async () => {
  state.view = getViewKey();
  await loadData(state.view);

  const view = VIEWS[state.view];
  el("viewTitle").textContent = view.title;
  el("viewEyebrow").textContent = view.eyebrow;
  document.title = `${view.title} - Admin Dashboard`;

  const pageSizeSelect = el("pageSize");
  state.pageSize = parseInt(pageSizeSelect.value, 10);

  pageSizeSelect.addEventListener("change", (event) => {
    state.pageSize = parseInt(event.target.value, 10);
    state.page = 1;
    render();
  });

  el("detailToggle").addEventListener("click", async () => {
    state.showDetails = !state.showDetails;
    if (state.showDetails) {
      await ensureLoaded("posts");
      await ensureLoaded("users");
      state.page = 1;
    }
    render();
  });

  el("prevView").addEventListener("click", async () => {
    const currentIndex = VIEW_ORDER.indexOf(state.view);
    const nextIndex = (currentIndex - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
    await applyView(VIEW_ORDER[nextIndex], state.showDetails);
  });

  el("nextView").addEventListener("click", async () => {
    const currentIndex = VIEW_ORDER.indexOf(state.view);
    const nextIndex = (currentIndex + 1) % VIEW_ORDER.length;
    await applyView(VIEW_ORDER[nextIndex], state.showDetails);
  });

  el("prevPage").addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    render();
  });

  el("nextPage").addEventListener("click", () => {
    state.page = state.page + 1;
    render();
  });

  render();
  updateViewTooltips();
};

init().catch((error) => {
  console.error(error);
  el("usersTable").insertAdjacentHTML(
    "beforeend",
    `<div class="table-row-wide">Failed to load data. Start the API server and reload.</div>`
  );
});
