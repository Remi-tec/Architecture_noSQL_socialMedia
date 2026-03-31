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
  const dataSource = 'posts.json';

  function loadPosts() {
    fetch(dataSource)
      .then(response => response.json())
      .then(data => {
        const sortedPosts = data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        postsFeedContainer.innerHTML = '';

        sortedPosts.forEach(post => {
          const dateObj = new Date(post.created_at);
          const formattedDate = dateObj.toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', year: 'numeric'//123456789
          });

          let imageHtml = post.image_url ? `<img src="${post.image_url}" class="post-image" loading="lazy" />` : '';
          
          const postElement = document.createElement("div");
          postElement.classList.add("post-card");

          postElement.innerHTML = `
            <div class="post-header">
              <div class="post-author"><strong>User #${post.user_id}</strong></div>
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
        });
      })
      .catch(err => {
        console.error("Erreur:", err);
        postsFeedContainer.innerHTML = "<p>Erreur de chargement des posts.</p>";
      });
  }

  loadPosts();
});