require('dotenv').config();
console.log(`
%c ██████╗ ██████╗██████╗ ██╗     ██╗  ██╗
%c██╔════╝██╔════╝╚════██╗██║     ██║  ██║
%c██║     ███████╗ █████╔╝██║     ███████║
%c██║     ╚════██║██╔═══╝ ██║     ██╔══██║
%c╚██████╗██████ ║███████╗███████╗██║  ██║
%c ╚═════╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝
%c Developed by Keseneir | CS2 League Hub 2026
%c 
%cВНИМАНИЕ: Копирование кода без разрешения автора запрещено. 
%cВсе права защищены.
`,
'color: #ffcc00; font-weight: bold;',
'color: #ffcc00; font-weight: bold;',
'color: #ffcc00; font-weight: bold;',
'color: #ffcc00; font-weight: bold;',
'color: #ffcc00; font-weight: bold;',
'color: #ffcc00; font-weight: bold;',
'color: #ffffff; font-weight: bold; font-style: italic;',
'color: transparent;',
'color: #ff4444; font-size: 12px; font-family: sans-serif;',
'color: #888888; font-size: 11px; font-family: sans-serif;'
);

/* ================================================
   AUTH — подключается на всех страницах
   ================================================ */
async function checkAuth() {
    try {
        const res  = await fetch("/api/user");
        const user = await res.json();

        const btnLogin   = document.getElementById("btnSteamLogin");
        const profile    = document.getElementById("headerUserProfile");
        const avatar     = document.getElementById("headerAvatar");
        const name       = document.getElementById("headerName");
        const points     = document.getElementById("headerPoints");
        const teamBadge  = document.getElementById("headerTeamBadge");
        const btnApply   = document.getElementById("btnApply");
        const heroBtnApply = document.getElementById("heroBtnApply");

        if (user) {
            if (btnLogin)  btnLogin.style.display   = "none";
            if (profile)   profile.style.display    = "flex";
            if (avatar)    avatar.src               = user.avatar;
            if (name)      name.textContent         = user.displayName;
            if (points)    points.textContent       = user.points + " очков";

            if (teamBadge && user.team) {
                teamBadge.textContent  = `[${user.team.tag}] ${user.team.name}`;
                teamBadge.style.display = "inline-flex";
            }

            if (btnApply) {
                btnApply.href = "/join.html";
                btnApply.removeAttribute("target");
            }
            if (heroBtnApply) {
                heroBtnApply.href = "/join.html";
                heroBtnApply.removeAttribute("target");
            }
        } else {
            if (btnLogin)  btnLogin.style.display  = "inline-flex";
            if (profile)   profile.style.display   = "none";
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
if (document.getElementById('widgetBody')) {
    const WIDGET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLzmfGa-hRDaGQLSiXkhp7oA6FeMmvllGr7bMBv8nZVIP2o6abGMzAi4NOxMc6RvI1fSieM06ZoMuQ/pub?gid=1376391839&single=true&output=csv";

    const DEMO_TOP3 = [
        { team: "Natus Vincere", pts: 18, wins: 6, losses: 0 },
        { team: "Cloud9",        pts: 15, wins: 5, losses: 1 },
        { team: "Virtus.pro",    pts: 12, wins: 4, losses: 2 },
    ];
    const RANK_CLASS = ["r1", "r2", "r3"];

    function parseWidgetCSV(text) {
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
        return lines.slice(1).map(line => {
            const vals = line.split(",").map(v => v.trim());
            const obj = {};
            headers.forEach((h, i) => obj[h] = vals[i] || "");
            return {
                team:   obj["команда"]    || obj["team"]    || "—",
                pts:    parseInt(obj["очки"]      || obj["pts"]     || 0),
                wins:   parseInt(obj["победы"]    || obj["wins"]    || 0),
                losses: parseInt(obj["поражения"] || obj["losses"]  || 0),
                rd:     parseInt(obj["round_diff"] || obj["rd"]     || 0),
                avatar: obj["аватар"] || obj["avatar"] || "",
            };
        }).filter(r => r.team && r.team !== "—");
    }

    function renderWidget(data) {
        const top3 = [...data].sort((a, b) => b.pts - a.pts || b.rd - a.rd).slice(0, 3);
        const html = top3.map((r, i) => `
            <div class="widget-row">
                <div class="widget-rank ${RANK_CLASS[i]}">${i + 1}</div>
                ${r.avatar ? `<img src="${r.avatar}" alt="${r.team}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : ''}
                <div class="widget-team-name">${r.team}</div>
                <div class="widget-stats">
                    <div class="widget-pts">${r.pts} <span style="font-size:10px;font-weight:600;color:var(--text-gray)">ОЧК</span></div>
                    <div class="widget-wl"><span class="w">${r.wins}W</span> / <span class="l">${r.losses}L</span></div>
                </div>
            </div>
            ${i < 2 ? '<div class="widget-divider"></div>' : ''}
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
if (document.getElementById('newsContainer')) {
    const NEWS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbdqLzy4PvMyR_9Pndokh0E0zNYg13qHTJOwRtBJz1wlwyjrfz_2NsJaskSLLlfXHRMFIT4_CkR_6K/pub?gid=0&single=true&output=csv";

    const DEMO_NEWS = [
        { date: "01 апреля 2026", tag: "Результаты", title: "Итоги 3-го тура: BAREBUH удерживает лидерство, HYDRA врывается в топ-3", text: "По итогам третьего игрового тура команда BAREBUH сохраняет первое место с 18 очками. FIreF0x уступила в напряжённом матче и опустилась на 4-ю строчку таблицы. Главным сюрпризом тура стало выступление HYDRA — команда выиграла оба матча и поднялась сразу на 3 позиции.", img: "", link: "", featured: "да" },
        { date: "28 марта 2026", tag: "Анонс", title: "Расписание 4-го тура опубликовано", text: "Матчи пройдут с 5 по 7 апреля. Главное противостояние тура — лидер BAREBUH против набравшей форму VERTEX.", img: "", link: "", featured: "нет" },
        { date: "25 марта 2026", tag: "Лига", title: "Две новые команды вступили в лигу", text: "Команды GHOST и PHANTOM успешно прошли отбор и присоединятся к турниру со следующего тура.", img: "", link: "", featured: "нет" },
        { date: "20 марта 2026", tag: "Результаты", title: "Итоги 2-го тура: неожиданные результаты в нижней части таблицы", text: "Второй тур преподнёс сюрпризы — аутсайдеры показали борьбу, несколько матчей завершились в овертайме.", img: "", link: "", featured: "нет" },
    ];

    let ALL_NEWS   = [];
    let activeTag  = "all";
    let activeSort = "new";
    let activeSearch = "";

    window._imgErr = function(el) {
        el.style.display = 'none';
        const ph = document.createElement('div');
        ph.className = 'img-placeholder';
        ph.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        el.parentNode.appendChild(ph);
    };

    function imgHtml(url) {
        const ph = '<div class="img-placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>';
        if (!url) return ph;
        return '<img src="' + url + '" alt="" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.85;" onerror="_imgErr(this)">';
    }

    function parseNewsCSV(text) {
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        return lines.slice(1).map(line => {
            const vals = [];
            let cur = '', inQ = false;
            for (const ch of line) {
                if (ch === '"') { inQ = !inQ; }
                else if (ch === ',' && !inQ) { vals.push(cur.trim()); cur = ''; }
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
        const months = { "января":0,"февраля":1,"марта":2,"апреля":3,"мая":4,"июня":5,"июля":6,"августа":7,"сентября":8,"октября":9,"ноября":10,"декабря":11 };
        const parts = str.trim().split(/\s+/);
        if (parts.length === 3) {
            const d = parseInt(parts[0]);
            const m = months[parts[1].toLowerCase()];
            const y = parseInt(parts[2]);
            if (!isNaN(d) && m !== undefined && !isNaN(y)) return new Date(y, m, d);
        }
        return new Date(0);
    }

    function applyNewsFilters() {
        let data = [...ALL_NEWS];
        if (activeTag !== "all") {
            data = data.filter(n => n.tag.toLowerCase().includes(activeTag.toLowerCase()));
        }
        if (activeSearch.trim()) {
            const q = activeSearch.toLowerCase();
            data = data.filter(n =>
                n.title.toLowerCase().includes(q) ||
                n.text.toLowerCase().includes(q) ||
                n.tag.toLowerCase().includes(q)
            );
        }
        data.sort((a, b) => {
            const diff = parseDate(b.date) - parseDate(a.date);
            return activeSort === "new" ? diff : -diff;
        });
        renderNews(data);
    }

    function renderNews(data) {
        const noFilter = activeTag === "all" && !activeSearch.trim();
        const featured = noFilter ? data.find(n => n.featured === "да" || n.featured === "yes") : null;
        const rest = data.filter(n => n !== featured);
        let html = "";
        if (featured) {
            const href = featured.link ? `href="${featured.link}" target="_blank"` : 'href="#"';
            html += `
            <a ${href} class="news-featured" style="text-decoration:none;color:inherit;">
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
                html += `
                <a ${href} class="news-card" style="text-decoration:none;color:inherit;">
                    <div class="card-img">${imgHtml(n.img)}</div>
                    <div class="card-content">
                        <div class="news-meta"><span class="news-tag">${n.tag}</span><span class="news-date">${n.date}</span></div>
                        <div class="card-title">${n.title}</div>
                        <div class="card-excerpt">${n.text}</div>
                        <div class="card-readmore">Подробнее</div>
                    </div>
                </a>`;
            });
            html += `</div>`;
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

    document.getElementById("searchInput").addEventListener("input", function() { activeSearch = this.value; applyNewsFilters(); });
    document.getElementById("sortSelect").addEventListener("change", function() { activeSort = this.value; applyNewsFilters(); });
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
if (document.getElementById('tableContainer')) {
    const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQLzmfGa-hRDaGQLSiXkhp7oA6FeMmvllGr7bMBv8nZVIP2o6abGMzAi4NOxMc6RvI1fSieM06ZoMuQ/pub?gid=REPLACEGID&single=true&output=csv";
    const AUTO_REFRESH_MINUTES = 10;
    let currentGid = "1376391839";

    function getCSVUrl(gid) { return SHEET_BASE_URL.replace("REPLACEGID", gid); }

    const DEMO_DATA = [
        { team: "Natus Vincere", pts: 18, matches: 6, wins: 6, losses: 0, wr: 100, rd: +22, roster: "s1mple, b1t, niko, Perfecto, electroNic" },
        { team: "Cloud9",        pts: 15, matches: 6, wins: 5, losses: 1, wr: 83,  rd: +14, roster: "Ax1Le, sh1ro, HObbit, Buster, nafany" },
        { team: "Virtus.pro",    pts: 12, matches: 6, wins: 4, losses: 2, wr: 67,  rd: +7  },
        { team: "FaZe Clan",     pts:  9, matches: 6, wins: 3, losses: 3, wr: 50,  rd: +1  },
        { team: "Team Spirit",   pts:  7, matches: 6, wins: 2, losses: 4, wr: 33,  rd: -8  },
        { team: "Heroic",        pts:  5, matches: 5, wins: 1, losses: 4, wr: 20,  rd: -11 },
        { team: "ENCE",          pts:  3, matches: 6, wins: 1, losses: 5, wr: 17,  rd: -14 },
        { team: "BIG",           pts:  1, matches: 5, wins: 0, losses: 5, wr: 0,   rd: -21 },
    ];

    function playerSilhouetteSVG(c) {
        c = c || '#e6b022';
        return `<svg class="player-silhouette" viewBox="0 0 64 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="32" cy="14" rx="11" ry="12" fill="${c}"/><ellipse cx="32" cy="13.5" rx="9" ry="10" fill="${c}"/>
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
        const lines = text.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
        return lines.slice(1).map(line => {
            const vals = line.split(",").map(v => v.trim());
            const obj = {};
            headers.forEach((h, i) => obj[h] = vals[i] || "");
            return {
                team:    obj["команда"]    || obj["team"]       || "—",
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
        return `background: linear-gradient(135deg, ${c1} 0%, ${c2} 100%); color: ${i === 0 ? '#000' : '#fff'};`;
    }
    function getAccentColor(i) { return AVATAR_COLORS[i % AVATAR_COLORS.length][0]; }
    function renderAvatar(r, i, size = 32) {
        if (r.avatar) {
            return `<img src="${r.avatar}" alt="${r.team}" style="width:${size}px;height:${size}px;border-radius:6px;object-fit:cover;flex-shrink:0;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"><div class="team-avatar" style="${avatarStyle(i)};display:none;">${initials(r.team)}</div>`;
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
            <tr class="${rankClass}${hasRoster ? ' has-roster' : ''}" ${hasRoster ? `onclick="openRosterModal(${i})"` : ''}>
                <td><span class="rank-badge">${rank}</span></td>
                <td><div class="team-name">${renderAvatar(r, i)}${r.team}${hasRoster ? '<span class="roster-toggle">▸ состав</span>' : ''}</div></td>
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
        setTimeout(() => { document.querySelectorAll(".wr-bar-fill").forEach(el => { el.style.transition = "width 1s ease"; }); }, 50);
        const now = new Date();
        document.getElementById("updateTime").textContent = now.toLocaleDateString("ru-RU") + " " + now.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});
        applySearch();
    }

    function applySearch() {
        const q = (document.getElementById("teamSearch").value || "").toLowerCase().trim();
        const tbody = document.querySelector("#tableContainer tbody");
        if (!tbody) return;
        let visibleCount = 0;
        tbody.querySelectorAll("tr:not(.no-results-row)").forEach(tr => {
            const nameEl = tr.querySelector(".team-name");
            if (!nameEl) { tr.style.display = ""; return; }
            const rawText = Array.from(nameEl.childNodes).filter(n => n.nodeType === Node.TEXT_NODE).map(n => n.textContent).join("") || nameEl.textContent;
            const matches = q === "" || rawText.toLowerCase().includes(q);
            tr.style.display = matches ? "" : "none";
            if (matches) visibleCount++;
        });
        let noRow = tbody.querySelector(".no-results-row");
        if (visibleCount === 0 && q !== "") {
            if (!noRow) { noRow = document.createElement("tr"); noRow.className = "no-results-row"; noRow.innerHTML = `<td colspan="7">😕 Команда «${q}» не найдена</td>`; tbody.appendChild(noRow); }
            else { noRow.querySelector("td").textContent = `😕 Команда «${q}» не найдена`; noRow.style.display = ""; }
        } else if (noRow) { noRow.style.display = "none"; }
    }

    window.openRosterModal = function(idx) {
        const r = _tableData[idx];
        if (!r) return;
        const players = (r.roster || "").replace(/"/g, "").split(/[,;]/).map(p => p.trim()).filter(Boolean);
        const accentColor = getAccentColor(idx);
        const avatarEl = document.getElementById("rosterModalAvatar");
        avatarEl.style = avatarStyle(idx);
        avatarEl.innerHTML = r.avatar ? `<img src="${r.avatar}" alt="${r.team}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentNode.innerHTML='${initials(r.team)}'">` : initials(r.team);
        document.getElementById("rosterModalTeamName").textContent = r.team;
        const listEl = document.getElementById("rosterPlayersList");
        listEl.innerHTML = players.length === 0 ? `<div class="roster-empty-msg">Состав не указан</div>` : players.map(nick => `<div class="player-card">${playerSilhouetteSVG(accentColor)}<div class="player-nick">${nick}</div></div>`).join("");
        document.getElementById("rosterModal").classList.add("open");
        document.body.style.overflow = "hidden";
    };

    function closeRosterModal() { document.getElementById("rosterModal").classList.remove("open"); document.body.style.overflow = ""; }
    document.getElementById("rosterModalClose").addEventListener("click", closeRosterModal);
    document.getElementById("rosterModal").addEventListener("click", function(e) { if (e.target === this) closeRosterModal(); });
    document.addEventListener("keydown", function(e) { if (e.key === "Escape") closeRosterModal(); });

    function showError(msg) {
        document.getElementById("tableContainer").innerHTML = `<div class="state-box"><div class="icon">⚠️</div><p>${msg}</p></div>`;
    }

    async function loadData() {
        const container = document.getElementById("tableContainer");
        if (!container.querySelector("table")) {
            container.innerHTML = `<div class="state-box"><div class="spinner"></div><p>Загрузка данных...</p></div>`;
        }
        try {
            const res = await fetch(getCSVUrl(currentGid));
            if (!res.ok) throw new Error("HTTP " + res.status);
            const text = await res.text();
            const data = parseLeaderboardCSV(text);
            if (!data.length) throw new Error("Таблица пуста или неверный формат");
            renderTable(data);
        } catch (e) {
            if (currentGid === "1376391839") { renderTable(DEMO_DATA); document.getElementById("updateTime").textContent = "демо-данные"; }
            else { showError("Не удалось загрузить данные архивного сезона.<br><small style='color:#5c6b7f'>(" + e.message + ")</small>"); }
        }
    }

    document.getElementById("teamSearch").addEventListener("input", applySearch);
    document.getElementById("seasonSelect").addEventListener("change", function() {
        currentGid = this.value;
        const labelEl = document.querySelector(".season-label");
        if (labelEl) labelEl.textContent = this.options[this.selectedIndex].text;
        document.getElementById("teamSearch").value = "";
        countdown = AUTO_REFRESH_MINUTES * 60;
        loadData();
    });
    document.getElementById("ratingBtn").addEventListener("click", () => { document.getElementById("ratingModal").classList.add("open"); document.body.style.overflow = "hidden"; });
    document.getElementById("modalClose").addEventListener("click", () => { document.getElementById("ratingModal").classList.remove("open"); document.body.style.overflow = ""; });
    document.getElementById("ratingModal").addEventListener("click", (e) => { if (e.target === e.currentTarget) { document.getElementById("ratingModal").classList.remove("open"); document.body.style.overflow = ""; } });

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
if (document.getElementById('joinForm')) {

    let _currentUser = null;

    async function initJoinPage() {
        const user = await checkAuth();
        _currentUser = user;

        if (!user) {
            document.getElementById("authGate").style.display = "block";
            return;
        }

        const nicknameEl = document.getElementById("nickname");
        if (nicknameEl) nicknameEl.value = user.displayName;

        if (!user.team) {
            document.getElementById("noTeamBanner").style.display = "block";
            return;
        }

        renderTeamInfoCard(user.team);
        document.getElementById("progressWrap").style.display = "flex";
        document.getElementById("joinForm").style.display = "block";
    }

    function renderTeamInfoCard(team) {
        const card = document.getElementById("teamInfoCard");
        card.innerHTML = `
            <div class="team-card">
                ${team.logo ? `<img src="${team.logo}" class="team-card-logo" alt="${team.name}" onerror="this.style.display='none'">` : `<div class="team-card-logo-placeholder">[${team.tag}]</div>`}
                <div class="team-card-info">
                    <div class="team-card-name">[${team.tag}] ${team.name}</div>
                    <div class="team-card-sub">Ваша команда · Капитан</div>
                </div>
            </div>`;
    }

    window.openCreateTeamModal = function() {
        document.getElementById("createTeamModal").style.display = "flex";
        document.body.style.overflow = "hidden";
        document.getElementById("ctError").style.display = "none";
        document.getElementById("ctName").value = "";
        document.getElementById("ctTag").value  = "";
        document.getElementById("ctLogo").value = "";
    };

    window.closeCreateTeamModal = function() {
        document.getElementById("createTeamModal").style.display = "none";
        document.body.style.overflow = "";
    };

    document.getElementById("createTeamModal").addEventListener("click", function(e) {
        if (e.target === this) closeCreateTeamModal();
    });
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && document.getElementById("createTeamModal").style.display === "flex") closeCreateTeamModal();
    });

    window.submitCreateTeam = async function() {
        const name = document.getElementById("ctName").value.trim();
        const tag  = document.getElementById("ctTag").value.trim();
        const logo = document.getElementById("ctLogo").value.trim();
        const errEl = document.getElementById("ctError");
        const btn  = document.getElementById("ctSubmitBtn");

        errEl.style.display = "none";
        if (!name || !tag) { errEl.textContent = "Заполните название и тег команды."; errEl.style.display = "block"; return; }

        btn.disabled = true;
        btn.textContent = "Создание...";

        try {
            const res = await fetch("/api/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, tag, logo }),
            });
            const data = await res.json();
            if (!res.ok) { errEl.textContent = data.error || "Ошибка сервера."; errEl.style.display = "block"; btn.disabled = false; btn.textContent = "Создать команду"; return; }

            closeCreateTeamModal();
            document.getElementById("noTeamBanner").style.display = "none";
            renderTeamInfoCard(data.team);
            document.getElementById("progressWrap").style.display = "flex";
            document.getElementById("joinForm").style.display = "block";
            if (_currentUser) _currentUser.team = data.team;

            const teamBadge = document.getElementById("headerTeamBadge");
            if (teamBadge) { teamBadge.textContent = `[${data.team.tag}] ${data.team.name}`; teamBadge.style.display = "inline-flex"; }
        } catch {
            errEl.textContent = "Ошибка соединения."; errEl.style.display = "block"; btn.disabled = false; btn.textContent = "Создать команду";
        }
    };

    function updateProgress() {
        [1, 2, 3, 4].forEach(n => {
            const section = document.querySelector(`.form-section[data-section="${n}"]`);
            if (!section) return;
            const required = section.querySelectorAll("[required]");
            const filled = [...required].every(el => {
                if (el.type === "checkbox") return el.checked;
                if (el.type === "radio")    return document.querySelector(`input[name="${el.name}"]:checked`);
                return el.value.trim() !== "";
            });
            const ps = document.getElementById("ps" + n);
            const pl = document.getElementById("pl" + n);
            if (filled) { ps.classList.remove("active"); ps.classList.add("done"); ps.querySelector(".progress-step-circle").textContent = "✓"; if (pl) pl.classList.add("done"); }
            else { ps.classList.remove("done"); ps.querySelector(".progress-step-circle").textContent = n; if (pl) pl.classList.remove("done"); }
        });
        let found = false;
        [1, 2, 3, 4].forEach(n => {
            const ps = document.getElementById("ps" + n);
            if (!found && !ps.classList.contains("done")) { ps.classList.add("active"); found = true; }
            else ps.classList.remove("active");
        });
    }

    document.getElementById("joinForm").addEventListener("input", updateProgress);
    document.getElementById("joinForm").addEventListener("change", updateProgress);

    document.getElementById("joinForm").addEventListener("submit", async function(e) {
        e.preventDefault();

        if (!this.checkValidity()) {
            const firstInvalid = this.querySelector(":invalid");
            if (firstInvalid) { firstInvalid.focus(); firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" }); }
            return;
        }

        const btn = document.getElementById("submitBtn");
        btn.disabled = true;
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="width:18px;height:18px;stroke:#000;stroke-width:2.5;animation:spin 0.7s linear infinite"><circle cx="12" cy="12" r="9" stroke-dasharray="40" stroke-dashoffset="15"/></svg> Отправка...`;

        try {
            const res = await fetch("/api/applications", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    hoursInCS2:  document.getElementById("hours").value,
                    faceitLevel: document.getElementById("faceit_level").value,
                    experience:  document.getElementById("experience").value,
                    contacts:    document.getElementById("contacts").value,
                }),
            });
            const data = await res.json();
            if (res.ok && data.ok) {
                this.style.display = "none";
                document.getElementById("progressWrap").style.display = "none";
                document.getElementById("successMsg").style.display = "block";
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                alert(data.error || "Не удалось отправить заявку.");
                btn.disabled = false;
                btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="width:18px;height:18px;stroke:#000;stroke-width:2.5;stroke-linecap:round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> Отправить заявку`;
            }
        } catch {
            alert("Ошибка соединения. Проверьте интернет и попробуйте ещё раз.");
            btn.disabled = false;
            btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" style="width:18px;height:18px;stroke:#000;stroke-width:2.5;stroke-linecap:round"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> Отправить заявку`;
        }
    });

    initJoinPage();
}

/* ================================================
   ANTI-CLONE
   ================================================ */
(function() {
    const isOriginal = window.location.hostname === 'cs2-league-hub.vercel.app' || window.location.hostname === 'localhost';
    if (!isOriginal) {
        console.error("ATTENTION: Cloned version detected.");
        window.addEventListener('load', () => {
            setTimeout(() => {
                const footerCopy = document.querySelector('footer p');
                if (footerCopy) {
                    const marker = document.createElement('span');
                    marker.style.cssText = "color:#ff4444; font-weight:bold; margin-left:10px;";
                    marker.innerHTML = "| FAKE SITE (Original by Keseneir)";
                    footerCopy.appendChild(marker);
                }
            }, 3000);
        });
    }
})();
