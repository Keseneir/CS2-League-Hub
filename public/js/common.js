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

//auth на всех страницах
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

            if (profile && !document.getElementById("_dynAvatarMenu")) {
                // Скрываем оригинальные аватар, имя и кнопку выйти — заменяем своим виджетом
                if (avatar)  avatar.style.display  = "none";
                if (name)    name.style.display     = "none";
                const origLogout = profile.querySelector(".header-logout-btn");
                if (origLogout) origLogout.style.display = "none";

                // Обёртка с аватаром и дропдауном
                const wrap = document.createElement("div");
                wrap.id = "_dynAvatarMenu";
                wrap.style.cssText = "position:relative;display:inline-flex;align-items:center;";

                // Аватар-кнопка
                const avatarBtn = document.createElement("div");
                avatarBtn.style.cssText = [
                    "position:relative",
                    "width:36px",
                    "height:36px",
                    "border-radius:50%",
                    "overflow:visible",
                    "cursor:pointer",
                    "flex-shrink:0",
                ].join(";");

                const avatarImg = document.createElement("img");
                avatarImg.src = user.avatar;
                avatarImg.style.cssText = [
                    "width:36px",
                    "height:36px",
                    "border-radius:50%",
                    "border:2px solid rgba(230,176,34,0.4)",
                    "object-fit:cover",
                    "display:block",
                    "transition:border-color .2s",
                ].join(";");
                avatarImg.onerror = () => { avatarImg.style.display = "none"; };
                avatarBtn.appendChild(avatarImg);

                // Бейдж уведомлений
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
                    "box-shadow:0 0 0 2px #0b0f12",
                    "z-index:1",
                ].join(";");
                avatarBtn.appendChild(badge);
                wrap.appendChild(avatarBtn);

                // Дропдаун
                const dropdown = document.createElement("div");
                dropdown.id = "_dynAvatarDropdown";
                dropdown.style.cssText = [
                    "display:none",
                    "position:absolute",
                    "top:calc(100% + 10px)",
                    "right:0",
                    "min-width:160px",
                    "background:#0e1318",
                    "border:1px solid #1f252c",
                    "border-radius:10px",
                    "overflow:hidden",
                    "z-index:500",
                    "box-shadow:0 8px 32px rgba(0,0,0,0.5)",
                ].join(";");

                // Шапка дропдауна — имя пользователя
                const dropHeader = document.createElement("div");
                dropHeader.style.cssText = [
                    "padding:10px 14px 8px",
                    "font-family:'Montserrat',sans-serif",
                    "font-weight:700",
                    "font-size:12px",
                    "color:#aebbc7",
                    "border-bottom:1px solid #1f252c",
                    "white-space:nowrap",
                    "overflow:hidden",
                    "text-overflow:ellipsis",
                    "max-width:180px",
                ].join(";");
                dropHeader.textContent = user.displayName;
                dropdown.appendChild(dropHeader);

                // Пункт — Профиль
                const profileItem = document.createElement("a");
                profileItem.href = "/profile.html";
                profileItem.style.cssText = [
                    "display:flex",
                    "align-items:center",
                    "gap:8px",
                    "padding:10px 14px",
                    "color:#ffffff",
                    "text-decoration:none",
                    "font-size:13px",
                    "transition:background .15s",
                    "cursor:pointer",
                ].join(";");
                profileItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> Профиль`;
                profileItem.onmouseover = () => profileItem.style.background = "#12171d";
                profileItem.onmouseout  = () => profileItem.style.background = "transparent";
                dropdown.appendChild(profileItem);

                // Пункт — Моя команда (только если есть команда)
                if (user.team) {
                    const teamItem = document.createElement("a");
                    teamItem.href = "/team.html";
                    teamItem.style.cssText = [
                        "display:flex","align-items:center","gap:8px","padding:10px 14px",
                        "color:#ffffff","text-decoration:none","font-size:13px",
                        "transition:background .15s","cursor:pointer",
                    ].join(";");
                    teamItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Моя команда`;
                    teamItem.onmouseover = () => teamItem.style.background = "#12171d";
                    teamItem.onmouseout  = () => teamItem.style.background = "transparent";
                    dropdown.appendChild(teamItem);
                }

                // Пункт — Магазин
                const shopItem = document.createElement("a");
                shopItem.href = "/shop.html";
                shopItem.style.cssText = [
                    "display:flex","align-items:center","gap:8px","padding:10px 14px",
                    "color:#e6b022","text-decoration:none","font-size:13px",
                    "transition:background .15s","cursor:pointer",
                ].join(";");
                shopItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg> Магазин`;
                shopItem.onmouseover = () => shopItem.style.background = "rgba(230,176,34,0.06)";
                shopItem.onmouseout  = () => shopItem.style.background = "transparent";
                dropdown.appendChild(shopItem);

                // Разделитель
                const sep = document.createElement("div");
                sep.style.cssText = "height:1px;background:#1f252c;";
                dropdown.appendChild(sep);

                // Пункт — Выйти
                const logoutItem = document.createElement("a");
                logoutItem.href = "/logout";
                logoutItem.style.cssText = [
                    "display:flex",
                    "align-items:center",
                    "gap:8px",
                    "padding:10px 14px",
                    "color:#e05c5c",
                    "text-decoration:none",
                    "font-size:13px",
                    "transition:background .15s",
                    "cursor:pointer",
                ].join(";");
                logoutItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg> Выйти`;
                logoutItem.onmouseover = () => logoutItem.style.background = "rgba(224,92,92,0.08)";
                logoutItem.onmouseout  = () => logoutItem.style.background = "transparent";
                dropdown.appendChild(logoutItem);

                wrap.appendChild(dropdown);
                profile.appendChild(wrap);

                // Открыть/закрыть по клику на аватар
                avatarBtn.addEventListener("click", (e) => {
                    e.stopPropagation();
                    const isOpen = dropdown.style.display === "block";
                    dropdown.style.display = isOpen ? "none" : "block";
                    avatarImg.style.borderColor = isOpen ? "rgba(230,176,34,0.4)" : "rgba(230,176,34,0.9)";
                });

                // Закрыть при клике вне
                document.addEventListener("click", () => {
                    dropdown.style.display = "none";
                    avatarImg.style.borderColor = "rgba(230,176,34,0.4)";
                });
            }

            if (btnApply)     { btnApply.href     = "/join.html"; btnApply.removeAttribute("target"); }
            if (heroBtnApply) { heroBtnApply.href = "/join.html"; heroBtnApply.removeAttribute("target"); }
        } else {
            if (btnLogin) btnLogin.style.display = "inline-flex";
            if (profile)  profile.style.display  = "none";
        }
        // Сообщаем мобильному меню что авторизация завершена
        if (user) document.dispatchEvent(new CustomEvent("_authDone", { detail: user }));
        return user;
    } catch {
        return null;
    }
}

document.addEventListener("DOMContentLoaded", checkAuth);


document.addEventListener("DOMContentLoaded", function () {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    // ─── Ссылка «Правила» в хедере ───────────────────────────────────────────
    // Ищем оба варианта классов (.social-links и .nav-links)
    const navContainer = document.querySelector(".social-links") || document.querySelector(".nav-links");
    if (navContainer && !navContainer.querySelector('a[href="rules.html"]')) {
        const rulesLink = document.createElement("a");
        rulesLink.href        = "rules.html";
        rulesLink.textContent = "Правила";
        if (currentPage === "rules.html") rulesLink.style.color = "var(--accent)";

        // Вставляем после «Рейтинг», или в конец если не найден
        const ratingLink = [...navContainer.querySelectorAll("a")]
            .find(a => a.href.includes("leaderboard"));
        if (ratingLink) ratingLink.after(rulesLink);
        else navContainer.appendChild(rulesLink);
    }


    // ─── Контакты в футере ───────────────────────────────────────────────────
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

        // Вставляем перед .footer-divider или перед .footer-copy
        const divider = footerInner.querySelector(".footer-divider");
        if (divider) footerInner.insertBefore(contacts, divider);
        else footerInner.appendChild(contacts);
    }

    // ─── Ссылка «Правила» в футере ───────────────────────────────────────────
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

//поллинг уведомлений на всех страницах
(function() {
    let _globalPrevCount = -1;
    const _globalAudio   = new Audio("assets/notification.mp3");

    async function globalPollNotifs() {
        try {
            const res = await fetch("/api/profile");
            if (!res.ok) return;
            const d = await res.json();

            const total =
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



document.addEventListener("DOMContentLoaded", function () {
    if (document.getElementById("_dynHamburger")) return;

    const header = document.querySelector("header");
    if (!header) return;

    // Кнопка гамбургера
    const btn = document.createElement("button");
    btn.id = "_dynHamburger";
    btn.className = "hamburger-btn";
    btn.setAttribute("aria-label", "Меню");
    btn.innerHTML = "<span></span><span></span><span></span>";
    header.appendChild(btn);

    // Оверлей + панель
    const drawer = document.createElement("div");
    drawer.className = "mobile-nav-drawer";
    drawer.id = "_dynNavDrawer";

    const panel = document.createElement("div");
    panel.className = "mobile-nav-panel";

    const currentPage = window.location.pathname.split("/").pop() || "index.html";

    const links = [
        { href: "index.html",       label: "Главная" },
        { href: "leaderboard.html", label: "Рейтинг" },
        { href: "news.html",        label: "Новости" },
        { href: "rules.html",       label: "Правила" },
        { href: "join.html",        label: "Подать заявку" },
    ];

    links.forEach(({ href, label }) => {
        const a = document.createElement("a");
        a.href = href;
        a.textContent = label;
        if (currentPage === href) a.classList.add("active");
        a.addEventListener("click", closeDrawer);
        panel.appendChild(a);
    });

    // Разделитель + профиль/выход (если авторизован)
    const userNav = document.createElement("div");
    userNav.id = "_dynMobileUserNav";
    panel.appendChild(userNav);

    drawer.appendChild(panel);
    document.body.appendChild(drawer);

    function openDrawer() {
        drawer.classList.add("open");
        btn.classList.add("open");
        document.body.style.overflow = "hidden";
    }
    function closeDrawer() {
        drawer.classList.remove("open");
        btn.classList.remove("open");
        document.body.style.overflow = "";
    }

    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        drawer.classList.contains("open") ? closeDrawer() : openDrawer();
    });
    drawer.addEventListener("click", (e) => {
        if (e.target === drawer) closeDrawer();
    });
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeDrawer();
    });

    
    const origCheckAuth = window._origCheckAuth;
    document.addEventListener("_authDone", function(e) {
        const user = e.detail;
        const nav = document.getElementById("_dynMobileUserNav");
        if (!nav || !user) return;
        const div = document.createElement("div");
        div.innerHTML = `
            <div class="mobile-nav-divider"></div>
            <a href="/profile.html">👤 Профиль</a>
            ${user.team ? `<a href="/team.html">🛡️ Моя команда</a>` : ""}
            <a href="/shop.html" style="color:#e6b022;">🛒 Магазин</a>
            <a href="/logout" style="color:#e05c5c;">Выйти</a>
        `;
        div.querySelectorAll("a").forEach(a => a.addEventListener("click", closeDrawer));
        nav.appendChild(div);
    });
});


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