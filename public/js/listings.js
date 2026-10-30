(function () {
  "use strict";

  const TYPE_LABEL = {
    player_seeking_team: "Игрок ищет команду",
    team_seeking_player: "Команда ищет игрока",
    scrim:                "Ищут спарринг",
  };
  const TYPE_BADGE_CLASS = {
    player_seeking_team: "lh-type-player",
    team_seeking_player: "lh-type-team",
    scrim:                "lh-type-scrim",
  };
  const TYPE_HINT = {
    player_seeking_team: "Публикуется от вашего лица.",
    team_seeking_player: "Публикуется от команды. Доступно только капитану или менеджеру.",
    scrim:                "Публикуется от команды. Доступно только капитану или менеджеру.",
  };
  const TEAM_TYPES = ["team_seeking_player", "scrim"];

  let currentUser  = null; // { steamId, displayName, avatar, team, isAdmin } | null
  let currentTab   = "all";
  let editingId    = null; // если не null — форма создания работает в режиме редактирования
  let pendingImage = null; // { url, publicId } | null
  let cloudinaryCloud  = null;
  let cloudinaryPreset = null;

  // Ссылки на публичные страницы автора и команды (открываются в новой вкладке)
  function authorHref(a) { return a && a.steamId ? "/profile.html?id=" + encodeURIComponent(a.steamId) : ""; }
  function teamHref(t)   { return t && t.tag ? "/team.html?tag=" + encodeURIComponent(t.tag) : ""; }
  function linkWrap(href, innerHtml) {
    return href ? `<a class="lh-link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${innerHtml}</a>` : innerHtml;
  }

  // Экранирование для HTML-текста И значений атрибутов (кавычки обязательны: esc() используется в src="...")
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  // «1 новый отклик», «2 новых отклика», «5 новых откликов»
  function unreadLabel(n) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return `${n} новый отклик`;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return `${n} новых отклика`;
    return `${n} новых откликов`;
  }
  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return ""; }
  }

  // ── Инициализация ────────────────────────────────────────────────────
  async function init() {
    try {
      const [userRes, cfgRes] = await Promise.all([fetch("/api/user"), fetch("/api/config")]);
      currentUser = await userRes.json();
      const cfg = await cfgRes.json();
      cloudinaryCloud  = cfg.cloudinaryCloud;
      cloudinaryPreset = cfg.cloudinaryPreset;
    } catch {}

    document.querySelectorAll(".lh-tab").forEach(tab => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });
    document.getElementById("lhFilterType").addEventListener("change", loadAndRender);
    let qTimer = null;
    document.getElementById("lhFilterQ").addEventListener("input", () => {
      clearTimeout(qTimer);
      qTimer = setTimeout(loadAndRender, 300);
    });

    document.getElementById("lhBtnCreate").addEventListener("click", () => openCreateModal());

    document.querySelectorAll("[data-close]").forEach(btn => {
      btn.addEventListener("click", () => closeAllModals());
    });
    // окно жалобы (data-own-close) закрывается само, не сворачивая карточку объявления под ним
    document.querySelectorAll(".lh-overlay:not([data-own-close])").forEach(ov => {
      ov.addEventListener("click", e => { if (e.target === ov) closeAllModals(); });
    });
    document.addEventListener("keydown", e => { if (e.key === "Escape") closeAllModals(); });

    document.getElementById("lhCreateForm").addEventListener("submit", submitCreateForm);
    document.getElementById("lhFImage").addEventListener("change", handleImageUpload);
    document.getElementById("lhUploadRemove").addEventListener("click", () => {
      pendingImage = null;
      document.getElementById("lhUploadPreview").classList.remove("show");
      document.getElementById("lhFImage").value = "";
    });
    document.getElementById("lhFType").addEventListener("change", updateTypeHint);
    updateTypeHint();
    initChatUi();

    // deeplink /listings.html?tab=mine из шапки
    const params = new URLSearchParams(location.search);
    // switchTab() сама запускает загрузку и возвращает true; общую загрузку делаем только
    // если вкладка «Мои» не была открыта (нет deeplink или гость — тогда грузим публичную ленту)
    const wantedTab  = params.get("tab");
    const openedMine = (wantedTab === "mine" || wantedTab === "messages") && switchTab(wantedTab);
    if (!openedMine) loadAndRender();
  }

  function closeAllModals() {
    const hadChat = stopChat(); // останавливает опрос и снимает обработчики
    document.querySelectorAll(".lh-overlay").forEach(ov => ov.classList.remove("open"));
    if (hadChat && currentTab === "messages") loadConversations(); // обновить индикаторы непрочитанного
  }

  function switchTab(tab) {
    if ((tab === "mine" || tab === "messages") && !currentUser) {
      alert("Войдите через Steam, чтобы видеть свои объявления и сообщения.");
      return false;
    }
    currentTab = tab;
    document.querySelectorAll(".lh-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    document.getElementById("lhToolbar").style.display = tab === "all" ? "flex" : "none";
    loadAndRender();
    return true;
  }

  function updateTypeHint() {
    const type = document.getElementById("lhFType").value;
    document.getElementById("lhFTypeHint").textContent = TYPE_HINT[type] || "";
  }

  // ── Загрузка и рендер списка ─────────────────────────────────────────
  async function loadAndRender() {
    const grid     = document.getElementById("lhGrid");
    const empty    = document.getElementById("lhEmpty");
    const emptyTxt = document.getElementById("lhEmptyText");
    grid.innerHTML = "";
    empty.style.display = "none";

    const convList = document.getElementById("lhConvList");
    if (currentTab === "messages") {
      grid.style.display = "none";
      convList.style.display = "flex";
      await loadConversations();
      return;
    }
    grid.style.display = "";
    convList.style.display = "none";

    function showEmpty(title, text) {
      emptyTxt.querySelector("strong").textContent = title;
      emptyTxt.querySelector("p").textContent = text;
      empty.style.display = "flex";
    }

    try {
      let url;
      if (currentTab === "mine") {
        url = "/api/listings/mine";
      } else {
        const type = document.getElementById("lhFilterType").value;
        const q    = document.getElementById("lhFilterQ").value.trim();
        const params = new URLSearchParams();
        if (type) params.set("type", type);
        if (q)    params.set("q", q);
        url = "/api/listings?" + params.toString();
      }
      const res  = await fetch(url);
      const data = await res.json();
      const listings = data.listings || [];

      if (!listings.length) {
        if (currentTab === "mine") {
          showEmpty("У вас пока нет объявлений", "Разместите первое — это займёт меньше минуты.");
        } else {
          showEmpty("Пока ничего нет", "Будь первым — разместите объявление, и его увидит всё комьюнити.");
        }
        return;
      }
      listings.forEach(l => grid.appendChild(renderCard(l)));
    } catch {
      showEmpty("Не удалось загрузить", "Попробуйте обновить страницу чуть позже.");
    }
  }

  function renderCard(l) {
    const card = document.createElement("div");
    card.className = "news-card";

    const imgHtml = l.image && l.image.url
      ? `<div class="card-img"><img src="${esc(l.image.url)}" alt=""></div>`
      : `<div class="card-img"><div class="img-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15l-5-5L5 21"/><circle cx="8.5" cy="8.5" r="1.5"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div></div>`;

    const flags = [];
    if (currentTab === "mine") {
      if (l.hiddenByAdmin) flags.push(`<span class="lh-flag lh-flag-hidden">Скрыто админом</span>`);
      else if (!l.active)  flags.push(`<span class="lh-flag lh-flag-inactive">Снято с публикации</span>`);
    }

    card.innerHTML = `
      ${imgHtml}
      <div class="lh-card-content">
        <span class="lh-type-badge ${TYPE_BADGE_CLASS[l.type] || ""}">${esc(TYPE_LABEL[l.type] || l.type)}</span>
        <h3 class="card-title">${esc(l.title)}</h3>
        <p class="card-excerpt">${esc(l.description)}</p>
        ${l.role ? `<span class="lh-role-tag">${esc(l.role)}</span>` : ""}
        ${currentTab === "mine" && l.unreadCount > 0 ? `<span class="lh-unread-mark">● ${unreadLabel(l.unreadCount)}</span>` : ""}
        <div class="lh-card-foot">
          <div class="lh-card-author">
            ${linkWrap(authorHref(l.authorId), `${l.authorId && l.authorId.avatar ? `<img src="${esc(l.authorId.avatar)}" alt="">` : ""}<span>${esc((l.authorId && l.authorId.displayName) || "")}</span>`)}
          </div>
          ${flags.join("")}
          <span class="lh-resp-count">${l.responseCount || 0} откл.</span>
        </div>
      </div>
    `;
    card.addEventListener("click", e => { if (e.target.closest("a")) return; openDetailModal(l._id); });   // клик по ссылке автора карточку не открывает
    return card;
  }

  // ── Модалка деталей ──────────────────────────────────────────────────
  async function openDetailModal(id) {
    const overlay = document.getElementById("lhDetailOverlay");
    const body    = document.getElementById("lhDetailBody");
    body.innerHTML = `<p style="color:var(--lh-muted);">Загрузка...</p>`;
    overlay.classList.add("open");

    try {
      const res  = await fetch(`/api/listings/${id}`);
      const data = await res.json();
      if (!res.ok) { body.innerHTML = `<p class="lh-error-text show">${esc(data.error || "Объявление не найдено.")}</p>`; return; }
      renderDetail(data.listing);
    } catch {
      body.innerHTML = `<p class="lh-error-text show">Ошибка загрузки.</p>`;
    }
  }

  function renderDetail(l) {
    const body = document.getElementById("lhDetailBody");
    // Владелец определяется сервером (по сессии); клиентское сравнение id не используется
    const isOwnerReal = l.isOwner === true;
    const isAdmin = currentUser && currentUser.isAdmin;

    const teamLine = l.teamId ? `<div>Команда: <b>${linkWrap(teamHref(l.teamId), `[${esc(l.teamId.tag)}] ${esc(l.teamId.name)}`)}</b></div>` : "";

    body.innerHTML = `
      <span class="lh-type-badge ${TYPE_BADGE_CLASS[l.type] || ""}">${esc(TYPE_LABEL[l.type] || l.type)}</span>
      <h2 style="font-family:'Montserrat',sans-serif; font-weight:800; font-size:19px; color:white; margin:8px 0 12px;">${esc(l.title)}</h2>
      ${l.image && l.image.url ? `<img class="lh-detail-img" src="${esc(l.image.url)}" alt="">` : ""}
      <div class="lh-detail-meta">
        <div>${linkWrap(authorHref(l.authorId), `${l.authorId && l.authorId.avatar ? `<img src="${esc(l.authorId.avatar)}">` : ""}${esc((l.authorId && l.authorId.displayName) || "")}`)}</div>
        ${teamLine}
        ${l.role ? `<div>Роль: <b>${esc(l.role)}</b></div>` : ""}
        <div>${fmtDate(l.createdAt)}</div>
      </div>
      <p class="lh-detail-desc">${esc(l.description)}</p>
      <div id="lhDetailActionArea"></div>
    `;

    const actionArea = document.getElementById("lhDetailActionArea");

    if (isOwnerReal) {
      // Скрыто админом: владелец не может вернуть объявление в публикацию сам,
      // поэтому кнопка снятия/публикации не показывается. Отклики, правка и удаление доступны.
      const adminHiddenNote = l.hiddenByAdmin
        ? `<div class="lh-status-note"><b>Скрыто администратором.</b> Объявление не показывается в публичной ленте. Вернуть его в публикацию может только администратор. Вы по-прежнему можете смотреть отклики, редактировать или удалить объявление.</div>`
        : "";
      actionArea.innerHTML = `
        ${adminHiddenNote}
        <div class="lh-detail-meta"><b style="color:var(--accent);">${l.responseCount || 0}</b>&nbsp;откликов</div>
        <div class="lh-actions-row">
          <button class="btn-nav" id="lhBtnViewResponses">Смотреть отклики</button>
          <button class="lh-btn-outline" id="lhBtnEdit">Редактировать</button>
          ${l.hiddenByAdmin ? "" : `<button class="lh-btn-outline" id="lhBtnToggleActive">${l.active ? "Снять с публикации" : "Опубликовать снова"}</button>`}
          <button class="lh-btn-outline danger" id="lhBtnDelete">Удалить</button>
        </div>
      `;
      document.getElementById("lhBtnViewResponses").addEventListener("click", () => openResponsesModal(l._id));
      document.getElementById("lhBtnEdit").addEventListener("click", () => { closeAllModals(); openCreateModal(l); });
      const toggleBtn = document.getElementById("lhBtnToggleActive");
      if (toggleBtn) toggleBtn.addEventListener("click", () => toggleActive(l._id, !l.active));
      document.getElementById("lhBtnDelete").addEventListener("click", () => deleteListing(l._id));
    } else if (!currentUser) {
      actionArea.innerHTML = `<div class="lh-detail-meta"><b style="color:var(--accent);">${l.responseCount || 0}</b>&nbsp;откликов</div>
        <p class="lh-hint-text">Войдите через Steam, чтобы откликнуться.</p>`;
    } else {
      const hasContacts = currentUser.discordUsername || currentUser.telegramUsername;
      actionArea.innerHTML = `
        <div class="lh-detail-meta"><b style="color:var(--accent);">${l.responseCount || 0}</b>&nbsp;откликов</div>
        <div class="field">
          <span class="field-label">Ваше сообщение автору</span>
          <textarea id="lhRespMsg" maxlength="500" placeholder="Расскажи о себе коротко, почему подходишь..."></textarea>
          <div class="field-hint">Отклик приватный — увидит только автор объявления. Ваши контакты (Discord/Telegram из профиля) уйдут вместе с сообщением.</div>
        </div>
        <div class="lh-error-text" id="lhRespError"></div>
        <div class="lh-actions-row">
          <button class="btn-submit" id="lhBtnRespond" style="width:auto;">Откликнуться</button>
          ${l.myConversationId ? `<button class="lh-btn-outline" id="lhBtnOpenChat">Открыть чат с автором</button>` : ""}
          <button class="lh-btn-outline" id="lhBtnReport">Пожаловаться</button>
        </div>
      `;
      if (!hasContacts) {
        document.getElementById("lhRespError").textContent = "Укажите Discord или Telegram в профиле — иначе автор не сможет с вами связаться.";
        document.getElementById("lhRespError").classList.add("show");
      }
      document.getElementById("lhBtnRespond").addEventListener("click", () => sendResponse(l._id));
      const openChatBtn = document.getElementById("lhBtnOpenChat");
      if (openChatBtn) openChatBtn.addEventListener("click", () => openChat(l.myConversationId));
      document.getElementById("lhBtnReport").addEventListener("click", () => openReportModal(l._id));
    }

    if (isAdmin && !isOwnerReal) {
      const adminBtn = document.createElement("div");
      adminBtn.className = "lh-actions-row";
      adminBtn.innerHTML = `<button class="lh-btn-outline" id="lhBtnAdminHide">${l.hiddenByAdmin ? "Вернуть в публикацию" : "Скрыть (модерация)"}</button>`;
      actionArea.appendChild(adminBtn);
      document.getElementById("lhBtnAdminHide").addEventListener("click", () => adminToggleHide(l._id, !l.hiddenByAdmin));
    }
  }

  async function sendResponse(id) {
    const msg = document.getElementById("lhRespMsg").value.trim();
    const errEl = document.getElementById("lhRespError");
    if (!msg) { errEl.textContent = "Напишите сообщение."; errEl.classList.add("show"); return; }
    const btn = document.getElementById("lhBtnRespond");
    btn.disabled = true;
    try {
      const res  = await fetch(`/api/listings/${id}/responses`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error || "Ошибка."; errEl.classList.add("show"); return; }
      const area = document.getElementById("lhDetailActionArea");
      area.innerHTML = `<p class="lh-hint-text">Отклик отправлен. Автор увидит его в уведомлениях.</p>`;
      if (data.conversationId) {
        const row = document.createElement("div");
        row.className = "lh-actions-row";
        const chatBtn = document.createElement("button");
        chatBtn.className = "lh-btn-outline";
        chatBtn.textContent = "Открыть чат с автором";
        chatBtn.addEventListener("click", () => openChat(data.conversationId));
        row.appendChild(chatBtn);
        area.appendChild(row);
      }
    } catch {
      errEl.textContent = "Ошибка сети."; errEl.classList.add("show");
    } finally {
      btn.disabled = false;
    }
  }

  async function toggleActive(id, active) {
    try {
      await fetch(`/api/listings/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      closeAllModals();
      loadAndRender();
    } catch {}
  }

  async function deleteListing(id) {
    if (!confirm("Удалить объявление? Действие необратимо.")) return;
    try {
      await fetch(`/api/listings/${id}`, { method: "DELETE" });
      closeAllModals();
      loadAndRender();
    } catch {}
  }

  async function adminToggleHide(id, hidden) {
    try {
      await fetch(`/api/listings/${id}/admin-hide`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden }),
      });
      closeAllModals();
      loadAndRender();
    } catch {}
  }

  // ── Модалка откликов (для автора) ────────────────────────────────────
  async function openResponsesModal(id) {
    const overlay = document.getElementById("lhResponsesOverlay");
    const body    = document.getElementById("lhResponsesBody");
    body.innerHTML = `<p style="color:var(--lh-muted);">Загрузка...</p>`;
    overlay.classList.add("open");

    try {
      const res  = await fetch(`/api/listings/${id}/responses`);
      const data = await res.json();
      const responses = data.responses || [];
      if (!responses.length) {
        body.innerHTML = `<p class="lh-hint-text">Пока никто не откликнулся.</p>`;
        return;
      }
      body.innerHTML = responses.map(r => `
        <div class="lh-response-item">
          <div class="lh-resp-head">
            ${r.fromUserId && r.fromUserId.avatar ? `<img src="${esc(r.fromUserId.avatar)}">` : ""}
            <span class="lh-resp-name">${esc((r.fromUserId && r.fromUserId.displayName) || "Пользователь")}</span>
            <span class="lh-resp-date">${fmtDate(r.createdAt)}</span>
          </div>
          <div class="lh-resp-msg">${esc(r.message)}</div>
          <div class="lh-resp-contacts">
            ${r.contacts && r.contacts.discordUsername ? `<span>Discord: ${esc(r.contacts.discordUsername)}</span>` : ""}
            ${r.contacts && r.contacts.telegramUsername ? `<span>Telegram: @${esc(r.contacts.telegramUsername)}</span>` : ""}
          </div>
          ${r.conversationId ? `<div class="lh-actions-row" style="margin-top:10px;"><button class="lh-btn-outline" data-conv="${esc(r.conversationId)}">Написать в чат</button></div>` : ""}
        </div>
      `).join("");
      body.querySelectorAll("[data-conv]").forEach(b => b.addEventListener("click", () => openChat(b.dataset.conv)));
    } catch {
      body.innerHTML = `<p class="lh-error-text show">Не удалось загрузить отклики.</p>`;
    }
    loadAndRender(); // счётчик "N откл." мог обновиться (отклики теперь прочитаны)
  }

  // ── Сообщения: приватный чат по объявлению ─────────────────────────
  // Весь пользовательский текст выводится ТОЛЬКО через textContent (никакого innerHTML).
  const CHAT_MAX_LEN    = 1000;
  const CHAT_POLL_MS    = 4000;
  const CHAT_OVERLAP_MS = 5000; // при опросе берём запас по времени, дубли отсекаются по _id
  const DELETED_TEXT    = "Сообщение удалено";
  let chat = null; // { id, seen:Set, rows:Map, lastAt, changedAfter, timer, onVis, polling, sending, canSend, readUpTo, otherName, muted, blockedByMe, otherDeleted }

  // Существующая страница публичного профиля (ссылка того же вида используется в админ-панели)
  function profileUrl(steamId) { return "/profile.html?id=" + encodeURIComponent(steamId); }

  // Аватар собеседника: картинка (только https) либо буква-заглушка; со steamId — ссылка на профиль
  function makeAvatar(u) {
    const hasLink = !!(u && u.steamId);
    const wrap = document.createElement(hasLink ? "a" : "span");
    wrap.className = "lh-avatar";
    if (hasLink) {
      wrap.href = profileUrl(u.steamId);
      wrap.target = "_blank";
      wrap.rel = "noopener noreferrer";
      wrap.title = "Открыть профиль";
      wrap.setAttribute("aria-label", "Профиль: " + (u.displayName || ""));
    }
    const initial = ((u && u.displayName) || "?").trim().charAt(0).toUpperCase() || "?";
    const fallback = () => { wrap.textContent = initial; };
    if (u && typeof u.avatar === "string" && /^https:\/\//i.test(u.avatar)) {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("error", fallback);
      img.src = u.avatar;
      wrap.appendChild(img);
    } else {
      fallback();
    }
    return wrap;
  }

  function fmtDateTime(iso) {
    try {
      return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    } catch { return ""; }
  }

  function setChatError(msg) {
    const el = document.getElementById("lhChatError");
    el.textContent = msg || "";
    el.classList.toggle("show", !!msg);
  }

  function setChatStatus(text) {
    const box = document.getElementById("lhChatMessages");
    box.textContent = "";
    if (!text) return;
    const p = document.createElement("p");
    p.className = "lh-chat-status";
    p.textContent = text;
    box.appendChild(p);
  }

  function updateChatFormState() {
    const canSend = !!chat && chat.canSend;
    document.getElementById("lhChatInput").disabled = !canSend;
    document.getElementById("lhChatSend").disabled  = !canSend || chat.sending;
  }

  function updateChatTools() {
    const muteBtn  = document.getElementById("lhChatMute");
    const blockBtn = document.getElementById("lhChatBlock");
    const c = chat;
    muteBtn.disabled = blockBtn.disabled = !c;
    if (!c) return;
    muteBtn.textContent = c.muted ? "🔕" : "🔔";
    muteBtn.title = c.muted ? "Включить уведомления" : "Отключить уведомления";
    muteBtn.setAttribute("aria-label", muteBtn.title);
    blockBtn.textContent = c.blockedByMe ? "🔓" : "🚫";
    blockBtn.title = c.blockedByMe ? "Разблокировать пользователя" : "Заблокировать пользователя";
    blockBtn.setAttribute("aria-label", blockBtn.title);
  }

  function renderChatBanner() {
    const b = document.getElementById("lhChatBanner");
    const c = chat;
    b.textContent = "";
    let text = "";
    if (c) {
      if (c.blockedByMe)        text = "Вы заблокировали этого пользователя. Переписка недоступна.";
      else if (c.otherDeleted)  text = "Собеседник удалён — отправка сообщений недоступна.";
      else if (!c.canSend)      text = "Отправка сообщений в этот диалог недоступна.";
    }
    if (text) {
      const span = document.createElement("span");
      span.textContent = text;
      b.appendChild(span);
      if (c.blockedByMe) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = "Разблокировать";
        btn.addEventListener("click", () => toggleBlock(false));
        b.appendChild(btn);
      }
    }
    b.style.display = text ? "flex" : "none";
  }

  function renderChatHeader(conv) {
    const slot = document.getElementById("lhChatAvatarSlot");
    slot.textContent = "";
    slot.appendChild(makeAvatar(conv.other));
    document.getElementById("lhChatTitle").textContent = (conv.listing && conv.listing.title) || "Объявление удалено";
    const sub = document.getElementById("lhChatSub");
    sub.textContent = (conv.other && conv.other.displayName) || "";
    if (conv.other && conv.other.steamId) sub.href = profileUrl(conv.other.steamId);
    else sub.removeAttribute("href");
  }

  // Останавливает опрос и убирает обработчики. Возвращает true, если чат был открыт.
  function stopChat() {
    if (!chat) return false;
    clearInterval(chat.timer);
    if (chat.onVis) document.removeEventListener("visibilitychange", chat.onVis);
    chat = null;
    return true;
  }

  async function openChat(id) {
    document.querySelectorAll(".lh-overlay").forEach(ov => ov.classList.remove("open"));
    stopChat();
    const c = chat = {
      id, seen: new Set(), rows: new Map(), lastAt: null, changedAfter: null, timer: null, onVis: null,
      polling: false, sending: false, canSend: false, readUpTo: null,
      otherName: "", muted: false, blockedByMe: false, otherDeleted: false,
    };

    document.getElementById("lhChatTitle").textContent = "Чат";
    document.getElementById("lhChatSub").textContent = "";
    document.getElementById("lhChatSub").removeAttribute("href");
    document.getElementById("lhChatAvatarSlot").textContent = "";
    document.getElementById("lhChatInput").value = "";
    document.getElementById("lhChatBanner").style.display = "none";
    setChatError("");
    setChatStatus("Загрузка...");
    updateChatFormState();
    updateChatTools();
    document.getElementById("lhChatOverlay").classList.add("open");

    try {
      const res  = await fetch(`/api/conversations/${encodeURIComponent(id)}/messages`);
      const data = await res.json().catch(() => ({}));
      if (chat !== c) return; // пока грузилось — чат закрыли
      if (!res.ok) { setChatStatus(data.error || "Не удалось загрузить диалог."); return; }

      const conv = data.conversation || {};
      c.otherName    = (conv.other && conv.other.displayName) || "";
      c.muted        = !!conv.muted;
      c.blockedByMe  = !!conv.blockedByMe;
      c.otherDeleted = !!conv.otherDeleted;
      c.canSend      = conv.canSend === true;
      c.changedAfter = data.lastChangeAt || null;
      renderChatHeader(conv);
      renderChatBanner();
      updateChatTools();
      setChatStatus("");
      appendMessages(data.messages || []);
      updateChatFormState();

      // Опрос только пока вкладка видима; при возврате на вкладку — сразу обновляемся
      c.onVis = () => { if (!document.hidden) { pollChat(); markChatRead(); } };
      document.addEventListener("visibilitychange", c.onVis);
      c.timer = setInterval(pollChat, CHAT_POLL_MS);
    } catch {
      if (chat === c) setChatStatus("Ошибка сети. Попробуйте открыть чат ещё раз.");
    }
  }

  // ── строки сообщений (создание / обновление на месте) ──
  const rowVersion = m => (m.deleted ? "d" : "") + (m.editedAt || "");

  function fillMessageRow(row, m) {
    const c = chat;
    row.textContent = "";
    row.className = "lh-msg" + (m.isMine ? " mine" : "") + (m.deleted ? " deleted" : "");

    const meta = document.createElement("div");
    meta.className = "lh-msg-meta";
    const name = document.createElement("span");
    name.textContent = m.isMine ? "Вы" : (m.senderName || (c && c.otherName) || "");
    const right = document.createElement("span");
    const time = document.createElement("span");
    time.textContent = fmtDateTime(m.createdAt);
    right.appendChild(time);
    if (m.edited && !m.deleted) {
      const ed = document.createElement("span");
      ed.className = "lh-msg-edited";
      ed.textContent = " · изменено";
      right.appendChild(ed);
    }
    if (!m.deleted && (m.canEdit || m.canDelete)) {
      const acts = document.createElement("span");
      acts.className = "lh-msg-actions";
      acts.style.marginLeft = "8px";
      if (m.canEdit) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "lh-msg-act"; b.textContent = "✎";
        b.title = "Редактировать"; b.setAttribute("aria-label", b.title);
        b.addEventListener("click", () => startEditMessage(m._id));
        acts.appendChild(b);
      }
      if (m.canDelete) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "lh-msg-act"; b.textContent = "🗑";
        b.title = "Удалить"; b.setAttribute("aria-label", b.title);
        b.addEventListener("click", () => deleteMessage(m._id));
        acts.appendChild(b);
      }
      right.appendChild(acts);
    }
    meta.appendChild(name); meta.appendChild(right);

    const text = document.createElement("div");
    text.className = "lh-msg-text";
    text.textContent = m.deleted ? DELETED_TEXT : m.text;
    row.appendChild(meta); row.appendChild(text);
  }

  function appendMessages(list) {
    const c = chat;
    if (!c) return;
    const box = document.getElementById("lhChatMessages");
    const valid = list.filter(m => m && m._id);
    const fresh = valid.filter(m => !c.seen.has(m._id));

    // изменения уже показанных сообщений (правка/удаление у собеседника или с другого устройства)
    valid.filter(m => c.seen.has(m._id)).forEach(m => {
      const e = c.rows.get(m._id);
      if (e && !e.editing && e.ver !== rowVersion(m)) { e.m = m; e.ver = rowVersion(m); fillMessageRow(e.el, m); }
    });

    if (!fresh.length) {
      if (!c.seen.size && !box.children.length) setChatStatus("Сообщений пока нет. Напишите первым.");
      return;
    }
    if (box.querySelector(".lh-chat-status")) box.textContent = "";
    const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    let hasIncoming = false, hasMine = false;

    fresh.forEach(m => {
      c.seen.add(m._id);
      const row = document.createElement("div");
      c.rows.set(m._id, { el: row, m, ver: rowVersion(m), editing: false });
      fillMessageRow(row, m);
      box.appendChild(row);
      if (!c.lastAt || Date.parse(m.createdAt) > Date.parse(c.lastAt)) c.lastAt = m.createdAt;
      if (m.isMine) hasMine = true; else hasIncoming = true;
    });

    if (nearBottom || hasMine) box.scrollTop = box.scrollHeight;
    if (hasIncoming) markChatRead();
  }

  // ── правка и удаление своих сообщений (проверка владельца — на сервере) ──
  function startEditMessage(id) {
    const c = chat;
    const e = c && c.rows.get(id);
    if (!e || e.editing || e.m.deleted) return;
    e.editing = true;
    const row = e.el;
    const textEl = row.querySelector(".lh-msg-text");

    const wrap = document.createElement("div");
    const ta = document.createElement("textarea");
    ta.className = "lh-msg-edit";
    ta.maxLength = CHAT_MAX_LEN;
    ta.value = e.m.text || "";
    const err = document.createElement("div");
    err.className = "lh-msg-edit-error";
    const actions = document.createElement("div");
    actions.className = "lh-msg-edit-actions";
    const save = document.createElement("button");
    save.type = "button"; save.className = "primary"; save.textContent = "Сохранить";
    const cancel = document.createElement("button");
    cancel.type = "button"; cancel.textContent = "Отмена";
    actions.appendChild(save); actions.appendChild(cancel);
    wrap.appendChild(ta); wrap.appendChild(err); wrap.appendChild(actions);
    textEl.replaceWith(wrap);
    ta.focus();

    cancel.addEventListener("click", () => { e.editing = false; fillMessageRow(row, e.m); });
    save.addEventListener("click", async () => {
      const text = ta.value.trim();
      if (!text) { err.textContent = "Введите сообщение."; return; }
      if (text.length > CHAT_MAX_LEN) { err.textContent = `Максимум ${CHAT_MAX_LEN} символов.`; return; }
      err.textContent = "";
      save.disabled = cancel.disabled = true;
      try {
        const res  = await fetch(`/api/conversations/${encodeURIComponent(c.id)}/messages/${encodeURIComponent(id)}`, {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }),
        });
        const data = await res.json().catch(() => ({}));
        if (chat !== c) return;
        if (!res.ok) { err.textContent = data.error || "Не удалось сохранить."; save.disabled = cancel.disabled = false; return; }
        e.editing = false;
        e.m = { ...e.m, ...data.message, senderName: e.m.senderName };
        e.ver = rowVersion(e.m);
        fillMessageRow(row, e.m);
      } catch {
        if (chat === c) { err.textContent = "Ошибка сети."; save.disabled = cancel.disabled = false; }
      }
    });
  }

  async function deleteMessage(id) {
    const c = chat;
    const e = c && c.rows.get(id);
    if (!e || e.editing || e.m.deleted) return;
    if (!confirm("Удалить сообщение? Это действие необратимо.")) return;
    try {
      const res  = await fetch(`/api/conversations/${encodeURIComponent(c.id)}/messages/${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (chat !== c) return;
      if (!res.ok) { setChatError(data.error || "Не удалось удалить сообщение."); return; }
      setChatError("");
      e.m = { _id: e.m._id, createdAt: e.m.createdAt, isMine: true, deleted: true };
      e.ver = rowVersion(e.m);
      fillMessageRow(e.el, e.m);
    } catch {
      if (chat === c) setChatError("Ошибка сети. Сообщение не удалено.");
    }
  }

  // ── уведомления и блокировка ──
  async function toggleMute() {
    const c = chat;
    if (!c) return;
    const btn = document.getElementById("lhChatMute");
    btn.disabled = true;
    setChatError("");
    try {
      const res  = await fetch(`/api/conversations/${encodeURIComponent(c.id)}/mute`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ muted: !c.muted }),
      });
      const data = await res.json().catch(() => ({}));
      if (chat !== c) return;
      if (!res.ok) { setChatError(data.error || "Не удалось изменить уведомления."); return; }
      c.muted = data.muted === true;
    } catch {
      if (chat === c) setChatError("Ошибка сети.");
    } finally {
      if (chat === c) updateChatTools();
    }
  }

  async function toggleBlock(blocked) {
    const c = chat;
    if (!c) return;
    if (blocked === undefined) blocked = !c.blockedByMe;
    if (blocked && !confirm("Заблокировать пользователя? Он не сможет писать вам в чате и откликаться на ваши объявления. История переписки сохранится, разблокировать можно в любой момент.")) return;
    const id = c.id;
    document.getElementById("lhChatBlock").disabled = true;
    setChatError("");
    try {
      const res  = await fetch(`/api/conversations/${encodeURIComponent(id)}/block`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocked }),
      });
      const data = await res.json().catch(() => ({}));
      if (chat !== c) return;
      if (!res.ok) { setChatError(data.error || "Не удалось изменить блокировку."); updateChatTools(); return; }
      openChat(id); // перезагрузка диалога: актуальные права на отправку и баннер
    } catch {
      if (chat === c) { setChatError("Ошибка сети."); updateChatTools(); }
    }
  }

  // Отмечаем прочитанным только до времени последнего реально показанного сообщения
  async function markChatRead() {
    const c = chat;
    if (!c || document.hidden || !c.lastAt || c.readUpTo === c.lastAt) return;
    const upTo = c.lastAt;
    c.readUpTo = upTo;
    try {
      await fetch(`/api/conversations/${encodeURIComponent(c.id)}/read`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upTo }),
      });
    } catch {
      if (chat === c && c.readUpTo === upTo) c.readUpTo = null;
    }
  }

  async function pollChat() {
    const c = chat;
    if (!c || document.hidden || c.polling) return;
    c.polling = true;
    try {
      let qs = "";
      if (c.lastAt) {
        qs = "?after=" + encodeURIComponent(new Date(Date.parse(c.lastAt) - CHAT_OVERLAP_MS).toISOString());
        if (c.changedAfter) qs += "&changed=" + encodeURIComponent(c.changedAfter);
      }
      const res = await fetch(`/api/conversations/${encodeURIComponent(c.id)}/messages${qs}`);
      if (chat !== c) return;
      if (res.status === 404 || res.status === 403) {
        clearInterval(c.timer);
        setChatError("Диалог недоступен.");
        return;
      }
      if (!res.ok) return;
      const data = await res.json();
      if (chat !== c) return;
      if (data.lastChangeAt) c.changedAfter = data.lastChangeAt;
      appendMessages(data.messages || []);
    } catch {
      // временная ошибка сети — попробуем на следующем тике
    } finally {
      c.polling = false;
    }
  }

  async function sendChatMessage(e) {
    e.preventDefault();
    const c = chat;
    if (!c || !c.canSend || c.sending) return;
    const input = document.getElementById("lhChatInput");
    const text  = input.value.trim();
    if (!text) { setChatError("Введите сообщение."); return; }
    if (text.length > CHAT_MAX_LEN) { setChatError(`Сообщение слишком длинное (максимум ${CHAT_MAX_LEN} символов).`); return; }

    setChatError("");
    c.sending = true;
    updateChatFormState();
    try {
      const res  = await fetch(`/api/conversations/${encodeURIComponent(c.id)}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await res.json().catch(() => ({}));
      if (chat !== c) return;
      if (!res.ok) {
        setChatError(data.error || "Не удалось отправить сообщение.");
        if (res.status === 403 || res.status === 409) { c.canSend = false; renderChatBanner(); }  // переписка ограничена
        return;
      }
      input.value = "";
      appendMessages([data.message]);
    } catch {
      if (chat === c) setChatError("Ошибка сети. Сообщение не отправлено.");
    } finally {
      if (chat === c) { c.sending = false; updateChatFormState(); if (c.canSend) input.focus(); }
    }
  }

  function initChatUi() {
    document.getElementById("lhChatForm").addEventListener("submit", sendChatMessage);
    document.getElementById("lhChatInput").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) sendChatMessage(e);
    });
    document.getElementById("lhChatMute").addEventListener("click", toggleMute);
    document.getElementById("lhChatBlock").addEventListener("click", () => toggleBlock());
    initReportUi();
  }

  // ── Жалоба на объявление ────────────────────────────────────────────
  let reportTarget = null;
  let reportBusy   = false;

  function openReportModal(listingId) {
    reportTarget = listingId;
    reportBusy = false;
    document.getElementById("lhReportReason").value = "";
    document.getElementById("lhReportDetails").value = "";
    const err = document.getElementById("lhReportError");
    err.textContent = ""; err.classList.remove("show");
    document.getElementById("lhReportForm").style.display = "";
    document.getElementById("lhReportDone").style.display = "none";
    document.getElementById("lhReportSubmit").disabled = false;
    document.getElementById("lhReportOverlay").classList.add("open");
  }

  function closeReportModal() {
    document.getElementById("lhReportOverlay").classList.remove("open");
    reportTarget = null;
  }

  async function submitReport(e) {
    e.preventDefault();
    if (!reportTarget || reportBusy) return;
    const err = document.getElementById("lhReportError");
    const showErr = msg => { err.textContent = msg; err.classList.add("show"); };
    const reason  = document.getElementById("lhReportReason").value;
    const details = document.getElementById("lhReportDetails").value.trim();
    if (!reason) { showErr("Выберите причину жалобы."); return; }
    if (details.length > 500) { showErr("Подробности — не длиннее 500 символов."); return; }
    err.textContent = ""; err.classList.remove("show");

    const btn = document.getElementById("lhReportSubmit");
    reportBusy = true; btn.disabled = true;
    try {
      const res  = await fetch(`/api/listings/${encodeURIComponent(reportTarget)}/report`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason, details }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showErr(data.error || "Не удалось отправить жалобу."); return; }
      document.getElementById("lhReportForm").style.display = "none";
      const done = document.getElementById("lhReportDone");
      done.textContent = "Жалоба отправлена. Спасибо — администрация её рассмотрит.";
      done.style.display = "";
    } catch {
      showErr("Ошибка сети. Попробуйте ещё раз.");
    } finally {
      reportBusy = false; btn.disabled = false;
    }
  }

  function initReportUi() {
    document.getElementById("lhReportForm").addEventListener("submit", submitReport);
    document.getElementById("lhReportClose").addEventListener("click", closeReportModal);
    document.getElementById("lhReportCancel").addEventListener("click", closeReportModal);
    const ov = document.getElementById("lhReportOverlay");
    ov.addEventListener("click", e => { if (e.target === ov) closeReportModal(); });
  }

  // ── Список диалогов (вкладка «Сообщения») ───────────────────────────
  function renderConversationItem(c) {
    const item = document.createElement("div");
    item.className = "lh-conv-item" + (c.unread ? " unread" : "") + (c.muted ? " muted" : "");

    item.appendChild(makeAvatar(c.other));   // аватар — ссылка на профиль собеседника

    const main = document.createElement("button");
    main.type = "button";
    main.className = "lh-conv-main";

    const top = document.createElement("div");
    top.className = "lh-conv-top";
    const name = document.createElement("span");
    name.className = "lh-conv-name";
    name.textContent = (c.other && c.other.displayName) || "";
    top.appendChild(name);
    if (c.muted) {
      const m = document.createElement("span");
      m.className = "lh-conv-flag"; m.textContent = "🔕"; m.title = "Уведомления отключены";
      top.appendChild(m);
    }
    if (c.blockedByMe) {
      const b = document.createElement("span");
      b.className = "lh-conv-flag"; b.textContent = "🚫"; b.title = "Пользователь заблокирован";
      top.appendChild(b);
    }
    if (c.unread) {
      const dot = document.createElement("span");
      dot.className = "lh-conv-dot";
      dot.title = c.muted ? "Есть непрочитанные (уведомления отключены)" : "Есть непрочитанные сообщения";
      top.appendChild(dot);
    }
    const time = document.createElement("span");
    time.className = "lh-conv-time";
    time.textContent = c.lastMessage && c.lastMessage.at ? fmtDateTime(c.lastMessage.at) : "";
    top.appendChild(time);

    const listing = document.createElement("div");
    listing.className = "lh-conv-listing";
    listing.textContent = (c.listing && c.listing.title) || "Объявление удалено";

    const last = document.createElement("div");
    last.className = "lh-conv-last";
    last.textContent = c.lastMessage ? ((c.lastMessage.isMine ? "Вы: " : "") + (c.lastMessage.text || "")) : "";

    main.appendChild(top); main.appendChild(listing); main.appendChild(last);
    item.appendChild(main);
    // вся строка открывает чат (кнопка внутри — для клавиатуры), кроме ссылки-аватара: она ведёт на профиль
    item.addEventListener("click", e => { if (!e.target.closest("a")) openChat(c._id); });
    return item;
  }

  async function loadConversations() {
    const list = document.getElementById("lhConvList");
    const note = txt => {
      list.textContent = "";
      const p = document.createElement("p");
      p.className = "lh-hint-text";
      p.textContent = txt;
      list.appendChild(p);
    };
    note("Загрузка...");
    try {
      const res  = await fetch("/api/conversations");
      const data = await res.json().catch(() => ({}));
      if (currentTab !== "messages") return;
      if (!res.ok) { note(data.error || "Не удалось загрузить сообщения."); return; }
      const items = data.conversations || [];
      if (!items.length) { note("Пока нет диалогов. Они появляются, когда вы откликаетесь на объявление или кто-то откликается на ваше."); return; }
      list.textContent = "";
      items.forEach(c => list.appendChild(renderConversationItem(c)));
    } catch {
      note("Ошибка сети. Попробуйте обновить страницу.");
    }
  }

  // ── Модалка создания / редактирования ────────────────────────────────
  function openCreateModal(listingToEdit) {
    editingId = listingToEdit ? listingToEdit._id : null;
    pendingImage = listingToEdit && listingToEdit.image && listingToEdit.image.url ? { ...listingToEdit.image } : null;

    document.getElementById("lhCreateTitle").textContent = editingId ? "Редактировать объявление" : "Новое объявление";
    document.getElementById("lhCreateSubmit").textContent = editingId ? "Сохранить" : "Опубликовать";
    document.getElementById("lhFType").value = listingToEdit ? listingToEdit.type : "player_seeking_team";
    document.getElementById("lhFType").disabled = !!editingId; // тип не меняем после публикации (влияет на привязку к команде)
    document.getElementById("lhFTitle").value = listingToEdit ? listingToEdit.title : "";
    document.getElementById("lhFRole").value  = listingToEdit ? (listingToEdit.role || "") : "";
    document.getElementById("lhFDesc").value  = listingToEdit ? listingToEdit.description : "";
    document.getElementById("lhCreateError").classList.remove("show");
    document.getElementById("lhFImage").value = "";

    const preview = document.getElementById("lhUploadPreview");
    if (pendingImage && pendingImage.url) {
      document.getElementById("lhUploadPreviewImg").src = pendingImage.url;
      preview.classList.add("show");
    } else {
      preview.classList.remove("show");
    }

    updateTypeHint();
    document.getElementById("lhCreateOverlay").classList.add("open");
  }

  async function handleImageUpload() {
    const file = document.getElementById("lhFImage").files[0];
    if (!file) return;
    if (!cloudinaryCloud || !cloudinaryPreset) {
      alert("Загрузка изображений сейчас недоступна (не настроен Cloudinary).");
      return;
    }
    const preview = document.getElementById("lhUploadPreview");
    preview.classList.add("show");
    document.getElementById("lhUploadPreviewImg").src = "";
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("upload_preset", cloudinaryPreset);
      const res  = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryCloud}/image/upload`, { method: "POST", body: fd });
      const data = await res.json();
      if (!data.secure_url) throw new Error("upload failed");
      pendingImage = { url: data.secure_url, publicId: data.public_id };
      document.getElementById("lhUploadPreviewImg").src = data.secure_url;
    } catch {
      alert("Не удалось загрузить картинку.");
      pendingImage = null;
      preview.classList.remove("show");
    }
  }

  async function submitCreateForm(e) {
    e.preventDefault();
    const errEl = document.getElementById("lhCreateError");
    errEl.classList.remove("show");

    const payload = {
      type:        document.getElementById("lhFType").value,
      title:       document.getElementById("lhFTitle").value.trim(),
      role:        document.getElementById("lhFRole").value.trim(),
      description: document.getElementById("lhFDesc").value.trim(),
      image:       pendingImage || { url: "", publicId: "" },
    };

    const submitBtn = document.getElementById("lhCreateSubmit");
    submitBtn.disabled = true;
    try {
      const url    = editingId ? `/api/listings/${editingId}` : "/api/listings";
      const method = editingId ? "PATCH" : "POST";
      const res  = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) { errEl.textContent = data.error || "Ошибка."; errEl.classList.add("show"); return; }
      closeAllModals();
      loadAndRender();
    } catch {
      errEl.textContent = "Ошибка сети."; errEl.classList.add("show");
    } finally {
      submitBtn.disabled = false;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();