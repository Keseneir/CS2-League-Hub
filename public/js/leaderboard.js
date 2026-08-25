/**
 * public/js/leaderboard.js — фронтенд таблицы лидеров
 * Использует inline-стили → работает независимо от style.css классов.
 */
(function () {
  "use strict";

  let allRows     = [];
  let rosterCache = {};

  const $ = (id) => document.getElementById(id);

  // ── Цветной плейсхолдер вместо лого (хэш названия → стабильный оттенок) ──
  function teamColor(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 55%, 42%)`;
  }
  function teamInitialsHtml(tag, name, fontSize) {
    const label = (tag || name || "?").replace(/[^a-zA-Zа-яА-Я0-9]/g, "").slice(0, 2).toUpperCase() || "?";
    const bg    = teamColor(tag || name || "?");
    return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:${bg};color:#fff;font-family:'Montserrat',sans-serif;font-weight:800;font-size:${fontSize || 12}px;">${label}</div>`;
  }

  const tableContainer = $("tableContainer");
  const teamSearch     = $("teamSearch");
  const seasonSelect   = $("seasonSelect");
  const updateTimeEl   = $("updateTime");
  const seasonLabelEl  = document.querySelector(".season-label");
  const lbModal        = $("lbRosterModal");
  const lbClose        = $("lbRosterClose");
  const lbMain         = $("lbRosterMain");
  const lbSubs         = $("lbRosterSubs");
  const lbTeamName     = $("lbRosterTeamName");
  const lbAvatar       = $("lbRosterAvatar");
  const lbTelegram     = $("lbRosterTelegram");
  const ratingBtn      = $("ratingBtn");
  const ratingModal    = $("ratingModal");
  const modalClose     = $("modalClose");

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
    } catch {
      tableContainer.innerHTML =
        `<div class="state-box"><p style="color:#e05c5c">Ошибка загрузки. Обновите страницу.</p></div>`;
    }
  }

  // ── Season select ─────────────────────────────────────────────────────────
  function buildSeasonSelect(seasons, activeSid) {
    if (!seasonSelect) return;
    seasonSelect.innerHTML = "";
    if (!seasons.length) { seasonSelect.innerHTML = "<option>Нет сезонов</option>"; return; }
    seasons.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s._id;
      opt.textContent = s.name || `Сезон ${s._id.slice(-4)}`;
      opt.selected = s._id === activeSid;
      seasonSelect.appendChild(opt);
    });
  }

  seasonSelect?.addEventListener("change", async () => {
    tableContainer.innerHTML =
      `<div class="state-box"><div class="spinner"></div><p>Загрузка...</p></div>`;
    try {
      const data = await fetch(`/api/leaderboard/${seasonSelect.value}`).then(r => r.json());
      renderLeaderboard(data);
    } catch {
      tableContainer.innerHTML =
        `<div class="state-box"><p style="color:#e05c5c">Ошибка загрузки.</p></div>`;
    }
  });

  // ── Render ────────────────────────────────────────────────────────────────
  function renderLeaderboard({ season, rows }) {
    allRows = rows || [];
    if (seasonLabelEl)
      seasonLabelEl.innerHTML = season ? `${iconSvg("trophy")} ${season.name || "Текущий сезон"}` : `${iconSvg("trophy")} Нет данных`;
    if (updateTimeEl)
      updateTimeEl.textContent = new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });

    // Кэши для ростер-патча
    window.__teamNameToId = {};
    allRows.forEach(r => { if (r.teamId) window.__teamNameToId[r.team] = r.teamId.toString(); });

    // Предзагрузка ростеров
    const ids = allRows.map(r => r.teamId).filter(Boolean);
    if (ids.length) {
      fetch(`/api/leaderboard/rosters?ids=${ids.join(",")}`)
        .then(r => r.json())
        .then(d => { Object.assign(rosterCache, d); window.__rosterCache = rosterCache; })
        .catch(() => {});
    }

    renderRows(allRows);
  }

  // ── Table ─────────────────────────────────────────────────────────────────
  // ── Карточное отображение для мобильных (вместо grid-таблицы с
  // фиксированными пиксельными колонками, которая не сжимается уже
  // текста и толкает всю страницу в горизонтальный overflow) ──────────────
  function renderCards(rows) {
    const wrap = document.createElement("div");
    wrap.style.cssText = "display:flex;flex-direction:column;gap:8px;";

    rows.forEach((row, i) => {
      const rank = i + 1;
      const rankColors = { 1: "#e6b022", 2: "#b0b8c8", 3: "#c07840" };
      const rankColor  = rankColors[rank] || "#5c6b7f";
      const rowBg      = rank === 1 ? "rgba(230,176,34,0.05)"
                       : rank === 2 ? "rgba(176,184,200,0.04)"
                       : rank === 3 ? "rgba(192,120,64,0.04)"
                       : "rgba(255,255,255,0.015)";
      const wr      = row.wr || 0;
      const barColor = wr >= 60 ? "#4caf82" : wr >= 40 ? "#e6b022" : "#e05c5c";
      const rd    = row.roundDiff || 0;
      const rdCol = rd >= 0 ? "#4caf82" : "#e05c5c";

      const card = document.createElement("div");
      card.dataset.teamId  = row.teamId || "";
      card.dataset.teamTag = row.tag    || "";
      card.style.cssText = `
        background:${rowBg};
        border:1px solid rgba(255,255,255,0.05);
        border-radius:10px;
        padding:12px 14px;
      `;

      const logoHtml = row.logo
        ? `<img src="${x(row.logo)}" style="width:36px;height:36px;border-radius:6px;object-fit:cover;display:block;" onerror="this.parentElement.innerHTML=teamInitialsHtml('${x(row.tag)}','${x(row.team)}',13)">`
        : teamInitialsHtml(row.tag, row.team, 13);

      card.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="display:flex;flex-direction:column;align-items:center;gap:1px;flex-shrink:0;width:22px;">
            <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:15px;color:${rankColor};">${rank}</span>
            ${row.isKingOfHill ? `<span style="font-size:10px;" title="Царь горы">${iconSvg("crown")}</span>` : ""}
          </div>
          <div style="width:36px;height:36px;border-radius:6px;background:#1a2128;border:1px solid #2a3340;flex-shrink:0;overflow:hidden;">${logoHtml}</div>
          <div style="min-width:0;flex:1;overflow:hidden;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
              <a href="/team.html?tag=${x(row.tag)}"
                 style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:14px;color:#e0e6ed;text-decoration:none;">${x(row.team)}</a>
              <span style="font-size:11px;color:#4a5568;font-weight:700;">[${x(row.tag)}]</span>
              ${row.winStreak >= 3 ? `<span style="font-size:10px;background:rgba(255,100,0,0.12);border:1px solid rgba(255,100,0,0.25);color:#ff6400;border-radius:4px;padding:1px 5px;font-family:'Montserrat',sans-serif;font-weight:700;display:inline-flex;align-items:center;gap:2px;">${iconSvg("flame")}${row.winStreak}</span>` : ""}
            </div>
            <div style="font-size:11px;color:#4a5568;margin-top:1px;">${row.rosterSize || 0} игр.</div>
          </div>
          <div style="text-align:right;flex-shrink:0;">
            <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:16px;color:#e6b022;">${row.pts}</div>
            <div style="font-size:10px;color:#5c6b7f;text-transform:uppercase;letter-spacing:0.5px;">очков</div>
          </div>
        </div>

        <div style="display:flex;align-items:center;gap:14px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.05);">
          <div style="display:flex;gap:8px;font-size:12px;font-weight:700;flex-shrink:0;">
            <span style="color:#4caf82;">${row.wins}В</span>
            <span style="color:#3a4552;">·</span>
            <span style="color:#e05c5c;">${row.losses}П</span>
          </div>
          <div style="flex:1;display:flex;align-items:center;gap:6px;min-width:0;">
            <div style="flex:1;height:5px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;">
              <div style="width:${wr}%;height:100%;background:${barColor};border-radius:3px;"></div>
            </div>
            <span style="font-size:11px;font-weight:700;color:${barColor};flex-shrink:0;">${wr}%</span>
          </div>
          <div style="font-size:12px;font-weight:700;color:${rdCol};flex-shrink:0;">${(rd > 0 ? "+" : "") + rd} RD</div>
        </div>

        <button class="btn-roster"
          data-team-id="${row.teamId || ""}"
          data-team-name="${x(row.team || "")}"
          data-team-tag="${x(row.tag || "")}"
          data-team-logo="${x(row.logo || "")}"
          data-team-telegram="${x(row.telegram || "")}"
          style="
            width:100%;margin-top:10px;
            background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
            color:#aebbc7;border-radius:6px;padding:8px;
            font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;
          "
        >Состав команды</button>
      `;
      wrap.appendChild(card);
    });

    tableContainer.innerHTML = "";
    tableContainer.appendChild(wrap);
  }

  function renderRows(rows) {
    if (!rows.length) {
      tableContainer.innerHTML = `<div class="state-box"><p>Нет команд для отображения.</p></div>`;
      return;
    }

    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (isMobile) { renderCards(rows); return; }

    // Обёртка таблицы
    const wrap = document.createElement("div");
    wrap.style.cssText = "width:100%;overflow-x:auto;";

    // Шапка
    const header = document.createElement("div");
    header.style.cssText = `
      display:grid;
      grid-template-columns: 48px 1fr 72px 52px 52px 130px 60px 90px;
      gap:0;
      padding:0 16px;
      background:rgba(230,176,34,0.06);
      border:1px solid rgba(230,176,34,0.18);
      border-radius:8px;
      margin-bottom:4px;
    `;
    header.innerHTML = [
      { label: "#",       align: "center" },
      { label: "КОМАНДА", align: "left"   },
      { label: "ОЧКИ",    align: "center" },
      { label: "В",       align: "center" },
      { label: "П",       align: "center" },
      { label: "WINRATE", align: "left"   },
      { label: "RD",      align: "center" },
      { label: "",        align: "center" },
    ].map(col => `
      <div style="
        padding:10px 6px;
        font-family:'Montserrat',sans-serif;font-weight:800;
        font-size:10px;letter-spacing:1.5px;text-transform:uppercase;
        color:#5c6b7f;text-align:${col.align};
      ">${col.label}</div>
    `).join("");
    wrap.appendChild(header);

    // Строки
    const rowsWrap = document.createElement("div");
    rowsWrap.style.cssText = "display:flex;flex-direction:column;gap:3px;";

    rows.forEach((row, i) => {
      const rank = i + 1;
      const rankColors = { 1: "#e6b022", 2: "#b0b8c8", 3: "#c07840" };
      const rankColor  = rankColors[rank] || "#5c6b7f";
      const rowBg      = rank === 1 ? "rgba(230,176,34,0.05)"
                       : rank === 2 ? "rgba(176,184,200,0.04)"
                       : rank === 3 ? "rgba(192,120,64,0.04)"
                       : "rgba(255,255,255,0.015)";

      const tr = document.createElement("div");
      tr.dataset.teamId  = row.teamId || "";
      tr.dataset.teamTag = row.tag    || "";
      tr.style.cssText = `
        display:grid;
        grid-template-columns: 48px 1fr 72px 52px 52px 130px 60px 90px;
        gap:0;align-items:center;
        padding:0 16px;
        background:${rowBg};
        border:1px solid rgba(255,255,255,0.05);
        border-radius:8px;
        transition:border-color .15s,background .15s;
        cursor:default;
      `;
      tr.onmouseover = () => { tr.style.borderColor = "rgba(230,176,34,0.25)"; tr.style.background = `${rowBg.replace("0.0","0.08")}`; };
      tr.onmouseout  = () => { tr.style.borderColor = "rgba(255,255,255,0.05)"; tr.style.background = rowBg; };

      // 1. Ранг
      const rankCell = document.createElement("div");
      rankCell.style.cssText = "display:flex;flex-direction:column;align-items:center;gap:2px;padding:12px 0;";
      rankCell.innerHTML = `
        <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:16px;color:${rankColor};">${rank}</span>
        ${row.isKingOfHill ? `<span style="font-size:11px;" title="Царь горы">${iconSvg("crown")}</span>` : ""}
      `;

      // 2. Команда
      const teamCell = document.createElement("div");
      teamCell.style.cssText = "display:flex;align-items:center;gap:10px;padding:12px 8px;min-width:0;overflow:hidden;";

      const logoEl = document.createElement("div");
      logoEl.style.cssText = "width:32px;height:32px;border-radius:6px;background:#1a2128;border:1px solid #2a3340;flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:14px;";
      if (row.logo) {
        const img = document.createElement("img");
        img.src = row.logo;
        img.style.cssText = "width:32px;height:32px;object-fit:cover;display:block;";
        img.onerror = () => { logoEl.innerHTML = teamInitialsHtml(row.tag, row.team, 12); };
        logoEl.appendChild(img);
      } else {
        logoEl.innerHTML = teamInitialsHtml(row.tag, row.team, 12);
      }

      const nameWrap = document.createElement("div");
      nameWrap.style.cssText = "min-width:0;overflow:hidden;";
      nameWrap.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
          <a href="/team.html?tag=${x(row.tag)}"
             style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:13px;
                    color:#e0e6ed;text-decoration:none;white-space:nowrap;
                    transition:color .15s;"
             onmouseover="this.style.color='#e6b022'" onmouseout="this.style.color='#e0e6ed'"
          >${x(row.team)}</a>
          <span style="font-size:11px;color:#4a5568;font-weight:700;">[${x(row.tag)}]</span>
          ${row.winStreak >= 3 ? `<span style="font-size:11px;background:rgba(255,100,0,0.12);border:1px solid rgba(255,100,0,0.25);color:#ff6400;border-radius:4px;padding:1px 6px;font-family:'Montserrat',sans-serif;font-weight:700;display:inline-flex;align-items:center;gap:2px;">${iconSvg("flame")}${row.winStreak}</span>` : ""}
        </div>
        <div style="font-size:11px;color:#4a5568;margin-top:1px;">${row.rosterSize || 0} игр.</div>
      `;

      teamCell.appendChild(logoEl);
      teamCell.appendChild(nameWrap);

      // 3. Очки
      const ptsCell = document.createElement("div");
      ptsCell.style.cssText = "text-align:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:15px;color:#e6b022;padding:12px 4px;";
      ptsCell.textContent = row.pts;

      // 4. Победы
      const wCell = document.createElement("div");
      wCell.style.cssText = "text-align:center;font-weight:700;font-size:13px;color:#4caf82;padding:12px 4px;";
      wCell.textContent = row.wins;

      // 5. Поражения
      const lCell = document.createElement("div");
      lCell.style.cssText = "text-align:center;font-weight:700;font-size:13px;color:#e05c5c;padding:12px 4px;";
      lCell.textContent = row.losses;

      // 6. WinRate bar
      const wrCell = document.createElement("div");
      wrCell.style.cssText = "padding:12px 8px;";
      const wr = row.wr || 0;
      const barColor = wr >= 60 ? "#4caf82" : wr >= 40 ? "#e6b022" : "#e05c5c";
      wrCell.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;">
          <div style="flex:1;height:5px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;">
            <div style="width:${wr}%;height:100%;background:${barColor};border-radius:3px;transition:width .4s;"></div>
          </div>
          <span style="font-size:11px;font-weight:700;color:${barColor};min-width:32px;text-align:right;">${wr}%</span>
        </div>
      `;

      // 7. Round Diff
      const rdCell = document.createElement("div");
      const rd    = row.roundDiff || 0;
      const rdCol = rd >= 0 ? "#4caf82" : "#e05c5c";
      rdCell.style.cssText = `text-align:center;font-weight:700;font-size:13px;color:${rdCol};padding:12px 4px;`;
      rdCell.textContent = (rd > 0 ? "+" : "") + rd;

      // 8. Состав кнопка
      const rosterCell = document.createElement("div");
      rosterCell.style.cssText = "text-align:center;padding:12px 8px;";
      const btn = document.createElement("button");
      btn.dataset.teamId       = row.teamId || "";
      btn.dataset.teamName     = row.team   || "";
      btn.dataset.teamTag      = row.tag    || "";
      btn.dataset.teamLogo     = row.logo   || "";
      btn.dataset.teamTelegram = row.telegram || "";
      btn.textContent = "Состав";
      btn.className   = "btn-roster";
      btn.style.cssText = `
        background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);
        color:#aebbc7;border-radius:6px;padding:5px 12px;
        font-family:'Montserrat',sans-serif;font-weight:700;font-size:11px;
        cursor:pointer;transition:all .15s;white-space:nowrap;
      `;
      btn.onmouseover = () => { btn.style.borderColor="rgba(230,176,34,0.4)"; btn.style.color="#e6b022"; };
      btn.onmouseout  = () => { btn.style.borderColor="rgba(255,255,255,0.1)"; btn.style.color="#aebbc7"; };
      rosterCell.appendChild(btn);

      tr.appendChild(rankCell);
      tr.appendChild(teamCell);
      tr.appendChild(ptsCell);
      tr.appendChild(wCell);
      tr.appendChild(lCell);
      tr.appendChild(wrCell);
      tr.appendChild(rdCell);
      tr.appendChild(rosterCell);
      rowsWrap.appendChild(tr);
    });

    wrap.appendChild(rowsWrap);
    tableContainer.innerHTML = "";
    tableContainer.appendChild(wrap);
  }

  // ── Search ────────────────────────────────────────────────────────────────
  teamSearch?.addEventListener("input", () => {
    const q = teamSearch.value.trim().toLowerCase();
    renderRows(q
      ? allRows.filter(r => r.team.toLowerCase().includes(q) || r.tag.toLowerCase().includes(q))
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

    if (lbTeamName) lbTeamName.textContent = name;
    if (lbAvatar) {
      if (logo) {
        lbAvatar.innerHTML = "";
        const img = document.createElement("img");
        img.src = logo;
        img.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:8px;";
        img.onerror = () => { lbAvatar.innerHTML = teamInitialsHtml(tag, name, 18); };
        lbAvatar.appendChild(img);
      } else {
        lbAvatar.innerHTML = teamInitialsHtml(tag, name, 18);
      }
    }
    if (lbTelegram) {
      lbTelegram.style.display = telegram ? "" : "none";
      lbTelegram.innerHTML = telegram
        ? `<a href="${x(telegramUrl(telegram))}" target="_blank" rel="noopener"
              style="display:inline-flex;align-items:center;gap:5px;color:#aebbc7;text-decoration:none;
                     font-size:12px;background:#1a2128;border:1px solid #2a3340;border-radius:6px;padding:5px 10px;"
              onmouseover="this.style.color='#e6b022'" onmouseout="this.style.color='#aebbc7'">${iconSvg("megaphone")} Telegram</a>`
        : "";
    }

    if (lbMain) lbMain.innerHTML = `<div class="spinner" style="margin:8px auto;"></div>`;
    if (lbSubs) lbSubs.innerHTML = "";
    lbModal?.classList.add("open");

    let roster = rosterCache[teamId];
    if (!roster && teamId) {
      try {
        const d = await fetch(`/api/leaderboard/rosters?ids=${teamId}`).then(r => r.json());
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

    // Имя → ссылка на страницу команды
    if (lbTeamName && tag && !lbTeamName.querySelector("a")) {
      const t = lbTeamName.textContent;
      lbTeamName.innerHTML = `<a href="/team.html?tag=${encodeURIComponent(tag)}"
        style="color:inherit;text-decoration:none;border-bottom:1px solid rgba(230,176,34,.35);transition:color .15s"
        onmouseover="this.style.color='#e6b022'" onmouseout="this.style.color=''">${x(t)}</a>`;
    }
  }

  function chips(players) {
    if (!players.length) return `<span style="color:#5c6b7f;font-size:12px;">—</span>`;
    const chip = `display:inline-flex;align-items:center;padding:6px 12px;border-radius:6px;
      background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);
      color:#aebbc7;font-size:13px;font-weight:600;transition:all .15s;white-space:nowrap;text-decoration:none;`;
    return players.map(p => {
      const name = x(p.displayName || "—");
      if (p.steamId) {
        return `<a href="/profile.html?id=${p.steamId}" style="${chip}"
          onmouseover="this.style.background='rgba(230,176,34,.1)';this.style.borderColor='rgba(230,176,34,.3)';this.style.color='#e6b022'"
          onmouseout="this.style.background='rgba(255,255,255,.04)';this.style.borderColor='rgba(255,255,255,.08)';this.style.color='#aebbc7'"
        >${name}</a>`;
      }
      return `<span style="${chip}">${name}</span>`;
    }).join("");
  }

  lbClose?.addEventListener("click",  () => lbModal?.classList.remove("open"));
  lbModal?.addEventListener("click",  e => { if (e.target === lbModal) lbModal.classList.remove("open"); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") lbModal?.classList.remove("open"); });

  // ── Rating modal ──────────────────────────────────────────────────────────
  ratingBtn?.addEventListener("click",  () => { if (ratingModal) ratingModal.style.display = "flex"; });
  modalClose?.addEventListener("click", () => { if (ratingModal) ratingModal.style.display = "none"; });
  ratingModal?.addEventListener("click", e => { if (e.target === ratingModal) ratingModal.style.display = "none"; });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function x(s) {
    return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  // team.telegram в базе может лежать в разных форматах (юзернейм, @юзернейм,
  // t.me/юзернейм, полная https-ссылка — у старых команд, сохранённых до фикса
  // на странице команды) — всегда приводим к полноценной ссылке t.me/username,
  // иначе браузер трактует "@name" как относительный путь и ломает ссылку.
  function telegramUrl(raw) {
    const clean = String(raw || "")
      .trim()
      .replace(/^https?:\/\/(www\.)?t\.me\//i, "")
      .replace(/^t\.me\//i, "")
      .replace(/^@/, "")
      .replace(/\/+$/, "");
    return clean ? `https://t.me/${clean}` : "";
  }

  // ── Пересобираем таблицу/карточки при повороте телефона или ресайзе окна,
  // раз выбор между ними зависит от ширины экрана.
  let _resizeTimer = null;
  let _wasMobile = window.matchMedia("(max-width: 640px)").matches;
  window.addEventListener("resize", () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      const isMobileNow = window.matchMedia("(max-width: 640px)").matches;
      if (isMobileNow !== _wasMobile && allRows.length) {
        _wasMobile = isMobileNow;
        renderRows(allRows);
      }
    }, 200);
  });

  init();
})();