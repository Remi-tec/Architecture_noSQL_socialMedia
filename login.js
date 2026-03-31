document.addEventListener("DOMContentLoaded", () => {
  const searchInput = document.getElementById("searchInput");
  const usersListContainer = document.getElementById("usersList");
  let allUsers = [];

  fetch("users.json")
    .then(response => response.json())
    .then(users => {
      allUsers = users;
      displayUsers(allUsers); 
    })
    .catch(error => console.error("Erreur de chargement des utilisateurs:", error));

  function displayUsers(users) {
    usersListContainer.innerHTML = ""; 
    
    users.forEach(user => {
      const userDiv = document.createElement("div");
      userDiv.classList.add("user-item");
      
      userDiv.innerHTML = `
        <span class="user-name">${user.username}</span>
        <span class="user-email">${user.email}</span>
      `;

      userDiv.addEventListener("click", () => {
        localStorage.setItem("currentUser_id", user.user_id);
        localStorage.setItem("currentUser_name", user.username);
        
        window.location.href = "resaux.html";
      });

      usersListContainer.appendChild(userDiv);
    });
  }

  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value.toLowerCase();
    
    const filteredUsers = allUsers.filter(user => 
      user.username.toLowerCase().includes(searchTerm)
    );
    
    displayUsers(filteredUsers);
  });
});