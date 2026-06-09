/**
 * public/js/leaderboard.js  — ФРОНТЕНД (НЕ routes/leaderboard.js)
 * Рендерит таблицу лидеров, поиск, модал состава.
 */
(function () {
  "use strict";

  let allRows     = [];
  let rosterCache = {};

  const tableContainer = document.getElementById("tableContainer");
  const teamSearch     = document.getElementById("teamSearch");
  const seasonSelect   = document.getElementById("seasonSelect");
  const updateTimeEl   = document.getElementById("updateTime");
  const seasonLabelEl  = document.querySelector(".season-label");
  const lbModal        = document.getElementById("lbRosterModal");
  const lbClose        = document.getElementById("lbRosterClose");
  const lbMain         = document.getElementById("lbRosterMain");
  const lbSubs         = document.getElementById("lbRosterSubs");
  const lbTeamName     = document.getElementById("lbRosterTeamName");
  const lbAvatar       = document.getElementById("lbRosterAvatar");
  const lbTelegram     = document.getElementById("lbRosterTelegram");
  const ratingBtn      = document.getElementById("ratingBtn");
  const ratingModal    = document.getElementById("ratingModal");
  const modalClose     = document.getElementById("modalClose");

  // ── Init ──────────────────────────────────────────────────────────────────
  async function init() {
    try {
      const [seasonsRes, lbRes] = await Promise.all([
        fetch("/api/seasons"),
        fetch("/api/leaderboard/"),
      ]);
      const seasons = await seasonsRes.json();
      const data    = await lbRes.json();

      buildSeasonSelect(seasons, data.season?._id);
      renderLeaderboard(data);
    } catch (err) {
      tableContainer.innerHTML =
        `<div class="state-box"><p style="color:var(--red,#e05c5c)">Ошибка загрузки. Обновите страницу.</p></div>`;
    }
  }

  // ── Season select ─────────────────────────────────────────────────────────
  function buildSeasonSelect(seasons, activeSid) {
    seasonSelect.innerHTML = "";
    if (!seasons.length) {
      seasonSelect.innerHTML = "<option>Нет сезонов</option>";
      return;
    }
    seasons.forEach((s) => {
      const opt = document.createElement("option");
      opt.value       = s._id;
      opt.textContent = s.name || `Сезон ${s._id.slice(-4)}`;
      opt.selected    = s._id === activeSid;
      seasonSelect.appendChild(opt);
    });
  }

  seasonSelect?.addEventListener("change", async () => {
    tableContainer.innerHTML =
      `<div class="state-box"><div class="spinner"></div><p>Загрузка...</p></div>`;
    try {
      const res  = await fetch(`/api/leaderboard/${seasonSelect.value}`);
      const data = await res.json();
      renderLeaderboard(data);
    } catch {
      tableContainer.innerHTML =
        `<div class="state-box"><p style="color:var(--red,#e05c5c)">Ошибка загрузки.</p></div>`;
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────
  function renderLeaderboard({ season, rows }) {
    allRows = rows || [];
    if (seasonLabelEl)
      seasonLabelEl.textContent = season
        ? `🏆 ${season.name || "Текущий сезон"}`
        : "🏆 Нет активного сезона";
    if (updateTimeEl)
      updateTimeEl.textContent = new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit", minute: "2-digit",
      });

    // Кэш имён для патч-скрипта leaderboard.html
    window.__teamNameToId = {};
    allRows.forEach((r) => {
      if (r.teamId) window.__teamNameToId[r.team] = r.teamId.toString();
    });

    // Предзагрузка ростеров
    const ids = allRows.map((r) => r.teamId).filter(Boolean);
    if (ids.length) {
      fetch(`/api/leaderboard/rosters?ids=${ids.join(",")}`)
        .then((r) => r.json())
        .then((d) => {
          Object.assign(rosterCache, d);
          window.__rosterCache = rosterCache;
        })
        .catch(() => {});
    }

    renderRows(allRows);
  }

  function renderRows(rows) {
    if (!rows.length) {
      tableContainer.innerHTML =
        `<div class="state-box"><p>Нет команд для отображения.</p></div>`;
      return;
    }

    const table  = document.createElement("table");
    table.className = "lb-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-rank">#</th>
          <th class="col-team">Команда</th>
          <th class="col-pts">Очки</th>
          <th class="col-stat">В</th>
          <th class="col-stat">П</th>
          <th class="col-stat hide-xs">WR%</th>
          <th class="col-stat hide-xs">RD</th>
          <th class="col-roster"></th>
        </tr>
      </thead>`;

    const tbody = document.createElement("tbody");
    rows.forEach((row, i) => {
      const rank = i + 1;
      const tr   = document.createElement("tr");
      tr.className          = `lb-row${rank <= 3 ? ` top-${rank}` : ""}`;
      tr.dataset.teamId     = row.teamId || "";
      tr.dataset.teamTag    = row.tag    || "";

      const logoHtml   = row.logo
        ? `<img src="${x(row.logo)}" class="lb-team-logo" alt="" onerror="this.style.display='none'">`
        : `<div class="lb-team-logo lb-logo-placeholder">🛡️</div>`;
      const kingBadge  = row.isKingOfHill
        ? `<span class="king-badge" title="Царь горы">👑</span>` : "";
      const streakBadge = row.winStreak >= 3
        ? `<span class="streak-badge">🔥${row.winStreak}</span>` : "";
      const rdSign     = row.roundDiff > 0 ? "+" : "";

      tr.innerHTML = `
        <td class="col-rank">
          <span class="rank-badge rank-${rank <= 3 ? rank : "n"}">${rank}</span>
          ${kingBadge}
        </td>
        <td class="col-team">
          <div class="lb-team-cell">
            ${logoHtml}
            <div class="lb-team-info">
              <a href="/team.html?tag=${x(row.tag)}" class="lb-team-name">${x(row.team)}</a>
              <span class="lb-team-tag">[${x(row.tag)}]</span>
            </div>
            ${streakBadge}
          </div>
        </td>
        <td class="col-pts"><span class="lb-pts">${row.pts}</span></td>
        <td class="col-stat lb-win">${row.wins}</td>
        <td class="col-stat lb-loss">${row.losses}</td>
        <td class="col-stat hide-xs">${row.wr}%</td>
        <td class="col-stat hide-xs ${row.roundDiff >= 0 ? "lb-win" : "lb-loss"}">${rdSign}${row.roundDiff}</td>
        <td class="col-roster">
          <button class="btn-roster"
            data-team-id="${x(row.teamId)}"
            data-team-name="${x(row.team)}"
            data-team-tag="${x(row.tag)}"
            data-team-logo="${x(row.logo)}"
            data-team-telegram="${x(row.telegram)}">
            Состав
          </button>
        </td>`;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    tableContainer.innerHTML = "";
    tableContainer.appendChild(table);
  }

  // ── Search ────────────────────────────────────────────────────────────────
  teamSearch?.addEventListener("input", () => {
    const q = teamSearch.value.trim().toLowerCase();
    renderRows(
      q
        ? allRows.filter(
            (r) =>
              r.team.toLowerCase().includes(q) ||
              r.tag.toLowerCase().includes(q)
          )
        : allRows
    );
  });

  // ── Roster modal ──────────────────────────────────────────────────────────
  tableContainer?.addEventListener("click", async (e) => {
    const btn = e.target.closest(".btn-roster");
    if (!btn) return;

    const teamId   = btn.dataset.teamId;
    const tag      = btn.dataset.teamTag;
    const name     = btn.dataset.teamName;
    const logo     = btn.dataset.teamLogo;
    const telegram = btn.dataset.teamTelegram;

    window.__lbCurrentTeam = { id: teamId, tag };

    // Заголовок модала
    if (lbTeamName) lbTeamName.textContent = name;
    if (lbAvatar)
      lbAvatar.innerHTML = logo
        ? `<img src="${x(logo)}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;" onerror="this.parentElement.textContent='🛡️'">`
        : "🛡️";
    if (lbTelegram) {
      lbTelegram.style.display = telegram ? "" : "none";
      lbTelegram.innerHTML     = telegram
        ? `<a href="${x(telegram)}" target="_blank" rel="noopener"
              style="display:inline-flex;align-items:center;gap:5px;color:#aebbc7;text-decoration:none;
                     font-size:12px;background:#1a2128;border:1px solid #2a3340;border-radius:6px;padding:5px 10px;"
              onmouseover="this.style.color='#e6b022'" onmouseout="this.style.color='#aebbc7'">📣 Telegram</a>`
        : "";
    }

    if (lbMain) lbMain.innerHTML = `<div class="spinner" style="margin:8px auto;"></div>`;
    if (lbSubs) lbSubs.innerHTML = "";
    lbModal?.classList.add("open");

    // Ростер из кэша или запрос
    let roster = rosterCache[teamId];
    if (!roster && teamId) {
      try {
        const d = await fetch(`/api/leaderboard/rosters?ids=${teamId}`).then((r) => r.json());
        Object.assign(rosterCache, d);
        window.__rosterCache = rosterCache;
        roster = rosterCache[teamId];
      } catch {}
    }
    paintRoster(roster, tag);
  });

  function paintRoster(roster, tag) {
    if (!roster) {
      if (lbMain) lbMain.innerHTML = `<span style="color:#5c6b7f;font-size:13px;">Нет данных</span>`;
      return;
    }
    if (lbMain) lbMain.innerHTML = chips(roster.members || []);
    if (lbSubs) lbSubs.innerHTML = chips(roster.subs    || []);

    // Имя команды → ссылка на team.html
    if (lbTeamName && tag && !lbTeamName.querySelector("a")) {
      const t = lbTeamName.textContent;
      lbTeamName.innerHTML =
        `<a href="/team.html?tag=${encodeURIComponent(tag)}"
            style="color:inherit;text-decoration:none;border-bottom:1px solid rgba(230,176,34,.35);transition:color .15s"
            onmouseover="this.style.color='#e6b022'" onmouseout="this.style.color=''">${x(t)}</a>`;
    }
  }

  function chips(players) {
    if (!players.length)
      return `<span style="color:#5c6b7f;font-size:12px;">—</span>`;
    return players
      .map((p) => {
        const name = x(p.displayName || "—");
        const style = `display:inline-flex;align-items:center;padding:6px 12px;border-radius:6px;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
          color:#aebbc7;font-size:13px;font-weight:600;transition:all .15s;white-space:nowrap;
          text-decoration:none;`;
        if (p.steamId)
          return `<a href="/profile.html?id=${p.steamId}" style="${style}"
            onmouseover="this.style.background='rgba(230,176,34,.1)';this.style.borderColor='rgba(230,176,34,.3)';this.style.color='#e6b022'"
            onmouseout="this.style.background='rgba(255,255,255,.04)';this.style.borderColor='rgba(255,255,255,.08)';this.style.color='#aebbc7'"
          >${name}</a>`;
        return `<span style="${style}">${name}</span>`;
      })
      .join("");
  }

  lbClose?.addEventListener("click", () => lbModal?.classList.remove("open"));
  lbModal?.addEventListener("click", (e) => {
    if (e.target === lbModal) lbModal.classList.remove("open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") lbModal?.classList.remove("open");
  });

  // ── Rating modal ──────────────────────────────────────────────────────────
  ratingBtn?.addEventListener("click", () => {
    if (ratingModal) ratingModal.style.display = "flex";
  });
  modalClose?.addEventListener("click", () => {
    if (ratingModal) ratingModal.style.display = "none";
  });
  ratingModal?.addEventListener("click", (e) => {
    if (e.target === ratingModal) ratingModal.style.display = "none";
  });

  // ── Escape helper ─────────────────────────────────────────────────────────
  function x(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  init();
})();