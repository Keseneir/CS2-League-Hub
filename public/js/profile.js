//профиль+команда
if (document.getElementById("ownProfileWrap") || document.getElementById("publicProfileWrap")) {

    let _profileData    = null;
    let _inviteTargetId = null;

    

    function avatarEl(src, name, cls) {
        if (src) return `<img src="${src}" alt="${name}" class="${cls}" onerror="this.style.display='none'">`;
        const initials = (name || "?").trim().split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
        const ph = cls.includes("member") ? "member-avatar-placeholder" : "friend-avatar-placeholder";
        return `<div class="${ph}">${initials}</div>`;
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
                const res = await fetch("/api/profile");
                if (!res.ok) return;
                const d = await res.json();

                const frCount  = (d.friendRequests || []).length;
                const tiCount  = (d.teamInvites    || []).length;
                const appCount = (d.applications   || []).filter(a => a.status !== "pending").length;
                const anCount  = (d.adminNotices   || []).length;
                const total    = frCount + tiCount + appCount + anCount;

                if (_prevNotifCount >= 0 && total > _prevNotifCount) {
                    await refreshProfile();
                }
                _prevNotifCount = total;
                updateBadges(d);
            } catch {}
        }

        setInterval(pollNotifications, 5000);
        setTimeout(pollNotifications, 5000);
    }

    async function loadPublicProfile(steamId) {
        try {
            const [pubRes, meRes] = await Promise.all([
                fetch(`/api/users/${steamId}/public`),
                fetch("/api/profile").catch(() => null)
            ]);

            const pubLoading = document.getElementById("publicLoading");
            if (pubLoading) pubLoading.style.display = "none";

            if (!pubRes.ok) {
                const pubHidden = document.getElementById("publicHidden");
                if (pubHidden) pubHidden.style.display = "block";
                return;
            }

            const data = await pubRes.json();

            if (data.isPrivate) {
                const pubHidden = document.getElementById("publicHidden");
                if (pubHidden) pubHidden.style.display = "block";
                return;
            }

            let meData = null;
            if (meRes && meRes.ok) {
                try { meData = await meRes.json(); } catch {}
            }

            renderPublicProfile(data, meData);
        } catch {
            const pubLoading = document.getElementById("publicLoading");
            if (pubLoading) pubLoading.innerHTML = '<p style="color:var(--text-gray);text-align:center;padding:40px;">Не удалось загрузить профиль.</p>';
        }
    }

    function renderPublicProfile(data, me) {
        const pubContent = document.getElementById("publicContent");
        if (pubContent) pubContent.style.display = "block";

        const avatar = document.getElementById("pubAvatar");
        if (avatar) {
            if (data.avatar) { avatar.src = data.avatar; avatar.style.display = ""; avatar.onerror = function() { this.style.display = "none"; }; }
            else { avatar.style.display = "none"; }
        }

        // Применяем косметику владельца публичного профиля
        if (data.equippedCosmetics && window._applyCosmeticCSS) {
            window._applyCosmeticCSS(data.equippedCosmetics);
        }

        const nameEl = document.getElementById("pubName");
        if (nameEl) nameEl.textContent = data.displayName || "—";

        const rankEl = document.getElementById("pubRank");
        if (rankEl) {
            rankEl.textContent = data.rank || "Unranked";
            if (data.rankColor) {
                rankEl.style.color       = data.rankColor;
                rankEl.style.borderColor = data.rankColor + "55";
                rankEl.style.background  = data.rankColor + "18";
            }
        }

        if (data.team) {
            const tag = document.getElementById("pubTeamTag");
            if (tag) { tag.textContent = `[${data.team.tag}] ${data.team.name}`; tag.style.display = "inline-flex"; }
        }

        const friendBtnWrap = document.getElementById("pubFriendBtnWrap");
        const friendBtn     = document.getElementById("pubFriendBtn");
        if (friendBtnWrap && me && me.steamId && me.steamId !== data.steamId) {
            friendBtnWrap.style.display = "block";
            const isFriend = (me.friends || []).some(f => f.steamId === data.steamId || f._id === data._id);
            if (isFriend) {
                friendBtn.textContent = "✓ Уже в друзьях";
                friendBtn.style.background  = "rgba(76,175,130,0.12)";
                friendBtn.style.borderColor = "rgba(76,175,130,0.35)";
                friendBtn.style.color       = "#4caf82";
                friendBtn.disabled = true;
            }
            friendBtn.dataset.steamId = data.steamId;
        }

        const faceitBadge = document.getElementById("pubFaceitBadge");
        if (faceitBadge && data.faceitLevel !== null && data.faceitLevel !== undefined) {
            const label = data.faceitLevel === 0 ? "FACEIT: нет аккаунта" : `FACEIT lv${data.faceitLevel}`;
            faceitBadge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,95,31,0.12);border:1px solid rgba(255,95,31,0.3);color:#ff5f1f;border-radius:6px;padding:5px 12px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;">${label}</span>`;
            faceitBadge.style.display = "block";
        }

        const hoursBadge = document.getElementById("pubHoursBadge");
        if (hoursBadge && data.hoursInCS2 !== null && data.hoursInCS2 !== undefined) {
            hoursBadge.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(91,141,232,0.12);border:1px solid rgba(91,141,232,0.3);color:#5b8de8;border-radius:6px;padding:5px 12px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;">⏱ ${data.hoursInCS2} ч. в CS2</span>`;
            hoursBadge.style.display = "block";
        }

        if (data.bio) {
            const bioBlock = document.getElementById("pubBioBlock");
            const bioText  = document.getElementById("pubBioText");
            if (bioBlock) bioBlock.style.display = "block";
            if (bioText)  bioText.textContent    = data.bio;
        }

        const socialsBlock = document.getElementById("pubSocialsBlock");
        const socialsRow   = document.getElementById("pubSocialsRow");
        if (socialsBlock && socialsRow) {
            const links = [];
            if (data.telegramUsername) {
                links.push(`<a href="https://t.me/${data.telegramUsername}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:rgba(91,141,232,0.10);border:1px solid rgba(91,141,232,0.25);color:#5b8de8;border-radius:6px;padding:6px 14px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;text-decoration:none;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.9 8.2-2 9.4c-.1.6-.5.8-.9.5l-2.6-1.9-1.2 1.2c-.1.1-.3.2-.6.2l.2-2.7 4.9-4.4c.2-.2 0-.3-.3-.1L6.6 15.4 4 14.6c-.6-.2-.6-.6.1-.8l10.9-4.2c.5-.2 1 .1.9.6z"/></svg>
                    @${data.telegramUsername}
                </a>`);
            }
            if (data.discordUsername) {
                links.push(`<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(114,137,218,0.10);border:1px solid rgba(114,137,218,0.25);color:#7289da;border-radius:6px;padding:6px 14px;font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3c-.2.4-.5.9-.7 1.3a18.3 18.3 0 0 0-5.5 0A13 13 0 0 0 8.6 3a19.7 19.7 0 0 0-4.9 1.4C.5 9 -.3 13.5.1 17.9a20 20 0 0 0 6 3c.5-.7.9-1.4 1.3-2.1a13 13 0 0 1-2-.9l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a13 13 0 0 1-2 1c.4.7.8 1.4 1.2 2a19.9 19.9 0 0 0 6.1-3c.5-5-1-9.4-3.6-13.5zM8 15.4c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4c1.2 0 2.2 1.1 2.2 2.4s-1 2.4-2.2 2.4zm8 0c-1.2 0-2.2-1.1-2.2-2.4s1-2.4 2.2-2.4c1.2 0 2.2 1.1 2.2 2.4s-1 2.4-2.2 2.4z"/></svg>
                    ${data.discordUsername}
                </span>`);
            }
            if (links.length) {
                socialsBlock.style.display = "block";
                socialsRow.innerHTML = links.join("");
            }
        }

        if (data.team) {
            const teamBlock = document.getElementById("pubTeamBlock");
            const teamCard  = document.getElementById("pubTeamCard");
            if (teamBlock) teamBlock.style.display = "block";
            if (teamCard) {
                const logoHtml = data.team.logo
                    ? `<img src="${data.team.logo}" style="width:44px;height:44px;border-radius:8px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">`
                    : `<div style="width:44px;height:44px;border-radius:8px;background:rgba(230,176,34,0.12);border:1px solid rgba(230,176,34,0.25);display:flex;align-items:center;justify-content:center;font-family:'Montserrat',sans-serif;font-weight:800;font-size:13px;color:var(--accent);flex-shrink:0;">${(data.team.tag || "?").slice(0, 2)}</div>`;
                teamCard.innerHTML = `${logoHtml}<div><div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:16px;color:white;">${data.team.name}</div><div style="font-size:12px;color:#5c6b7f;margin-top:3px;text-transform:uppercase;letter-spacing:1px;">[${data.team.tag}]</div></div>`;
            }
        }
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
                if (btn) { btn.textContent = "✓ Уже в друзьях"; btn.style.color = "#4caf82"; btn.style.borderColor = "rgba(76,175,130,0.35)"; }
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
            renderProfile(_profileData);
        } catch {
            const loading = document.getElementById("profileLoading");
            if (loading) loading.innerHTML = '<p style="color:var(--text-gray);text-align:center;padding:40px;">Не удалось загрузить профиль.</p>';
        }
    }

    function renderProfile(d) {
        const loading = document.getElementById("profileLoading");
        const content = document.getElementById("profileContent");
        if (loading) loading.style.display = "none";
        if (content) content.style.display = "block";

        const avatarEl2 = document.getElementById("profileAvatar");
        if (avatarEl2) avatarEl2.src = d.avatar || "";

        const nameEl = document.getElementById("profileDisplayName");
        if (nameEl) nameEl.textContent = d.displayName || "—";

        const rankEl = document.getElementById("profileRankBadge");
        if (rankEl) rankEl.textContent = d.rank || "Unranked";

        if (d.team) {
            const tag = document.getElementById("profileTeamTagBadge");
            if (tag) { tag.textContent = `[${d.team.tag}] ${d.team.name}`; tag.style.display = "inline-flex"; }
        }

        const helpBtn = document.getElementById("profileHelpBtn");
        if (helpBtn) helpBtn.style.display = "inline-flex";

        // ── Применяем косметику ──────────────────────────────────────────
        applyCosmeticCSS(d.equippedCosmetics || {});

        renderMyProfileTab(d);
        renderTeamTab(d);
        renderFriendsTab(d);
        renderNotifsTab(d);
        updateBadges(d);
    }

    // ── Инъекция CSS косметики ─────────────────────────────────────────────
    function addImportant(css) {
        // Добавляет !important к каждому свойству в CSS-строке
        return css.replace(/([^:{};]+:[^;{}]+)(;|(?=}))/g, function(m, prop, end) {
            if (prop.trim().endsWith("!important")) return m;
            return prop.trim() + " !important" + (end || "");
        });
    }

    function applyCosmeticCSS(cosmetics) {
        let styles = "";
 
        // ── Рамка аватарки ────────────────────────────────────────────────
        const frame = cosmetics.avatarFrame;
        if (frame?.css) {
            if (frame.keyframes) styles += frame.keyframes + "\n";
            const css = addImportant(frame.css);
            styles += `#profileAvatar { ${css} }\n`;
            styles += `#pubAvatar     { ${css} }\n`;
        }
 
        // ── Фон профиля ───────────────────────────────────────────────────
        const bg = cosmetics.profileBg;
        if (bg?.css) {
            if (bg.keyframes) styles += bg.keyframes + "\n";
            const css = addImportant(bg.css);
            // Применяем к обоим вариантам страницы: личный кабинет и публичный профиль
            styles += `#profileCoverArea { ${css} }\n`;
            styles += `#pubCoverArea     { ${css} }\n`;   // ← FIX: добавлена эта строка
        }
 
        let el = document.getElementById("_cosmetic_styles");
        if (!el) {
            el = document.createElement("style");
            el.id = "_cosmetic_styles";
            document.head.appendChild(el);
        }
        el.textContent = styles;
    }

    // Экспортируем для публичного профиля
    window._applyCosmeticCSS = applyCosmeticCSS;

    //таб мой профиль

    function renderMyProfileTab(d) {
        const faceit = d.faceitLevel ?? null;
        const hours  = d.hoursInCS2  ?? null;
        const bio    = d.bio         || "";
        const priv   = d.isPrivate   || false;

        const group = document.getElementById("faceitBtnGroup");
        if (group) {
            const levels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            group.innerHTML = levels.map(lv => {
                const label = lv === 0 ? "Нет" : `lv${lv}`;
                const sel   = faceit === lv;
                return `<button type="button"
                    data-level="${lv}"
                    onclick="selectFaceit(${lv})"
                    style="padding:7px 13px;border-radius:6px;cursor:pointer;transition:all 0.2s;
                           font-family:'Montserrat',sans-serif;font-weight:700;font-size:12px;
                           border:1px solid ${sel ? "var(--accent)" : "var(--border)"};
                           background:${sel ? "rgba(230,176,34,0.15)" : "#0e1318"};
                           color:${sel ? "var(--accent)" : "var(--text-gray)"};"
                >${label}</button>`;
            }).join("");
        }

        const faceitInput = document.getElementById("statFaceit");
        if (faceitInput) faceitInput.value = faceit !== null ? String(faceit) : "";

        const hoursInput = document.getElementById("statHours");
        if (hoursInput && hours !== null) hoursInput.value = hours;

        const bioInput = document.getElementById("statBio");
        if (bioInput) {
            bioInput.value = bio;
            const counter = document.getElementById("bioCharCount");
            if (counter) counter.textContent = bio.length;
            bioInput.addEventListener("input", function() {
                const c = document.getElementById("bioCharCount");
                if (c) c.textContent = this.value.length;
            });
        }

        const privToggle = document.getElementById("statPrivate");
        if (privToggle) privToggle.checked = priv;

        const tgInput = document.getElementById("statTelegram");
        if (tgInput) tgInput.value = d.telegramUsername || "";
        const dcInput = document.getElementById("statDiscord");
        if (dcInput) dcInput.value = d.discordUsername  || "";

        const isIncomplete = (d.faceitLevel === null || d.faceitLevel === undefined) ||
                             (d.hoursInCS2  === null || d.hoursInCS2  === undefined);
        const warning = document.getElementById("profileIncompleteWarning");
        if (warning) warning.style.display = isIncomplete ? "block" : "none";

        const badge = document.getElementById("profileIncompleteBadge");
        if (badge) badge.style.display = isIncomplete ? "inline-flex" : "none";

        // ── Секция кастомизации ──────────────────────────────────────────
        renderCosmeticsSection(d);
    }

    function renderCosmeticsSection(d) {
        const section = document.getElementById("cosmeticsSection");
        const list    = document.getElementById("equippedCosmeticsList");
        if (!section || !list) return;
        section.style.display = "";

        const c = d.equippedCosmetics || {};
        const items = [];
        if (c.avatarFrame) items.push({ label: "Рамка аватарки", item: c.avatarFrame });
        if (c.profileBg)   items.push({ label: "Фон профиля",   item: c.profileBg  });

        if (!items.length) {
            list.innerHTML = `<span style="font-size:13px;color:var(--text-gray);">Ничего не надето — купите косметику в магазине</span>`;
            return;
        }
        list.innerHTML = items.map(({ label, item }) => `
            <div style="display:inline-flex;align-items:center;gap:8px;
                        padding:7px 14px;border-radius:8px;
                        background:rgba(230,176,34,0.08);border:1px solid rgba(230,176,34,0.25);">
                <span style="font-size:16px;">${item.icon || "🎨"}</span>
                <div>
                    <div style="font-size:12px;font-weight:700;color:#e6b022;">${item.name || label}</div>
                    <div style="font-size:11px;color:#5c6b7f;">${label}</div>
                </div>
            </div>
        `).join("");
    }   // ← конец renderCosmeticsSection

    window.selectFaceit = function(level) {
        const hiddenInput = document.getElementById("statFaceit");
        if (hiddenInput) hiddenInput.value = String(level);
        document.querySelectorAll("#faceitBtnGroup button").forEach(btn => {
            const lv  = parseInt(btn.dataset.level);
            const sel = lv === level;
            btn.style.border     = `1px solid ${sel ? "var(--accent)" : "var(--border)"}`;
            btn.style.background = sel ? "rgba(230,176,34,0.15)" : "#0e1318";
            btn.style.color      = sel ? "var(--accent)" : "var(--text-gray)";
        });
    };

    window.saveProfileStats = async function() {
        const faceitVal = document.getElementById("statFaceit")?.value;
        const hoursVal  = document.getElementById("statHours")?.value;
        const bioVal    = document.getElementById("statBio")?.value   || "";
        const privVal   = document.getElementById("statPrivate")?.checked || false;
        const tgVal     = (document.getElementById("statTelegram")?.value || "").trim().replace(/^@/, "");
        const dcVal     = (document.getElementById("statDiscord")?.value  || "").trim();

        const errEl     = document.getElementById("statsError");
        const successEl = document.getElementById("statsSuccess");
        const btn       = document.getElementById("statsSaveBtn");

        if (errEl)     errEl.style.display    = "none";
        if (successEl) successEl.style.display = "none";

        if (faceitVal === "" || faceitVal === undefined) {
            if (errEl) { errEl.textContent = "Выберите FACEIT уровень (или «Нет» если нет аккаунта)"; errEl.style.display = "block"; }
            return;
        }
        if (!hoursVal && hoursVal !== "0") {
            if (errEl) { errEl.textContent = "Укажите количество часов в CS2"; errEl.style.display = "block"; }
            return;
        }

        if (btn) { btn.disabled = true; btn.textContent = "Сохранение..."; }

        try {
            const res = await fetch("/api/profile/stats", {
                method:  "PATCH",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({
                    faceitLevel:      Number(faceitVal),
                    hoursInCS2:       Number(hoursVal),
                    bio:              bioVal,
                    isPrivate:        privVal,
                    telegramUsername: tgVal,
                    discordUsername:  dcVal,
                })
            });
            const data = await res.json();
            if (!res.ok) {
                if (errEl) { errEl.textContent = data.error || "Ошибка сервера"; errEl.style.display = "block"; }
            } else {
                if (successEl) {
                    successEl.style.display = "block";
                    setTimeout(() => { if (successEl) successEl.style.display = "none"; }, 3000);
                }
                await refreshProfile();
            }
        } catch {
            if (errEl) { errEl.textContent = "Ошибка соединения"; errEl.style.display = "block"; }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "Сохранить"; }
        }
    };


    window.syncSteamHours = async function() {
        const btn      = document.getElementById("syncSteamBtn");
        const statusEl = document.getElementById("syncSteamStatus");
        const hoursEl  = document.getElementById("statHours");
        if (btn) { btn.disabled = true; btn.textContent = "⏳ Загружаем..."; }
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
            } else {
                if (hoursEl) hoursEl.value = data.hoursInCS2;
                if (statusEl) {
                    statusEl.textContent   = `✓ Получено ${data.hoursInCS2} ч. из Steam`;
                    statusEl.style.color   = "#4caf82";
                    statusEl.style.display = "block";
                }
                // auto-update hidden faceit if already set, refresh badges
                await refreshProfile();
            }
        } catch {
            if (statusEl) {
                statusEl.textContent   = "Ошибка соединения";
                statusEl.style.color   = "#e05c5c";
                statusEl.style.display = "block";
            }
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = "🔄 Синхронизировать со Steam"; }
        }
    };

    window.switchToMyProfileTab = function() {
        document.querySelectorAll(".profile-tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".profile-tab-content").forEach(c => c.classList.remove("active"));
        const btn = document.querySelector('.profile-tab-btn[data-tab="myprofile"]');
        const tab = document.getElementById("tab-myprofile");
        if (btn) btn.classList.add("active");
        if (tab) tab.classList.add("active");
    };

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
                logoEl2.innerHTML = `<img src="${team.logo}" alt="${team.name}" style="width:100%;height:100%;object-fit:cover;border-radius:10px;" onerror="this.style.display='none'">`;
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
        const nameEsc = (m.displayName || "Игрок").replace(/'/g, "\\'");
        const clickAttr = (myCap && !isMe)
            ? `onclick="openMemberModal('${mId}','${nameEsc}',${isCap})" style="cursor:pointer;" title="Управление игроком"`
            : "";
        return `<div class="member-row" ${clickAttr}>
            ${avatarEl(m.avatar, m.displayName, "member-avatar")}
            <span class="member-name">${m.displayName || "Игрок"}${isCap ? '<span class="captain-crown" title="Капитан">👑</span>' : ""}</span>
            ${(myCap && !isMe) ? '<span style="font-size:11px;color:var(--gray2);margin-left:auto;padding-right:4px;">⋯</span>' : ""}
        </div>`;
    }

    //таб др

    function renderFriendsTab(d) {
        const friends  = d.friends        || [];
        const requests = d.friendRequests || [];
        const el       = document.getElementById("friendsList");
        if (!el) return;
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
        const fId      = f._id?.toString();
        const canInvite = d.isCaptain && !f.teamId;
        return `<div class="friend-row">
            ${avatarEl(f.avatar, f.displayName, "friend-avatar")}
            <div class="friend-info">
                <div class="friend-name">${f.displayName}</div>
                <div class="friend-sub">${f.teamId ? "Уже в команде" : "Свободен"}</div>
            </div>
            <div class="friend-actions">
                <a href="/profile.html?id=${f.steamId}" class="btn-fr btn-fr-pending" style="text-decoration:none;" target="_blank">👤</a>
                ${canInvite ? `<button class="btn-fr btn-fr-invite" onclick="openInviteModal('${fId}','${f.displayName.replace(/'/g,"\\'")}')">⚔️ Пригласить</button>` : ""}
                <button class="btn-fr btn-fr-remove" onclick="removeFriend('${fId}','${f.displayName.replace(/'/g,"\\'")}')">Удалить</button>
            </div>
        </div>`;
    }

    //таб уведы

    function appStatusIcon(status)  { return status === "accepted" ? "✅" : status === "rejected" ? "❌" : "⏳"; }
    function appStatusLabel(status) { return status === "accepted" ? "Принята" : status === "rejected" ? "Отклонена" : "На рассмотрении"; }
    function appStatusColor(status) { return status === "accepted" ? "#4caf82" : status === "rejected" ? "#e05c5c" : "#e6b022"; }

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
                <div class="notif-block-title">📢 Сообщения от администрации</div>
                ${notices.map((n, idx) => `<div class="friend-row">
                    <div style="font-size:24px;flex-shrink:0;">📣</div>
                    <div class="friend-info">
                        <div class="friend-name">${n.message}</div>
                        <div class="friend-sub">${n.teamName ? "Команда: " + n.teamName : ""}</div>
                    </div>
                    <button class="btn-fr btn-fr-reject" onclick="dismissNotice(${idx})">✕</button>
                </div>`).join("")}
            </div>`;
        }

        if (apps.length > 0) {
            html += `<div class="notif-block">
                <div class="notif-block-title">📋 Статус заявки на участие</div>
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

        if (!html) html = `<div class="notif-empty">🔔 Уведомлений нет</div>`;
        el.innerHTML = html;
    }

    function renderTeamInviteRow(inv) {
        const team = inv.teamId;
        const from = inv.from;
        const role = inv.role === "sub" ? "Замена" : "Основной состав";
        if (!team) return "";
        return `<div class="friend-row">
            <div class="friend-avatar-placeholder" style="border-radius:8px;background:var(--accent-dim);color:var(--accent);">${(team.tag || "?").slice(0, 2)}</div>
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
        if (u.isFriend)            btn = `<span class="btn-fr btn-fr-pending">✓ Друг</span>`;
        else if (u.iRequestedThem) btn = `<span class="btn-fr btn-fr-pending">Отправлено</span>`;
        else if (u.requestedMe)    btn = `<button class="btn-fr btn-fr-accept" onclick="acceptFriend('${u._id}')">✓ Принять</button>`;
        else                       btn = `<button class="btn-fr btn-fr-add" onclick="addFriend('${u._id}', this)">+ Добавить</button>`;

        return `<div class="friend-row">
            ${avatarEl(u.avatar, u.displayName, "friend-avatar")}
            <div class="friend-info">
                <div class="friend-name">${u.displayName}</div>
                <div class="friend-sub">Steam ID: ${u.steamId}</div>
            </div>
            <div class="friend-actions">
                <a href="/profile.html?id=${u.steamId}" class="btn-fr btn-fr-pending" style="text-decoration:none;" target="_blank">👤 Профиль</a>
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
                _preview.innerHTML = `<img src="${_existingLogo}" style="width:100%;height:100%;object-fit:cover;" onerror="this.parentElement.innerHTML='🛡️'">`;
                if (_fileName) _fileName.textContent = "Текущий логотип загружен";
                if (document.getElementById("tsLogoDeleteBtn")) document.getElementById("tsLogoDeleteBtn").style.display = "";
            } else {
                _preview.innerHTML = "🛡️";
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
        if (preview)   preview.innerHTML = "🛡️";
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

    //рефреш

    async function refreshProfile() {
        try {
            const res = await fetch("/api/profile");
            _profileData = await res.json();
            renderProfile(_profileData);
        } catch {}
    }

    //табы

    document.querySelectorAll(".profile-tab-btn").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".profile-tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".profile-tab-content").forEach(c => c.classList.remove("active"));
            this.classList.add("active");
            const tab = document.getElementById("tab-" + this.dataset.tab);
            if (tab) tab.classList.add("active");
        });
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