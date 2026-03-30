const COLLECTIONS = ["users", "posts", "comments", "likes"];

const COLLECTION_CONFIG = {
  users: {
    title: "Users",
    label: "users",
    idField: "user_id",
    requiredFields: ["user_id"],
    columns: [
      { key: "user_id", label: "User ID", width: "120px" },
      { key: "username", label: "Username", width: "180px" },
      { key: "email", label: "Email", width: "200px" },
      { key: "created_at", label: "Created", width: "160px" },
      { key: "bio", label: "Bio", width: "1fr" }
    ],
    createFields: ["user_id", "username", "email", "created_at", "bio"]
  },
  posts: {
    title: "Posts",
    label: "posts",
    idField: "post_id",
    requiredFields: ["post_id"],
    columns: [
      { key: "post_id", label: "Post ID", width: "120px" },
      { key: "user_id", label: "User ID", width: "120px" },
      { key: "created_at", label: "Created", width: "160px" },
      { key: "likes_count", label: "Likes", width: "120px" },
      { key: "content", label: "Content", width: "1fr" }
    ],
    createFields: ["post_id", "user_id_ref", "created_at", "likes_count", "content"]
  },
  comments: {
    title: "Comments",
    label: "comments",
    idField: "comment_id",
    requiredFields: ["comment_id"],
    columns: [
      { key: "comment_id", label: "Comment ID", width: "120px" },
      { key: "post_id", label: "Post ID", width: "120px" },
      { key: "user_id", label: "User ID", width: "120px" },
      { key: "created_at", label: "Created", width: "160px" },
      { key: "content", label: "Content", width: "1fr" }
    ],
    createFields: ["comment_id", "post_id", "user_id_ref", "created_at", "content"]
  },
  likes: {
    title: "Likes",
    label: "likes",
    idField: "like_id",
    requiredFields: ["like_id"],
    columns: [
      { key: "like_id", label: "Like ID", width: "120px" },
      { key: "post_id", label: "Post ID", width: "120px" },
      { key: "user_id", label: "User ID", width: "120px" },
      { key: "created_at", label: "Created", width: "160px" }
    ],
    createFields: ["like_id", "post_id", "user_id_ref", "created_at"]
  }
};

const el = (id) => document.getElementById(id);

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);

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

const escapeHtml = (value) => {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const loadJson = async (path, options) => {
  const response = await fetch(path, options);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Cannot load ${path}`);
  }
  return response.json();
};

const showToast = (message, variant = "success") => {
  const toast = el("toast");
  toast.textContent = message;
  toast.classList.remove("is-success", "is-error", "is-visible");
  toast.classList.add(variant === "error" ? "is-error" : "is-success");
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1800);
};

const state = {
  rows: [],
  total: 0,
  page: 1,
  pageSize: 25,
  view: "users",
  showDetails: false,
  selectedId: null
};

const buildHeader = (columns, template) => {
  const labels = columns.map((column) => `<div>${escapeHtml(column.label)}</div>`).join("");
  return `
    <div class="table-head" style="grid-template-columns: ${template};">
      ${labels}
    </div>
  `;
};

const buildRows = (rows, columns, template, idKey) => {
  return rows
    .map((row) => {
      const rowId = idKey ? row[idKey] : "";
      const cells = columns
        .map((column) => {
          const value = row[column.key] ?? "-";
          return `<div class="cell-truncate" title="${escapeHtml(value)}">${escapeHtml(value)}</div>`;
        })
        .join("");

      return `
        <div class="table-row-wide is-clickable" data-row-id="${escapeHtml(rowId ?? "")}" style="grid-template-columns: ${template};">
          ${cells}
        </div>
      `;
    })
    .join("");
};

const buildUserCards = (rows, idKey) => {
  return rows
    .map(
      (row) => `
        <article class="profile-card is-clickable" data-row-id="${escapeHtml(row[idKey] ?? "")}">
          <div class="profile-card-title">${escapeHtml(row.username || "-")}</div>
          <div class="profile-card-meta">
            <span>${escapeHtml(row.email || "-")}</span>
            <span>${escapeHtml(formatShortDate(parseDate(row.created_at)))}</span>
          </div>
          <p class="profile-card-body">${escapeHtml(row.bio || "-")}</p>
          <div class="profile-card-footer">
            <span class="profile-chip">ID ${escapeHtml(row.user_id ?? "-")}</span>
          </div>
        </article>
      `
    )
    .join("");
};

const buildPostCards = (rows, idKey) => {
  return rows
    .map(
      (row) => `
        <article class="post-card is-clickable" data-row-id="${escapeHtml(row[idKey] ?? "")}">
          <div class="post-card-title">Post #${escapeHtml(row.post_id ?? "-")}</div>
          <div class="post-card-meta">
            <span>${escapeHtml(formatShortDate(parseDate(row.created_at)))}</span>
            <span>${escapeHtml(formatNumber(row.likes_count || 0))} likes</span>
          </div>
          <p class="post-card-body">${escapeHtml(row.content || "-")}</p>
          <div class="post-card-footer">
            <span class="post-chip">User #${escapeHtml(row.user_id ?? "-")}</span>
          </div>
        </article>
      `
    )
    .join("");
};

const buildCommentCards = (rows, idKey) => {
  return rows
    .map(
      (row) => `
        <article class="profile-card is-clickable" data-row-id="${escapeHtml(row[idKey] ?? "")}">
          <div class="profile-card-title">Comment #${escapeHtml(row.comment_id ?? "-")}</div>
          <div class="profile-card-meta">
            <span>${escapeHtml(formatShortDate(parseDate(row.created_at)))}</span>
          </div>
          <p class="profile-card-body">${escapeHtml(row.content || "-")}</p>
          <div class="profile-card-footer">
            <span class="profile-chip">Post #${escapeHtml(row.post_id ?? "-")}</span>
            <span class="profile-chip">User #${escapeHtml(row.user_id ?? "-")}</span>
          </div>
        </article>
      `
    )
    .join("");
};

const buildLikeCards = (rows, idKey) => {
  return rows
    .map(
      (row) => `
        <article class="profile-card is-clickable" data-row-id="${escapeHtml(row[idKey] ?? "")}">
          <div class="profile-card-title">Like #${escapeHtml(row.like_id ?? "-")}</div>
          <div class="profile-card-meta">
            <span>${escapeHtml(formatShortDate(parseDate(row.created_at)))}</span>
          </div>
          <p class="profile-card-body">No content</p>
          <div class="profile-card-footer">
            <span class="profile-chip">Post #${escapeHtml(row.post_id ?? "-")}</span>
            <span class="profile-chip">User #${escapeHtml(row.user_id ?? "-")}</span>
          </div>
        </article>
      `
    )
    .join("");
};

const render = () => {
  const config = COLLECTION_CONFIG[state.view];
  const columnsWithIndex = [{ key: "_index", label: "#", width: "60px" }, ...config.columns];
  const template = columnsWithIndex.map((column) => column.width || "1fr").join(" ");
  const tableEl = el("editTable");
  const detailToggle = el("detailToggle");
  const idKey = config.idField;

  el("viewTitle").textContent = config.title;
  el("viewEyebrow").textContent = "Edition";
  el("totalLabel").textContent = config.label;

  const totalRows = state.total;
  const totalPages = Math.max(1, Math.ceil(totalRows / state.pageSize));
  state.page = Math.min(state.page, totalPages);

  el("totalRows").textContent = formatNumber(totalRows);
  el("pageInfo").textContent = `Page ${state.page} of ${totalPages}`;
  el("prevPage").disabled = state.page <= 1;
  el("nextPage").disabled = state.page >= totalPages;

  if (state.showDetails) {
    detailToggle.textContent = "Table view";
    detailToggle.setAttribute("aria-pressed", "true");
    tableEl.classList.remove("table-wide");

    if (state.view === "users") {
      tableEl.classList.add("profile-grid");
      tableEl.classList.remove("post-grid");
      tableEl.innerHTML = buildUserCards(state.rows, idKey);
    } else if (state.view === "posts") {
      tableEl.classList.add("post-grid");
      tableEl.classList.remove("profile-grid");
      tableEl.innerHTML = buildPostCards(state.rows, idKey);
    } else if (state.view === "comments") {
      tableEl.classList.add("profile-grid");
      tableEl.classList.remove("post-grid");
      tableEl.innerHTML = buildCommentCards(state.rows, idKey);
    } else {
      tableEl.classList.add("profile-grid");
      tableEl.classList.remove("post-grid");
      tableEl.innerHTML = buildLikeCards(state.rows, idKey);
    }
  } else {
    detailToggle.textContent = "Classic";
    detailToggle.setAttribute("aria-pressed", "false");
    tableEl.classList.add("table-wide");
    tableEl.classList.remove("post-grid");
    tableEl.classList.remove("profile-grid");

    const tableRows = state.rows.map((row, index) => {
      const normalized = { ...row };
      normalized._index = (state.page - 1) * state.pageSize + index + 1;
      columnsWithIndex.forEach((column) => {
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

    tableEl.innerHTML =
      buildHeader(columnsWithIndex, template) + buildRows(tableRows, columnsWithIndex, template, idKey);
  }

  attachRowHandlers();
};

const showEditPanel = (rowId) => {
  const panel = el("editPanel");
  const tableSection = el("tableSection");
  panel.classList.remove("is-hidden");
  tableSection.classList.add("is-hidden");
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
};

const hideEditPanel = () => {
  const panel = el("editPanel");
  const tableSection = el("tableSection");
  panel.classList.add("is-hidden");
  tableSection.classList.remove("is-hidden");
};

const populateEditForm = (row) => {
  if (!row) return;
  const config = COLLECTION_CONFIG[state.view];
  const meta = el("selectedMeta");
  const idValue = row[config.idField];
  meta.textContent = `${config.title.slice(0, -1)} #${idValue}`;

  // Set all fields to empty by default
  ["user_id", "post_id", "comment_id", "like_id", "username", "email", "user_id_ref", "created_at", "bio", "content", "likes_count"].forEach((fieldId) => {
    const elField = el(fieldId);
    if (!elField) return;
    if (elField.tagName === "INPUT") {
      elField.value = "";
    } else {
      elField.textContent = "-";
    }
  });

  // Set values for the current row
  Object.entries(row).forEach(([key, value]) => {
    // user_id_ref is a special case for forms
    if (key === "user_id" && config.createFields.includes("user_id_ref")) {
      const refInput = el("user_id_ref");
      if (refInput && refInput.tagName === "INPUT") refInput.value = value ?? "";
    }
    const elField = el(key);
    if (!elField) return;
    if (elField.tagName === "INPUT") {
      elField.value = value ?? "";
    } else {
      elField.textContent = value ?? "-";
    }
  });

  // Always show the primary key as readonly text
  const pk = config.idField;
  const pkDiv = el(pk);
  if (pkDiv && pkDiv.tagName !== "INPUT") {
    pkDiv.textContent = row[pk] ?? "-";
  }
};

const attachRowHandlers = () => {
  const rows = document.querySelectorAll("#editTable [data-row-id]");
  rows.forEach((rowEl) => {
    rowEl.addEventListener("click", () => {
      const rowId = rowEl.getAttribute("data-row-id");
      if (!rowId) return;
      const config = COLLECTION_CONFIG[state.view];
      const match = state.rows.find((row) => String(row[config.idField]) === String(rowId));
      state.selectedId = rowId;
      populateEditForm(match);
      // Show delete button and set updateBtn to 'Update'
      const deleteBtnWrapper = el("deleteBtnWrapper");
      if (deleteBtnWrapper) deleteBtnWrapper.style.display = "";
      const updateBtn = el("updateBtn");
      if (updateBtn) updateBtn.textContent = "Update";
      showEditPanel(rowId);
    });
  });
};

const updateFormVisibility = () => {
  const config = COLLECTION_CONFIG[state.view];
  el("formTitle").textContent = `Edit ${config.title.slice(0, -1)}`;

  const fields = document.querySelectorAll(".form-field");
  fields.forEach((field) => {
    field.style.display = "none";
    const input = field.querySelector("input");
    if (input) {
      input.required = false;
    }
  });

  config.createFields.forEach((fieldId) => {
    const target = document.querySelector(`[data-field="${fieldId}"]`);
    if (target) {
      target.style.display = "grid";
      const input = target.querySelector("input");
      if (input && config.requiredFields.includes(fieldId)) {
        input.required = true;
      }
    }
  });

  const meta = el("selectedMeta");
  meta.textContent = "No item selected";
};

const buildUpdatePayload = () => {
  const config = COLLECTION_CONFIG[state.view];
  const payload = {};

  config.createFields.forEach((fieldId) => {
    const input = el(fieldId);
    if (!input || input.tagName !== "INPUT") return;
    const value = input.value.trim();
    if (!value) return;

    if (input.type === "number") {
      payload[fieldId] = Number(value);
    } else {
      payload[fieldId] = value;
    }
  });

  if (payload.user_id_ref != null) {
    payload.user_id = payload.user_id_ref;
    delete payload.user_id_ref;
  }

  delete payload[config.idField];

  return payload;
};

const loadData = async () => {
  const params = new URLSearchParams();
  params.set("page", state.page);
  params.set("limit", state.pageSize);
  params.set("meta", "1");
  params.set("sort", COLLECTION_CONFIG[state.view].idField);
  params.set("order", "asc");
  const response = await loadJson(`/api/${state.view}?${params.toString()}`);
  state.rows = response.items || [];
  state.total = response.total || 0;
};

const updateViewTooltips = () => {
  const currentIndex = COLLECTIONS.indexOf(state.view);
  const prevKey = COLLECTIONS[(currentIndex - 1 + COLLECTIONS.length) % COLLECTIONS.length];
  const nextKey = COLLECTIONS[(currentIndex + 1) % COLLECTIONS.length];

  el("prevView").setAttribute("title", COLLECTION_CONFIG[prevKey].title);
  el("nextView").setAttribute("title", COLLECTION_CONFIG[nextKey].title);
};

const applyView = async (viewKey) => {
  state.view = viewKey;
  state.page = 1;
  state.selectedId = null;
  await loadData();
  updateFormVisibility();
  updateViewTooltips();
  render();
  hideEditPanel();
};

const init = async () => {
  const pageSizeSelect = el("pageSize");
  state.pageSize = parseInt(pageSizeSelect.value, 10);
  await loadData();
  updateFormVisibility();
  render();
  updateViewTooltips();

  // Add handler for addContentBtn
  el("addContentBtn").addEventListener("click", () => {
    state.selectedId = null;
    // Clear form fields
    const config = COLLECTION_CONFIG[state.view];
    config.createFields.forEach((fieldId) => {
      const input = el(fieldId);
      if (input) {
        if (input.tagName === "INPUT") {
          input.value = "";
        } else {
          input.textContent = "-";
        }
      }
    });
    el("selectedMeta").textContent = `New ${config.title.slice(0, -1)}`;
    el("formTitle").textContent = `Create ${config.title.slice(0, -1)}`;
    // Hide delete button and set updateBtn to 'Create'
    const deleteBtnWrapper = el("deleteBtnWrapper");
    if (deleteBtnWrapper) deleteBtnWrapper.style.display = "none";
    const updateBtn = el("updateBtn");
    if (updateBtn) updateBtn.textContent = "Create";
    showEditPanel();
  });

  pageSizeSelect.addEventListener("change", async (event) => {
    state.pageSize = parseInt(event.target.value, 10);
    state.page = 1;
    await loadData();
    render();
    showToast("Created successfully", "success");
    hideEditPanel();
  });

  el("detailToggle").addEventListener("click", () => {
    state.showDetails = !state.showDetails;
    render();
  });

  el("closeEditPanel").addEventListener("click", () => {
    hideEditPanel();
  });

  el("prevView").addEventListener("click", async () => {
    const currentIndex = COLLECTIONS.indexOf(state.view);
    const nextIndex = (currentIndex - 1 + COLLECTIONS.length) % COLLECTIONS.length;
    await applyView(COLLECTIONS[nextIndex]);
  });

  el("nextView").addEventListener("click", async () => {
    const currentIndex = COLLECTIONS.indexOf(state.view);
    const nextIndex = (currentIndex + 1) % COLLECTIONS.length;
    await applyView(COLLECTIONS[nextIndex]);
  });

  el("prevPage").addEventListener("click", () => {
    state.page = Math.max(1, state.page - 1);
    loadData().then(render).catch(console.error);
  });

  el("nextPage").addEventListener("click", () => {
    state.page = state.page + 1;
    loadData().then(render).catch(console.error);
  });

  el("editForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.selectedId) return;
    const payload = buildUpdatePayload();
    if (!payload || Object.keys(payload).length === 0) return;

    try {
      await loadJson(`/api/${state.view}/${state.selectedId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      showToast("Updated successfully", "success");
      await loadData();
      render();
      hideEditPanel();
    } catch (error) {
      console.error(error);
      showToast("Update failed", "error");
    }
  });

  el("deleteBtn").addEventListener("click", async () => {
    if (!state.selectedId) return;
    try {
      await loadJson(`/api/${state.view}/${state.selectedId}`, {
        method: "DELETE"
      });
      showToast("Deleted successfully", "success");
      state.selectedId = null;
      await loadData();
      render();
      hideEditPanel();
    } catch (error) {
      console.error(error);
      showToast("Delete failed", "error");
    }
  });
};

init().catch((error) => {
  console.error(error);
  el("editTable").insertAdjacentHTML(
    "beforeend",
    `<div class="table-row-wide">Failed to load data. Start the API server and reload.</div>`
  );
});
