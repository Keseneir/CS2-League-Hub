//профиль+команда
if (document.getElementById("ownProfileWrap") || document.getElementById("publicProfileWrap")) {

    let _profileData    = null;
    let _inviteTargetId = null;

    // ── Редактор профиля: сохранённое состояние и несохранённый черновик ─────
    // _draft живёт только в браузере владельца и уходит на сервер только по «Сохранить».
    let _saved        = null;   // последнее сохранённое на сервере
    let _draft        = null;   // текущие (возможно несохранённые) правки
    let _inv          = [];     // личный инвентарь из /api/shop/inventory (itemId — полный ShopItem)
    let _invOk        = false;
    let _invLoaded    = false;
    let _formBuilt    = false;
    let _saving       = false;
    let _matchesCache = null;   // последние матчи для вкладки «Профиль» и превью
    const BIO_MAX     = 300;    // тот же лимит, что на сервере (routes/users.js, models/User.js)
    const SLOT_TYPE   = { avatarFrame: "avatar_frame", profileBg: "profile_bg" };
    const SLOT_LABEL  = { avatarFrame: "Рамка аватара", profileBg: "Фон профиля" };
    const AVATAR_FALLBACK = "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Crect width=%2724%27 height=%2724%27 fill=%27%231a2128%27/%3E%3Ccircle cx=%2712%27 cy=%278.5%27 r=%274%27 fill=%27%235c6b7f%27/%3E%3Cpath d=%27M4 21a8 8 0 0 1 16 0z%27 fill=%27%235c6b7f%27/%3E%3C/svg%3E";
    const SVG_TG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.9 8.2-2 9.4c-.1.6-.5.8-.9.5l-2.6-1.9-1.2 1.2c-.1.1-.3.2-.6.2l.2-2.7 4.9-4.4c.2-.2 0-.3-.3-.1L6.6 15.4 4 14.6c-.6-.2-.6-.6.1-.8l10.9-4.2c.5-.2 1 .1.9.6z"/></svg>';
    const SVG_DC = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3c-.2.4-.5.9-.7 1.3a18.3 18.3 0 0 0-5.5 0A13 13 0 0 0 8.6 3a19.7 19.7 0 0 0-4.9 1.4C.5 9 -.3 13.5.1 17.9a20 20 0 0 0 6 3c.5-.7.9-1.4 1.3-2.1a13 13 0 0 1-2-.9l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a13 13 0 0 1-2 1c.4.7.8 1.4 1.2 2a19.9 19.9 0 0 0 6.1-3c.5-5-1-9.4-3.6-13.5zM8 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4c1.2 0 2.2 1.1 2.2 2.4s-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4c1.2 0 2.2 1.1 2.2 2.4s-1 2.4-2.2 2.4z"/></svg>';

    

    function avatarEl(src, name, cls) {
        if (src) return `<img src="${esc(src)}" alt="${esc(name)}" class="${cls}" onerror="this.style.display='none'">`;
        const initials = (name || "?").trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
        const ph = cls.includes("member") ? "member-avatar-placeholder" : "friend-avatar-placeholder";
        return `<div class="${ph}">${esc(initials)}</div>`;
    }

    // ── Палитра уровней FACEIT ──────────────────────────────────────────────
    // 1 — белый, 2-3 — лайм, 4-7 — жёлтый, 8-9 — оранжевый, 10 — красный.
    // Уровень 0 ("нет аккаунта") и отсутствие уровня — нейтральный серый.
    function faceitLevelColor(level) {
        if (level === null || level === undefined || level === 0) return "#5c6b7f";
        if (level === 1) return "#e8ecf0";
        if (level <= 3) return "#8bc543";
        if (level <= 7) return "#e6b022";
        if (level <= 9) return "#ff8a1f";
        return "#e14b4b"; // level 10
    }

    

    function showToast(msg, type) {
        let t = document.getElementById("_toast");
        if (!t) {
            t = document.createElement("div");
            t.id = "_toast";
            t.style.cssText = "position:fixed;bottom:28px;right:28px;z-index:9999;padding:12px 20px;border-radius:10px;font-family:'Inter',sans-serif;font-size:14px;font-weight:600;pointer-events:none;opacity:0;transition:opacity 0.3s;";
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.background = type === "ok" ? "rgba(76,175,130,0.95)" : "rgba(224,92,92,0.95)";
        t.style.color = "#fff";
        t.style.opacity = "1";
        clearTimeout(t._timer);
        t._timer = setTimeout(() => { t.style.opacity = "0"; }, 3000);
    }

    //модальные окна

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

    //м: создать тим

    window.openCreateTeamModal = function() {
        const errEl = document.getElementById("ctError");
        if (errEl) { errEl.textContent = ""; errEl.style.display = "none"; }
        ["ctName","ctTag","ctLogo","ctTelegram"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
        openModal("createTeamModal");
    };

    window.closeCreateTeamModal = function() { closeModal("createTeamModal"); };

    window.submitCreateTeam = async function() {
        const nameEl     = document.getElementById("ctName");
        const tagEl      = document.getElementById("ctTag");
        const logoEl     = document.getElementById("ctLogo");
        const telegramEl = document.getElementById("ctTelegram");
        const errEl      = document.getElementById("ctError");
        const btn        = document.getElementById("ctSubmitBtn");
        const name     = nameEl     ? nameEl.value.trim()     : "";
        const tag      = tagEl      ? tagEl.value.trim()      : "";
        let   logo     = logoEl     ? logoEl.value.trim()     : "";
        const telegram = telegramEl ? telegramEl.value.trim() : "";
        const fileInput = document.getElementById("ctLogoFile");

        if (errEl) errEl.style.display = "none";
        if (!name || !tag) {
            if (errEl) { errEl.textContent = "Заполните название и тег команды."; errEl.style.display = "block"; }
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = "Создание..."; }

        //лоад лого
        if (fileInput && fileInput.files.length > 0) {
            try {
                if (btn) btn.textContent = "Загружаем лого...";
                logo = await uploadLogoToCloudinary(fileInput.files[0]);
                if (logoEl) logoEl.value = logo;
            } catch (uploadErr) {
                const ctErr = document.getElementById("ctLogoUploadError");
                if (ctErr) { ctErr.textContent = uploadErr.message; ctErr.style.display = "block"; }
                if (btn) { btn.disabled = false; btn.textContent = "Создать команду"; }
                return;
            }
            if (btn) btn.textContent = "Создание...";
        }

        try {
            const res  = await fetch("/api/teams", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name,tag,logo,telegram}) });
            const data = await res.json();
            if (!res.ok) {
                if (errEl) { errEl.textContent = data.error || "Ошибка сервера."; errEl.style.display = "block"; }
                if (btn)   { btn.disabled = false; btn.textContent = "Создать команду"; }
                return;
            }
            closeCreateTeamModal();
            showToast("Команда создана!", "ok");
            await refreshProfile();
        } catch {
            if (errEl) { errEl.textContent = "Ошибка соединения."; errEl.style.display = "block"; }
            if (btn)   { btn.disabled = false; btn.textContent = "Создать команду"; }
        }
    };

    //публичный профиль

    const urlParams     = new URLSearchParams(window.location.search);
    const publicSteamId = urlParams.get("id");

    if (publicSteamId) {
        const pubWrap = document.getElementById("publicProfileWrap");
        const ownWrap = document.getElementById("ownProfileWrap");
        if (pubWrap) pubWrap.style.display = "block";
        if (ownWrap) ownWrap.style.display = "none";

        const helpBtn = document.getElementById("profileHelpBtn");
        if (helpBtn) helpBtn.style.display = "none";

        loadPublicProfile(publicSteamId);
    } else {
        loadProfile();

        let _prevNotifCount = -1;

        async function pollNotifications() {
            try {
                const res = await fetch("/api/notifications/count");
                if (!res.ok) return;
                const d = await res.json();

                const total = d.total || 0;

                if (_prevNotifCount >= 0 && total > _prevNotifCount) {
                    await refreshProfile();
                }
                _prevNotifCount = total;
                // Update badges from lightweight response
                const frBadge = document.getElementById("friendReqBadge");
                const nfBadge = document.getElementById("notifsBadge");
                if (frBadge) { frBadge.textContent = d.friendRequests || 0; frBadge.style.display = d.friendRequests > 0 ? "inline-flex" : "none"; }
                if (nfBadge) { const n = (d.teamInvites||0) + (d.adminNotices||0); nfBadge.textContent = n; nfBadge.style.display = n > 0 ? "inline-flex" : "none"; }
            } catch {}
        }

        setInterval(pollNotifications, 5000);
        setTimeout(pollNotifications, 5000);
    }

    async function loadPublicProfile(steamId) {
        const pubLoading = document.getElementById("publicLoading");
        try {
            const [pubRes, meRes] = await Promise.all([
                fetch(`/api/users/${encodeURIComponent(steamId)}/public`),
                fetch("/api/profile").catch(() => null)
            ]);
            if (pubLoading) pubLoading.style.display = "none";

            let me = null;
            if (meRes && meRes.ok) {
                try { me = await meRes.json(); } catch {}
            }

            // Владелец открыл свой профиль по ?id=: берём его данные из /api/profile
            // (авторизованный запрос), публичный API при этом не ослабляется.
            if (me && me.steamId && String(me.steamId) === String(steamId)) {
                showPublicView(me, { selfPrivate: !!me.isPrivate });
                return;
            }

            if (!pubRes.ok) { showPublicHidden(); return; }
            const data = await pubRes.json();
            showPublicView(data, {});
        } catch {
            if (pubLoading) pubLoading.innerHTML = '<p style="color:var(--text-gray);text-align:center;padding:40px;">Не удалось загрузить профиль.</p>';
        }
    }

    function showPublicHidden() {
        const el = document.getElementById("publicHidden");
        if (el) el.style.display = "block";
    }

    function showPublicView(vd, opts) {
        const content = document.getElementById("publicContent");
        const host    = document.getElementById("pubView");
        if (!content || !host) return;
        content.style.display = "block";

        const root = ensureView(host);
        renderView(root, vd, opts);

        // Чужой приватный профиль: косметику и остальные данные не показываем
        const hide = !!vd.isPrivate && !(opts && opts.selfPrivate);
        applyCosmeticCSS(hide ? {} : (vd.equippedCosmetics || {}));

        if (!hide && vd.steamId) {
            fetchMatches(vd.steamId).then(m => renderMatches(root, m));
        }
    }

    // ── Общий компонент профиля (шаблон #profileViewTpl) ────────────────────
    function ensureView(host) {
        if (!host.firstElementChild) {
            const tpl = document.getElementById("profileViewTpl");
            host.appendChild(tpl.content.cloneNode(true));
            const root = host.firstElementChild;
            root.querySelectorAll("[data-ico]").forEach(el => {
                el.insertAdjacentHTML("afterbegin", iconSvg(el.dataset.ico) + " ");
            });
        }
        return host.firstElementChild;
    }

    function q(root, key) { return root.querySelector(`[data-pv="${key}"]`); }

    // vd: { displayName, avatar, rank, rankColor, faceitLevel, hoursInCS2, bio, telegramUsername,
    //       discordUsername, stats, seasonStats, team, isPrivate }
    // opts.selfPrivate — владелец смотрит свой скрытый профиль: показываем всё + пометку.
    function renderView(root, vd, opts) {
        opts = opts || {};
        const hide = !!vd.isPrivate && !opts.selfPrivate;

        // Аватар и имя видны всегда
        const av  = q(root, "avatar");
        const src = vd.avatar || AVATAR_FALLBACK;
        if (av.dataset.src !== src) {
            av.dataset.src = src;
            av.onerror = function() { this.onerror = null; this.dataset.src = AVATAR_FALLBACK; this.src = AVATAR_FALLBACK; };
            av.src = src;
        }
        q(root, "name").textContent = vd.displayName || "—";

        q(root, "private").hidden  = !hide;
        q(root, "selfNote").hidden = !(vd.isPrivate && opts.selfPrivate);
        q(root, "body").hidden     = hide;

        // Ранг
        const rankEl = q(root, "rank");
        if (hide) {
            rankEl.hidden = true;
        } else {
            rankEl.hidden = false;
            rankEl.textContent = vd.rank || "Unranked";
            if (vd.rankColor && /^#[0-9a-fA-F]{3,8}$/.test(vd.rankColor)) {
                rankEl.style.color       = vd.rankColor;
                rankEl.style.borderColor = vd.rankColor + "55";
                rankEl.style.background  = vd.rankColor + "18";
            } else {
                rankEl.style.color = rankEl.style.borderColor = rankEl.style.background = "";
            }
        }

        // Тег команды в шапке
        const tagEl = q(root, "teamTag");
        if (!hide && vd.team && vd.team.tag) {
            tagEl.hidden = false;
            tagEl.textContent = `[${vd.team.tag}] ${vd.team.name || ""}`.trim();
            tagEl.href = `/team.html?tag=${encodeURIComponent(vd.team.tag)}`;
        } else {
            tagEl.hidden = true;
        }

        // Бейджи FACEIT / часы (пустые не показываем)
        const badges = q(root, "badges");
        badges.textContent = "";
        if (!hide) {
            if (Number.isFinite(vd.faceitLevel) && vd.faceitLevel > 0) {
                const color = faceitLevelColor(vd.faceitLevel);
                const chip = document.createElement("span");
                chip.className = "pv-chip";
                chip.style.background  = color + "20";
                chip.style.border      = `1px solid ${color}55`;
                chip.style.color       = color;
                chip.textContent = `FACEIT lv${vd.faceitLevel}`;
                badges.appendChild(chip);
            }
            if (Number.isFinite(vd.hoursInCS2)) {
                const chip = document.createElement("span");
                chip.className = "pv-chip pv-chip--hours";
                chip.innerHTML = iconSvg("clock") + " " + esc(vd.hoursInCS2) + " ч. в CS2";
                badges.appendChild(chip);
            }
        }
        badges.hidden = !badges.children.length;

        if (hide) return;

        // О себе
        const bio = (vd.bio || "").trim();
        q(root, "bioBlock").hidden = !bio;
        q(root, "bio").textContent = bio;

        // Контакты
        const links = [];
        if (vd.telegramUsername) {
            links.push(`<a class="pv-social pv-social--tg" href="https://t.me/${encodeURIComponent(vd.telegramUsername)}" target="_blank" rel="noopener noreferrer">${SVG_TG} @${esc(vd.telegramUsername)}</a>`);
        }
        if (vd.discordUsername) {
            links.push(`<span class="pv-social pv-social--dc">${SVG_DC} ${esc(vd.discordUsername)}</span>`);
        }
        q(root, "socialsBlock").hidden = !links.length;
        q(root, "socials").innerHTML   = links.join("");

        // Команда
        const teamBlock = q(root, "teamBlock");
        if (vd.team && vd.team.tag) {
            teamBlock.hidden = false;
            const card = q(root, "teamCard");
            const logoHtml = vd.team.logo
                ? `<img src="${esc(vd.team.logo)}" alt="" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
                : `<div style="width:44px;height:44px;border-radius:8px;background:rgba(230,176,34,0.12);border:1px solid rgba(230,176,34,0.25);display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:13px;color:var(--accent);flex-shrink:0;">${esc(String(vd.team.tag || "?").slice(0, 2))}</div>`;
            card.href = `/team.html?tag=${encodeURIComponent(vd.team.tag)}`;
            card.innerHTML = `${logoHtml}<div class="pv-team-info"><div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:16px;color:white;overflow-wrap:anywhere;">${esc(vd.team.name)}</div><div style="font-size:12px;color:#5c6b7f;margin-top:3px;text-transform:uppercase;letter-spacing:1px;">[${esc(vd.team.tag)}]</div></div><div class="pv-team-go">Перейти на страницу команды ${iconSvg("link")}</div>`;
        } else {
            teamBlock.hidden = true;
        }

        renderStatOverview(root, vd);
    }

    // ── Обзорная статистика (донаты FACEIT-уровня / винрейта сезона) ────────
    function renderStatOverview(root, data) {
        const card = q(root, "statCard");
        const hasFaceit    = Number.isFinite(data.faceitLevel) && data.faceitLevel > 0;
        const stats        = data.stats || {};
        const seasonStat   = data.seasonStats || null;
        const totalMatches = (stats.wins || 0) + (stats.losses || 0);

        if (!hasFaceit && !seasonStat && !totalMatches) { card.hidden = true; return; }
        card.hidden = false;

        const faceitDonut = q(root, "faceitDonut");
        const faceitVal   = q(root, "faceitVal");
        if (hasFaceit) {
            faceitDonut.style.setProperty("--pct", (data.faceitLevel / 10) * 100);
            faceitDonut.style.setProperty("--donut-color", faceitLevelColor(data.faceitLevel));
            faceitVal.textContent = data.faceitLevel;
        } else {
            faceitDonut.style.setProperty("--pct", 0);
            faceitDonut.style.setProperty("--donut-color", faceitLevelColor(null));
            faceitVal.textContent = "—";
        }

        const winrateWrap = q(root, "winrateWrap");
        if (seasonStat && seasonStat.matches > 0) {
            winrateWrap.hidden = false;
            q(root, "winrateDonut").style.setProperty("--pct", seasonStat.winPct);
            q(root, "winrateVal").textContent   = seasonStat.winPct + "%";
            q(root, "winrateLabel").textContent = `ВИНРЕЙТ · ${seasonStat.seasonName}`;
        } else {
            winrateWrap.hidden = true;
        }

        q(root, "kd").textContent = (stats.deaths || 0) > 0
            ? (stats.kills / stats.deaths).toFixed(2)
            : (stats.kills ? stats.kills.toFixed(2) : "—");
        q(root, "matchesPlayed").textContent = totalMatches || "—";
    }

    // ── Последние матчи ──────────────────────────────────────────────────
    async function fetchMatches(steamId) {
        try {
            const res = await fetch(`/api/users/${encodeURIComponent(steamId)}/matches?limit=6`);
            if (!res.ok) return [];
            const m = await res.json();
            return Array.isArray(m) ? m : [];
        } catch {
            return [];
        }
    }

    function renderMatches(root, matches) {
        const block = q(root, "matchesBlock");
        const wrap  = q(root, "matchesWrap");
        if (!block || !wrap) return;
        if (!matches || !matches.length) { block.hidden = true; wrap.innerHTML = ""; return; }
        block.hidden = false;
        wrap.innerHTML = matches.map(m => {
            const dateStr = m.playedAt
                ? new Date(m.playedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" })
                : "";
            const kdaStr = (m.kills !== null && m.kills !== undefined)
                ? `${m.kills}/${m.deaths}/${m.assists}`
                : "";
            return `
                <div class="match-row-item">
                    <span class="match-result-badge ${m.result === "win" ? "win" : "loss"}">${m.result === "win" ? "WIN" : "LOSS"}</span>
                    <span class="match-map">${m.map ? esc(m.map) : "—"}</span>
                    <span class="match-opponent">vs ${m.opponentTeam ? `[${esc(m.opponentTeam.tag)}] ${esc(m.opponentTeam.name)}` : "—"}</span>
                    <span class="match-score">${m.score ? esc(m.score) : "—"}</span>
                    <span class="match-kda">${kdaStr}</span>
                    <span class="match-date">${dateStr}</span>
                </div>`;
        }).join("");
    }

    function esc(s) {
        return String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
    }

    window.pubAddFriend = async function() {
        const btn     = document.getElementById("pubFriendBtn");
        const steamId = btn?.dataset.steamId;
        if (!steamId) return;
        if (btn) { btn.disabled = true; btn.textContent = "..."; }
        try {
            const searchRes = await fetch("/api/users/search?q=" + encodeURIComponent(steamId));
            const results   = searchRes.ok ? await searchRes.json() : [];
            const target    = results.find(u => u.steamId === steamId);
            if (!target) {
                if (btn) { btn.disabled = false; btn.textContent = "+ Добавить в друзья"; }
                alert("Не удалось найти игрока");
                return;
            }
            const res = await fetch(`/api/friends/request/${target._id}`, { method: "POST" });
            const d   = await res.json();
            if (!res.ok) {
                if (btn) { btn.disabled = false; btn.textContent = "+ Добавить в друзья"; }
                alert(d.error || "Ошибка");
                return;
            }
            if (d.autoAccepted) {
                if (btn) { btn.innerHTML = iconSvg("checkCircle") + " Уже в друзьях"; btn.style.color = "#4caf82"; btn.style.borderColor = "rgba(76,175,130,0.35)"; }
            } else {
                if (btn) { btn.textContent = "Заявка отправлена"; btn.style.color = "#e6b022"; btn.style.borderColor = "rgba(230,176,34,0.35)"; }
            }
        } catch {
            if (btn) { btn.disabled = false; btn.textContent = "+ Добавить в друзья"; }
        }
    };

    //свой профиль

    async function loadProfile() {
        const ownWrap = document.getElementById("ownProfileWrap");
        const pubWrap = document.getElementById("publicProfileWrap");
        if (ownWrap) ownWrap.style.display = "block";
        if (pubWrap) pubWrap.style.display = "none";

        try {
            const res = await fetch("/api/profile");
            if (res.status === 401) {
                const loading = document.getElementById("profileLoading");
                const gate    = document.getElementById("authGateProfile");
                if (loading) loading.style.display = "none";
                if (gate)    gate.style.display    = "block";
                return;
            }
            _profileData = await res.json();
            await renderProfile(_profileData);
        } catch {
            const loading = document.getElementById("profileLoading");
            if (loading) loading.innerHTML = '<p style="color:var(--text-gray);text-align:center;padding:40px;">Не удалось загрузить профиль.</p>';
        }
    }

    async function renderProfile(d) {
        const loading = document.getElementById("profileLoading");
        const content = document.getElementById("profileContent");
        if (loading) loading.style.display = "none";
        if (content) content.style.display = "block";

        const helpBtn = document.getElementById("profileHelpBtn");
        if (helpBtn) helpBtn.style.display = "inline-flex";

        // Уведомление о закрытом Steam: только в личном кабинете, только при подтверждённой приватности
        const syncWarn = document.getElementById("steamSyncWarning");
        if (syncWarn) syncWarn.style.display = d.steamSyncPrivacyError ? "block" : "none";

        // ── Вкладка «Профиль»: только сохранённые данные (как видят другие) ──
        const ownRoot = ensureView(document.getElementById("ownView"));
        renderView(ownRoot, d, { selfPrivate: !!d.isPrivate });
        applyCosmeticCSS(d.equippedCosmetics || {});

        // ── Вкладка «Редактирование»: сохранённое + черновик + превью ───────
        if (!_invLoaded) await loadInventory();
        syncEditor(d);

        renderTeamTab(d);
        renderNotifsTab(d);
        updateBadges(d);

        if (d.steamId) {
            fetchMatches(d.steamId).then(m => {
                _matchesCache = m;
                renderMatches(ownRoot, m);
                const prev = document.getElementById("editPreview");
                if (prev && prev.firstElementChild) {
                    renderMatches(prev.firstElementChild, m);
                    prev.firstElementChild._m = true;
                }
            });
        }

        // Кнопка «Просмотр профиля» → публичная страница
        const viewPublicProfileLink = document.getElementById("viewPublicProfileLink");
        if (viewPublicProfileLink && d.steamId) {
            viewPublicProfileLink.href  = `/profile.html?id=${encodeURIComponent(d.steamId)}`;
            viewPublicProfileLink.style.display = "inline-flex";
        }
    }

    // ── Инъекция CSS косметики ─────────────────────────────────────────────
    function addImportant(css) {
        // Добавляет !important к каждому свойству в CSS-строке
        return css.replace(/([^:{};]+:[^;{}]+)(;|(?=}))/g, function(m, prop, end) {
            if (prop.trim().endsWith("!important")) return m;
            return prop.trim() + " !important" + (end || "");
        });
    }

    function extractKeyframes(css) {
    let keyframes = "";
    const kfRegex = /@keyframes\s+[\w\-]+\s*\{(?:[^{}]+|\{[^{}]*\})*\}/g;
    const cleanCss = css.replace(kfRegex, function(match) {
        keyframes += match + "\n";
        return "";
    });
    return { keyframes, cleanCss: cleanCss.trim() };
}

    // Предмет считается "сырым" CSS (с собственными селекторами/::before/::after),
    // если содержит фигурную скобку — иначе это просто список свойств (старый формат).
    function isRawCosmeticCss(css) {
        return /\{/.test(css);
    }

    // Подставляет плейсхолдер %SEL% на каждый переданный селектор и склеивает блоки.
    // Так один и тот же "сырой" CSS предмета применяется и к своему, и к публичному профилю.
    function injectRawCosmeticCss(css, selectors) {
        return selectors.map(sel => css.split("%SEL%").join(sel)).join("\n");
    }
    // Собирает CSS косметики для заданных селекторов (общий код для профиля и превью).
    // o: { frameSels: [...], avatarSels: [...], bgSel: "..." }
    function buildCosmeticStyles(cosmetics, o) {
        let styles = "";
        let hasBg  = false;

        // ── Рамка аватарки ────────────────────────────────────────────────
        const frame = cosmetics.avatarFrame;
        if (frame && (frame.css || frame.keyframes)) {
            const src = (frame.keyframes || "") + "\n" + (frame.css || "");
            const extracted = extractKeyframes(src);
            if (extracted.keyframes) styles += extracted.keyframes + "\n";
            const cleanCss = extracted.cleanCss;
            if (cleanCss) {
                if (isRawCosmeticCss(cleanCss)) {
                    // Сырой CSS (свои селекторы, ::before/::after) — вешаем на div-обёртку,
                    // а не на <img>: псевдоэлементы на replaced-элементах браузер не рисует.
                    styles += injectRawCosmeticCss(cleanCss, o.frameSels) + "\n";
                } else {
                    styles += `${o.avatarSels.join(", ")} { ${addImportant(cleanCss)} }\n`;
                }
            }
        }

        // ── Фон профиля ───────────────────────────────────────────────────
        const bg = cosmetics.profileBg;
        if (bg && (bg.css || bg.keyframes)) {
            const src = (bg.keyframes || "") + "\n" + (bg.css || "");
            const extracted = extractKeyframes(src);
            if (extracted.keyframes) styles += extracted.keyframes + "\n";
            const cleanCss = extracted.cleanCss;
            if (cleanCss) {
                if (isRawCosmeticCss(cleanCss)) {
                    styles += injectRawCosmeticCss(cleanCss, [o.bgSel]) + "\n";
                } else {
                    styles += `${o.bgSel} { ${cleanCss} }\n`;
                }
                hasBg = true;
            }
        }
        return { styles, hasBg };
    }

    function setStyleEl(id, css) {
        let el = document.getElementById(id);
        if (!el) {
            el = document.createElement("style");
            el.id = id;
            document.head.appendChild(el);
        }
        el.textContent = css;
    }

    // Косметика самого профиля (публичная страница и вкладка «Профиль»).
    // ВАЖНО: фон вешаем на #_cosmetic_bg_layer (position:fixed, will-change:transform),
    // а не на body — иначе браузер перерисовывает всю страницу на каждом кадре анимации.
    function applyCosmeticCSS(cosmetics) {
        const r = buildCosmeticStyles(cosmetics || {}, {
            frameSels:  ["#pubView .pv-frame-wrap", "#ownView .pv-frame-wrap"],
            avatarSels: ["#pubView .pv-avatar", "#ownView .pv-avatar"],
            bgSel:      "#_cosmetic_bg_layer",
        });

        let bgLayer = document.getElementById("_cosmetic_bg_layer");
        if (!bgLayer) {
            bgLayer = document.createElement("div");
            bgLayer.id = "_cosmetic_bg_layer";
            document.body.insertBefore(bgLayer, document.body.firstChild);
        }
        bgLayer.classList.toggle("active", r.hasBg);
        setStyleEl("_cosmetic_styles", r.styles);
    }

    // Косметика в превью редактора (локальный слой внутри превью, не затрагивает остальную страницу).
    function applyPreviewCosmeticCSS(cosmetics, root) {
        const r = buildCosmeticStyles(cosmetics || {}, {
            frameSels:  ["#editPreview .pv-frame-wrap"],
            avatarSels: ["#editPreview .pv-avatar"],
            bgSel:      "#editPreview .pv-bg",
        });
        setStyleEl("_cosmetic_styles_preview", r.styles);
        const bgEl = root && q(root, "bg");
        if (bgEl) bgEl.classList.toggle("active", r.hasBg);
    }

    // Экспортируем для публичного профиля
    window._applyCosmeticCSS = applyCosmeticCSS;

    // ═══ Вкладки: Профиль / Редактирование / Команда / Уведомления ═══════════
    function activateTab(name) {
        document.querySelectorAll(".profile-tab-btn").forEach(b => b.classList.toggle("active", b.dataset.tab === name));
        document.querySelectorAll(".profile-tab-content").forEach(c => c.classList.toggle("active", c.id === "tab-" + name));
        // На вкладке редактирования глобальный фон страницы скрыт: фон показывает само превью
        document.body.classList.toggle("pe-active", name === "edit");
        if (name === "edit") {
            updatePreview();
            loadBlockedList();
            // Инвентарь перечитываем при входе (например, после промокода); черновик не трогаем
            loadInventory().then(() => { renderCosmeticsSection(); updatePreview(); });
            loadPurchaseHistory();
        }
    }

    // ═══ Редактирование профиля ═════════════════════════════════════════════
    function normTg(s) { return String(s || "").trim().replace(/^@/, ""); }

    function savedFromProfile(d) {
        const eq = d.equippedCosmetics || {};
        return {
            faceitLevel: d.faceitLevel ?? null,
            hoursInCS2:  d.hoursInCS2  ?? null,
            bio:         d.bio || "",
            isPrivate:   !!d.isPrivate,
            telegram:    d.telegramUsername || "",
            discord:     d.discordUsername  || "",
            // equippedCosmetics.* хранит _id предмета ShopItem (= personalInventory[].itemId)
            avatarFrame: (eq.avatarFrame && eq.avatarFrame._id) || null,
            profileBg:   (eq.profileBg   && eq.profileBg._id)   || null,
        };
    }

    function isDirty() {
        if (!_saved || !_draft) return false;
        return _draft.faceitLevel !== _saved.faceitLevel
            || _draft.hoursInCS2  !== _saved.hoursInCS2
            || _draft.bio         !== _saved.bio
            || _draft.isPrivate   !== _saved.isPrivate
            || normTg(_draft.telegram) !== normTg(_saved.telegram)
            || String(_draft.discord).trim() !== String(_saved.discord).trim()
            || _draft.avatarFrame !== _saved.avatarFrame
            || _draft.profileBg   !== _saved.profileBg;
    }

    // Вызывается после каждой загрузки профиля с сервера (в т.ч. фоновой).
    // Несохранённые правки при этом не затираются.
    function syncEditor(d) {
        const next     = savedFromProfile(d);
        const wasDirty = !!(_saved && _draft && isDirty());
        const changed  = !_saved || JSON.stringify(next) !== JSON.stringify(_saved);
        _saved = next;

        if (!_draft || !wasDirty) {
            _draft = Object.assign({}, _saved);
            if (changed || !_formBuilt) fillEditorForm();
        }

        updateIncompleteUI(d);
        renderCosmeticsSection();
        updatePreview();
        updateEditorState();
    }

    function updateIncompleteUI(d) {
        const isIncomplete = (d.faceitLevel === null || d.faceitLevel === undefined) ||
                             (d.hoursInCS2  === null || d.hoursInCS2  === undefined);
        const warning = document.getElementById("profileIncompleteWarning");
        if (warning) warning.style.display = isIncomplete ? "block" : "none";
        const badge = document.getElementById("profileIncompleteBadge");
        if (badge) badge.style.display = isIncomplete ? "inline-flex" : "none";
    }

    function renderFaceitButtons() {
        const group = document.getElementById("faceitBtnGroup");
        if (!group || !_draft) return;
        const faceit = _draft.faceitLevel;
        group.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(lv => {
            const label = lv === 0 ? "Нет" : `lv${lv}`;
            const sel   = faceit === lv;
            const color = faceitLevelColor(lv === 0 ? null : lv);
            return `<button type="button" data-level="${lv}"
                style="padding:7px 13px;border-radius:6px;cursor:pointer;transition:all 0.2s;
                       font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;
                       border:1px solid ${sel ? color : "var(--border)"};
                       background:${sel ? color + "26" : "#0e1318"};
                       color:${sel ? color : "var(--text-gray)"};"
            >${label}</button>`;
        }).join("");
        const hidden = document.getElementById("statFaceit");
        if (hidden) hidden.value = faceit !== null ? String(faceit) : "";
    }

    function updateBioCounter() {
        const bioInput = document.getElementById("statBio");
        const counter  = document.getElementById("bioCharCount");
        if (!bioInput || !counter) return;
        const n = bioInput.value.length;
        counter.textContent = n;
        const wrap = counter.parentElement;
        if (wrap) wrap.style.color = n >= BIO_MAX ? "#e05c5c" : (n >= BIO_MAX * 0.9 ? "#e6b022" : "");
    }

    // Заполняет поля формы значениями из черновика
    function fillEditorForm() {
        if (!_draft) return;
        wireEditorOnce();
        renderFaceitButtons();

        const hoursInput = document.getElementById("statHours");
        if (hoursInput) hoursInput.value = _draft.hoursInCS2 !== null ? _draft.hoursInCS2 : "";

        const bioInput = document.getElementById("statBio");
        if (bioInput) bioInput.value = _draft.bio;
        updateBioCounter();

        const privToggle = document.getElementById("statPrivate");
        if (privToggle) privToggle.checked = _draft.isPrivate;

        const tgInput = document.getElementById("statTelegram");
        if (tgInput) tgInput.value = _draft.telegram;
        const dcInput = document.getElementById("statDiscord");
        if (dcInput) dcInput.value = _draft.discord;
    }

    // Обработчики вешаются один раз (раньше они добавлялись при каждой перерисовке)
    function wireEditorOnce() {
        if (_formBuilt) return;
        _formBuilt = true;

        const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

        const group = document.getElementById("faceitBtnGroup");
        if (group) group.addEventListener("click", e => {
            const b = e.target.closest("button[data-level]");
            if (!b || !_draft) return;
            _draft.faceitLevel = parseInt(b.dataset.level, 10);
            renderFaceitButtons();
            onDraftChanged();
        });

        on("statHours", "input", function() {
            if (!_draft) return;
            const v = this.value.trim();
            _draft.hoursInCS2 = v === "" ? null : Number(v);
            if (Number.isNaN(_draft.hoursInCS2)) _draft.hoursInCS2 = null;
            onDraftChanged();
        });

        on("statBio", "input", function() {
            if (!_draft) return;
            if (this.value.length > BIO_MAX) this.value = this.value.slice(0, BIO_MAX);
            _draft.bio = this.value;
            updateBioCounter();
            onDraftChanged();
        });

        on("statPrivate", "change", function() {
            if (!_draft) return;
            _draft.isPrivate = this.checked;
            onDraftChanged();
        });

        on("statTelegram", "input", function() { if (_draft) { _draft.telegram = this.value; onDraftChanged(); } });
        on("statDiscord",  "input", function() { if (_draft) { _draft.discord  = this.value; onDraftChanged(); } });

        const grid = document.getElementById("inventoryItemsGrid");
        if (grid) grid.addEventListener("click", e => {
            const b = e.target.closest("button[data-act]");
            if (!b) return;
            if (b.dataset.act === "equip") window.equipCosmetic(b.dataset.id, b.dataset.slot);
            else window.unequipCosmetic(b.dataset.slot);
        });
    }

    function onDraftChanged() {
        const errEl = document.getElementById("statsError");
        if (errEl) errEl.style.display = "none";
        const okEl = document.getElementById("statsSuccess");
        if (okEl) okEl.style.display = "none";
        updatePreview();
        updateEditorState();
    }

    function updateEditorState() {
        const dirty  = isDirty();
        const save   = document.getElementById("statsSaveBtn");
        const cancel = document.getElementById("statsCancelBtn");
        const hint   = document.getElementById("editDirtyHint");
        if (save)   save.disabled   = !dirty || _saving;
        if (cancel) cancel.disabled = !dirty || _saving;
        if (hint)   hint.style.display = dirty ? "" : "none";
    }

    // ── Косметика: выбор только из реального инвентаря игрока ───────────────
    async function loadInventory() {
        try {
            const r = await fetch("/api/shop/inventory");
            if (r.ok) {
                const j = await r.json();
                _inv   = (j.personal || []).filter(e => e && e.itemId);
                _invOk = true;
            } else {
                _invOk = false;
            }
        } catch {
            _invOk = false;
        }
        _invLoaded = true;
    }

    // ── История личных покупок (видна только владельцу профиля) ─────────────
    function fmtPurchaseDate(d) {
        if (!d) return "";
        return new Date(d).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    let _phSeq = 0;   // применяем только ответ последнего запроса
    async function loadPurchaseHistory() {
        const wrap = document.getElementById("purchaseHistoryWrap");
        const list = document.getElementById("purchaseHistoryList");
        if (!wrap || !list) return;
        const mySeq = ++_phSeq;
        try {
            const r = await fetch("/api/shop/history/personal");
            if (!r.ok) return;
            const rows = await r.json();
            if (mySeq !== _phSeq) return;
            wrap.style.display = "";
            list.innerHTML = rows.length
                ? rows.map(p => `<div class="ph-row">
                <div class="ph-icon">${p.itemIcon || iconSvg("gift")}</div>
                <div class="ph-main">
                    <div class="ph-name">${esc(p.itemName || "Предмет")}</div>
                    <div class="ph-sub">
                        <span>${fmtPurchaseDate(p.createdAt)}</span>
                        ${p.buyer ? `<span>·</span>${p.buyer.avatar ? `<img src="${esc(p.buyer.avatar)}" alt="">` : ""}<span>${esc(p.buyer.displayName || "Игрок")}</span>` : ""}
                    </div>
                </div>
                <div class="ph-price">−${p.price} <small>монет</small></div>
            </div>`).join("")
                : `<div class="ph-empty">Покупок пока нет</div>`;
        } catch (e) { console.error(e); }
    }

    // id предмета (ShopItem._id) → объект предмета с css/keyframes для превью
    function resolveCosmetic(slot, id) {
        if (!id) return null;
        const hit = _inv.find(e => e.itemId && String(e.itemId._id) === String(id));
        if (hit) return hit.itemId;
        const cur = _profileData && _profileData.equippedCosmetics && _profileData.equippedCosmetics[slot];
        if (cur && String(cur._id) === String(id)) return cur;
        return null;
    }

    function renderCosmeticsSection() {
        if (!_draft) return;

        // Слоты «Сейчас выбрано» (по черновику)
        const slotCfg = {
            avatarFrame: { nameId: "slotAvatarFrameName", btnId: "unequipAvatarFrameBtn", slotId: "slotAvatarFrame", empty: "Не надета" },
            profileBg:   { nameId: "slotProfileBgName",   btnId: "unequipProfileBgBtn",   slotId: "slotProfileBg",   empty: "Не надет"  },
        };
        for (const [slot, cfg] of Object.entries(slotCfg)) {
            const item   = resolveCosmetic(slot, _draft[slot]);
            const nameEl = document.getElementById(cfg.nameId);
            const btnEl  = document.getElementById(cfg.btnId);
            const slotEl = document.getElementById(cfg.slotId);
            if (!nameEl) continue;
            if (item && item.name) {
                nameEl.textContent = item.name;
                nameEl.className   = "cslot-filled";
                if (btnEl)  btnEl.style.display = "";
                if (slotEl) slotEl.classList.add("has-item");
            } else {
                nameEl.textContent = cfg.empty;
                nameEl.className   = "cslot-empty";
                if (btnEl)  btnEl.style.display = "none";
                if (slotEl) slotEl.classList.remove("has-item");
            }
        }

        // Сетка инвентаря
        const grid      = document.getElementById("inventoryItemsGrid");
        const emptyNote = document.getElementById("inventoryEmptyNote");
        if (!grid) return;

        if (!_invOk) {
            grid.innerHTML = `<div style="color:#e05c5c;font-size:13px;padding:8px 0;">Не удалось загрузить инвентарь. Обновите страницу.</div>`;
            if (emptyNote) emptyNote.style.display = "none";
            return;
        }
        grid.innerHTML = "";

        if (_inv.length === 0) {
            if (emptyNote) emptyNote.style.display = "";
            return;
        }
        if (emptyNote) emptyNote.style.display = "none";

        const cosmeticLabels = {
            "avatar_frame": iconSvg("image")   + " Рамка аватара",
            "profile_bg":   iconSvg("palette") + " Фон профиля",
        };
        const slotByType = { "avatar_frame": "avatarFrame", "profile_bg": "profileBg" };
        const seen = new Set();   // один и тот же предмет, купленный дважды, показываем один раз

        _inv.forEach(({ itemId, consumed }) => {
            // ── Буст монет: расходник, не надевается ──────────────────────
            if (itemId.type === "boost") {
                const card = document.createElement("div");
                card.className = "cosmetic-inv-card" + (consumed ? " is-equipped" : "");
                card.innerHTML = `
                    <div class="cic-icon">${itemId.icon || iconSvg("coins")}</div>
                    <div class="cic-meta">
                        <div class="cic-name">${esc(itemId.name)}</div>
                        <div class="cic-type">${consumed
                            ? iconSvg("checkCircle") + " Использован"
                            : iconSvg("zap") + " Активен — сработает в следующем матче"}</div>
                    </div>
                    <div class="cic-btn" style="opacity:0.5;cursor:default;background:transparent;
                         border:none;font-size:11px;color:var(--text-gray);">
                        ${consumed ? "Использован" : "Авто"}
                    </div>
                `;
                grid.appendChild(card);
                return;
            }

            // ── Командная косметика: показываем, но без кнопки надеть ─────
            if (itemId.cosmeticType === "team_bg" || itemId.category === "team") {
                const card = document.createElement("div");
                card.className = "cosmetic-inv-card";
                card.innerHTML = `
                    <div class="cic-icon">${itemId.icon || iconSvg("gift")}</div>
                    <div class="cic-meta">
                        <div class="cic-name">${esc(itemId.name)}</div>
                        <div class="cic-type">${iconSvg("shield")} Командный предмет</div>
                    </div>
                    <div class="cic-btn" style="opacity:0.5;cursor:default;background:transparent;
                         border:none;font-size:11px;color:var(--text-gray);">Команда</div>
                `;
                grid.appendChild(card);
                return;
            }

            // ── Личная косметика: рамка / фон профиля ─────────────────────
            const slot = slotByType[itemId.cosmeticType];
            if (!slot) return;   // неизвестный тип — пропускаем
            const id = String(itemId._id);
            if (seen.has(id)) return;
            seen.add(id);

            const isSelected = _draft[slot] === id;
            const typeLabel  = cosmeticLabels[itemId.cosmeticType] || "Предмет";
            const icon       = itemId.icon || (itemId.cosmeticType === "avatar_frame" ? iconSvg("image") : iconSvg("palette"));

            const card = document.createElement("div");
            card.className = "cosmetic-inv-card" + (isSelected ? " is-equipped" : "");
            card.innerHTML = `
                <div class="cic-icon">${icon}</div>
                <div class="cic-meta">
                    <div class="cic-name">${esc(itemId.name)}</div>
                    <div class="cic-type">${typeLabel}</div>
                </div>
                <button type="button" class="cic-btn ${isSelected ? "cic-btn-off" : "cic-btn-on"}"
                    data-act="${isSelected ? "unequip" : "equip"}" data-slot="${slot}" data-id="${esc(id)}">
                    ${isSelected ? "Снять" : "Надеть"}
                </button>
            `;
            grid.appendChild(card);
        });
    }

    // Выбор/снятие косметики меняют только черновик; на сервер уходит по «Сохранить».
    window.equipCosmetic = function(itemId, slot) {
        if (!_draft || !SLOT_TYPE[slot]) return;
        const entry = _inv.find(e => e.itemId && String(e.itemId._id) === String(itemId));
        // Только предмет из реального инвентаря и только подходящего типа для слота
        if (!entry || entry.itemId.cosmeticType !== SLOT_TYPE[slot]) return;
        _draft[slot] = String(entry.itemId._id);
        renderCosmeticsSection();
        onDraftChanged();
    };

    window.unequipCosmetic = function(slot) {
        if (!_draft || !SLOT_TYPE[slot]) return;
        _draft[slot] = null;
        renderCosmeticsSection();
        onDraftChanged();
    };

    // ── Живой предпросмотр (тот же компонент, что и публичный профиль) ──────
    function buildPreviewData() {
        const d = _profileData || {};
        const h = _draft.hoursInCS2;
        return {
            steamId:          d.steamId,
            displayName:      d.displayName,
            avatar:           d.avatar,
            rank:             d.rank,
            rankColor:        d.rankColor,
            stats:            d.stats,
            seasonStats:      d.seasonStats,
            team:             d.team,
            faceitLevel:      _draft.faceitLevel,
            hoursInCS2:       (typeof h === "number" && isFinite(h) && h >= 0) ? h : null,
            bio:              _draft.bio,
            telegramUsername: normTg(_draft.telegram),
            discordUsername:  String(_draft.discord).trim(),
            isPrivate:        _draft.isPrivate,
            equippedCosmetics: {
                avatarFrame: resolveCosmetic("avatarFrame", _draft.avatarFrame),
                profileBg:   resolveCosmetic("profileBg",   _draft.profileBg),
            },
        };
    }

    function updatePreview() {
        const host = document.getElementById("editPreview");
        if (!host || !_draft || !_profileData) return;
        const root = ensureView(host);
        const vd   = buildPreviewData();
        renderView(root, vd, {});
        // У приватного профиля посетители не видят косметику — превью тоже
        applyPreviewCosmeticCSS(vd.isPrivate ? {} : vd.equippedCosmetics, root);
        if (_matchesCache && !root._m) { renderMatches(root, _matchesCache); root._m = true; }
    }

    // ── Сохранить / Отменить ───────────────────────────────────────────────
    window.saveProfileStats = async function() {
        if (_saving || !_draft || !isDirty()) return;

        const errEl     = document.getElementById("statsError");
        const successEl = document.getElementById("statsSuccess");
        const btn       = document.getElementById("statsSaveBtn");
        const fail = (msg) => { if (errEl) { errEl.textContent = msg; errEl.style.display = "block"; } };

        if (errEl)     errEl.style.display    = "none";
        if (successEl) successEl.style.display = "none";

        if (_draft.faceitLevel === null) return fail("Выберите FACEIT уровень (или «Нет» если нет аккаунта)");
        if (_draft.hoursInCS2  === null) return fail("Укажите количество часов в CS2");

        _saving = true;
        updateEditorState();
        if (btn) btn.textContent = "Сохранение...";

        try {
            // 1) Поля профиля
            const res = await fetch("/api/profile/stats", {
                method:  "PATCH",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                    faceitLevel:      _draft.faceitLevel,
                    hoursInCS2:       _draft.hoursInCS2,
                    bio:              _draft.bio,
                    isPrivate:        _draft.isPrivate,
                    telegramUsername: normTg(_draft.telegram),
                    discordUsername:  String(_draft.discord).trim(),
                })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { fail(data.error || "Ошибка сервера"); return; }

            // 2) Косметика: сервер сам проверяет, что предмет есть в инвентаре и подходит слоту
            const failed = [];
            const keep   = {};
            for (const slot of ["avatarFrame", "profileBg"]) {
                if (_draft[slot] === _saved[slot]) continue;
                const r = await fetch("/api/shop/equip/personal", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ itemId: _draft[slot], slot }),
                });
                if (!r.ok) {
                    const e = await r.json().catch(() => ({}));
                    failed.push(`${SLOT_LABEL[slot]}: ${e.error || "ошибка"}`);
                    keep[slot] = _draft[slot];
                }
            }

            // 3) Перечитываем сохранённое состояние с сервера
            const pr = await fetch("/api/profile");
            if (!pr.ok) { fail("Сохранено, но не удалось обновить страницу — перезагрузите её"); return; }
            _profileData = await pr.json();
            _saved = savedFromProfile(_profileData);
            _draft = Object.assign({}, _saved, keep);
            await renderProfile(_profileData);
            fillEditorForm();
            updatePreview();
            updateEditorState();

            if (failed.length) {
                fail("Часть изменений не сохранена. " + failed.join("; "));
                showToast("Часть изменений не сохранена", "err");
            } else {
                if (successEl) {
                    successEl.style.display = "block";
                    setTimeout(() => { successEl.style.display = "none"; }, 3000);
                }
                showToast("Профиль сохранён", "ok");
            }
        } catch {
            fail("Ошибка соединения");
        } finally {
            _saving = false;
            if (btn) btn.textContent = "Сохранить изменения";
            updateEditorState();
        }
    };

    window.cancelProfileEdit = function() {
        if (_saving || !_saved) return;
        _draft = Object.assign({}, _saved);
        fillEditorForm();
        renderCosmeticsSection();
        updatePreview();
        updateEditorState();
        const errEl = document.getElementById("statsError");
        if (errEl) errEl.style.display = "none";
        const okEl = document.getElementById("statsSuccess");
        if (okEl) okEl.style.display = "none";
    };

    // Часы из Steam сохраняются на сервере сразу (это отдельный запрос), поэтому
    // обновляем и черновик, и поле, чтобы они не считались «несохранёнными».
    window.syncSteamHours = async function() {
        const btn      = document.getElementById("syncSteamBtn");
        const statusEl = document.getElementById("syncSteamStatus");
        const hoursEl  = document.getElementById("statHours");
        if (btn) { btn.disabled = true; btn.innerHTML = iconSvg("clock") + " Загружаем..."; }
        if (statusEl) { statusEl.style.display = "none"; }
        try {
            const res  = await fetch("/api/profile/sync-steam-hours", { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                if (statusEl) {
                    statusEl.textContent   = data.error || "Ошибка";
                    statusEl.style.color   = "#e05c5c";
                    statusEl.style.display = "block";
                }
                // Сервер подтвердил закрытый Steam — показываем уведомление в кабинете
                if (data.code === "privacy") await refreshProfile();
            } else {
                if (hoursEl) hoursEl.value = data.hoursInCS2;
                if (_draft) _draft.hoursInCS2 = data.hoursInCS2;
                if (statusEl) {
                    statusEl.innerHTML     = iconSvg("check") + ` Получено ${esc(data.hoursInCS2)} ч. из Steam`;
                    statusEl.style.color   = "#4caf82";
                    statusEl.style.display = "block";
                }
                await refreshProfile();
            }
        } catch {
            if (statusEl) {
                statusEl.textContent   = "Ошибка соединения";
                statusEl.style.color   = "#e05c5c";
                statusEl.style.display = "block";
            }
        } finally {
            if (btn) { btn.disabled = false; btn.innerHTML = iconSvg("refresh") + " Синхронизировать со Steam"; }
        }
    };

    // Кнопка «Заполнить профиль» во вкладке «Команда» ведёт во вкладку редактирования
    window.switchToMyProfileTab = function() { activateTab("edit"); };

    //там команда

    function renderTeamTab(d) {
        const isIncomplete = (d.faceitLevel === null || d.faceitLevel === undefined) ||
                             (d.hoursInCS2  === null || d.hoursInCS2  === undefined);

        const blocker    = document.getElementById("teamTabBlocker");
        const tabContent = document.getElementById("teamTabContent");

        if (blocker && tabContent) {
            blocker.style.display    = isIncomplete ? "block" : "none";
            tabContent.style.display = isIncomplete ? "none"  : "block";
            if (isIncomplete) return;
        }

        const noTeam  = document.getElementById("noTeamState");
        const content = document.getElementById("teamContent");
        if (!d.team) {
            if (noTeam)  noTeam.style.display  = "block";
            if (content) content.style.display = "none";
            return;
        }
        if (noTeam)  noTeam.style.display  = "none";
        if (content) content.style.display = "block";

        const team    = d.team;
        const logoEl2 = document.getElementById("teamLogoEl");
        if (logoEl2) {
            if (team.logo) {
                logoEl2.innerHTML = `<img src="${esc(team.logo)}" alt="${esc(team.name)}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" onerror="this.style.display='none'">`;
            } else {
                logoEl2.textContent = team.tag || "?";
            }
        }

        const nameEl2 = document.getElementById("teamNameEl");
        const tagEl   = document.getElementById("teamTagEl");
        if (nameEl2) nameEl2.textContent = team.name;
        if (tagEl)   tagEl.textContent   = "[" + team.tag + "]";

        const mainList  = document.getElementById("mainRosterList");
        const subList   = document.getElementById("subRosterList");
        const mainCount = document.getElementById("mainCountLabel");
        const subCount  = document.getElementById("subCountLabel");
        const captainId = team.captainId?._id?.toString() || team.captainId?.toString();

        const members = team.members || [];
        const subs    = team.subs    || [];
        if (mainCount) mainCount.textContent = members.length + "/5";
        if (subCount)  subCount.textContent  = subs.length    + "/5";

        if (mainList) mainList.innerHTML = members.length === 0
            ? `<div class="roster-empty-hint">Состав пуст</div>`
            : members.map(m => renderMemberRow(m, captainId, d)).join("");

        if (subList) subList.innerHTML = subs.length === 0
            ? `<div class="roster-empty-hint">Нет замен</div>`
            : subs.map(m => renderMemberRow(m, captainId, d)).join("");

        const captainActionsEl = document.getElementById("captainActions");
        const memberActionsEl  = document.getElementById("memberActions");
        if (d.isCaptain) {
            if (captainActionsEl) captainActionsEl.style.display = "flex";
            if (memberActionsEl)  memberActionsEl.style.display  = "none";
        } else {
            if (captainActionsEl) captainActionsEl.style.display = "none";
            if (memberActionsEl)  memberActionsEl.style.display  = "flex";
        }
    }

    function renderMemberRow(m, captainId, d) {
        const isCap   = m._id?.toString() === captainId;
        const isMe    = m._id?.toString() === d._id?.toString();
        const myCap   = d.isCaptain;
        const mId     = m._id?.toString();
        const nameArg = esc(JSON.stringify(m.displayName || "Игрок"));
        const clickAttr = (myCap && !isMe)
            ? `onclick="openMemberModal('${mId}',${nameArg},${isCap})" style="cursor:pointer;" title="Управление игроком"`
            : "";
        return `<div class="member-row" ${clickAttr}>
            ${avatarEl(m.avatar, m.displayName, "member-avatar")}
            <span class="member-name">${esc(m.displayName || "Игрок")}${isCap ? `<span class="captain-crown" title="Капитан">${iconSvg("crown")}</span>` : ""}</span>
            ${(myCap && !isMe) ? '<span style="font-size:11px;color:var(--gray2);margin-left:auto;padding-right:4px;">⋯</span>' : ""}
        </div>`;
    }

    //таб др

    function renderNotifsTab(d) {
        const el       = document.getElementById("notifsList");
        if (!el) return;
        const requests = d.friendRequests || [];
        const invites  = d.teamInvites    || [];
        const apps     = d.applications   || [];
        const notices  = d.adminNotices   || [];
        let html = "";

        if (notices.length > 0) {
            html += `<div class="notif-block">
                <div class="notif-block-title">${iconSvg("megaphone")} Сообщения от администрации</div>
                ${notices.map((n, idx) => `<div class="friend-row">
                    <div style="font-size:24px;flex-shrink:0;">${iconSvg("megaphone")}</div>
                    <div class="friend-info">
                        <div class="friend-name">${n.message}</div>
                        <div class="friend-sub">${n.teamName ? "Команда: " + n.teamName : ""}</div>
                    </div>
                    <button class="btn-fr btn-fr-reject" onclick="dismissNotice(${idx})">${iconSvg("x")}</button>
                </div>`).join("")}
            </div>`;
        }

        if (apps.length > 0) {
            html += `<div class="notif-block">
                <div class="notif-block-title">${iconSvg("clipboard")} Статус заявки на участие</div>
                ${apps.map(a => `<div class="friend-row">
                    <div style="font-size:24px;flex-shrink:0;">${appStatusIcon(a.status)}</div>
                    <div class="friend-info">
                        <div class="friend-name" style="color:${appStatusColor(a.status)};">${appStatusLabel(a.status)}</div>
                        <div class="friend-sub">${a.faceitLevel ? `FACEIT: ${a.faceitLevel} · ` : ""}${new Date(a.createdAt).toLocaleDateString("ru-RU")}</div>
                    </div>
                </div>`).join("")}
            </div>`;
        }

        if (requests.length > 0) {
            html += `<div class="notif-block">
                <div class="notif-block-title">${iconSvg("mail")} Заявки в друзья</div>
                ${requests.map(r => renderFriendRequestRow(r)).join("")}
            </div>`;
        }

        if (invites.length > 0) {
            html += `<div class="notif-block">
                <div class="notif-block-title">${iconSvg("swords")} Приглашения в команду</div>
                ${invites.map(inv => renderTeamInviteRow(inv)).join("")}
            </div>`;
        }

        if (!html) html = `<div class="notif-empty">${iconSvg("bell")} Уведомлений нет</div>`;
        el.innerHTML = html;
    }

    function renderTeamInviteRow(inv) {
        const team = inv.teamId;
        const from = inv.from;
        const role = inv.role === "sub" ? "Замена" : "Основной состав";
        if (!team) return "";
        return `<div class="friend-row">
            <div class="friend-avatar-placeholder" style="border-radius:8px;background:var(--accent-dim);color:var(--accent);">${esc((team.tag || "?").slice(0, 2))}</div>
            <div class="friend-info">
                <div class="friend-name">[${esc(team.tag)}] ${esc(team.name)}</div>
                <div class="friend-sub">Роль: ${role} · от ${esc(from?.displayName || "?")}</div>
            </div>
            <div class="friend-actions">
                <button class="btn-fr btn-fr-accept" onclick="acceptTeamInvite('${team._id}')">${iconSvg("check")} Принять</button>
                <button class="btn-fr btn-fr-reject" onclick="rejectTeamInvite('${team._id}')">${iconSvg("x")} Отказ</button>
            </div>
        </div>`;
    }

    //значки

    function updateBadges(d) {
        const frCount  = (d.friendRequests || []).length;
        const tiCount  = (d.teamInvites    || []).length;
        const appCount = (d.applications   || []).filter(a => a.status !== "pending").length;
        const anCount  = (d.adminNotices   || []).length;
        const total    = frCount + tiCount + appCount + anCount;

        const frBadge = document.getElementById("friendReqBadge");
        if (frBadge) { frBadge.textContent = frCount; frBadge.style.display = frCount > 0 ? "inline-flex" : "none"; }

        const nBadge = document.getElementById("notifsBadge");
        if (nBadge)  { nBadge.textContent = total; nBadge.style.display = total > 0 ? "inline-flex" : "none"; }

        const isIncomplete = (d.faceitLevel === null || d.faceitLevel === undefined) ||
                             (d.hoursInCS2  === null || d.hoursInCS2  === undefined);
        const incompleteBadge = document.getElementById("profileIncompleteBadge");
        if (incompleteBadge) incompleteBadge.style.display = isIncomplete ? "inline-flex" : "none";

        const mascot = document.getElementById("profileMascot");
        if (mascot) mascot.src = total > 0 ? "assets/molotov.png" : "assets/molotov-sleep.png";
    }

    //поиск др

    window.searchFriendsHandler = async function() {
        const q = (document.getElementById("friendSearchInput")?.value || "").trim();
        if (q.length < 2) { showToast("Введите минимум 2 символа", "err"); return; }
        const box = document.getElementById("searchResultsBox");
        if (!box) return;
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
        if (u.isFriend)            btn = `<span class="btn-fr btn-fr-pending">${iconSvg("check")} Друг</span>`;
        else if (u.iRequestedThem) btn = `<span class="btn-fr btn-fr-pending">Отправлено</span>`;
        else if (u.requestedMe)    btn = `<button class="btn-fr btn-fr-accept" onclick="acceptFriend('${u._id}')">${iconSvg("check")} Принять</button>`;
        else                       btn = `<button class="btn-fr btn-fr-add" onclick="addFriend('${u._id}', this)">+ Добавить</button>`;

        return `<div class="friend-row">
            ${avatarEl(u.avatar, u.displayName, "friend-avatar")}
            <div class="friend-info">
                <div class="friend-name">${esc(u.displayName)}</div>
                <div class="friend-sub">Steam ID: ${u.steamId}</div>
            </div>
            <div class="friend-actions">
                <a href="/profile.html?id=${u.steamId}" class="btn-fr btn-fr-pending" style="text-decoration:none;" target="_blank">${iconSvg("user")} Профиль</a>
                ${btn}
            </div>
        </div>`;
    }

    //действия с др

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

    // ═══ Чёрный список ═══════════════════════════════════════════════════════
    let _blockedReq = 0; // защита от гонок: при быстрых повторных открытиях применяем только последний ответ

    async function loadBlockedList() {
        const box = document.getElementById("blockedList");
        const cnt = document.getElementById("blockedCount");
        if (!box) return;
        const myReq = ++_blockedReq;
        try {
            const res  = await fetch("/api/blocked");
            const data = await res.json().catch(() => ({}));
            if (myReq !== _blockedReq) return;
            if (!res.ok) { box.innerHTML = `<div class="notif-empty">${esc(data.error || "Не удалось загрузить список.")}</div>`; return; }
            const list = data.blocked || [];
            if (cnt) cnt.textContent = list.length ? `${list.length} / ${data.max || 100}` : "";
            if (!list.length) { box.innerHTML = `<div class="notif-empty">Вы никого не блокировали</div>`; return; }
            box.innerHTML = list.map(u => {
                const nameArg = esc(JSON.stringify(u.displayName || "Игрок"));
                return `<div class="friend-row">
                    ${avatarEl(u.avatar, u.displayName, "friend-avatar")}
                    <div class="friend-info">
                        <div class="friend-name"><a href="/profile.html?id=${encodeURIComponent(u.steamId || "")}" target="_blank" rel="noopener noreferrer" style="color:inherit;text-decoration:none;">${esc(u.displayName || "Игрок")}</a></div>
                    </div>
                    <div class="friend-actions">
                        <button class="btn-fr btn-fr-accept" onclick="unblockUser('${esc(u._id)}', ${nameArg})">Разблокировать</button>
                    </div>
                </div>`;
            }).join("");
        } catch {
            if (myReq === _blockedReq) box.innerHTML = `<div class="notif-empty">Ошибка соединения</div>`;
        }
    }

    window.unblockUser = async function(userId, name) {
        if (!confirm(`Разблокировать ${name}?`)) return;
        try {
            const res = await fetch(`/api/blocked/${encodeURIComponent(userId)}`, { method: "DELETE" });
            if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || "Ошибка", "err"); return; }
            showToast("Пользователь разблокирован", "ok");
            await loadBlockedList();
        } catch { showToast("Ошибка соединения", "err"); }
    };

    //уведы адм

    window.dismissNotice = async function(idx) {
        try {
            await fetch("/api/profile/dismiss-notice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idx })
            });
            await refreshProfile();
        } catch { showToast("Ошибка", "err"); }
    };

    //инвайт в тиму

    window.openInviteModal = function(userId, name) {
        _inviteTargetId = userId;
        const tNameEl = document.getElementById("inviteTargetName");
        if (tNameEl) tNameEl.textContent = name;
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

    //управление тимой

    let _memberModalId   = null;
    let _memberModalName = null;

    window.openMemberModal = function(userId, name, isCap) {
        _memberModalId   = userId;
        _memberModalName = name;
        const nameEl = document.getElementById("memberModalName");
        if (nameEl) nameEl.textContent = name;
        const capBtn = document.getElementById("memberModalCapBtn");
        if (capBtn) capBtn.style.display = isCap ? "none" : "flex";
        openModal("memberModal");
    };

    window.closeMemberModal = function() { closeModal("memberModal"); };

    window.memberModalKick    = function() { closeModal("memberModal"); if (_memberModalId) kickMember(_memberModalId, _memberModalName); };
    window.memberModalCaptain = function() { closeModal("memberModal"); if (_memberModalId) transferCaptain(_memberModalId, _memberModalName); };

    window.memberModalRole = async function() {
        closeModal("memberModal");
        if (!_memberModalId || !_profileData?.team) return;
        const team    = _profileData.team;
        const isSub   = (team.subs || []).some(s => s._id?.toString() === _memberModalId);
        const newRole = isSub ? "main" : "sub";
        const label   = isSub ? "основной состав" : "замену";
        if (!confirm(`Перевести ${_memberModalName} в ${label}?`)) return;
        try {
            const res = await fetch(`/api/team/member/${_memberModalId}/role`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRole })
            });
            const d = await res.json();
            if (!res.ok) { showToast(d.error || "Ошибка", "err"); return; }
            showToast("Роль изменена", "ok");
            await refreshProfile();
        } catch { showToast("Ошибка соединения", "err"); }
    };

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

    window.openTeamSettingsModal = function() {
        if (!_profileData || !_profileData.team) return;
        const tsName = document.getElementById("tsName");
        const tsTag  = document.getElementById("tsTag");
        const tsLogo = document.getElementById("tsLogo");
        const tsTg   = document.getElementById("tsTelegram");
        if (tsName) tsName.value = _profileData.team.name    || "";
        if (tsTag)  tsTag.value  = _profileData.team.tag     || "";
        if (tsLogo) tsLogo.value = _profileData.team.logo    || "";
        const _preview  = document.getElementById("tsLogoPreview");
        const _fileName = document.getElementById("tsLogoFileName");
        if (_preview) {
            const _existingLogo = _profileData.team.logo || "";
            if (_existingLogo) {
                _preview.innerHTML = `<img src="${_existingLogo}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML=iconSvg('shield')">`;
                if (_fileName) _fileName.textContent = "Текущий логотип загружен";
                if (document.getElementById("tsLogoDeleteBtn")) document.getElementById("tsLogoDeleteBtn").style.display = "";
            } else {
                _preview.innerHTML = iconSvg("shield");
                if (_fileName) _fileName.textContent = "Файл не выбран · до 2 МБ · JPG/PNG/GIF/WEBP";
            }
        }
        const _fi  = document.getElementById("tsLogoFile");
        const _err = document.getElementById("tsLogoUploadError");
        if (_fi) _fi.value = "";
        if (_err) _err.style.display = "none";
        if (tsTg) tsTg.value = _profileData.team.telegram || "";
        hideModalError("tsError");
        openModal("teamSettingsModal");
    };
    window.closeTeamSettingsModal = function() { closeModal("teamSettingsModal"); };

    //лого клаудинари

    let _cloudinaryConfig = null;
    async function getCloudinaryConfig() {
        if (_cloudinaryConfig) return _cloudinaryConfig;
        const r = await fetch("/api/config");
        _cloudinaryConfig = await r.json();
        return _cloudinaryConfig;
    }

    async function uploadLogoToCloudinary(file) {
        if (file.size > 2 * 1024 * 1024)   throw new Error("Файл не должен превышать 2 МБ");
        if (!file.type.startsWith("image/")) throw new Error("Допустимы только изображения");
        const cfg = await getCloudinaryConfig();
        if (!cfg.cloudinaryCloud || !cfg.cloudinaryPreset) throw new Error("Загрузка изображений не настроена");
        const fd = new FormData();
        fd.append("file", file);
        fd.append("upload_preset", cfg.cloudinaryPreset);
        fd.append("folder", "team-logos");
        const res = await fetch(`https://api.cloudinary.com/v1_1/${cfg.cloudinaryCloud}/image/upload`, { method: "POST", body: fd });
        if (!res.ok) throw new Error("Ошибка загрузки на Cloudinary");
        const data = await res.json();
        return data.secure_url;
    }

    (function initLogoUpload() {
        const fileInput  = document.getElementById("tsLogoFile");
        const preview    = document.getElementById("tsLogoPreview");
        const fileNameEl = document.getElementById("tsLogoFileName");
        const errorEl    = document.getElementById("tsLogoUploadError");
        if (!fileInput) return;

        fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            if (!file) return;
            errorEl.style.display = "none";
            if (file.size > 2 * 1024 * 1024) {
                errorEl.textContent = "Файл слишком большой (макс. 2 МБ)";
                errorEl.style.display = "block";
                fileInput.value = "";
                return;
            }
            if (!file.type.startsWith("image/")) {
                errorEl.textContent = "Допустимы только изображения";
                errorEl.style.display = "block";
                fileInput.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = e => { preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`; };
            reader.readAsDataURL(file);
            fileNameEl.textContent = file.name;
            const delBtn = document.getElementById("tsLogoDeleteBtn");
            if (delBtn) delBtn.style.display = "";
        });
    })();


    //клауд лого

    (function initCreateTeamLogoUpload() {
        const fileInput  = document.getElementById("ctLogoFile");
        const preview    = document.getElementById("ctLogoPreview");
        const fileNameEl = document.getElementById("ctLogoFileName");
        const errorEl    = document.getElementById("ctLogoUploadError");
        const delBtn     = document.getElementById("ctLogoDeleteBtn");
        if (!fileInput) return;

        fileInput.addEventListener("change", () => {
            const file = fileInput.files[0];
            if (!file) return;
            if (errorEl) errorEl.style.display = "none";
            if (file.size > 2 * 1024 * 1024) {
                if (errorEl) { errorEl.textContent = "Файл слишком большой (макс. 2 МБ)"; errorEl.style.display = "block"; }
                fileInput.value = "";
                return;
            }
            if (!file.type.startsWith("image/")) {
                if (errorEl) { errorEl.textContent = "Допустимы только изображения"; errorEl.style.display = "block"; }
                fileInput.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = e => {
                if (preview) preview.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
            };
            reader.readAsDataURL(file);
            if (fileNameEl) fileNameEl.textContent = file.name;
            if (delBtn) delBtn.style.display = "";
        });
    })();

    window.clearTeamLogo = function() {
        const hiddenUrl  = document.getElementById("tsLogo");
        const fileInput  = document.getElementById("tsLogoFile");
        const preview    = document.getElementById("tsLogoPreview");
        const fileNameEl = document.getElementById("tsLogoFileName");
        const errorEl    = document.getElementById("tsLogoUploadError");
        const delBtn     = document.getElementById("tsLogoDeleteBtn");
        if (hiddenUrl) hiddenUrl.value = "";
        if (fileInput) fileInput.value = "";
        if (preview) {
            const _tname = (window._profileData && window._profileData.team && window._profileData.team.name) || "";
            const _ini   = _tname.trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?";
            preview.innerHTML = `<span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:18px;color:#5c6b7f;">${_ini}</span>`;
        }
        if (fileNameEl) fileNameEl.textContent = "Файл не выбран · до 2 МБ · JPG/PNG/GIF/WEBP";
        if (errorEl)    errorEl.style.display = "none";
        if (delBtn)     delBtn.style.display = "none";
    };


    window.clearCreateTeamLogo = function() {
        const hiddenUrl  = document.getElementById("ctLogo");
        const fileInput  = document.getElementById("ctLogoFile");
        const preview    = document.getElementById("ctLogoPreview");
        const fileNameEl = document.getElementById("ctLogoFileName");
        const errorEl    = document.getElementById("ctLogoUploadError");
        const delBtn     = document.getElementById("ctLogoDeleteBtn");
        if (hiddenUrl) hiddenUrl.value  = "";
        if (fileInput) fileInput.value  = "";
        if (preview)   preview.innerHTML = iconSvg("shield");
        if (fileNameEl) fileNameEl.textContent = "Файл не выбран · до 2 МБ · JPG/PNG/GIF/WEBP";
        if (errorEl)   errorEl.style.display   = "none";
        if (delBtn)    delBtn.style.display     = "none";
    };

    window.saveTeamSettings = async function() {
        const name      = document.getElementById("tsName")?.value.trim();
        const tag       = document.getElementById("tsTag")?.value.trim();
        const telegram  = document.getElementById("tsTelegram")?.value.trim();
        const hiddenUrl = document.getElementById("tsLogo");
        const fileInput = document.getElementById("tsLogoFile");
        const errorEl   = document.getElementById("tsLogoUploadError");
        hideModalError("tsError");
        if (!name || !tag) { showModalError("tsError", "Название и тег обязательны"); return; }
        const btn = document.getElementById("tsSaveBtn");
        if (btn) { btn.disabled = true; btn.textContent = "Сохранение..."; }
        try {
            let logo = hiddenUrl?.value.trim() || "";
            if (fileInput?.files.length > 0) {
                if (errorEl) errorEl.style.display = "none";
                if (btn) btn.textContent = "Загружаем лого...";
                try {
                    logo = await uploadLogoToCloudinary(fileInput.files[0]);
                    if (hiddenUrl) hiddenUrl.value = logo;
                } catch (uploadErr) {
                    if (errorEl) { errorEl.textContent = uploadErr.message; errorEl.style.display = "block"; }
                    if (btn) { btn.disabled = false; btn.textContent = "Сохранить"; }
                    return;
                }
                if (btn) btn.textContent = "Сохранение...";
            }
            const res = await fetch("/api/team", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, tag, logo, telegram }) });
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
            if (!res.ok) { showToast(d.error || "Ошибка", "err"); if (btn) { btn.disabled = false; btn.innerHTML = iconSvg("skull") + " Распустить"; } return; }
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

    //рефреш

    async function refreshProfile() {
        try {
            const res = await fetch("/api/profile");
            if (!res.ok) return;
            _profileData = await res.json();
            await renderProfile(_profileData);
        } catch {}
    }

    //табы

    document.querySelectorAll(".profile-tab-btn").forEach(btn => {
        btn.addEventListener("click", function() { activateTab(this.dataset.tab); });
    });

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
    
}

//промокод
async function redeemPromoCode() {
    const input  = document.getElementById("promoCodeInput");
    const btn    = document.getElementById("promoRedeemBtn");
    const result = document.getElementById("promoRedeemResult");
    const code = (input.value || "").trim();
    if (!code) return;

    btn.disabled = true; btn.textContent = "Активация...";
    result.style.display = "none";
    try {
        const res = await fetch("/api/promo/redeem", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
        });
        const data = await res.json();
        result.style.display = "block";
        if (!res.ok) {
            result.style.color = "#e05c5c";
            result.textContent = data.error || "Не удалось активировать промокод";
        } else {
            result.style.color = "#4caf82";
            result.innerHTML = "✓ Промокод активирован!<br>" + (data.rewards || []).map(r => "• " + r).join("<br>");
            input.value = "";
        }
    } catch {
        result.style.display = "block";
        result.style.color = "#e05c5c";
        result.textContent = "Ошибка соединения";
    } finally {
        btn.disabled = false; btn.textContent = "Активировать";
    }
}