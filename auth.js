async function checkAuth() {
  try {
    const res  = await fetch("/api/user");
    const user = await res.json();

    const btnLogin   = document.getElementById("btn-login");
    const btnLogout  = document.getElementById("btn-logout");
    const profile    = document.getElementById("user-profile");
    const avatar     = document.getElementById("user-avatar");
    const name       = document.getElementById("user-name");
    const points     = document.getElementById("user-points");

    if (user) {
      if (btnLogin)  btnLogin.style.display  = "none";
      if (btnLogout) btnLogout.style.display = "inline-flex";
      if (profile)   profile.style.display   = "flex";
      if (avatar)    avatar.src              = user.avatar;
      if (name)      name.textContent        = user.displayName;
      if (points)    points.textContent      = user.points + " очков";
    } else {
      if (btnLogin)  btnLogin.style.display  = "inline-flex";
      if (btnLogout) btnLogout.style.display = "none";
      if (profile)   profile.style.display   = "none";
    }
  } catch {
    console.error("Auth check failed");
  }
}

document.addEventListener("DOMContentLoaded", checkAuth);