//главная и виджет
if (document.getElementById("widgetBody")) {
    const RANK_CLASS = ["r1", "r2", "r3"];

    function renderWidget(rows) {
        const top3 = rows.slice(0, 3);
        const html  = top3.map((r, i) => `
            <div class="widget-row">
                <div class="widget-rank ${RANK_CLASS[i]}">${i + 1}</div>
                ${r.logo ? `<img src="${r.logo}" alt="${r.team}" style="width:28px;height:28px;border-radius:6px;object-fit:cover;flex-shrink:0;" onerror="this.style.display='none'">` : ""}
                <div class="widget-team-name">${r.team}</div>
                <div class="widget-stats">
                    <div class="widget-pts">${r.pts} <span style="font-size:10px;font-weight:600;color:var(--text-gray)">ОЧК</span></div>
                    <div class="widget-wl"><span class="w">${r.wins}W</span> / <span class="l">${r.losses}L</span></div>
                </div>
            </div>
            ${i < 2 ? '<div class="widget-divider"></div>' : ""}
        `).join("");
        document.getElementById("widgetBody").innerHTML = html || '<div style="padding:20px;text-align:center;color:#5c6b7f;font-size:13px;">Сезон ещё не начат</div>';
    }

    async function loadWidget() {
        try {
            const res = await fetch("/api/leaderboard");
            if (!res.ok) throw new Error();
            const { rows } = await res.json();
            renderWidget(rows || []);
        } catch {
            document.getElementById("widgetBody").innerHTML = '<div style="padding:20px;text-align:center;color:#5c6b7f;font-size:13px;">Нет данных</div>';
        }
    }

    loadWidget();
}