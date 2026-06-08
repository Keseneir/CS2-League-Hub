/* ================================================
   public/js/leaderboard.js
   Таблица лидеров — CS2 League Hub
   ================================================ */
(function () {
  'use strict';

  // ── DOM-элементы ─────────────────────────────────────────────────────────
  const tableContainer = document.getElementById('tableContainer');
  const seasonSelect   = document.getElementById('seasonSelect');
  const teamSearch     = document.getElementById('teamSearch');
  const updateTime     = document.getElementById('updateTime');
  const seasonLabel    = document.querySelector('.season-label');

  // Ростер-модал (lbRosterModal — новый, из нижней части HTML)
  const rosterModal    = document.getElementById('lbRosterModal');
  const rosterAvatar   = document.getElementById('lbRosterAvatar');
  const rosterTeamName = document.getElementById('lbRosterTeamName');
  const rosterTelegram = document.getElementById('lbRosterTelegram');
  const rosterMain     = document.getElementById('lbRosterMain');
  const rosterSubs     = document.getElementById('lbRosterSubs');
  const rosterClose    = document.getElementById('lbRosterClose');

  // ── Состояние ─────────────────────────────────────────────────────────────
  let allRows         = [];   // все строки текущего сезона
  let searchQuery     = '';
  let currentSeasonId = null;

  // ── Утилиты ───────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Чип игрока (со ссылкой если есть steamId) */
  function playerChip(player) {
    const style = [
      'display:inline-flex', 'align-items:center', 'padding:6px 12px',
      'border-radius:6px', 'background:rgba(255,255,255,0.04)',
      'border:1px solid rgba(255,255,255,0.08)', 'color:#aebbc7',
      'font-size:13px', 'font-weight:600', 'transition:all .15s',
      'white-space:nowrap', 'text-decoration:none',
    ].join(';');

    const hover   = "this.style.background='rgba(230,176,34,0.1)';this.style.borderColor='rgba(230,176,34,0.3)';this.style.color='#e6b022'";
    const unhover = "this.style.background='rgba(255,255,255,0.04)';this.style.borderColor='rgba(255,255,255,0.08)';this.style.color='#aebbc7'";

    if (player.steamId) {
      return `<a href="/profile.html?id=${esc(player.steamId)}"
                 style="${style}" onmouseover="${hover}" onmouseout="${unhover}"
              >${esc(player.displayName)}</a>`;
    }
    return `<span style="${style}">${esc(player.displayName)}</span>`;
  }

  // ── UI-состояния ──────────────────────────────────────────────────────────
  function showLoading() {
    tableContainer.innerHTML = `
      <div class="state-box">
        <div class="spinner"></div>
        <p>Загрузка данных...</p>
      </div>`;
  }

  function showEmpty(msg) {
    tableContainer.innerHTML = `
      <div class="state-box">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#3a4555"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p style="color:#5c6b7f;">${esc(msg)}</p>
      </div>`;
  }

  function showError(msg) {
    tableContainer.innerHTML = `
      <div class="state-box">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e05c5c"
             stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px;">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style="color:#e05c5c;">${esc(msg)}</p>
      </div>`;
  }

  // ── Рендер таблицы ────────────────────────────────────────────────────────
  function renderTable(rows) {
    if (!rows.length) {
      showEmpty(searchQuery ? 'Команды не найдены' : 'Нет данных для отображения');
      return;
    }

    const tbody = rows.map((row, i) => {
      const rank = i + 1;

      // Иконка места
      const rankEl = rank === 1
        ? `<span style="font-size:20px;line-height:1;">🥇</span>`
        : rank === 2
        ? `<span style="font-size:20px;line-height:1;">🥈</span>`
        : rank === 3
        ? `<span style="font-size:20px;line-height:1;">🥉</span>`
        : `<span style="font-family:'Montserrat',sans-serif;font-weight:700;
                        font-size:14px;color:#3a4555;">${rank}</span>`;

      // Лого команды
      const logo = row.logo
        ? `<img src="${esc(row.logo)}" alt=""
               style="width:34px;height:34px;border-radius:7px;object-fit:cover;
                      flex-shrink:0;border:1px solid rgba(255,255,255,0.06);"
               onerror="this.style.display='none'">`
        : `<div style="width:34px;height:34px;border-radius:7px;flex-shrink:0;
                       background:rgba(230,176,34,0.12);border:1px solid rgba(230,176,34,0.2);
                       display:flex;align-items:center;justify-content:center;
                       font-family:'Montserrat',sans-serif;font-weight:800;
                       font-size:11px;color:#e6b022;letter-spacing:0.5px;">
              ${esc((row.tag || '?').slice(0, 2).toUpperCase())}
           </div>`;

      // Бейджи
      const kingBadge = row.isKingOfHill
        ? `<span title="Царь горы" style="font-size:13px;line-height:1;">👑</span>` : '';
      const streakBadge = row.winStreak >= 2
        ? `<span style="font-size:10px;font-family:'Montserrat',sans-serif;font-weight:700;
                        background:rgba(249,115,22,0.12);border:1px solid rgba(249,115,22,0.28);
                        color:#f97316;border-radius:4px;padding:2px 6px;
                        margin-left:4px;white-space:nowrap;">🔥 ${row.winStreak}</span>` : '';

      // Разница раундов
      const diffVal = row.roundDiff > 0 ? `+${row.roundDiff}` : `${row.roundDiff}`;
      const diffClr = row.roundDiff > 0 ? '#4ade80' : row.roundDiff < 0 ? '#f87171' : '#5c6b7f';

      // Цвет WR
      const wrClr = row.wr >= 60 ? '#4ade80' : row.wr >= 40 ? '#aebbc7' : '#f87171';

      return `
        <tr data-team-id="${esc(row.teamId)}" data-team-tag="${esc(row.tag)}"
            style="cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.04);
                   transition:background .12s;"
            onmouseover="this.style.background='rgba(230,176,34,0.04)'"
            onmouseout="this.style.background=''">

          <td style="padding:12px 8px;text-align:center;width:52px;">${rankEl}</td>

          <td style="padding:12px 8px;">
            <div style="display:flex;align-items:center;gap:10px;">
              ${logo}
              <div style="min-width:0;">
                <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                  <span style="font-family:'Montserrat',sans-serif;font-weight:700;
                               font-size:14px;color:#fff;white-space:nowrap;overflow:hidden;
                               text-overflow:ellipsis;">${esc(row.team)}</span>
                  ${kingBadge}${streakBadge}
                </div>
                <div style="font-size:11px;color:#5c6b7f;margin-top:2px;
                            font-family:'Montserrat',sans-serif;">[${esc(row.tag)}]</div>
              </div>
            </div>
          </td>

          <td style="padding:12px 8px;text-align:center;">
            <span style="font-family:'Montserrat',sans-serif;font-weight:800;
                         font-size:16px;color:#e6b022;">${row.pts}</span>
          </td>

          <td style="padding:12px 8px;text-align:center;
                     font-weight:700;font-size:14px;color:#4ade80;">${row.wins}</td>

          <td style="padding:12px 8px;text-align:center;
                     font-weight:700;font-size:14px;color:#f87171;">${row.losses}</td>

          <td style="padding:12px 8px;text-align:center;
                     font-size:14px;color:#aebbc7;">${row.matches}</td>

          <td style="padding:12px 8px;text-align:center;
                     font-weight:600;font-size:14px;color:${wrClr};">${row.wr}%</td>

          <td style="padding:12px 8px;text-align:center;
                     font-weight:600;font-size:14px;color:${diffClr};">${diffVal}</td>

          <td style="padding:12px 8px;text-align:center;
                     font-size:13px;color:#aebbc7;">${row.rosterSize || '—'}</td>
        </tr>`;
    }).join('');

    const thStyle = `padding:10px 8px;font-size:10px;font-family:'Montserrat',sans-serif;
                     font-weight:700;text-transform:uppercase;letter-spacing:1.2px;
                     color:#3a4555;border-bottom:1px solid #1f252c;white-space:nowrap;`;

    tableContainer.innerHTML = `
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${thStyle}text-align:center;">#</th>
            <th style="${thStyle}text-align:left;">Команда</th>
            <th style="${thStyle}text-align:center;color:#e6b022;" title="Очки рейтинга">Очки</th>
            <th style="${thStyle}text-align:center;" title="Победы">В</th>
            <th style="${thStyle}text-align:center;" title="Поражения">П</th>
            <th style="${thStyle}text-align:center;" title="Матчей сыграно">И</th>
            <th style="${thStyle}text-align:center;" title="Процент побед">WR%</th>
            <th style="${thStyle}text-align:center;" title="Разница раундов">±Раунды</th>
            <th style="${thStyle}text-align:center;" title="Размер ростера">Ростер</th>
          </tr>
        </thead>
        <tbody>${tbody}</tbody>
      </table>`;

    // Клик по строке → открыть ростер
    tableContainer.querySelectorAll('tr[data-team-id]').forEach(tr => {
      tr.addEventListener('click', () => openRoster(tr.dataset.teamId, tr.dataset.teamTag));
    });
  }

  // ── Фильтрация ────────────────────────────────────────────────────────────
  function applyFilter() {
    const q = searchQuery.toLowerCase().trim();
    const filtered = q
      ? allRows.filter(r =>
          r.team.toLowerCase().includes(q) || r.tag.toLowerCase().includes(q))
      : allRows;
    renderTable(filtered);
  }

  // ── Загрузка лидерборда ───────────────────────────────────────────────────
  async function loadLeaderboard(seasonId) {
    showLoading();
    try {
      const url = seasonId
        ? `/api/leaderboard/${encodeURIComponent(seasonId)}`
        : '/api/leaderboard/';

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.error) { showError(data.error); return; }

      allRows = data.rows || [];

      // Метка сезона
      if (seasonLabel) {
        seasonLabel.textContent = data.season
          ? `🏆 ${data.season.name || 'Текущий сезон'}`
          : '🏆 Нет активного сезона';
      }

      // Время обновления
      if (updateTime) {
        updateTime.textContent = new Date().toLocaleTimeString('ru-RU', {
          hour: '2-digit', minute: '2-digit',
        });
      }

      // Событие для inline-патча в HTML (заполняет window.__teamNameToId)
      document.dispatchEvent(new CustomEvent('lbDataLoaded', {
        detail: { rows: allRows },
      }));

      applyFilter();
    } catch (err) {
      console.error('[Leaderboard] ошибка загрузки:', err);
      showError('Ошибка загрузки данных. Попробуйте обновить страницу.');
    }
  }

  // ── Загрузка сезонов ──────────────────────────────────────────────────────
  async function loadSeasons() {
    try {
      const res = await fetch('/api/seasons');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const seasons = await res.json();

      if (!Array.isArray(seasons) || !seasons.length) {
        if (seasonSelect) seasonSelect.innerHTML = '<option disabled>Нет сезонов</option>';
        return;
      }

      if (seasonSelect) {
        seasonSelect.innerHTML = seasons
          .map(s => `<option value="${esc(s._id)}">${esc(s.name || 'Сезон')}</option>`)
          .join('');

        const active = seasons.find(s => s.isActive) || seasons[0];
        seasonSelect.value = active._id;
        currentSeasonId    = active._id;
      }
    } catch (err) {
      console.error('[Leaderboard] ошибка загрузки сезонов:', err);
      if (seasonSelect) seasonSelect.innerHTML = '<option disabled>Ошибка загрузки</option>';
    }
  }

  // ── Ростер-модал ──────────────────────────────────────────────────────────
  function openRoster(teamId, tag) {
    if (!teamId || !rosterModal) return;

    // Устанавливаем текущую команду (для inline-патча)
    window.__lbCurrentTeam = { id: teamId, tag };

    // Сброс контента
    if (rosterTeamName) rosterTeamName.textContent    = '';
    if (rosterMain)     rosterMain.innerHTML          = '<span style="color:#5c6b7f;font-size:13px;">Загрузка...</span>';
    if (rosterSubs)     rosterSubs.innerHTML          = '';
    if (rosterAvatar)   rosterAvatar.innerHTML        = '';
    if (rosterTelegram) { rosterTelegram.innerHTML = ''; rosterTelegram.style.display = 'none'; }

    // Сразу показать данные из уже загруженной таблицы
    const rowData = allRows.find(r => String(r.teamId) === String(teamId));
    if (rowData) {
      if (rosterTeamName) rosterTeamName.textContent = rowData.team;

      if (rosterAvatar && rowData.logo) {
        rosterAvatar.innerHTML = `
          <img src="${esc(rowData.logo)}" alt="${esc(rowData.tag)}"
               style="width:100%;height:100%;object-fit:cover;border-radius:8px;"
               onerror="this.parentElement.innerHTML=''">`;
      }

      if (rosterTelegram && rowData.telegram) {
        const handle = rowData.telegram.replace('@', '');
        rosterTelegram.innerHTML = `
          <a href="https://t.me/${esc(handle)}" target="_blank" rel="noopener"
             style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;
                    border-radius:8px;background:rgba(41,182,246,0.1);
                    border:1px solid rgba(41,182,246,0.25);color:#29b6f6;
                    text-decoration:none;font-size:13px;font-weight:600;">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.9 8.2-2 9.4c-.1.6-.5.8-.9.5l-2.6-1.9-1.2 1.2c-.1.1-.3.2-.6.2l.2-2.7 4.9-4.4c.2-.2 0-.3-.3-.1L6.6 15.4 4 14.6c-.6-.2-.6-.6.1-.8l10.9-4.2c.5-.2 1 .1.9.6z"/>
            </svg>
            ${esc(rowData.telegram)}
          </a>`;
        rosterTelegram.style.display = 'flex';
      }
    }

    // Показать модал
    rosterModal.classList.add('open');
    document.body.style.overflow = 'hidden';

    // Загрузить ростер с API
    fetch(`/api/leaderboard/rosters?ids=${encodeURIComponent(teamId)}`)
      .then(r => r.json())
      .then(data => {
        const team = data[String(teamId)];
        if (!team) {
          if (rosterMain) rosterMain.innerHTML =
            '<span style="color:#5c6b7f;font-size:13px;">Нет данных о составе</span>';
          return;
        }

        if (rosterMain) {
          rosterMain.innerHTML = team.members?.length
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${team.members.map(playerChip).join('')}</div>`
            : '<span style="color:#5c6b7f;font-size:13px;">Основной состав не указан</span>';
        }
        if (rosterSubs) {
          rosterSubs.innerHTML = team.subs?.length
            ? `<div style="display:flex;flex-wrap:wrap;gap:6px;">${team.subs.map(playerChip).join('')}</div>`
            : '<span style="color:#5c6b7f;font-size:13px;">Замены не указаны</span>';
        }
      })
      .catch(err => {
        console.error('[Leaderboard] ошибка ростера:', err);
        if (rosterMain) rosterMain.innerHTML =
          '<span style="color:#e05c5c;font-size:13px;">Ошибка загрузки состава</span>';
      });
  }

  function closeRoster() {
    rosterModal?.classList.remove('open');
    document.body.style.overflow = '';
    window.__lbCurrentTeam = null;
  }

  // ── Слушатели событий ─────────────────────────────────────────────────────
  rosterClose?.addEventListener('click', closeRoster);

  rosterModal?.addEventListener('click', e => {
    if (e.target === rosterModal) closeRoster();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeRoster();
  });

  seasonSelect?.addEventListener('change', () => {
    currentSeasonId = seasonSelect.value;
    loadLeaderboard(currentSeasonId);
  });

  teamSearch?.addEventListener('input', () => {
    searchQuery = teamSearch.value;
    applyFilter();
  });

  // ── Инициализация ─────────────────────────────────────────────────────────
  async function init() {
    await loadSeasons();
    await loadLeaderboard(currentSeasonId);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();