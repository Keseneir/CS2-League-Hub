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

/* ================================================
   AUTH — подключается на всех страницах
   ================================================ */
async function checkAuth() {
    try {
        const res  = await fetch("/api/user");
        const user = await res.json();

        const btnLogin     = document.getElementById("btnSteamLogin");
        const profile      = document.getElementById("headerUserProfile");
        const avatar       = document.getElementById("headerAvatar");
        const name         = document.getElementById("headerName");
        const points       = document.getElementById("headerPoints");
        const teamBadge    = document.getElementById("headerTeamBadge");
        const btnApply     = document.getElementById("btnApply");
        const heroBtnApply = document.getElementById("heroBtnApply");

        if (user) {
            if (btnLogin)  btnLogin.style.display  = "none";
            if (profile)   profile.style.display   = "flex";
            if (avatar)    avatar.src              = user.avatar;
            if (name)      name.textContent        = user.displayName;
            if (points)    points.textContent      = user.points + " очков";

            if (teamBadge && user.team) {
                teamBadge.textContent   = `[${user.team.tag}] ${user.team.name}`;
                teamBadge.style.display = "inline-flex";
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

/* ================================================
   INDEX PAGE — виджет рейтинга
   ================================================ */
if (document.getElementById("widgetBody")) {
    const WIDGET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLzmfGa-hRDaGQLSiXkhp7oA6FeMmvllGr7bMBv8nZVIP2o6abGMzAi4NOxMc6RvI1fSieM06ZoMuQ/pub?gid=1376391839&single=true&output=csv";

    const DEMO_TOP3 = [
        { team: "Natus Vincere", pts: 18, wins: 6, losses: 0, rd: 22 },
        { team: "Cloud9",        pts: 15, wins: 5, losses: 1, rd: 14 },
        { team: "Virtus.pro",    pts: 12, wins: 4, losses: 2, rd: 7  },
    ];
    const RANK_CLASS = ["r1", "r2", "r3"];

    function parseWidgetCSV(text) {
        const lines   = text.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
        return lines.slice(1).map(line => {
            const vals = line.split(",").map(v => v.trim());
            const obj  = {};
            headers.forEach((h, i) => obj[h] = vals[i] || "");
            return {
                team:   obj["команда"]    || obj["team"]    || "—",
                pts:    parseInt(obj["очки"]      || obj["pts"]    || 0),
                wins:   parseInt(obj["победы"]    || obj["wins"]   || 0),
                losses: parseInt(obj["поражения"] || obj["losses"] || 0),
                rd:     parseInt(obj["round_diff"]|| obj["rd"]     || 0),
                avatar: obj["аватар"] || obj["avatar"] || "",
            };
        }).filter(r => r.team && r.team !== "—");
    }

    function renderWidget(data) {
        const top3 = [...data].sort((a, b) => b.pts - a.pts || b.rd - a.rd).slice(0, 3);
        const html  = top3.map((r, i) => `
            <div class="widget-row">
                <div class="widget-rank ${RANK_CLASS[i]}">${i + 1}</div>
                ${r.avatar ? `<img src="${r.avatar}" alt="${r.team}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : ""}
                <div class="widget-team-name">${r.team}</div>
                <div class="widget-stats">
                    <div class="widget-pts">${r.pts} <span style="font-size:10px;font-weight:600;color:var(--text-gray)">ОЧК</span></div>
                    <div class="widget-wl"><span class="w">${r.wins}W</span> / <span class="l">${r.losses}L</span></div>
                </div>
            </div>
            ${i < 2 ? '<div class="widget-divider"></div>' : ""}
        `).join("");
        document.getElementById("widgetBody").innerHTML = html;
    }

    async function loadWidget() {
        try {
            const res = await fetch(WIDGET_CSV_URL);
            if (!res.ok) throw new Error();
            const text = await res.text();
            const data = parseWidgetCSV(text);
            if (!data.length) throw new Error();
            renderWidget(data);
        } catch {
            renderWidget(DEMO_TOP3);
        }
    }

    loadWidget();
}

/* ================================================
   NEWS PAGE
   ================================================ */
if (document.getElementById("newsContainer")) {
    const NEWS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbdqLzy4PvMyR_9Pndokh0E0zNYg13qHTJOwRtBJz1wlwyjrfz_2NsJaskSLLlfXHRMFIT4_CkR_6K/pub?gid=0&single=true&output=csv";

    const DEMO_NEWS = [
        { date:"01 апреля 2026", tag:"Результаты", title:"Итоги 3-го тура: BAREBUH удерживает лидерство", text:"По итогам третьего игрового тура команда BAREBUH сохраняет первое место.", img:"", link:"", featured:"да" },
        { date:"28 марта 2026",  tag:"Анонс",      title:"Расписание 4-го тура опубликовано",            text:"Матчи пройдут с 5 по 7 апреля.",                                         img:"", link:"", featured:"нет" },
        { date:"25 марта 2026",  tag:"Лига",        title:"Две новые команды вступили в лигу",            text:"Команды GHOST и PHANTOM прошли отбор.",                                 img:"", link:"", featured:"нет" },
        { date:"20 марта 2026",  tag:"Результаты", title:"Итоги 2-го тура",                              text:"Второй тур преподнёс сюрпризы.",                                        img:"", link:"", featured:"нет" },
    ];

    let ALL_NEWS    = [];
    let activeTag   = "all";
    let activeSort  = "new";
    let activeSearch = "";

    window._imgErr = function(el) {
        el.style.display = "none";
        const ph = document.createElement("div");
        ph.className = "img-placeholder";
        ph.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        el.parentNode.appendChild(ph);
    };

    function imgHtml(url) {
        const ph = '<div class="img-placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>';
        if (!url) return ph;
        return `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.85;" onerror="_imgErr(this)">`;
    }

    function parseNewsCSV(text) {
        const lines   = text.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        return lines.slice(1).map(line => {
            const vals = [];
            let cur = "", inQ = false;
            for (const ch of line) {
                if (ch === '"') { inQ = !inQ; }
                else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
                else { cur += ch; }
            }
            vals.push(cur.trim());
            const obj = {};
            headers.forEach((h, i) => obj[h] = (vals[i] || "").replace(/^"|"$/g, ""));
            return {
                date:     obj["дата"]      || obj["date"]     || "",
                tag:      obj["тег"]       || obj["tag"]      || "Новость",
                title:    obj["заголовок"] || obj["title"]    || "",
                text:     obj["текст"]     || obj["text"]     || "",
                img:      obj["картинка"]  || obj["img"]      || "",
                link:     obj["ссылка"]    || obj["link"]     || "",
                featured: (obj["главная"]  || obj["featured"] || "").toLowerCase(),
            };
        }).filter(r => r.title);
    }

    function parseDate(str) {
        const months = {"января":0,"февраля":1,"марта":2,"апреля":3,"мая":4,"июня":5,"июля":6,"августа":7,"сентября":8,"октября":9,"ноября":10,"декабря":11};
        const parts = str.trim().split(/\s+/);
        if (parts.length === 3) {
            const d = parseInt(parts[0]), m = months[parts[1].toLowerCase()], y = parseInt(parts[2]);
            if (!isNaN(d) && m !== undefined && !isNaN(y)) return new Date(y, m, d);
        }
        return new Date(0);
    }

    function applyNewsFilters() {
        let data = [...ALL_NEWS];
        if (activeTag !== "all") data = data.filter(n => n.tag.toLowerCase().includes(activeTag.toLowerCase()));
        if (activeSearch.trim()) {
            const q = activeSearch.toLowerCase();
            data = data.filter(n => n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q));
        }
        data.sort((a, b) => { const d = parseDate(b.date) - parseDate(a.date); return activeSort === "new" ? d : -d; });
        renderNews(data);
    }

    function renderNews(data) {
        const noFilter = activeTag === "all" && !activeSearch.trim();
        const featured = noFilter ? data.find(n => n.featured === "да" || n.featured === "yes") : null;
        const rest     = data.filter(n => n !== featured);
        let html = "";
        if (featured) {
            const href = featured.link ? `href="${featured.link}" target="_blank"` : 'href="#"';
            html += `<a ${href} class="news-featured" style="text-decoration:none;color:inherit;">
                <div class="featured-img">${imgHtml(featured.img)}<div class="featured-badge">Главное</div></div>
                <div class="featured-content">
                    <div class="news-meta"><span class="news-tag">${featured.tag}</span><span class="news-date">${featured.date}</span></div>
                    <div class="featured-title">${featured.title}</div>
                    <div class="featured-excerpt">${featured.text}</div>
                    <div class="news-readmore">Читать далее</div>
                </div>
            </a>`;
        }
        if (rest.length > 0) {
            html += `<div class="news-section-title">Все новости</div><div class="news-grid">`;
            rest.forEach(n => {
                const href = n.link ? `href="${n.link}" target="_blank"` : 'href="#"';
                html += `<a ${href} class="news-card" style="text-decoration:none;color:inherit;">
                    <div class="card-img">${imgHtml(n.img)}</div>
                    <div class="card-content">
                        <div class="news-meta"><span class="news-tag">${n.tag}</span><span class="news-date">${n.date}</span></div>
                        <div class="card-title">${n.title}</div>
                        <div class="card-excerpt">${n.text}</div>
                        <div class="card-readmore">Подробнее</div>
                    </div>
                </a>`;
            });
            html += "</div>";
        }
        if (!featured && rest.length === 0) {
            html = `<div class="empty-state"><div class="icon">🔍</div><p>Ничего не найдено. Попробуй другой запрос.</p></div>`;
        }
        document.getElementById("newsContainer").innerHTML = html;
    }

    async function loadNews() {
        try {
            const res = await fetch(NEWS_CSV_URL);
            if (!res.ok) throw new Error();
            const text = await res.text();
            const data = parseNewsCSV(text);
            if (!data.length) throw new Error();
            ALL_NEWS = data;
        } catch {
            ALL_NEWS = DEMO_NEWS;
        }
        applyNewsFilters();
    }

    const searchEl = document.getElementById("searchInput");
    const sortEl   = document.getElementById("sortSelect");
    if (searchEl) searchEl.addEventListener("input",  function() { activeSearch = this.value; applyNewsFilters(); });
    if (sortEl)   sortEl.addEventListener("change",   function() { activeSort   = this.value; applyNewsFilters(); });
    document.querySelectorAll(".filter-tag").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".filter-tag").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            activeTag = this.dataset.tag;
            applyNewsFilters();
        });
    });

    loadNews();
}

/* ================================================
   LEADERBOARD PAGE
   ================================================ */
if (document.getElementById("tableContainer")) {
    const SHEET_BASE_URL    = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLzmfGa-hRDaGQLSiXkhp7oA6FeMmvllGr7bMBv8nZVIP2o6abGMzAi4NOxMc6RvI1fSieM06ZoMuQ/pub?gid=REPLACEGID&single=true&output=csv";
    const AUTO_REFRESH_MINUTES = 10;
    let currentGid = "1376391839";
    function getCSVUrl(gid) { return SHEET_BASE_URL.replace("REPLACEGID", gid); }

    const DEMO_DATA = [
        { team:"Natus Vincere", pts:18, matches:6, wins:6, losses:0, wr:100, rd:+22, roster:"s1mple, b1t, niko, Perfecto, electroNic" },
        { team:"Cloud9",        pts:15, matches:6, wins:5, losses:1, wr:83,  rd:+14, roster:"Ax1Le, sh1ro, HObbit, Buster, nafany" },
        { team:"Virtus.pro",    pts:12, matches:6, wins:4, losses:2, wr:67,  rd:+7  },
        { team:"FaZe Clan",     pts:9,  matches:6, wins:3, losses:3, wr:50,  rd:+1  },
        { team:"Team Spirit",   pts:7,  matches:6, wins:2, losses:4, wr:33,  rd:-8  },
        { team:"Heroic",        pts:5,  matches:5, wins:1, losses:4, wr:20,  rd:-11 },
        { team:"ENCE",          pts:3,  matches:6, wins:1, losses:5, wr:17,  rd:-14 },
        { team:"BIG",           pts:1,  matches:5, wins:0, losses:5, wr:0,   rd:-21 },
    ];

    function playerSilhouetteSVG(c) {
        c = c || "#e6b022";
        return `<svg class="player-silhouette" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="32" cy="14" rx="11" ry="12" fill="${c}"/>
            <ellipse cx="32" cy="13.5" rx="9" ry="10" fill="${c}"/>
            <rect x="28" y="23" width="8" height="5" rx="2" fill="${c}"/>
            <path d="M12 60 Q12 38 20 34 L26 32 Q32 30 38 32 L44 34 Q52 38 52 60 Z" fill="${c}"/>
            <path d="M16 60 Q16 40 22 36 L28 33.5 Q32 32 36 33.5 L42 36 Q48 40 48 60 Z" fill="${c}"/>
            <path d="M16 38 Q8 44 7 58 L13 58 Q14 47 20 42 Z" fill="${c}"/>
            <path d="M48 38 Q56 44 57 58 L51 58 Q50 47 44 42 Z" fill="${c}"/>
            <rect x="19" y="56" width="11" height="20" rx="4" fill="${c}"/>
            <rect x="34" y="56" width="11" height="20" rx="4" fill="${c}"/>
            <ellipse cx="32" cy="10" rx="9" ry="4" fill="${c}"/>
        </svg>`;
    }

    function parseLeaderboardCSV(text) {
        const lines   = text.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
        return lines.slice(1).map(line => {
            const vals = line.split(",").map(v => v.trim());
            const obj  = {};
            headers.forEach((h, i) => obj[h] = vals[i] || "");
            return {
                team:    obj["команда"]    || obj["team"]    || "—",
                pts:     parseInt(obj["очки"]       || obj["pts"]     || 0),
                matches: parseInt(obj["матчи"]      || obj["matches"] || 0),
                wins:    parseInt(obj["победы"]     || obj["wins"]    || 0),
                losses:  parseInt(obj["поражения"]  || obj["losses"]  || 0),
                wr:      parseFloat(obj["win_rate"] || obj["wr"]      || "0"),
                rd:      parseInt(obj["round_diff"] || obj["rd"]      || 0),
                avatar:  obj["аватар"]     || obj["avatar"]  || "",
                roster:  obj["состав"]     || obj["roster"]  || "",
            };
        }).filter(r => r.team && r.team !== "—");
    }

    function initials(name) { return name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2); }

    const AVATAR_COLORS = [
        ["#e6b022","#6b4a00"],["#4caf82","#1a4a30"],["#5b8de8","#1a2f6b"],
        ["#e05c5c","#6b1a1a"],["#b07ae6","#3d1a6b"],["#e8a05b","#6b3a1a"],
        ["#5be8d8","#1a4a46"],["#e85ba0","#6b1a40"],
    ];
    function avatarStyle(i) {
        const [c1, c2] = AVATAR_COLORS[i % AVATAR_COLORS.length];
        return `background:linear-gradient(135deg,${c1} 0%,${c2} 100%);color:${i === 0 ? "#000" : "#fff"};`;
    }
    function getAccentColor(i) { return AVATAR_COLORS[i % AVATAR_COLORS.length][0]; }
    function renderAvatar(r, i) {
        if (r.avatar) {
            return `<img src="${r.avatar}" alt="${r.team}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;flex-shrink:0;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="team-avatar" style="${avatarStyle(i)};display:none;">${initials(r.team)}</div>`;
        }
        return `<div class="team-avatar" style="${avatarStyle(i)}">${initials(r.team)}</div>`;
    }

    let _tableData = [];

    function renderTable(data) {
        _tableData = [...data].sort((a, b) => b.pts - a.pts || b.rd - a.rd);
        const rows = _tableData.map((r, i) => {
            const rank      = i + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : "rank-other";
            const rdClass   = r.rd > 0 ? "pos" : r.rd < 0 ? "neg" : "zero";
            const rdText    = r.rd > 0 ? `+${r.rd}` : `${r.rd}`;
            const wr        = Math.min(100, Math.max(0, r.wr));
            const hasRoster = r.roster && r.roster.trim().length > 0;
            return `
            <tr class="${rankClass}${hasRoster ? " has-roster" : ""}" ${hasRoster ? `onclick="openRosterModal(${i})"` : ""}>
                <td><span class="rank-badge">${rank}</span></td>
                <td><div class="team-name">${renderAvatar(r, i)}${r.team}${hasRoster ? '<span class="roster-toggle">▸ состав</span>' : ""}</div></td>
                <td class="num"><span class="points">${r.pts}</span></td>
                <td class="num">${r.matches}</td>
                <td class="num"><div class="wl"><span class="w">${r.wins}W</span><span class="sep">/</span><span class="l">${r.losses}L</span></div></td>
                <td class="wr-cell"><div class="wr-wrap"><div class="wr-bar-bg"><div class="wr-bar-fill" style="width:${wr}%"></div></div><span class="wr-text">${wr}%</span></div></td>
                <td class="num hide-mobile"><span class="round-diff ${rdClass}">${rdText}</span></td>
            </tr>`;
        }).join("");

        document.getElementById("tableContainer").innerHTML = `
            <table><thead><tr>
                <th>#</th><th>Команда</th><th class="num">Очки</th><th class="num">Матчи</th>
                <th class="num">В / П</th><th class="num wr-cell">Win Rate</th><th class="num hide-mobile">Round Diff</th>
            </tr></thead><tbody>${rows}</tbody></table>`;

        setTimeout(() => {
            document.querySelectorAll(".wr-bar-fill").forEach(el => { el.style.transition = "width 1s ease"; });
        }, 50);

        const now = new Date();
        const timeEl = document.getElementById("updateTime");
        if (timeEl) timeEl.textContent = now.toLocaleDateString("ru-RU") + " " + now.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});

        applySearch();
    }

    function applySearch() {
        const searchEl = document.getElementById("teamSearch");
        const q = searchEl ? searchEl.value.toLowerCase().trim() : "";
        const tbody = document.querySelector("#tableContainer tbody");
        if (!tbody) return;
        let visible = 0;
        tbody.querySelectorAll("tr:not(.no-results-row)").forEach(tr => {
            const nameEl = tr.querySelector(".team-name");
            if (!nameEl) { tr.style.display = ""; return; }
            const text = nameEl.textContent.toLowerCase();
            const show = q === "" || text.includes(q);
            tr.style.display = show ? "" : "none";
            if (show) visible++;
        });
        let noRow = tbody.querySelector(".no-results-row");
        if (visible === 0 && q !== "") {
            if (!noRow) { noRow = document.createElement("tr"); noRow.className = "no-results-row"; noRow.innerHTML = `<td colspan="7" style="text-align:center;padding:30px;color:#5c6b7f;">😕 Команда «${q}» не найдена</td>`; tbody.appendChild(noRow); }
            else { noRow.querySelector("td").textContent = `😕 Команда «${q}» не найдена`; noRow.style.display = ""; }
        } else if (noRow) { noRow.style.display = "none"; }
    }

    window.openRosterModal = function(idx) {
        const r = _tableData[idx];
        if (!r) return;
        const players     = (r.roster || "").replace(/"/g, "").split(/[,;]/).map(p => p.trim()).filter(Boolean);
        const accentColor = getAccentColor(idx);
        const avatarEl    = document.getElementById("rosterModalAvatar");
        if (avatarEl) {
            avatarEl.style.cssText = avatarStyle(idx);
            avatarEl.innerHTML = r.avatar
                ? `<img src="${r.avatar}" alt="${r.team}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentNode.textContent='${initials(r.team)}'">` 
                : initials(r.team);
        }
        const nameEl = document.getElementById("rosterModalTeamName");
        if (nameEl) nameEl.textContent = r.team;
        const listEl = document.getElementById("rosterPlayersList");
        if (listEl) {
            listEl.innerHTML = players.length === 0
                ? `<div class="roster-empty-msg">Состав не указан</div>`
                : players.map(nick => `<div class="player-card">${playerSilhouetteSVG(accentColor)}<div class="player-nick">${nick}</div></div>`).join("");
        }
        const modal = document.getElementById("rosterModal");
        if (modal) { modal.classList.add("open"); document.body.style.overflow = "hidden"; }
    };

    function closeRosterModal() {
        const modal = document.getElementById("rosterModal");
        if (modal) { modal.classList.remove("open"); document.body.style.overflow = ""; }
    }

    const rosterCloseBtn = document.getElementById("rosterModalClose");
    const rosterModal    = document.getElementById("rosterModal");
    if (rosterCloseBtn) rosterCloseBtn.addEventListener("click", closeRosterModal);
    if (rosterModal)    rosterModal.addEventListener("click", function(e) { if (e.target === this) closeRosterModal(); });

    function showError(msg) {
        document.getElementById("tableContainer").innerHTML = `<div class="state-box"><div class="icon">⚠️</div><p>${msg}</p></div>`;
    }

    async function loadData() {
        const container = document.getElementById("tableContainer");
        if (container && !container.querySelector("table")) {
            container.innerHTML = `<div class="state-box"><div class="spinner"></div><p>Загрузка данных...</p></div>`;
        }
        try {
            const res = await fetch(getCSVUrl(currentGid));
            if (!res.ok) throw new Error("HTTP " + res.status);
            const text = await res.text();
            const data = parseLeaderboardCSV(text);
            if (!data.length) throw new Error("Таблица пуста");
            renderTable(data);
        } catch (e) {
            if (currentGid === "1376391839") {
                renderTable(DEMO_DATA);
                const timeEl = document.getElementById("updateTime");
                if (timeEl) timeEl.textContent = "демо-данные";
            } else {
                showError("Не удалось загрузить данные архивного сезона.<br><small style='color:#5c6b7f'>(" + e.message + ")</small>");
            }
        }
    }

    const teamSearchEl  = document.getElementById("teamSearch");
    const seasonSel     = document.getElementById("seasonSelect");
    const ratingBtn     = document.getElementById("ratingBtn");
    const modalCloseBtn = document.getElementById("modalClose");
    const ratingModal   = document.getElementById("ratingModal");

    if (teamSearchEl) teamSearchEl.addEventListener("input", applySearch);

    if (seasonSel) {
        seasonSel.addEventListener("change", function() {
            currentGid = this.value;
            const labelEl = document.querySelector(".season-label");
            if (labelEl) labelEl.textContent = this.options[this.selectedIndex].text;
            const searchEl = document.getElementById("teamSearch");
            if (searchEl) searchEl.value = "";
            countdown = AUTO_REFRESH_MINUTES * 60;
            loadData();
        });
    }

    if (ratingBtn)     ratingBtn.addEventListener("click",     () => { if (ratingModal) { ratingModal.classList.add("open"); document.body.style.overflow = "hidden"; } });
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", () => { if (ratingModal) { ratingModal.classList.remove("open"); document.body.style.overflow = ""; } });
    if (ratingModal)   ratingModal.addEventListener("click",   (e) => { if (e.target === e.currentTarget) { ratingModal.classList.remove("open"); document.body.style.overflow = ""; } });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeRosterModal(); if (ratingModal) { ratingModal.classList.remove("open"); document.body.style.overflow = ""; } } });

    let countdown = AUTO_REFRESH_MINUTES * 60;
    function updateCountdown() {
        const min = Math.floor(countdown / 60);
        const sec = String(countdown % 60).padStart(2, "0");
        const el  = document.getElementById("refreshCountdown");
        if (el) el.textContent = `Следующее обновление через ${min}:${sec}`;
        countdown--;
        if (countdown < 0) { countdown = AUTO_REFRESH_MINUTES * 60; loadData(); }
    }

    loadData();
    setInterval(updateCountdown, 1000);
    updateCountdown();
}

/* ================================================
   JOIN PAGE
   ================================================ */
if (document.getElementById("joinForm")) {
    let _currentUser = null;

    async function initJoinPage() {
        const user   = await checkAuth();
        _currentUser = user;

        if (!user) {
            const gate = document.getElementById("authGate");
            if (gate) gate.style.display = "block";
            return;
        }

        const nicknameEl = document.getElementById("nickname");
        if (nicknameEl) nicknameEl.value = user.displayName;

        if (!user.team) {
            const banner = document.getElementById("noTeamBanner");
            if (banner) banner.style.display = "block";
            return;
        }

        renderTeamInfoCard(user.team);
        const progress = document.getElementById("progressWrap");
        const form     = document.getElementById("joinForm");
        if (progress) progress.style.display = "flex";
        if (form)     form.style.display     = "block";
    }

    function renderTeamInfoCard(team) {
        const card = document.getElementById("teamInfoCard");
        if (!card) return;
        card.innerHTML = `
            <div class="team-card">
                ${team.logo
                    ? `<img src="${team.logo}" class="team-card-logo" alt="${team.name}" onerror="this.style.display='none'">`
                    : `<div class="team-card-logo-placeholder">[${team.tag}]</div>`}
                <div class="team-card-info">
                    <div class="team-card-name">[${team.tag}] ${team.name}</div>
                    <div class="team-card-sub">Ваша команда · Капитан</div>
                </div>
            </div>`;
    }

    window.openCreateTeamModal = function() {
        const modal = document.getElementById("createTeamModal");
        if (!modal) return;
        modal.style.display = "flex";
        document.body.style.overflow = "hidden";
        const errEl = document.getElementById("ctError");
        if (errEl) errEl.style.display = "none";
        ["ctName","ctTag","ctLogo"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    };

    window.closeCreateTeamModal = function() {
        const modal = document.getElementById("createTeamModal");
        if (modal) modal.style.display = "none";
        document.body.style.overflow = "";
    };

    const createModal = document.getElementById("createTeamModal");
    if (createModal) {
        createModal.addEventListener("click", function(e) { if (e.target === this) closeCreateTeamModal(); });
    }
    document.addEventListener("keydown", function(e) {
        const modal = document.getElementById("createTeamModal");
        if (e.key === "Escape" && modal && modal.style.display === "flex") closeCreateTeamModal();
    });

    window.submitCreateTeam = async function() {
        const nameEl  = document.getElementById("ctName");
        const tagEl   = document.getElementById("ctTag");
        const logoEl  = document.getElementById("ctLogo");
        const errEl   = document.getElementById("ctError");
        const btn     = document.getElementById("ctSubmitBtn");
        const name    = nameEl ? nameEl.value.trim() : "";
        const tag     = tagEl  ? tagEl.value.trim()  : "";
        const logo    = logoEl ? logoEl.value.trim()  : "";

        if (errEl) errEl.style.display = "none";
        if (!name || !tag) { if (errEl) { errEl.textContent = "Заполните название и тег команды."; errEl.style.display = "block"; } return; }

        if (btn) { btn.disabled = true; btn.textContent = "Создание..."; }

        try {
            const res  = await fetch("/api/teams", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,tag,logo}) });
            const data = await res.json();
            if (!res.ok) {
                if (errEl) { errEl.textContent = data.error || "Ошибка сервера."; errEl.style.display = "block"; }
                if (btn)   { btn.disabled = false; btn.textContent = "Создать команду"; }
                return;
            }
            closeCreateTeamModal();
            const banner = document.getElementById("noTeamBanner");
            if (banner) banner.style.display = "none";
            renderTeamInfoCard(data.team);
            const progress = document.getElementById("progressWrap");
            const form     = document.getElementById("joinForm");
            if (progress) progress.style.display = "flex";
            if (form)     form.style.display     = "block";
            if (_currentUser) _currentUser.team = data.team;
            const teamBadge = document.getElementById("headerTeamBadge");
            if (teamBadge) { teamBadge.textContent = `[${data.team.tag}] ${data.team.name}`; teamBadge.style.display = "inline-flex"; }
        } catch {
            if (errEl) { errEl.textContent = "Ошибка соединения."; errEl.style.display = "block"; }
            if (btn)   { btn.disabled = false; btn.textContent = "Создать команду"; }
        }
    };

    function updateProgress() {
        [1,2,3,4].forEach(n => {
            const section = document.querySelector(`.form-section[data-section="${n}"]`);
            if (!section) return;
            const required = section.querySelectorAll("[required]");
            const filled   = [...required].every(el => {
                if (el.type === "checkbox") return el.checked;
                if (el.type === "radio")    return document.querySelector(`input[name="${el.name}"]:checked`);
                return el.value.trim() !== "";
            });
            const ps = document.getElementById("ps" + n);
            const pl = document.getElementById("pl" + n);
            if (!ps) return;
            if (filled) { ps.classList.remove("active"); ps.classList.add("done"); const c = ps.querySelector(".progress-step-circle"); if (c) c.textContent = "✓"; if (pl) pl.classList.add("done"); }
            else        { ps.classList.remove("done"); const c = ps.querySelector(".progress-step-circle"); if (c) c.textContent = n; if (pl) pl.classList.remove("done"); }
        });
        let found = false;
        [1,2,3,4].forEach(n => {
            const ps = document.getElementById("ps" + n);
            if (!ps) return;
            if (!found && !ps.classList.contains("done")) { ps.classList.add("active"); found = true; }
            else ps.classList.remove("active");
        });
    }

    const joinForm = document.getElementById("joinForm");
    if (joinForm) {
        joinForm.addEventListener("input",  updateProgress);
        joinForm.addEventListener("change", updateProgress);
        joinForm.addEventListener("submit", async function(e) {
            e.preventDefault();
            if (!this.checkValidity()) {
                const first = this.querySelector(":invalid");
                if (first) { first.focus(); first.scrollIntoView({behavior:"smooth",block:"center"}); }
                return;
            }
            const btn = document.getElementById("submitBtn");
            if (btn) { btn.disabled = true; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="width:18px;height:18px;stroke:#000;stroke-width:2.5;animation:spin 0.7s linear infinite"><circle cx="12" cy="12" r="9" stroke-dasharray="40" stroke-dashoffset="15"/></svg> Отправка...`; }
            try {
                const res  = await fetch("/api/applications", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ hoursInCS2:document.getElementById("hours").value, faceitLevel:document.getElementById("faceit_level").value, experience:document.getElementById("experience").value, contacts:document.getElementById("contacts").value }) });
                const data = await res.json();
                if (res.ok && data.ok) {
                    this.style.display = "none";
                    const pw = document.getElementById("progressWrap"); if (pw) pw.style.display = "none";
                    const sm = document.getElementById("successMsg");  if (sm) sm.style.display = "block";
                    window.scrollTo({top:0, behavior:"smooth"});
                } else {
                    alert(data.error || "Не удалось отправить заявку.");
                    if (btn) { btn.disabled = false; btn.innerHTML = "Отправить заявку"; }
                }
            } catch {
                alert("Ошибка соединения.");
                if (btn) { btn.disabled = false; btn.innerHTML = "Отправить заявку"; }
            }
        });
    }

    initJoinPage();
}

/* ================================================
   ANTI-CLONE
   ================================================ */
(function() {
    const isOriginal = window.location.hostname === "cs2-league-hub.vercel.app" || window.location.hostname === "localhost";
    if (!isOriginal) {
        console.error("ATTENTION: Cloned version detected.");
        window.addEventListener("load", () => {
            setTimeout(() => {
                const fp = document.querySelector("footer p");
                if (fp) { const m = document.createElement("span"); m.style.cssText = "color:#ff4444;font-weight:bold;margin-left:10px;"; m.innerHTML = "| FAKE SITE (Original by Keseneir)"; fp.appendChild(m); }
            }, 3000);
        });
    }
})();

/* ================================================
   PROFILE PAGE
   ================================================ */
if (document.getElementById("profileContent")) {

    let _profileData = null;
    let _inviteTargetId = null;

    // ─── УТИЛИТЫ ──────────────────────────────────────────────────────────────

    function avatarEl(src, name, cls) {
        if (src) return `<img src="${src}" alt="${name}" class="${cls}" onerror="this.style.display='none'">`;
        const initials = (name || "?").trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
        const ph = cls.includes("member") ? "member-avatar-placeholder" : "friend-avatar-placeholder";
        return `<div class="${ph}">${initials}</div>`;
    }

    function showToast(msg, type) {
        let t = document.getElementById("_toast");
        if (!t) { t = document.createElement("div"); t.id = "_toast"; t.style.cssText = "position:fixed;bottom:28px;right:28px;z-index:9999;padding:12px 20px;border-radius:10px;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;pointer-events:none;opacity:0;transition:opacity 0.3s;"; document.body.appendChild(t); }
        t.textContent = msg;
        t.style.background = type === "ok" ? "rgba(76,175,130,0.95)" : "rgba(224,92,92,0.95)";
        t.style.color = "#fff";
        t.style.opacity = "1";
        clearTimeout(t._timer);
        t._timer = setTimeout(() => { t.style.opacity = "0"; }, 3000);
    }

    function showModalError(elId, msg) {
        const el = document.getElementById(elId);
        if (!el) return;
        el.textContent = msg;
        el.style.display = "block";
    }
    function hideModalError(elId) {
        const el = document.getElementById(elId);
        if (el) el.style.display = "none";
    }

    window.closeModal = function(id) {
        const el = document.getElementById(id);
        if (el) el.classList.add("p-modal-hidden");
        document.body.style.overflow = "";
    };

    function openModal(id) {
        const el = document.getElementById(id);
        if (el) { el.classList.remove("p-modal-hidden"); document.body.style.overflow = "hidden"; }
    }

    // ─── ЗАГРУЗКА ПРОФИЛЯ ─────────────────────────────────────────────────────

    async function loadProfile() {
        try {
            const res = await fetch("/api/profile");
            if (res.status === 401) {
                document.getElementById("profileLoading").style.display = "none";
                document.getElementById("authGateProfile").style.display = "block";
                return;
            }
            _profileData = await res.json();
            renderProfile(_profileData);
        } catch {
            document.getElementById("profileLoading").innerHTML =
                '<p style="color:var(--text-gray);text-align:center;padding:40px;">Не удалось загрузить профиль.</p>';
        }
    }

    function renderProfile(d) {
        document.getElementById("profileLoading").style.display  = "none";
        document.getElementById("profileContent").style.display  = "block";

        document.getElementById("profileAvatar").src              = d.avatar || "";
        document.getElementById("profileDisplayName").textContent = d.displayName || "—";
        document.getElementById("profilePointsBadge").textContent = (d.points || 0) + " очков";
        document.getElementById("profileRankBadge").textContent   = d.rank || "Unranked";

        if (d.team) {
            const tag = document.getElementById("profileTeamTagBadge");
            tag.textContent   = `[${d.team.tag}] ${d.team.name}`;
            tag.style.display = "inline-flex";
        }

        renderTeamTab(d);
        renderFriendsTab(d);
        renderNotifsTab(d);

        updateBadges(d);
    }

    // ─── ТАБ: КОМАНДА ─────────────────────────────────────────────────────────

    function renderTeamTab(d) {
        const noTeam  = document.getElementById("noTeamState");
        const content = document.getElementById("teamContent");
        if (!d.team) {
            noTeam.style.display  = "block";
            content.style.display = "none";
            return;
        }
        noTeam.style.display  = "none";
        content.style.display = "block";

        const team = d.team;
        const logoEl = document.getElementById("teamLogoEl");
        if (team.logo) {
            logoEl.innerHTML = `<img src="${team.logo}" alt="${team.name}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" onerror="this.style.display='none'">`;
        } else {
            logoEl.textContent = team.tag || "?";
        }
        document.getElementById("teamNameEl").textContent = team.name;
        document.getElementById("teamTagEl").textContent  = "[" + team.tag + "]";

        const mainList   = document.getElementById("mainRosterList");
        const subList    = document.getElementById("subRosterList");
        const mainCount  = document.getElementById("mainCountLabel");
        const subCount   = document.getElementById("subCountLabel");
        const captainId  = team.captainId?._id?.toString() || team.captainId?.toString();

        const members = team.members || [];
        const subs    = team.subs    || [];
        mainCount.textContent = members.length + "/5";
        subCount.textContent  = subs.length    + "/5";

        mainList.innerHTML = members.length === 0
            ? `<div class="roster-empty-hint">Состав пуст</div>`
            : members.map(m => renderMemberRow(m, captainId, d)).join("");

        subList.innerHTML = subs.length === 0
            ? `<div class="roster-empty-hint">Нет замен</div>`
            : subs.map(m => renderMemberRow(m, captainId, d)).join("");

        const captainActionsEl = document.getElementById("captainActions");
        const memberActionsEl  = document.getElementById("memberActions");
        if (d.isCaptain) {
            captainActionsEl.style.display = "flex";
            memberActionsEl.style.display  = "none";
        } else {
            captainActionsEl.style.display = "none";
            memberActionsEl.style.display  = "flex";
        }
    }

    function renderMemberRow(m, captainId, d) {
        const isCap   = m._id?.toString() === captainId;
        const isMe    = m._id?.toString() === d._id?.toString();
        const myCap   = d.isCaptain;
        const mId     = m._id?.toString();

        let actions = "";
        if (myCap && !isMe) {
            actions += `<button class="btn-member-action btn-member-kick" onclick="kickMember('${mId}','${m.displayName}')">Кик</button>`;
            actions += `<button class="btn-member-action" onclick="transferCaptain('${mId}','${m.displayName}')">👑 Капитан</button>`;
        }

        return `<div class="member-row">
            ${avatarEl(m.avatar, m.displayName, "member-avatar")}
            <span class="member-name">${m.displayName || "Игрок"}${isCap ? '<span class="captain-crown" title="Капитан">👑</span>' : ""}</span>
            ${actions ? `<div class="member-actions">${actions}</div>` : ""}
        </div>`;
    }

    // ─── ТАБ: ДРУЗЬЯ ──────────────────────────────────────────────────────────

    function renderFriendsTab(d) {
        const friends  = d.friends        || [];
        const requests = d.friendRequests || [];
        const el       = document.getElementById("friendsList");
        let html = "";

        if (requests.length > 0) {
            html += `<div class="section-label-sm">Заявки в друзья</div>`;
            html += `<div class="search-results-box">${requests.map(r => renderFriendRequestRow(r)).join("")}</div>`;
        }

        if (friends.length > 0) {
            html += `<div class="section-label-sm">Друзья (${friends.length})</div>`;
            html += `<div class="search-results-box">${friends.map(f => renderFriendRow(f, d)).join("")}</div>`;
        } else if (requests.length === 0) {
            html = `<div class="notif-empty">👥 У вас пока нет друзей. Найдите игрока выше!</div>`;
        }

        el.innerHTML = html;
    }

    function renderFriendRequestRow(r) {
        const from = r.from;
        if (!from) return "";
        return `<div class="friend-row">
            ${avatarEl(from.avatar, from.displayName, "friend-avatar")}
            <div class="friend-info">
                <div class="friend-name">${from.displayName}</div>
                <div class="friend-sub">Хочет добавить вас в друзья</div>
            </div>
            <div class="friend-actions">
                <button class="btn-fr btn-fr-accept" onclick="acceptFriend('${from._id}')">✓ Принять</button>
                <button class="btn-fr btn-fr-reject" onclick="rejectFriend('${from._id}')">✕</button>
            </div>
        </div>`;
    }

    function renderFriendRow(f, d) {
        const fId = f._id?.toString();
        const canInvite = d.isCaptain && !f.teamId;
        return `<div class="friend-row">
            ${avatarEl(f.avatar, f.displayName, "friend-avatar")}
            <div class="friend-info">
                <div class="friend-name">${f.displayName}</div>
                <div class="friend-sub">${f.teamId ? "Уже в команде" : "Свободен"}</div>
            </div>
            <div class="friend-actions">
                ${canInvite ? `<button class="btn-fr btn-fr-invite" onclick="openInviteModal('${fId}','${f.displayName.replace(/'/g,"\\'")}')">⚔️ Пригласить</button>` : ""}
                <button class="btn-fr btn-fr-remove" onclick="removeFriend('${fId}','${f.displayName.replace(/'/g,"\\'")}')">Удалить</button>
            </div>
        </div>`;
    }

    // ─── ТАБ: УВЕДОМЛЕНИЯ ─────────────────────────────────────────────────────

    function renderNotifsTab(d) {
        const el       = document.getElementById("notifsList");
        const requests = d.friendRequests || [];
        const invites  = d.teamInvites    || [];
        let html = "";

        if (requests.length > 0) {
            html += `<div class="notif-block">
                <div class="notif-block-title">📩 Заявки в друзья</div>
                ${requests.map(r => renderFriendRequestRow(r)).join("")}
            </div>`;
        }

        if (invites.length > 0) {
            html += `<div class="notif-block">
                <div class="notif-block-title">⚔️ Приглашения в команду</div>
                ${invites.map(inv => renderTeamInviteRow(inv)).join("")}
            </div>`;
        }

        if (!html) {
            html = `<div class="notif-empty">🔔 Уведомлений нет</div>`;
        }
        el.innerHTML = html;
    }

    function renderTeamInviteRow(inv) {
        const team = inv.teamId;
        const from = inv.from;
        const role = inv.role === "sub" ? "Замена" : "Основной состав";
        if (!team) return "";
        return `<div class="friend-row">
            <div class="friend-avatar-placeholder" style="border-radius:8px;background:var(--accent-dim);color:var(--accent);">${(team.tag || "?").slice(0,2)}</div>
            <div class="friend-info">
                <div class="friend-name">[${team.tag}] ${team.name}</div>
                <div class="friend-sub">Роль: ${role} · от ${from?.displayName || "?"}</div>
            </div>
            <div class="friend-actions">
                <button class="btn-fr btn-fr-accept" onclick="acceptTeamInvite('${team._id}')">✓ Принять</button>
                <button class="btn-fr btn-fr-reject" onclick="rejectTeamInvite('${team._id}')">✕ Отказ</button>
            </div>
        </div>`;
    }

    // ─── ЗНАЧКИ ───────────────────────────────────────────────────────────────

    function updateBadges(d) {
        const frCount = (d.friendRequests || []).length;
        const tiCount = (d.teamInvites    || []).length;
        const total   = frCount + tiCount;

        const frBadge = document.getElementById("friendReqBadge");
        if (frBadge) { frBadge.textContent = frCount; frBadge.style.display = frCount > 0 ? "inline-flex" : "none"; }

        const nBadge  = document.getElementById("notifsBadge");
        if (nBadge)  { nBadge.textContent  = total;   nBadge.style.display  = total  > 0 ? "inline-flex" : "none"; }
    }

    // ─── ПОИСК ИГРОКОВ ────────────────────────────────────────────────────────

    window.searchFriendsHandler = async function() {
        const q = (document.getElementById("friendSearchInput").value || "").trim();
        if (q.length < 2) { showToast("Введите минимум 2 символа", "err"); return; }
        const box = document.getElementById("searchResultsBox");
        box.style.display = "block";
        box.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-gray);font-size:14px;">Поиск...</div>`;
        try {
            const res     = await fetch("/api/users/search?q=" + encodeURIComponent(q));
            const results = await res.json();
            if (!results.length) { box.innerHTML = `<div style="padding:20px;text-align:center;color:#5c6b7f;font-size:14px;">Игрок не найден</div>`; return; }
            box.innerHTML = results.map(u => renderSearchResult(u)).join("");
        } catch { box.innerHTML = `<div style="padding:20px;text-align:center;color:#e05c5c;">Ошибка поиска</div>`; }
    };

    function renderSearchResult(u) {
        let btn = "";
        if (u.isFriend)         btn = `<span class="btn-fr btn-fr-pending">✓ Друг</span>`;
        else if (u.iRequestedThem) btn = `<span class="btn-fr btn-fr-pending">Отправлено</span>`;
        else if (u.requestedMe) btn = `<button class="btn-fr btn-fr-accept" onclick="acceptFriend('${u._id}')">✓ Принять</button>`;
        else                    btn = `<button class="btn-fr btn-fr-add" onclick="addFriend('${u._id}', this)">+ Добавить</button>`;

        return `<div class="friend-row">
            ${avatarEl(u.avatar, u.displayName, "friend-avatar")}
            <div class="friend-info">
                <div class="friend-name">${u.displayName}</div>
                <div class="friend-sub">Steam ID: ${u.steamId}</div>
            </div>
            <div class="friend-actions">${btn}</div>
        </div>`;
    }

    // ─── ДЕЙСТВИЯ: ДРУЗЬЯ ─────────────────────────────────────────────────────

    window.addFriend = async function(userId, btn) {
        if (btn) { btn.disabled = true; btn.textContent = "..."; }
        try {
            const res = await fetch(`/api/friends/request/${userId}`, { method: "POST" });
            const d   = await res.json();
            if (!res.ok) { showToast(d.error || "Ошибка", "err"); if (btn) { btn.disabled = false; btn.textContent = "+ Добавить"; } return; }
            if (d.autoAccepted) { showToast("Теперь вы друзья!", "ok"); await refreshProfile(); }
            else { showToast("Заявка отправлена!", "ok"); if (btn) { btn.disabled = true; btn.textContent = "Отправлено"; btn.className = "btn-fr btn-fr-pending"; } }
        } catch { showToast("Ошибка соединения", "err"); if (btn) { btn.disabled = false; btn.textContent = "+ Добавить"; } }
    };

    window.acceptFriend = async function(userId) {
        try {
            const res = await fetch(`/api/friends/accept/${userId}`, { method: "PATCH" });
            if (!res.ok) { const d = await res.json(); showToast(d.error || "Ошибка", "err"); return; }
            showToast("Друг добавлен!", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    window.rejectFriend = async function(userId) {
        try {
            await fetch(`/api/friends/reject/${userId}`, { method: "PATCH" });
            showToast("Заявка отклонена", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    window.removeFriend = async function(userId, name) {
        if (!confirm(`Удалить ${name} из друзей?`)) return;
        try {
            const res = await fetch(`/api/friends/${userId}`, { method: "DELETE" });
            if (!res.ok) { const d = await res.json(); showToast(d.error || "Ошибка", "err"); return; }
            showToast("Удалено из друзей", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    // ─── ДЕЙСТВИЯ: ПРИГЛАШЕНИЯ В КОМАНДУ ─────────────────────────────────────

    window.openInviteModal = function(userId, name) {
        _inviteTargetId = userId;
        document.getElementById("inviteTargetName").textContent = name;
        hideModalError("inviteError");
        openModal("inviteModal");
    };
    window.closeInviteModal = function() { closeModal("inviteModal"); _inviteTargetId = null; };

    window.sendTeamInvite = async function(role) {
        if (!_inviteTargetId) return;
        hideModalError("inviteError");
        try {
            const res = await fetch(`/api/team/invite/${_inviteTargetId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role })
            });
            const d = await res.json();
            if (!res.ok) { showModalError("inviteError", d.error || "Ошибка"); return; }
            closeModal("inviteModal");
            showToast("Приглашение отправлено!", "ok");
        } catch { showModalError("inviteError", "Ошибка соединения"); }
    };

    window.acceptTeamInvite = async function(teamId) {
        try {
            const res = await fetch(`/api/team/invite/accept/${teamId}`, { method: "PATCH" });
            const d   = await res.json();
            if (!res.ok) { showToast(d.error || "Ошибка", "err"); return; }
            showToast("Вы вступили в команду!", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    window.rejectTeamInvite = async function(teamId) {
        try {
            await fetch(`/api/team/invite/reject/${teamId}`, { method: "PATCH" });
            showToast("Приглашение отклонено", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    // ─── ДЕЙСТВИЯ: УПРАВЛЕНИЕ КОМАНДОЙ ───────────────────────────────────────

    window.kickMember = async function(userId, name) {
        if (!confirm(`Исключить ${name} из команды?`)) return;
        try {
            const res = await fetch(`/api/team/member/${userId}`, { method: "DELETE" });
            const d   = await res.json();
            if (!res.ok) { showToast(d.error || "Ошибка", "err"); return; }
            showToast(name + " исключён", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    window.transferCaptain = async function(userId, name) {
        if (!confirm(`Передать капитанство игроку ${name}?`)) return;
        try {
            const res = await fetch(`/api/team/captain/${userId}`, { method: "PATCH" });
            const d   = await res.json();
            if (!res.ok) { showToast(d.error || "Ошибка", "err"); return; }
            showToast("Капитанство передано", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    // Настройки команды
    window.openTeamSettingsModal = function() {
        if (!_profileData || !_profileData.team) return;
        document.getElementById("tsName").value  = _profileData.team.name || "";
        document.getElementById("tsTag").value   = _profileData.team.tag  || "";
        document.getElementById("tsLogo").value  = _profileData.team.logo || "";
        hideModalError("tsError");
        openModal("teamSettingsModal");
    };
    window.closeTeamSettingsModal = function() { closeModal("teamSettingsModal"); };

    window.saveTeamSettings = async function() {
        const name = document.getElementById("tsName").value.trim();
        const tag  = document.getElementById("tsTag").value.trim();
        const logo = document.getElementById("tsLogo").value.trim();
        hideModalError("tsError");
        if (!name || !tag) { showModalError("tsError", "Название и тег обязательны"); return; }
        const btn = document.getElementById("tsSaveBtn");
        if (btn) { btn.disabled = true; btn.textContent = "Сохранение..."; }
        try {
            const res = await fetch("/api/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, tag, logo }) });
            const d   = await res.json();
            if (!res.ok) { showModalError("tsError", d.error || "Ошибка"); if (btn) { btn.disabled = false; btn.textContent = "Сохранить"; } return; }
            closeModal("teamSettingsModal");
            showToast("Настройки сохранены!", "ok");
            await refreshProfile();
        } catch { showModalError("tsError", "Ошибка соединения"); if (btn) { btn.disabled = false; btn.textContent = "Сохранить"; } }
    };

    window.confirmDeleteTeam = function() { openModal("confirmDeleteModal"); };

    window.doDeleteTeam = async function() {
        const btn = document.getElementById("confirmDeleteBtn");
        if (btn) { btn.disabled = true; btn.textContent = "Удаление..."; }
        try {
            const res = await fetch("/api/team", { method: "DELETE" });
            const d   = await res.json();
            if (!res.ok) { showToast(d.error || "Ошибка", "err"); if (btn) { btn.disabled = false; btn.textContent = "💀 Распустить"; } return; }
            closeModal("confirmDeleteModal");
            showToast("Команда распущена", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    window.confirmLeaveTeam = function() { openModal("confirmLeaveModal"); };

    window.doLeaveTeam = async function() {
        try {
            const res = await fetch("/api/team/leave", { method: "POST" });
            const d   = await res.json();
            if (!res.ok) { showToast(d.error || "Ошибка", "err"); return; }
            closeModal("confirmLeaveModal");
            showToast("Вы покинули команду", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    // ─── ОБНОВЛЕНИЕ БЕЗ ПЕРЕЗАГРУЗКИ ─────────────────────────────────────────

    async function refreshProfile() {
        try {
            const res = await fetch("/api/profile");
            _profileData = await res.json();
            renderProfile(_profileData);
        } catch {}
    }

    // ─── ТАБЫ ─────────────────────────────────────────────────────────────────

    document.querySelectorAll(".profile-tab-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".profile-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".profile-tab-content").forEach(c => c.classList.remove("active"));
            this.classList.add("active");
            const tab = document.getElementById("tab-" + this.dataset.tab);
            if (tab) tab.classList.add("active");
        });
    });

    // Закрытие модалок по клику вне / Escape
    document.querySelectorAll(".p-modal-overlay").forEach(overlay => {
        overlay.addEventListener("click", function(e) {
            if (e.target === this) closeModal(this.id);
        });
    });
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") {
            document.querySelectorAll(".p-modal-overlay:not(.p-modal-hidden)").forEach(m => closeModal(m.id));
        }
    });

    // ─── ЗАПУСК ───────────────────────────────────────────────────────────────
    loadProfile();
}
