const VIEW_API_BASE = "/api/view";

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
  rows: [],
  total: 0,
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
    ]
  },
  "top-posts": {
    title: "Top Posts by Likes",
    eyebrow: "Posts",
    label: "posts",
    columns: [
      { key: "post", label: "Post", width: "140px" },
      { key: "likes", label: "Likes", width: "120px" }
    ]
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
    ]
  },
  "active-users": {
    title: "Most Active Users",
    eyebrow: "Engagement",
    label: "users",
    columns: [
      { key: "username", label: "Username", width: "200px" },
      { key: "actions", label: "Actions", width: "120px" }
    ]
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

const buildPostsGrid = (rows) => {
  return rows
    .map(
      (row) => `
        <article class="post-card">
          <div class="post-card-title">${escapeHtml(row.title || "-")}</div>
          <div class="post-card-meta">
            <span>${escapeHtml(formatShortDate(parseDate(row.created_at)))}</span>
            <span>${escapeHtml(formatNumber(row.likes || 0))} likes</span>
          </div>
          <p class="post-card-body">${escapeHtml(row.content || "-")}</p>
          <div class="post-card-footer">
            <span class="post-chip">${escapeHtml(row.author || "-")}</span>
            <span class="post-chip">ID ${escapeHtml(row.postId || "-")}</span>
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
          <div class="profile-card-title">${escapeHtml(row.username || "-")}</div>
          <div class="profile-card-meta">
            <span>${escapeHtml(row.email || "-")}</span>
            <span>${escapeHtml(formatShortDate(parseDate(row.created_at)))}</span>
          </div>
          <p class="profile-card-body">${escapeHtml(row.bio || "-")}</p>
          <div class="profile-card-footer">
            <span class="profile-chip">ID ${escapeHtml(row.userId || "-")}</span>
            <span class="profile-chip">${escapeHtml(formatNumber(row.metric ?? row.actions ?? row.posts ?? 0))} ${escapeHtml(row.metricLabel || "Score")}</span>
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

  const rows = state.rows;
  const totalRows = state.total;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  state.page = Math.min(state.page, totalPages);

  detailToggle.disabled = false;

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
      tableEl.innerHTML = buildUserGrid(rows);
    } else {
      el("totalLabel").textContent = "posts";
      tableEl.classList.add("post-grid");
      tableEl.classList.remove("profile-grid");
      tableEl.innerHTML = buildPostsGrid(rows);
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
    const tableRows = rows.map((row) => {
      const normalized = { ...row };
      columns.forEach((column) => {
        if (column.key === "created") {
          const source = normalized.created ?? normalized.created_at;
          normalized[column.key] = formatShortDate(parseDate(source));
          return;
        }
        if (column.key === "created_at") {
          normalized[column.key] = formatShortDate(parseDate(normalized[column.key]));
          return;
        }
        if (typeof normalized[column.key] === "number") {
          normalized[column.key] = formatNumber(normalized[column.key]);
        }
      });
      return normalized;
    });
    tableEl.innerHTML = buildHeader(columns, template) + buildRows(tableRows, columns, template);
  }
};

const getViewKey = () => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "top-users";
  return VIEWS[view] ? view : "top-users";
};

const loadData = async (viewKey) => {
  const params = new URLSearchParams();
  params.set("page", state.page);
  params.set("limit", state.pageSize);
  params.set("detail", state.showDetails ? "1" : "0");
  const response = await loadJson(`${VIEW_API_BASE}/${viewKey}?${params.toString()}`);
  state.rows = response.items || [];
  state.total = response.total || 0;
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
  const view = VIEWS[viewKey];
  el("viewTitle").textContent = view.title;
  el("viewEyebrow").textContent = view.eyebrow;
  document.title = `${VIEWS[viewKey].title} - Admin Dashboard`;
  updateViewTooltips();
  render();
};

const init = async () => {
  state.view = getViewKey();
  const pageSizeSelect = el("pageSize");
  state.pageSize = parseInt(pageSizeSelect.value, 10);
  await loadData(state.view);

  const view = VIEWS[state.view];
  el("viewTitle").textContent = view.title;
  el("viewEyebrow").textContent = view.eyebrow;
  document.title = `${view.title} - Admin Dashboard`;

  pageSizeSelect.addEventListener("change", async (event) => {
    state.pageSize = parseInt(event.target.value, 10);
    state.page = 1;
    await loadData(state.view);
    render();
  });

  el("detailToggle").addEventListener("click", async () => {
    state.showDetails = !state.showDetails;
    state.page = 1;
    await loadData(state.view);
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
    loadData(state.view).then(render).catch(console.error);
  });

  el("nextPage").addEventListener("click", () => {
    state.page = state.page + 1;
    loadData(state.view).then(render).catch(console.error);
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
