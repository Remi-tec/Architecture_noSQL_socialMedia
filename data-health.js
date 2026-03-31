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
  view: "health-comments"
};

const VIEW_ORDER = ["health-comments", "health-likes"];

const VIEWS = {
  "health-comments": {
    title: "Orphan Comments",
    eyebrow: "Data Health",
    label: "comments",
    columns: [
      { key: "itemId", label: "Comment ID", width: "140px" },
      { key: "postId", label: "Post ID", width: "120px" },
      { key: "userId", label: "User ID", width: "120px" },
      { key: "created_at", label: "Created", width: "160px" },
      { key: "content", label: "Content", width: "1fr" }
    ]
  },
  "health-likes": {
    title: "Orphan Likes",
    eyebrow: "Data Health",
    label: "likes",
    columns: [
      { key: "itemId", label: "Like ID", width: "140px" },
      { key: "postId", label: "Post ID", width: "120px" },
      { key: "userId", label: "User ID", width: "120px" },
      { key: "created_at", label: "Created", width: "160px" }
    ]
  }
};

const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

const render = () => {
  const view = VIEWS[state.view];
  const pageSize = state.pageSize;
  const tableEl = el("healthTable");

  const rows = state.rows;
  const totalRows = state.total;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  state.page = Math.min(state.page, totalPages);

  el("totalRows").textContent = formatNumber(totalRows);
  el("totalLabel").textContent = view.label;
  // Ajoute un input pour la navigation directe à une page
  const pageInfo = el("pageInfo");
  pageInfo.innerHTML = `Page <input id=\"pageJumpInput\" type=\"number\" min=\"1\" max=\"${totalPages}\" value=\"${state.page}\" style=\"width:3em;text-align:center;\"> of ${totalPages}`;
  // Attache le handler Enter/change à chaque render
  setTimeout(() => {
    const input = document.getElementById("pageJumpInput");
    if (input) {
      const goToPage = () => {
        let val = parseInt(input.value, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > totalPages) val = totalPages;
        state.page = val;
        loadData().then(render).catch(console.error);
      };
      input.addEventListener("change", goToPage);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          goToPage();
        }
      });
    }
  }, 0);
  el("prevPage").disabled = state.page <= 1;
  el("nextPage").disabled = state.page >= totalPages;

  const columns = view.columns;
  const columnsWithIndex = [{ key: "_index", label: "#", width: "60px" }, ...columns];
  const template = columnsWithIndex.map((column) => column.width || "1fr").join(" ");
  el("viewTitle").textContent = view.title;
  el("viewEyebrow").textContent = view.eyebrow;

  const tableRows = rows.map((row, index) => {
    const normalized = { ...row };
    normalized._index = (state.page - 1) * pageSize + index + 1;
    columnsWithIndex.forEach((column) => {
      const value = normalized[column.key];
      if (column.key === "created_at") {
        normalized[column.key] = formatShortDate(parseDate(value));
        return;
      }
      if (typeof value === "number") {
        normalized[column.key] = formatNumber(value);
      }
    });
    return normalized;
  });

  tableEl.innerHTML =
    buildHeader(columnsWithIndex, template) + buildRows(tableRows, columnsWithIndex, template);
};

const getViewKey = () => {
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "health-comments";
  return VIEWS[view] ? view : "health-comments";
};

const loadData = async () => {
  const params = new URLSearchParams();
  params.set("page", state.page);
  params.set("limit", state.pageSize);
  const response = await loadJson(`${VIEW_API_BASE}/${state.view}?${params.toString()}`);
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

const applyView = async (viewKey) => {
  state.view = viewKey;
  state.page = 1;
  await loadData();
  updateViewTooltips();
  render();
};

const init = async () => {
  state.view = getViewKey();
  const pageSizeSelect = el("pageSize");
  state.pageSize = parseInt(pageSizeSelect.value, 10);
  await loadData();

  pageSizeSelect.addEventListener("change", async (event) => {
    state.pageSize = parseInt(event.target.value, 10);
    state.page = 1;
    await loadData();
    render();
  });

  el("prevView").addEventListener("click", async () => {
    const currentIndex = VIEW_ORDER.indexOf(state.view);
    const nextIndex = (currentIndex - 1 + VIEW_ORDER.length) % VIEW_ORDER.length;
    await applyView(VIEW_ORDER[nextIndex]);
  });

  el("nextView").addEventListener("click", async () => {
    const currentIndex = VIEW_ORDER.indexOf(state.view);
    const nextIndex = (currentIndex + 1) % VIEW_ORDER.length;
    await applyView(VIEW_ORDER[nextIndex]);
  });

  el("prevPage").addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    loadData().then(render).catch(console.error);
  });

  el("nextPage").addEventListener("click", () => {
    state.page = state.page + 1;
    loadData().then(render).catch(console.error);
  });

  render();
  updateViewTooltips();
};

init().catch((error) => {
  console.error(error);
  el("healthTable").insertAdjacentHTML(
    "beforeend",
    `<div class="table-row-wide">Failed to load data. Start the API server and reload.</div>`
  );
});
