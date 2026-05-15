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
            if (btnLogin)  btnLogin.style.display  = "none";
            if (profile)   profile.style.display   = "flex";
            if (avatar)    avatar.src              = user.avatar;
            if (name)      name.textContent        = user.displayName;

            if (teamBadge && user.team) {
                teamBadge.textContent   = `[${user.team.tag}] ${user.team.name}`;
                teamBadge.style.display = "inline-flex";
            }

            if (profile && !document.getElementById("_dynProfileLink")) {
                const link = document.createElement("a");
                link.id        = "_dynProfileLink";
                link.href      = "/profile.html";
                link.className = "header-profile-link";
                link.style.position = "relative";
                link.textContent = "Профиль";

                const badge = document.createElement("span");
                badge.id = "_dynNotifBadge";
                badge.style.cssText = [
                    "display:none",
                    "position:absolute",
                    "top:-7px",
                    "right:-7px",
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
                ].join(";");
                link.appendChild(badge);

                const isProfilePage = window.location.pathname.includes("profile");
                if (isProfilePage) {
                    link.style.cssText += ";background:rgba(230,176,34,0.12);color:var(--accent);border-color:rgba(230,176,34,0.3);";
                }
                const logoutBtn = profile.querySelector(".header-logout-btn");
                if (logoutBtn) profile.insertBefore(link, logoutBtn);
                else profile.appendChild(link);
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


    //контактты футер
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

        //перед ращлелителеи
        const divider = footerInner.querySelector(".footer-divider");
        if (divider) footerInner.insertBefore(contacts, divider);
        else footerInner.appendChild(contacts);
    }

    //правила футер
    const footerLinks = document.querySelector(".footer-links");
    if (footerLinks && !footerLinks.querySelector('a[href="rules.html"]')) {
        const rulesFooterLink = document.createElement("a");
        rulesFooterLink.href        = "rules.html";
        rulesFooterLink.textContent = "Правила";

        // Вставляем после «Политика конфиденциальности»
        const privacyLink = [...footerLinks.querySelectorAll("a")]
            .find(a => a.href.includes("privacy"));
        if (privacyLink) privacyLink.after(rulesFooterLink);
        else footerLinks.appendChild(rulesFooterLink);
    }
});

//уведомления на всех стрницах
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
                badge.textContent   = total;
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