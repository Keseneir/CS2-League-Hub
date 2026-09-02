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

                // Пункт — Мои объявления
                const listingsItem = document.createElement("a");
                listingsItem.href = "/listings.html?tab=mine";
                listingsItem.style.cssText = [
                    "display:flex","align-items:center","gap:8px","padding:10px 14px",
                    "color:#ffffff","text-decoration:none","font-size:13px",
                    "transition:background .15s","cursor:pointer",
                ].join(";");
                listingsItem.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg> Мои объявления`;
                listingsItem.onmouseover = () => listingsItem.style.background = "#12171d";
                listingsItem.onmouseout  = () => listingsItem.style.background = "transparent";
                dropdown.appendChild(listingsItem);

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

    // ─── Ссылка «Объявления» в хедере ─────────────────────────────────────────
    if (navContainer && !navContainer.querySelector('a[href="listings.html"]')) {
        const listingsLink = document.createElement("a");
        listingsLink.href        = "listings.html";
        listingsLink.textContent = "Объявления";
        if (currentPage === "listings.html") listingsLink.style.color = "var(--accent)";

        const newsLink = [...navContainer.querySelectorAll("a")]
            .find(a => a.href.includes("news.html"));
        if (newsLink) newsLink.after(listingsLink);
        else navContainer.appendChild(listingsLink);
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

            let listingUnread = 0;
            try {
                const lr = await fetch("/api/listings/unread-count");
                if (lr.ok) listingUnread = (await lr.json()).count || 0;
            } catch {}

            const total =
                (d.teamInvites    || []).length +
                (d.applications   || []).filter(a => a.status !== "pending").length +
                (d.adminNotices   || []).length +
                listingUnread;

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
        { href: "listings.html",    label: "Объявления" },
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
        nav.innerHTML = ""; // checkAuth() может сработать больше 1 раза (виджет поддержки дёргает его повторно) — без очистки блок дублировался
        const div = document.createElement("div");
        div.innerHTML = `
            <div class="mobile-nav-divider"></div>
            <a href="/profile.html">${iconSvg("user")} Профиль</a>
            ${user.team ? `<a href="/team.html">${iconSvg("shield")} Моя команда</a>` : ""}
            <a href="/listings.html?tab=mine">${iconSvg("clipboard")} Мои объявления</a>
            <a href="/shop.html" style="color:#e6b022;">${iconSvg("cart")} Магазин</a>
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

// ── Виджет техподдержки: система тикетов (список + чат конкретного тикета) ─
(function () {
    if (location.pathname.toLowerCase().includes("admin")) return;

    function getGuestId() {
        let id = localStorage.getItem("_supportGuestId");
        if (!id) {
            id = (window.crypto && crypto.randomUUID)
                ? crypto.randomUUID()
                : "g-" + Date.now() + "-" + Math.random().toString(36).slice(2);
            localStorage.setItem("_supportGuestId", id);
        }
        return id;
    }
    const guestId = getGuestId();

    let pollTimer = null;
    let lastMessageCount = 0;
    let isOpen = false;
    let _cloudinaryCloud  = null;
    let _cloudinaryPreset = null;
    let _identity = { displayName: "", avatar: "" }; // подтягивается из checkAuth(), если юзер залогинен через Steam

    let view = "list";        // "list" (список тикетов) | "chat" (переписка конкретного тикета)
    let currentTicketId = null;
    let deliveredNoticeShown = false; // разовая строка "запрос доставлен" за сессию открытия конкретного тикета

    function escSupport(s) {
        return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function fmtDate(iso) {
        try {
            const d = new Date(iso);
            return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" }) + " " +
                   d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
        } catch { return ""; }
    }

    function widgetHtml() {
        return `
        <div id="_supportBtn" title="Техподдержка">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"/>
            </svg>
        </div>
        <div id="_supportPanel" class="_sp-hidden">
            <div class="_sp-header">
                <button id="_supportBackBtn" class="_sp-backBtn" aria-label="Назад" style="display:none;">←</button>
                <span id="_supportHeaderTitle">Техподдержка <span id="_supportStatusBadge" class="_sp-badge" style="display:none;"></span></span>
                <button id="_supportCloseBtn" aria-label="Закрыть">✕</button>
            </div>

            <div id="_supportListScreen">
                <div id="_supportTicketList"></div>
                <div class="_sp-newTicketRow">
                    <button id="_supportNewTicketBtn" class="_sp-newTicketBtn">+ Новое обращение</button>
                </div>
                <form id="_supportNewTicketForm" class="_sp-newTicketForm" style="display:none;">
                    <input id="_supportSubjectInput" type="text" placeholder="Кратко опишите тему..." maxlength="120">
                    <div class="_sp-newTicketFormRow">
                        <button type="button" id="_supportNewTicketCancel">Отмена</button>
                        <button type="submit" id="_supportNewTicketSubmit">Создать</button>
                    </div>
                </form>
            </div>

            <div id="_supportChatScreen" style="display:none;">
                <div id="_supportMessages"></div>
                <div id="_supportAttachPreview" class="_sp-attach-preview" style="display:none;"></div>
                <div id="_supportResolvedNotice" class="_sp-resolvedNotice" style="display:none;">
                    Тикет закрыт. <button type="button" id="_supportReopenAsNewBtn">Создать новый</button>
                </div>
                <div id="_supportInputRow" class="_sp-inputRow">
                    <label class="_sp-attachBtn" title="Прикрепить файл">
                        <input type="file" id="_supportFileInput" accept="image/*" style="display:none;">
                        📎
                    </label>
                    <input id="_supportInput" type="text" placeholder="Напишите сообщение..." maxlength="2000">
                    <button id="_supportSendBtn" aria-label="Отправить">➤</button>
                </div>
                <div class="_sp-resolveRow">
                    <button type="button" id="_supportResolveBtn" class="_sp-resolveBtn">✓ Пометить решённым</button>
                </div>
            </div>
        </div>`;
    }

    async function loadIdentity() {
        try {
            const user = await checkAuth();
            if (user) _identity = { displayName: user.displayName || "", avatar: user.avatar || "" };
        } catch {}
        try {
            const res = await fetch("/api/config");
            const cfg = await res.json();
            _cloudinaryCloud  = cfg.cloudinaryCloud;
            _cloudinaryPreset = cfg.cloudinaryPreset;
        } catch {}
    }

    function init() {
        document.body.insertAdjacentHTML("beforeend", widgetHtml());
        loadIdentity();

        const btn        = document.getElementById("_supportBtn");
        const panel       = document.getElementById("_supportPanel");
        const backBtn     = document.getElementById("_supportBackBtn");
        const headerTitle = document.getElementById("_supportHeaderTitle");
        const closeBtn    = document.getElementById("_supportCloseBtn");

        const listScreen  = document.getElementById("_supportListScreen");
        const ticketListEl = document.getElementById("_supportTicketList");
        const newTicketBtn  = document.getElementById("_supportNewTicketBtn");
        const newTicketForm = document.getElementById("_supportNewTicketForm");
        const subjectInput  = document.getElementById("_supportSubjectInput");
        const newTicketCancel = document.getElementById("_supportNewTicketCancel");

        const chatScreen  = document.getElementById("_supportChatScreen");
        const input       = document.getElementById("_supportInput");
        const sendBtn     = document.getElementById("_supportSendBtn");
        const msgsEl      = document.getElementById("_supportMessages");
        const fileInput   = document.getElementById("_supportFileInput");
        const attachPreview   = document.getElementById("_supportAttachPreview");
        const inputRow         = document.getElementById("_supportInputRow");
        const resolvedNotice   = document.getElementById("_supportResolvedNotice");
        const reopenAsNewBtn   = document.getElementById("_supportReopenAsNewBtn");
        const resolveBtn       = document.getElementById("_supportResolveBtn");
        const resolveRow       = document.querySelector("._sp-resolveRow");

        let pendingAttachment = null; // { url, publicId }

        // ── Переключение экранов ──────────────────────────────────────────
        function showListScreen() {
            view = "list";
            currentTicketId = null;
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
            backBtn.style.display = "none";
            headerTitle.innerHTML = `Техподдержка <span id="_supportStatusBadge" class="_sp-badge" style="display:none;"></span>`;
            listScreen.style.display = "";
            chatScreen.style.display = "none";
            loadTicketList();
        }

        function showChatScreen(ticketId) {
            view = "chat";
            currentTicketId = ticketId;
            lastMessageCount = 0;
            deliveredNoticeShown = false;
            backBtn.style.display = "";
            listScreen.style.display = "none";
            chatScreen.style.display = "";
            loadThread();
            if (!pollTimer) pollTimer = setInterval(loadThread, 4000);
        }

        // ── Список тикетов ─────────────────────────────────────────────────
        function ticketStatusLabel(t) {
            return t.status === "resolved" ? "✅ Решено" : "🕓 Открыт";
        }

        function renderTicketList(tickets) {
            if (!tickets.length) {
                ticketListEl.innerHTML = `<div class="_sp-empty">У вас пока нет обращений. Создайте новое, если есть вопрос.</div>`;
                return;
            }
            ticketListEl.innerHTML = tickets.map(t => `
                <div class="_sp-ticketRow _sp-ticketRow-${t.status}" data-id="${t.id}">
                    <div class="_sp-ticketSubject">${escSupport(t.subject || "Без темы")}</div>
                    <div class="_sp-ticketMeta">
                        <span class="_sp-ticketStatus _sp-ticketStatus-${t.status}">${ticketStatusLabel(t)}</span>
                        <span class="_sp-ticketDate">${fmtDate(t.lastMessageAt)}</span>
                    </div>
                </div>
            `).join("");
            ticketListEl.querySelectorAll("._sp-ticketRow").forEach(row => {
                row.addEventListener("click", () => showChatScreen(row.dataset.id));
            });
        }

        async function loadTicketList() {
            try {
                const res  = await fetch(`/api/support/tickets/${guestId}`);
                const data = await res.json();
                renderTicketList(data.tickets || []);
                const blocked = !!(data.guest && data.guest.isBlocked);
                newTicketBtn.style.display = blocked ? "none" : "";
                if (blocked && !ticketListEl.querySelector("._sp-blockedNotice")) {
                    ticketListEl.insertAdjacentHTML("beforeend", `<div class="_sp-blockedNotice">Чат временно недоступен</div>`);
                }
            } catch {}
        }

        newTicketBtn.addEventListener("click", () => {
            newTicketForm.style.display = "";
            newTicketBtn.style.display = "none";
            subjectInput.focus();
        });
        newTicketCancel.addEventListener("click", () => {
            newTicketForm.style.display = "none";
            newTicketBtn.style.display = "";
            subjectInput.value = "";
        });
        newTicketForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const subject = subjectInput.value.trim();
            if (!subject) return;
            const submitBtn = document.getElementById("_supportNewTicketSubmit");
            submitBtn.disabled = true;
            try {
                const res = await fetch("/api/support/ticket", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        guestId, subject,
                        guestName:   _identity.displayName,
                        guestAvatar: _identity.avatar,
                    }),
                });
                const data = await res.json();
                if (res.status === 403) { alert(data.error || "Чат временно недоступен"); return; }
                if (!data.ok) { alert(data.error || "Не удалось создать обращение"); return; }
                subjectInput.value = "";
                newTicketForm.style.display = "none";
                newTicketBtn.style.display = "";
                showChatScreen(data.ticket.id);
            } catch {
                alert("Не удалось создать обращение");
            } finally {
                submitBtn.disabled = false;
            }
        });

        // ── Экран чата конкретного тикета ───────────────────────────────────
        function renderStatusBadge(thread) {
            const badge = document.getElementById("_supportStatusBadge");
            if (!thread) { badge.style.display = "none"; return; }
            headerTitle.firstChild.textContent = `Тикет #${thread.number} `;
            badge.textContent = thread.status === "resolved" ? "✅ Решено" : "🕓 Открыт";
            badge.style.display = "inline";

            const isResolved = thread.status === "resolved";
            inputRow.style.display    = isResolved ? "none" : "";
            resolveRow.style.display  = isResolved ? "none" : "";
            resolvedNotice.style.display = isResolved ? "flex" : "none";
        }

        function avatarHtml(m) {
            if (m.authorAvatar) return `<img class="_sp-avatar" src="${escSupport(m.authorAvatar)}" onerror="this.style.display='none'">`;
            return `<div class="_sp-avatar _sp-avatar-ph"></div>`;
        }

        function renderMessages(messages) {
            if (!messages.length) {
                msgsEl.innerHTML = `<div class="_sp-empty">Опишите ваш вопрос — ответим как можно скорее.</div>`;
                return;
            }
            const rows = messages.map(m => `
                <div class="_sp-row _sp-row-${m.from}">
                    ${avatarHtml(m)}
                    <div class="_sp-col">
                        <div class="_sp-name">${escSupport(m.authorName || (m.from === "admin" ? "Поддержка" : "Гость"))}</div>
                        <div class="_sp-msg _sp-${m.from}">
                            ${m.attachmentUrl ? `<a href="${escSupport(m.attachmentUrl)}" target="_blank"><img class="_sp-attach-img" src="${escSupport(m.attachmentUrl)}"></a>` : ""}
                            ${m.text && m.text !== "📎 Вложение" ? escSupport(m.text) : ""}
                        </div>
                    </div>
                </div>
            `);
            // Разовая строка "запрос доставлен" — сразу после первого сообщения в тикете,
            // один раз за это открытие тикета (не хранится в БД, чисто UI-приветствие).
            if (deliveredNoticeShown && messages.length === 1 && messages[0].from === "guest") {
                rows.push(`<div class="_sp-system">Ваш запрос доставлен и рассматривается</div>`);
            }
            msgsEl.innerHTML = rows.join("");
            msgsEl.scrollTop = msgsEl.scrollHeight;
        }

        async function loadThread() {
            if (!currentTicketId) return;
            try {
                const res  = await fetch(`/api/support/thread/${currentTicketId}`);
                if (res.status === 404) { showListScreen(); return; }
                const data = await res.json();
                renderStatusBadge(data.thread);
                if (data.messages.length !== lastMessageCount) {
                    lastMessageCount = data.messages.length;
                    renderMessages(data.messages);
                }
            } catch {}
        }

        backBtn.addEventListener("click", showListScreen);

        btn.addEventListener("click", () => (isOpen ? closePanel() : openPanel()));
        closeBtn.addEventListener("click", closePanel);

        function openPanel() {
            isOpen = true;
            panel.classList.remove("_sp-hidden");
            showListScreen();
        }
        function closePanel() {
            isOpen = false;
            panel.classList.add("_sp-hidden");
            if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
        }

        fileInput.addEventListener("change", async () => {
            const file = fileInput.files[0];
            fileInput.value = "";
            if (!file) return;
            if (!_cloudinaryCloud || !_cloudinaryPreset) {
                attachPreview.style.display = "block";
                attachPreview.textContent = "Загрузка файлов недоступна (не настроено)";
                return;
            }
            attachPreview.style.display = "block";
            attachPreview.textContent = "Загрузка...";
            try {
                const fd = new FormData();
                fd.append("file", file);
                fd.append("upload_preset", _cloudinaryPreset);
                const res  = await fetch(`https://api.cloudinary.com/v1_1/${_cloudinaryCloud}/image/upload`, { method: "POST", body: fd });
                const data = await res.json();
                if (!data.secure_url) throw new Error("upload failed");
                pendingAttachment = { url: data.secure_url, publicId: data.public_id };
                attachPreview.innerHTML = `<img src="${data.secure_url}" style="height:40px;border-radius:6px;"> <span>Прикреплено (~30 мин)</span> <button type="button" id="_supportAttachRemove">✕</button>`;
                document.getElementById("_supportAttachRemove").addEventListener("click", () => {
                    pendingAttachment = null;
                    attachPreview.style.display = "none";
                    attachPreview.innerHTML = "";
                });
            } catch {
                attachPreview.textContent = "Не удалось загрузить файл";
                pendingAttachment = null;
            }
        });

        async function sendMsg() {
            const text = input.value.trim();
            if (!text && !pendingAttachment) return;
            if (!currentTicketId) return;
            const isFirstMessage = lastMessageCount === 0;
            input.value = "";
            sendBtn.disabled = true;
            try {
                const res = await fetch("/api/support/message", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ticketId: currentTicketId, guestId, text,
                        guestName:   _identity.displayName,
                        guestAvatar: _identity.avatar,
                        attachmentUrl:      pendingAttachment?.url || "",
                        attachmentPublicId: pendingAttachment?.publicId || "",
                    }),
                });
                if (res.status === 429) {
                    const d = await res.json();
                    alert(d.error || "Слишком часто, подождите немного");
                    return;
                }
                if (res.status === 403) {
                    const d = await res.json();
                    alert(d.error || "Чат временно недоступен");
                    return;
                }
                if (res.status === 409) {
                    // тикет успели закрыть, пока гость печатал
                    await loadThread();
                    return;
                }
                if (isFirstMessage) deliveredNoticeShown = true;
                pendingAttachment = null;
                attachPreview.style.display = "none";
                attachPreview.innerHTML = "";
                await loadThread();
            } catch {}
            finally { sendBtn.disabled = false; }
        }
        sendBtn.addEventListener("click", sendMsg);
        input.addEventListener("keydown", e => { if (e.key === "Enter") sendMsg(); });

        // ── Гость закрывает тикет ────────────────────────────────────────
        resolveBtn.addEventListener("click", async () => {
            if (!currentTicketId) return;
            resolveBtn.disabled = true;
            try {
                const res = await fetch(`/api/support/ticket/${currentTicketId}/resolve`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ guestId }),
                });
                if (res.ok) await loadThread();
            } catch {}
            finally { resolveBtn.disabled = false; }
        });

        reopenAsNewBtn.addEventListener("click", showListScreen);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();