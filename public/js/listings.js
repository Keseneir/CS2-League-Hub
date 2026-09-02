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

  function esc(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
    document.querySelectorAll(".lh-modal-overlay").forEach(ov => {
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

    // deeplink /listings.html?tab=mine из шапки
    const params = new URLSearchParams(location.search);
    if (params.get("tab") === "mine") switchTab("mine");

    loadAndRender();
  }

  function closeAllModals() {
    document.querySelectorAll(".lh-modal-overlay").forEach(ov => ov.classList.remove("open"));
  }

  function switchTab(tab) {
    if (tab === "mine" && !currentUser) {
      alert("Войдите через Steam, чтобы видеть свои объявления.");
      return;
    }
    currentTab = tab;
    document.querySelectorAll(".lh-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
    document.getElementById("lhToolbar").style.display = tab === "mine" ? "none" : "flex";
    loadAndRender();
  }

  function updateTypeHint() {
    const type = document.getElementById("lhFType").value;
    document.getElementById("lhFTypeHint").textContent = TYPE_HINT[type] || "";
  }

  // ── Загрузка и рендер списка ─────────────────────────────────────────
  async function loadAndRender() {
    const grid  = document.getElementById("lhGrid");
    const empty = document.getElementById("lhEmpty");
    grid.innerHTML = "";
    empty.style.display = "none";

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

      if (!listings.length) { empty.style.display = "block"; return; }
      listings.forEach(l => grid.appendChild(renderCard(l)));
    } catch {
      empty.style.display = "block";
      empty.textContent = "Не удалось загрузить объявления.";
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
        <div class="lh-card-foot">
          <div class="lh-card-author">
            ${l.authorId && l.authorId.avatar ? `<img src="${esc(l.authorId.avatar)}" alt="">` : ""}
            <span>${esc((l.authorId && l.authorId.displayName) || "")}</span>
          </div>
          ${flags.join("")}
          <span class="lh-resp-count">${l.responseCount || 0} откл.</span>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openDetailModal(l._id));
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
    const isOwnerReal = currentUser && l.authorId && String(l.authorId._id) === String(currentUser._id || "");
    const isAdmin = currentUser && currentUser.isAdmin;

    const teamLine = l.teamId ? `<div>Команда: <b>[${esc(l.teamId.tag)}] ${esc(l.teamId.name)}</b></div>` : "";

    body.innerHTML = `
      <span class="lh-type-badge ${TYPE_BADGE_CLASS[l.type] || ""}">${esc(TYPE_LABEL[l.type] || l.type)}</span>
      <h2 style="font-family:'Montserrat',sans-serif; font-weight:800; font-size:19px; color:white; margin:8px 0 12px;">${esc(l.title)}</h2>
      ${l.image && l.image.url ? `<img class="lh-detail-img" src="${esc(l.image.url)}" alt="">` : ""}
      <div class="lh-detail-meta">
        <div>${l.authorId && l.authorId.avatar ? `<img src="${esc(l.authorId.avatar)}">` : ""}${esc((l.authorId && l.authorId.displayName) || "")}</div>
        ${teamLine}
        ${l.role ? `<div>Роль: <b>${esc(l.role)}</b></div>` : ""}
        <div>${fmtDate(l.createdAt)}</div>
      </div>
      <p class="lh-detail-desc">${esc(l.description)}</p>
      <div id="lhDetailActionArea"></div>
    `;

    const actionArea = document.getElementById("lhDetailActionArea");

    if (isOwnerReal) {
      actionArea.innerHTML = `
        <div class="lh-detail-meta"><b style="color:var(--accent);">${l.responseCount || 0}</b>&nbsp;откликов</div>
        <div class="lh-actions-row">
          <button class="btn-nav" id="lhBtnViewResponses">Смотреть отклики</button>
          <button class="lh-btn-outline" id="lhBtnEdit">Редактировать</button>
          <button class="lh-btn-outline" id="lhBtnToggleActive">${l.active ? "Снять с публикации" : "Опубликовать снова"}</button>
          <button class="lh-btn-outline danger" id="lhBtnDelete">Удалить</button>
        </div>
      `;
      document.getElementById("lhBtnViewResponses").addEventListener("click", () => openResponsesModal(l._id));
      document.getElementById("lhBtnEdit").addEventListener("click", () => { closeAllModals(); openCreateModal(l); });
      document.getElementById("lhBtnToggleActive").addEventListener("click", () => toggleActive(l._id, !l.active));
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
        </div>
      `;
      if (!hasContacts) {
        document.getElementById("lhRespError").textContent = "Укажите Discord или Telegram в профиле — иначе автор не сможет с вами связаться.";
        document.getElementById("lhRespError").classList.add("show");
      }
      document.getElementById("lhBtnRespond").addEventListener("click", () => sendResponse(l._id));
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
      document.getElementById("lhDetailActionArea").innerHTML = `<p class="lh-hint-text">Отклик отправлен. Автор увидит его в уведомлениях.</p>`;
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
        </div>
      `).join("");
    } catch {
      body.innerHTML = `<p class="lh-error-text show">Не удалось загрузить отклики.</p>`;
    }
    loadAndRender(); // счётчик "N откл." мог обновиться (отклики теперь прочитаны)
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