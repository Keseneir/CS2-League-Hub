//вкладка акт турниров
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

        let prof = null;
        try {
            const profRes = await fetch("/api/profile");
            if (profRes.ok) prof = await profRes.json();
        } catch {}

        if (prof) {
            const hoursEl    = document.getElementById("hours");
            const faceitEl   = document.getElementById("faceit_level");
            const contactsEl = document.getElementById("contacts");
            if (hoursEl  && prof.hoursInCS2  !== null && prof.hoursInCS2  !== undefined) hoursEl.value  = prof.hoursInCS2;
            if (faceitEl && prof.faceitLevel !== null && prof.faceitLevel !== undefined) {
                faceitEl.value = prof.faceitLevel === 0 ? "no_account" : String(prof.faceitLevel);
            }
            if (contactsEl && !contactsEl.value && prof.telegramUsername) {
                contactsEl.value = "@" + prof.telegramUsername;
            }
        }

        if (!user.team) {
            const banner = document.getElementById("noTeamBanner");
            if (banner) banner.style.display = "block";
            return;
        }

        let roleLabel = "Основной состав";
        if (prof) {
            if (prof.isCaptain) {
                roleLabel = "Капитан";
            } else if (prof.team) {
                const myId   = prof._id?.toString();
                const inSubs = (prof.team.subs || []).some(s => (s._id || s)?.toString() === myId);
                roleLabel = inSubs ? "Замена" : "Основной состав";
            }
        }

        renderTeamInfoCard(user.team, roleLabel);
        const progress = document.getElementById("progressWrap");
        const form     = document.getElementById("joinForm");
        if (progress) progress.style.display = "flex";
        if (form)     form.style.display     = "block";
    }

    function renderTeamInfoCard(team, roleLabel) {
        const card = document.getElementById("teamInfoCard");
        if (!card) return;
        const role = roleLabel || "Основной состав";
        card.innerHTML = `
            <div class="team-card">
                ${team.logo
                    ? `<img src="${team.logo}" class="team-card-logo" alt="${team.name}" onerror="this.style.display='none'">`
                    : `<div class="team-card-logo-placeholder">[${team.tag}]</div>`}
                <div class="team-card-info">
                    <div class="team-card-name">[${team.tag}] ${team.name}</div>
                    <div class="team-card-sub">Ваша команда · ${role}</div>
                </div>
            </div>`;
    }

    function updateProgress() {
        [1,2,3,4].forEach(n => {
            const section  = document.querySelector(`.form-section[data-section="${n}"]`);
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
                const formPayload = {
                    nickname:     document.getElementById("nickname").value,
                    hours:        document.getElementById("hours").value,
                    faceit_level: document.getElementById("faceit_level").value,
                    experience:   document.getElementById("experience").value,
                    contacts:     document.getElementById("contacts").value,
                };

                try {
                    const faceitNum = formPayload.faceit_level === "no_account" ? 0 : Number(formPayload.faceit_level);
                    await fetch("/api/profile/stats", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ faceitLevel: faceitNum, hoursInCS2: Number(formPayload.hours) })
                    });
                } catch {}

                const res  = await fetch("/api/applications", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({
                        hoursInCS2:  formPayload.hours,
                        faceitLevel: formPayload.faceit_level,
                        experience:  formPayload.experience,
                        contacts:    formPayload.contacts,
                    }),
                });
                const data = await res.json();

                if (res.ok && data.ok) {
                    (function() {
                        const fd = new FormData();
                        Object.entries(formPayload).forEach(([k, v]) => fd.append(k, v));
                        fetch("https://formspree.io/f/xnjlqzbk", {
                            method: "POST",
                            headers: { "Accept": "application/json" },
                            body: fd,
                        }).catch(() => {});
                    })();

                    this.style.display = "none";
                    const pw = document.getElementById("progressWrap"); if (pw) pw.style.display = "none";
                    const sm = document.getElementById("successMsg");   if (sm) sm.style.display = "block";
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