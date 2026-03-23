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
  view: "top-users"
};

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

const render = () => {
  const rows = computeRows(state.view);
  const view = VIEWS[state.view];
  const columns = view.columns;
  const template = columns.map((column) => column.width || "1fr").join(" ");
  const totalRows = rows.length;
  const pageSize = state.pageSize;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  state.page = Math.min(state.page, totalPages);

  const start = (state.page - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  el("totalRows").textContent = formatNumber(totalRows);
  el("totalLabel").textContent = view.label;
  el("pageInfo").textContent = `Page ${state.page} of ${totalPages}`;

  el("prevPage").disabled = state.page <= 1;
  el("nextPage").disabled = state.page >= totalPages;

  el("usersTable").innerHTML = buildHeader(columns, template) + buildRows(pageRows, columns, template);
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

  el("prevPage").addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    render();
  });

  el("nextPage").addEventListener("click", () => {
    state.page = state.page + 1;
    render();
  });

  render();
};

init().catch((error) => {
  console.error(error);
  el("usersTable").insertAdjacentHTML(
    "beforeend",
    `<div class="table-row-wide">Failed to load data. Start the API server and reload.</div>`
  );
});
