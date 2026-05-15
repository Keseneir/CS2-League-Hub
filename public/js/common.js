console.log(
`%c ██████╗ ██████╗██████╗ ██╗     ██╗  ██╗
%c██╔════╝██╔════╝╚════██╗██║     ██║  ██║
%c██║     ███████╗ █████╔╝██║     ███████║
%c██║     ╚════██║██╔═══╝ ██║     ██╔══██║
%c╚██████╗██████ ║███████╗███████╗██║  ██║
%c ╚═════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
%c Developed by Keseneir | CS2 League Hub 2026
%c 
%cВНИМАНИЕ: Копирование кода без разрешения автора запрещено.
%cВсе права защищены.`,
'color:#ffcc00;font-weight:bold;','color:#ffcc00;font-weight:bold;',
'color:#ffcc00;font-weight:bold;','color:#ffcc00;font-weight:bold;',
'color:#ffcc00;font-weight:bold;','color:#ffcc00;font-weight:bold;',
'color:#ffffff;font-weight:bold;font-style:italic;','color:transparent;',
'color:#ff4444;font-size:12px;','color:#888;font-size:11px;'
);

async function checkAuth() {
    try {
        const res  = await fetch("/api/user");
        const user = await res.json();

        const btnLogin     = document.getElementById("btnSteamLogin");
        const profile      = document.getElementById("headerUserProfile");
        const avatar       = document.getElementById("headerAvatar");
        const name         = document.getElementById("headerName");
        const teamBadge    = document.getElementById("headerTeamBadge");
        const btnApply     = document.getElementById("btnApply");
        const heroBtnApply = document.getElementById("heroBtnApply");

        if (user) {
            if (btnLogin) btnLogin.style.display = "none";
            if (profile)  profile.style.display  = "flex";
            if (avatar)   avatar.src             = user.avatar;
            if (name)     name.textContent       = user.displayName;

            if (teamBadge && user.team) {
                teamBadge.textContent   = `[${user.team.tag}] ${user.team.name}`;
                teamBadge.style.display = "inline-flex";
            }

            // Скрываем оригинальную кнопку "Выйти" из HTML — она переедет в дропдаун
            const originalLogout = profile.querySelector(".header-logout-btn");
            if (originalLogout) originalLogout.style.display = "none";

            // Создаём аватар-дропдаун один раз
            if (profile && !document.getElementById("_dynAvatarMenu")) {
                const avatarEl = document.getElementById("headerAvatar");

                // Обёртка
                const wrapper = document.createElement("div");
                wrapper.id = "_dynAvatarMenu";
                wrapper.style.cssText = [
                    "position:relative",
                    "cursor:pointer",
                    "flex-shrink:0",
                    "display:inline-flex",
                    "align-items:center",
                ].join(";");

                // Перемещаем аватар внутрь обёртки
                avatarEl.parentNode.insertBefore(wrapper, avatarEl);
                wrapper.appendChild(avatarEl);

                // Подсветка аватара при открытом дропдауне
                avatarEl.style.transition = "border-color 0.2s, box-shadow 0.2s";

                // Бейдж уведомлений — на аватаре
                const badge = document.createElement("span");
                badge.id = "_dynNotifBadge";
                badge.style.cssText = [
                    "display:none",
                    "position:absolute",
                    "top:-5px",
                    "right:-5px",
                    "min-width:17px",
                    "height:17px",
                    "padding:0 4px",
                    "background:#e05c5c",
                    "color:#fff",
                    "font-family:'Montserrat',sans-serif",
                    "font-size:10px",
                    "font-weight:800",
                    "border-radius:999px",
                    "align-items:center",
                    "justify-content:center",
                    "line-height:1",
                    "pointer-events:none",
                    "box-shadow:0 0 0 2px #0b0f14",
                    "z-index:1",
                ].join(";");
                wrapper.appendChild(badge);

                // Дропдаун
                const dropdown = document.createElement("div");
                dropdown.id = "_dynAvatarDropdown";
                dropdown.style.cssText = [
                    "display:none",
                    "flex-direction:column",
                    "position:absolute",
                    "top:calc(100% + 10px)",
                    "right:0",
                    "background:#12171d",
                    "border:1px solid #1f252c",
                    "border-radius:10px",
                    "overflow:hidden",
                    "min-width:160px",
                    "box-shadow:0 12px 40px rgba(0,0,0,0.55),0 0 0 1px rgba(230,176,34,0.08)",
                    "z-index:300",
                ].join(";");

                // Пункт «Профиль»
                const profileLink = document.createElement("a");
                profileLink.href = "/profile.html";
                profileLink.textContent = "Профиль";
                const isProfilePage = window.location.pathname.includes("profile");
                profileLink.style.cssText = [
                    "display:block",
                    "padding:12px 18px",
                    "color:" + (isProfilePage ? "#e6b022" : "#aebbc7"),
                    "background:" + (isProfilePage ? "rgba(230,176,34,0.08)" : "transparent"),
                    "font-family:'Montserrat',sans-serif",
                    "font-weight:700",
                    "font-size:13px",
                    "text-decoration:none",
                    "border-bottom:1px solid #1f252c",
                    "transition:color 0.15s,background 0.15s",
                ].join(";");
                profileLink.addEventListener("mouseover", () => {
                    profileLink.style.color      = "#e6b022";
                    profileLink.style.background = "rgba(230,176,34,0.08)";
                });
                profileLink.addEventListener("mouseout", () => {
                    if (!isProfilePage) {
                        profileLink.style.color      = "#aebbc7";
                        profileLink.style.background = "transparent";
                    }
                });

                // Пункт «Выйти»
                const logoutLink = document.createElement("a");
                logoutLink.href = "/logout";
                logoutLink.textContent = "Выйти";
                logoutLink.style.cssText = [
                    "display:block",
                    "padding:12px 18px",
                    "color:#e05c5c",
                    "font-family:'Montserrat',sans-serif",
                    "font-weight:700",
                    "font-size:13px",
                    "text-decoration:none",
                    "transition:background 0.15s",
                ].join(";");
                logoutLink.addEventListener("mouseover", () => {
                    logoutLink.style.background = "rgba(224,92,92,0.09)";
                });
                logoutLink.addEventListener("mouseout", () => {
                    logoutLink.style.background = "transparent";
                });

                dropdown.appendChild(profileLink);
                dropdown.appendChild(logoutLink);
                wrapper.appendChild(dropdown);

                // Открыть / закрыть по клику на обёртку
                wrapper.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const isOpen = dropdown.style.display === "flex";
                    dropdown.style.display = isOpen ? "none" : "flex";
                    avatarEl.style.borderColor  = isOpen ? "var(--border)" : "var(--accent)";
                    avatarEl.style.boxShadow    = isOpen ? "none"          : "0 0 0 3px rgba(230,176,34,0.2)";
                });

                // Клик по самому дропдауну — не закрываем
                dropdown.addEventListener("click", (e) => e.stopPropagation());

                // Закрыть при клике в любом другом месте
                document.addEventListener("click", () => {
                    dropdown.style.display      = "none";
                    avatarEl.style.borderColor  = "var(--border)";
                    avatarEl.style.boxShadow    = "none";
                });
            }

            if (btnApply)     { btnApply.href     = "/join.html"; btnApply.removeAttribute("target"); }
            if (heroBtnApply) { heroBtnApply.href = "/join.html"; heroBtnApply.removeAttribute("target"); }
        } else {
            if (btnLogin) btnLogin.style.display = "inline-flex";
            if (profile)  profile.style.display  = "none";
        }
        return user;
    } catch {
        return null;
    }
}

document.addEventListener("DOMContentLoaded", checkAuth);

//единые ссылки на всех страницах
document.addEventListener("DOMContentLoaded", function () {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    const navContainer = document.querySelector(".social-links") || document.querySelector(".nav-links");
    if (navContainer && !navContainer.querySelector('a[href="rules.html"]')) {
        const rulesLink = document.createElement("a");
        rulesLink.href        = "rules.html";
        rulesLink.textContent = "Правила";
        if (currentPage === "rules.html") rulesLink.style.color = "var(--accent)";

        const ratingLink = [...navContainer.querySelectorAll("a")]
            .find(a => a.href.includes("leaderboard"));
        if (ratingLink) ratingLink.after(rulesLink);
        else navContainer.appendChild(rulesLink);
    }

    // Контакты в футере
    const footerInner = document.querySelector(".footer-inner");
    if (footerInner && !document.getElementById("_dynFooterContacts")) {
        const contacts = document.createElement("div");
        contacts.id = "_dynFooterContacts";
        contacts.style.cssText = [
            "display:flex",
            "flex-wrap:wrap",
            "justify-content:center",
            "gap:10px 24px",
            "margin-bottom:14px",
            "font-size:12px",
        ].join(";");

        contacts.innerHTML = `
            <a href="mailto:cs2.league.hub@gmail.com" style="display:inline-flex;align-items:center;gap:5px;color:#aebbc7;text-decoration:none;transition:color .15s;" onmouseover="this.style.color='#e6b022'" onmouseout="this.style.color='#aebbc7'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                cs2.league.hub@gmail.com
            </a>
        `;

        const divider = footerInner.querySelector(".footer-divider");
        if (divider) footerInner.insertBefore(contacts, divider);
        else footerInner.appendChild(contacts);
    }

    // Правила в футере
    const footerLinks = document.querySelector(".footer-links");
    if (footerLinks && !footerLinks.querySelector('a[href="rules.html"]')) {
        const rulesFooterLink = document.createElement("a");
        rulesFooterLink.href        = "rules.html";
        rulesFooterLink.textContent = "Правила";

        const privacyLink = [...footerLinks.querySelectorAll("a")]
            .find(a => a.href.includes("privacy"));
        if (privacyLink) privacyLink.after(rulesFooterLink);
        else footerLinks.appendChild(rulesFooterLink);
    }
});

// Уведомления на всех страницах
(function() {
    let _globalPrevCount = -1;
    const _globalAudio   = new Audio("assets/notification.mp3");

    async function globalPollNotifs() {
        try {
            const res = await fetch("/api/profile");
            if (!res.ok) return;
            const d = await res.json();

            const total =
                (d.friendRequests || []).length +
                (d.teamInvites    || []).length +
                (d.applications   || []).filter(a => a.status !== "pending").length +
                (d.adminNotices   || []).length;

            if (_globalPrevCount >= 0 && total > _globalPrevCount) {
                _globalAudio.play().catch(() => {});
            }
            _globalPrevCount = total;

            const badge = document.getElementById("_dynNotifBadge");
            if (badge) {
                badge.textContent   = total > 9 ? "9+" : total;
                badge.style.display = total > 0 ? "inline-flex" : "none";
            }
        } catch {}
    }

    document.addEventListener("DOMContentLoaded", function() {
        setTimeout(function() {
            globalPollNotifs();
            setInterval(globalPollNotifs, 5000);
        }, 1500);
    });
})();


(function() {
    const isOriginal = window.location.hostname === "cs2-league-hub.vercel.app" || window.location.hostname === "localhost";
    if (!isOriginal) {
        console.error("ATTENTION: Cloned version detected.");
        window.addEventListener("load", () => {
            setTimeout(() => {
                const fp = document.querySelector("footer p");
                if (fp) {
                    const m = document.createElement("span");
                    m.style.cssText = "color:#ff4444;font-weight:bold;margin-left:10px;";
                    m.innerHTML = "| FAKE SITE (Original by Keseneir)";
                    fp.appendChild(m);
                }
            }, 3000);
        });
    }
})();