document.addEventListener("DOMContentLoaded", () => {
  
  const currentUsername = localStorage.getItem("currentUser_name");
  const currentUserId = localStorage.getItem("currentUser_id");

  if (!currentUsername) {
    window.location.href = "login.html";
    return; 
  }

  const loggedInUserElement = document.getElementById("loggedInUser");
  if (loggedInUserElement) {
    loggedInUserElement.textContent = `Salut, ${currentUsername} !`;
  }

  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      localStorage.clear(); 
      window.location.href = "login.html"; 
    });
  }

  const dateElement = document.getElementById("currentDate");
  if (dateElement) {
    dateElement.textContent = new Date().toLocaleDateString('fr-FR');
  }

  const postsFeedContainer = document.getElementById("postsFeed");
  const dataSource = '/api/posts';

  // --- Chargement progressif des posts ---
  const POSTS_BATCH_SIZE = 25; // Nombre de posts à charger par requête
  const POSTS_BUFFER = 5;     // Nombre de posts préchargés pour éviter le popping
  let loadedPosts = [];
  let userMap = {};
  let currentPage = 1;
  let loading = false;
  let allLoaded = false;
  let observer = null;

  async function fetchUsers() {
    const users = await fetch('/api/users').then(r => r.json());
    userMap = {};
    users.forEach(user => {
      userMap[user.user_id] = user.username;
    });
  }

  async function fetchPostsPage(page) {
    loading = true;
    const url = `/api/posts?limit=${POSTS_BATCH_SIZE}&page=${page}&sort=created_at&order=desc`;
    const posts = await fetch(url).then(r => r.json());
    if (Array.isArray(posts) && posts.length > 0) {
      loadedPosts = loadedPosts.concat(posts);
      if (posts.length < POSTS_BATCH_SIZE) allLoaded = true;
    } else {
      allLoaded = true;
    }
    loading = false;
  }

  function renderPostsBatch() {
    const start = postsFeedContainer.childElementCount;
    const end = Math.min(loadedPosts.length, start + POSTS_BATCH_SIZE + POSTS_BUFFER);
    for (let i = start; i < end; i++) {
      const post = loadedPosts[i];
      const dateObj = new Date(post.created_at);
      const formattedDate = dateObj.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
      });
      let imageHtml = post.image_url ? `<img src="${post.image_url}" class="post-image" loading="lazy" />` : '';
      const username = userMap[post.user_id] || `User #${post.user_id}`;
      const postElement = document.createElement("div");
      postElement.classList.add("post-card");
      postElement.innerHTML = `
        <div class="post-header">
          <div class="post-author"><strong>${username}</strong></div>
          <div class="post-date">${formattedDate}</div>
        </div>
        <div class="post-body">
          <p>${post.content}</p>
          ${imageHtml}
        </div>
        <div class="post-footer">
          <span>❤️ ${post.likes_count} Likes</span>
          <span>💬 ${post.comments_count} Comm.</span>
        </div>
      `;
      postsFeedContainer.appendChild(postElement);
    }
    observeLastCard();
  }

  function observeLastCard() {
    if (observer) observer.disconnect();
    const cards = postsFeedContainer.querySelectorAll('.post-card');
    const lastToObserve = cards[cards.length - POSTS_BUFFER - 1] || cards[cards.length - 1];
    if (!lastToObserve) return;
    observer = new IntersectionObserver(async (entries) => {
      if (entries[0].isIntersecting && !loading && !allLoaded) {
        observer.disconnect();
        currentPage++;
        await fetchPostsPage(currentPage);
        renderPostsBatch();
      }
    }, { rootMargin: '200px' });
    observer.observe(lastToObserve);
  }

  async function initInfinitePosts() {
    postsFeedContainer.innerHTML = '';
    loadedPosts = [];
    currentPage = 1;
    allLoaded = false;
    await fetchUsers();
    await fetchPostsPage(currentPage);
    renderPostsBatch();
  }

  initInfinitePosts();
});