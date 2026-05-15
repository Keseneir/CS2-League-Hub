//лидерборд
if (document.getElementById("tableContainer")) {

    let _tableData  = [];
    let _rosterMap  = {};
    let _seasons    = [];
    let _currentSid = null;

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
        const fb = avatarStyle(i);
        const tx = initials(r.team);
        if (!r.logo) return `<div class="team-avatar" style="${fb}">${tx}</div>`;
        const errStyle = fb + "align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:11px;";
        return `<div style="width:32px;height:32px;border-radius:6px;flex-shrink:0;position:relative;overflow:hidden;">`
             + `<div class="team-avatar" style="${errStyle};position:absolute;inset:0;display:none;" data-fb="1">${tx}</div>`
             + `<img src="${r.logo}" alt="${tx}" style="width:100%;height:100%;object-fit:cover;display:block;position:relative;z-index:1;"
                  onload="this.style.opacity='1'"
                  onerror="this.style.display='none';var f=this.parentNode.querySelector('[data-fb]');if(f)f.style.display='flex'">`
             + `</div>`;
    }

    function renderTable(rows) {
        _tableData = rows || [];

        if (_tableData.length === 0) {
            document.getElementById("tableContainer").innerHTML =
                `<div class="state-box"><div class="icon">🏆</div><p>Сезон ещё не начат — команды скоро появятся</p></div>`;
            return;
        }

        const teamIds = _tableData.map(r => r.teamId).filter(Boolean);
        if (teamIds.length) {
            fetch("/api/leaderboard/rosters?ids=" + teamIds.join(","))
                .then(r => r.ok ? r.json() : {})
                .then(rMap => { _rosterMap = rMap; })
                .catch(() => {});
        }

        const html = _tableData.map((r, i) => {
            const rank      = i + 1;
            const rankClass = rank <= 3 ? `rank-${rank}` : "rank-other";
            const rdClass   = r.roundDiff > 0 ? "pos" : r.roundDiff < 0 ? "neg" : "zero";
            const rdText    = r.roundDiff > 0 ? `+${r.roundDiff}` : `${r.roundDiff}`;
            const wr        = r.wr || (r.matches > 0 ? Math.round((r.wins / r.matches) * 100) : 0);
            const crown     = r.isKingOfHill ? ' <span title="Царь горы" style="font-size:14px;">👑</span>' : "";
            const streak    = r.winStreak >= 3 ? ` <span style="font-size:11px;color:#e8a05b;font-weight:700;">🔥×${r.winStreak}</span>` : "";
            return `
            <tr class="${rankClass}" onclick="openLbTeamModal(${i})" style="cursor:pointer;" title="Состав команды">
                <td><span class="rank-badge">${rank}</span></td>
                <td><div class="team-name">${renderAvatar(r, i)}${r.team}${crown}${streak}</div></td>
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
            </tr></thead><tbody>${html}</tbody></table>`;

        setTimeout(() => {
            document.querySelectorAll(".wr-bar-fill").forEach(el => { el.style.transition = "width 1s ease"; });
        }, 50);

        const now    = new Date();
        const timeEl = document.getElementById("updateTime");
        if (timeEl) timeEl.textContent = now.toLocaleDateString("ru-RU") + " " + now.toLocaleTimeString("ru-RU", {hour:"2-digit", minute:"2-digit"});

        applySearch();
    }

    function applySearch() {
        const q = (document.getElementById("teamSearch")?.value || "").toLowerCase().trim();
        const tbody = document.querySelector("#tableContainer tbody");
        if (!tbody) return;
        let visible = 0;
        tbody.querySelectorAll("tr:not(.no-results-row)").forEach(tr => {
            const nameEl = tr.querySelector(".team-name");
            if (!nameEl) { tr.style.display = ""; return; }
            const show = q === "" || nameEl.textContent.toLowerCase().includes(q);
            tr.style.display = show ? "" : "none";
            if (show) visible++;
        });
        let noRow = tbody.querySelector(".no-results-row");
        if (visible === 0 && q !== "") {
            if (!noRow) { noRow = document.createElement("tr"); noRow.className = "no-results-row"; noRow.innerHTML = `<td colspan="7" style="text-align:center;padding:30px;color:#5c6b7f;">😕 Команда «${q}» не найдена</td>`; tbody.appendChild(noRow); }
            else { noRow.querySelector("td").textContent = `😕 Команда «${q}» не найдена`; noRow.style.display = ""; }
        } else if (noRow) { noRow.style.display = "none"; }
    }

    //окно состав
    window.openLbTeamModal = function(idx) {
        const r = _tableData[idx];
        if (!r) return;
        const modal  = document.getElementById("lbRosterModal");
        const nameEl = document.getElementById("lbRosterTeamName");
        const logoEl = document.getElementById("lbRosterAvatar");
        const mainEl = document.getElementById("lbRosterMain");
        const subEl  = document.getElementById("lbRosterSubs");
        if (!modal) return;

        if (nameEl) nameEl.textContent = `[${r.tag}] ${r.team}`;

        if (logoEl) {
            const fallbackStyle = "display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:16px;color:var(--accent);width:48px;height:48px;border-radius:10px;background:rgba(230,176,34,0.12);border:1px solid rgba(230,176,34,0.3);flex-shrink:0;overflow:hidden;";
            const fallbackText  = r.tag?.slice(0, 2) || "?";
            if (r.logo) {
                // ФИКСю: сохраняем размеры контейнера вместо полного сброса стилей
                logoEl.style.cssText = "width:48px;height:48px;border-radius:10px;flex-shrink:0;overflow:hidden;";
                logoEl.innerHTML = `<img src="${r.logo}" style="width:100%;height:100%;object-fit:cover;display:block;"
                    onerror="this.style.display='none';this.parentNode.textContent='${fallbackText}';this.parentNode.style.cssText='${fallbackStyle}'">`;
            } else {
                logoEl.textContent = fallbackText;
                logoEl.style.cssText = fallbackStyle;
            }
        }

        const roster  = _rosterMap[r.teamId] || {};
        const members = roster.members || [];
        const subs    = roster.subs    || [];

        function silhouette(name, c) {
            const init = (name || "?").trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
            return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:8px 12px;">
                <svg viewBox="0 0 40 52" style="width:36px;height:46px;opacity:0.85;" fill="${c || "#aebbc7"}">
                    <ellipse cx="20" cy="10" rx="8" ry="8"/>
                    <path d="M6 42 Q6 24 13 22 L17 20 Q20 19 23 20 L27 22 Q34 24 34 42 Z"/>
                    <path d="M6 28 Q1 33 1 42 L7 42 Q7 34 11 29 Z"/>
                    <path d="M34 28 Q39 33 39 42 L33 42 Q33 34 29 29 Z"/>
                </svg>
                <span style="font-size:12px;font-weight:700;color:white;text-align:center;word-break:break-all;max-width:80px;">${name || "?"}</span>
            </div>`;
        }

        if (mainEl) {
            mainEl.innerHTML = members.length
                ? members.map(m => silhouette(m.displayName, "#e6b022")).join("")
                : `<div style="color:#5c6b7f;font-size:13px;padding:20px;">Нет данных</div>`;
        }
        if (subEl) {
            subEl.innerHTML = subs.length
                ? subs.map(m => silhouette(m.displayName, "#5c6b7f")).join("")
                : `<div style="color:#5c6b7f;font-size:13px;padding:12px;">Замен нет</div>`;
        }

        const tgWrap = document.getElementById("lbRosterTelegram");
        if (tgWrap) {
            if (r.telegram) {
                const tgRaw = r.telegram.trim().replace(/^https?:\/\/t\.me\//i, "").replace(/^@/, "");
                const tgUrl = "https://t.me/" + tgRaw;
                tgWrap.style.display = "block";
                const tgLink = document.createElement("a");
                tgLink.href   = tgUrl;
                tgLink.target = "_blank";
                tgLink.rel    = "noopener noreferrer";
                tgLink.title  = "Telegram";
                tgLink.style.cssText = "display:inline-flex;align-items:center;gap:5px;background:#1a2435;border:1px solid rgba(91,141,232,0.3);color:#5b8de8;border-radius:8px;padding:0 10px;height:32px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:11px;text-decoration:none;white-space:nowrap;";
                tgLink.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.9 8.2-2 9.4c-.1.6-.5.8-.9.5l-2.6-1.9-1.2 1.2c-.1.1-.3.2-.6.2l.2-2.7 4.9-4.4c.2-.2 0-.3-.3-.1L6.6 15.4 4 14.6c-.6-.2-.6-.6.1-.8l10.9-4.2c.5-.2 1 .1.9.6z"/></svg>TG';
                tgWrap.innerHTML = "";
                tgWrap.appendChild(tgLink);
            } else {
                tgWrap.style.display = "none";
            }
        }

        modal.classList.add("open");
        document.body.style.overflow = "hidden";
    };

    const _lbRosterModal = document.getElementById("lbRosterModal");
    const _lbRosterClose = document.getElementById("lbRosterClose");
    if (_lbRosterClose) _lbRosterClose.addEventListener("click", () => { _lbRosterModal?.classList.remove("open"); document.body.style.overflow = ""; });
    if (_lbRosterModal) _lbRosterModal.addEventListener("click", e => { if (e.target === _lbRosterModal) { _lbRosterModal.classList.remove("open"); document.body.style.overflow = ""; } });

    //загрущзка сезонов
    async function loadSeasons() {
        try {
            const res  = await fetch("/api/seasons");
            if (!res.ok) return;
            _seasons = await res.json();
            const sel = document.getElementById("seasonSelect");
            if (!sel) return;
            sel.innerHTML = _seasons.map(s =>
                `<option value="${s._id}"${s.isActive ? " selected" : ""}>${s.name}</option>`
            ).join("") || `<option disabled>Сезонов пока нет</option>`;
            const active = _seasons.find(s => s.isActive) || _seasons[0];
            if (active) {
                _currentSid = active._id;
                const labelEl = document.querySelector(".season-label");
                if (labelEl) labelEl.textContent = "🏆 " + active.name;
            }
        } catch {}
    }

    async function loadData(seasonId) {
        const container = document.getElementById("tableContainer");
        if (container) container.innerHTML = `<div class="state-box"><div class="spinner"></div><p>Загрузка данных...</p></div>`;
        try {
            const url = seasonId ? `/api/leaderboard/${seasonId}` : "/api/leaderboard";
            const res = await fetch(url);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const { season, rows } = await res.json();
            if (season) {
                const labelEl = document.querySelector(".season-label");
                if (labelEl) labelEl.textContent = "🏆 " + season.name;
            }
            renderTable(rows || []);
        } catch (e) {
            if (container) container.innerHTML = `<div class="state-box"><div class="icon">⚠️</div><p>Не удалось загрузить данные.<br><small style='color:#5c6b7f'>${e.message}</small></p></div>`;
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
            _currentSid = this.value;
            if (document.getElementById("teamSearch")) document.getElementById("teamSearch").value = "";
            loadData(_currentSid);
        });
    }

    if (ratingBtn)     ratingBtn.addEventListener("click",     () => { if (ratingModal) { ratingModal.classList.add("open"); document.body.style.overflow = "hidden"; } });
    if (modalCloseBtn) modalCloseBtn.addEventListener("click", () => { if (ratingModal) { ratingModal.classList.remove("open"); document.body.style.overflow = ""; } });
    if (ratingModal)   ratingModal.addEventListener("click",   e  => { if (e.target === e.currentTarget) { ratingModal.classList.remove("open"); document.body.style.overflow = ""; } });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && ratingModal) { ratingModal.classList.remove("open"); document.body.style.overflow = ""; } });

    async function init() {
        await loadSeasons();
        await loadData(_currentSid);
        setInterval(() => loadData(_currentSid), 10 * 60 * 1000);
    }

    init();
}