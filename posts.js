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


  async function fetchComments(postId) {
    const res = await fetch(`/api/comments?post_id=${postId}`);
    if (!res.ok) return [];
    return res.json();
  }

  async function fetchLikes(postId) {
    const res = await fetch(`/api/likes?post_id=${postId}`);
    if (!res.ok) return [];
    return res.json();
  }

  async function renderPostsBatch() {
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
          <button class="like-btn" data-post-id="${post.post_id}">❤️ <span class="like-count">${post.likes_count ?? 0}</span> Like</button>
          <button class="toggle-comments-btn" data-post-id="${post.post_id}" style="margin-left:10px;">💬 <span class="comment-count">${post.comments_count ?? 0}</span> Commentaires</button>
        </div>
        <div class="comments-section" id="comments-for-${post.post_id}" style="display:none;">
          <div class="comments-list"></div>
          <button class="load-more-comments-btn" style="display:none;margin:8px auto 0 auto;">▼ Afficher plus</button>
          <form class="add-comment-form" style="margin-top:8px;display:none;">
            <input type="text" class="comment-input" placeholder="Ajouter un commentaire..." required style="width:70%;padding:6px;" />
            <button type="submit" class="comment-submit-btn">Envoyer</button>
          </form>
        </div>
      `;
      postsFeedContainer.appendChild(postElement);

      // Gestion des commentaires (affichage progressif)
      const commentsSection = postElement.querySelector('.comments-section');
      const commentsList = commentsSection.querySelector('.comments-list');
      const addCommentForm = commentsSection.querySelector('.add-comment-form');
      const loadMoreBtn = commentsSection.querySelector('.load-more-comments-btn');
      let allComments = [];
      let commentsDisplayed = 0;
      const COMMENTS_PAGE_SIZE = 5;

      async function showNextComments() {
        const next = allComments.slice(commentsDisplayed, commentsDisplayed + COMMENTS_PAGE_SIZE);
        next.forEach(c => {
          const div = document.createElement('div');
          div.className = 'comment-item';
          div.innerHTML = `<b>${userMap[c.user_id] || 'User #' + c.user_id}</b> : ${c.content}`;
          commentsList.appendChild(div);
        });
        commentsDisplayed += next.length;
        if (commentsDisplayed < allComments.length) {
          loadMoreBtn.style.display = '';
        } else {
          loadMoreBtn.style.display = 'none';
        }
      }

      async function loadAndDisplayCommentsOnDemand() {
        allComments = (await fetchComments(post.post_id)).filter(c => c.post_id == post.post_id);
        commentsList.innerHTML = '';
        commentsDisplayed = 0;
        showNextComments();
        // Met à jour le compteur
        const commentCountSpan = postElement.querySelector('.comment-count');
        if (commentCountSpan) commentCountSpan.textContent = allComments.length;
      }

      loadMoreBtn.addEventListener('click', showNextComments);

      // Afficher/Masquer les commentaires au clic
      const toggleCommentsBtn = postElement.querySelector('.toggle-comments-btn');
      let commentsLoaded = false;
      toggleCommentsBtn.addEventListener('click', async () => {
        if (commentsSection.style.display === 'none') {
          commentsSection.style.display = '';
          if (!commentsLoaded) {
            await loadAndDisplayCommentsOnDemand();
            commentsLoaded = true;
          }
        } else {
          commentsSection.style.display = 'none';
        }
      });

      // Ajout de commentaire
      if (currentUserId && currentUsername) {
        addCommentForm.style.display = "flex";
        addCommentForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const input = addCommentForm.querySelector('.comment-input');
          const content = input.value.trim();
          if (!content) return;
          const payload = {
            post_id: Number(post.post_id),
            user_id: Number(currentUserId),
            content,
            created_at: new Date().toISOString().slice(0, 10)
          };
          const res = await fetch('/api/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (res.ok) {
            input.value = '';
            await loadAndDisplayCommentsOnDemand();
          }
        });
      }

      // Affichage des likes
      const likeBtn = postElement.querySelector('.like-btn');
      if (currentUserId && currentUsername) {
        likeBtn.disabled = false;
        likeBtn.onclick = async () => {
          // Vérifie si déjà liké
          const likes = await fetchLikes(post.post_id);
          const userLike = likes.find(like => String(like.user_id) === String(currentUserId) && String(like.post_id) === String(post.post_id) && like.like_id !== undefined && like.like_id !== null);
          if (userLike) {
            // Retirer le like
            await fetch(`/api/likes/${userLike.like_id}`, { method: 'DELETE' });
            await loadAndDisplayLikes(post.post_id, likeBtn, postElement);
          } else {
            // Ajouter le like
            const payload = {
              post_id: Number(post.post_id),
              user_id: Number(currentUserId),
              created_at: new Date().toISOString().slice(0, 10)
            };
            const res = await fetch('/api/likes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            if (res.ok) {
              await loadAndDisplayLikes(post.post_id, likeBtn, postElement);
            }
          }
        };
      } else {
        likeBtn.disabled = true;
      }

      // Chargement initial des likes uniquement
      await loadAndDisplayLikes(post.post_id, likeBtn, postElement);
    }
    observeLastCard();
  }

  // plus utilisé : loadAndDisplayComments

      async function loadAndDisplayLikes(postId, likeBtn, postElement) {
        const likes = await fetchLikes(postId);
        // Met à jour le compteur en rechargeant la vraie valeur depuis l'API du post
        const likeCountSpan = likeBtn.querySelector('.like-count');
        // Recharge la valeur du post depuis l'API
        try {
          const res = await fetch(`/api/posts?post_id=${postId}`);
          const posts = await res.json();
          const postObj = Array.isArray(posts) ? posts.find(p => String(p.post_id) === String(postId)) : null;
          if (likeCountSpan) {
            if (postObj && typeof postObj.likes_count === 'number') {
              likeCountSpan.textContent = postObj.likes_count;
            } else {
              likeCountSpan.textContent = likes.length;
            }
          }
        } catch {
          if (likeCountSpan) likeCountSpan.textContent = likes.length;
        }

        // Gestion du bouton like/unlike
        let userLike = null;
        if (currentUserId) {
          userLike = likes.find(like => String(like.user_id) === String(currentUserId) && String(like.post_id) === String(postId) && like.like_id !== undefined && like.like_id !== null);
        }

        // Supprime le style "déjà liké" si présent
        likeBtn.classList.remove('liked');
        likeBtn.title = '';
        likeBtn.disabled = false;

        if (userLike && userLike.like_id !== undefined && userLike.like_id !== null) {
          // Style visuel différent pour indiquer que l'utilisateur a déjà liké
          likeBtn.classList.add('liked');
          likeBtn.title = "Vous avez déjà liké ce post";
        }
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