/* ================================================
   NEWS PAGE
   ================================================ */
if (document.getElementById("newsContainer")) {
    const NEWS_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTbdqLzy4PvMyR_9Pndokh0E0zNYg13qHTJOwRtBJz1wlwyjrfz_2NsJaskSLLlfXHRMFIT4_CkR_6K/pub?gid=0&single=true&output=csv";

    const DEMO_NEWS = [
        { date:"01 апреля 2026", tag:"Результаты", title:"Итоги 3-го тура: BAREBUH удерживает лидерство", text:"По итогам третьего игрового тура команда BAREBUH сохраняет первое место.", img:"", link:"", featured:"да" },
        { date:"28 марта 2026",  tag:"Анонс",      title:"Расписание 4-го тура опубликовано",            text:"Матчи пройдут с 5 по 7 апреля.",                                         img:"", link:"", featured:"нет" },
        { date:"25 марта 2026",  tag:"Лига",        title:"Две новые команды вступили в лигу",            text:"Команды GHOST и PHANTOM прошли отбор.",                                 img:"", link:"", featured:"нет" },
        { date:"20 марта 2026",  tag:"Результаты", title:"Итоги 2-го тура",                              text:"Второй тур преподнёс сюрпризы.",                                        img:"", link:"", featured:"нет" },
    ];

    let ALL_NEWS     = [];
    let activeTag    = "all";
    let activeSort   = "new";
    let activeSearch = "";

    window._imgErr = function(el) {
        el.style.display = "none";
        const ph = document.createElement("div");
        ph.className = "img-placeholder";
        ph.innerHTML = '<svg width="64" height="64" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        el.parentNode.appendChild(ph);
    };

    function imgHtml(url) {
        const ph = '<div class="img-placeholder"><svg width="64" height="64" viewBox="0 0 24 24" fill="white"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg></div>';
        if (!url) return ph;
        return `<img src="${url}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;opacity:0.85;" onerror="_imgErr(this)">`;
    }

    function parseNewsCSV(text) {
        const lines   = text.trim().split("\n");
        const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
        return lines.slice(1).map(line => {
            const vals = [];
            let cur = "", inQ = false;
            for (const ch of line) {
                if (ch === '"') { inQ = !inQ; }
                else if (ch === "," && !inQ) { vals.push(cur.trim()); cur = ""; }
                else { cur += ch; }
            }
            vals.push(cur.trim());
            const obj = {};
            headers.forEach((h, i) => obj[h] = (vals[i] || "").replace(/^"|"$/g, ""));
            return {
                date:     obj["дата"]      || obj["date"]     || "",
                tag:      obj["тег"]       || obj["tag"]      || "Новость",
                title:    obj["заголовок"] || obj["title"]    || "",
                text:     obj["текст"]     || obj["text"]     || "",
                img:      obj["картинка"]  || obj["img"]      || "",
                link:     obj["ссылка"]    || obj["link"]     || "",
                featured: (obj["главная"]  || obj["featured"] || "").toLowerCase(),
            };
        }).filter(r => r.title);
    }

    function parseDate(str) {
        const months = {"января":0,"февраля":1,"марта":2,"апреля":3,"мая":4,"июня":5,"июля":6,"августа":7,"сентября":8,"октября":9,"ноября":10,"декабря":11};
        const parts = str.trim().split(/\s+/);
        if (parts.length === 3) {
            const d = parseInt(parts[0]), m = months[parts[1].toLowerCase()], y = parseInt(parts[2]);
            if (!isNaN(d) && m !== undefined && !isNaN(y)) return new Date(y, m, d);
        }
        return new Date(0);
    }

    function applyNewsFilters() {
        let data = [...ALL_NEWS];
        if (activeTag !== "all") data = data.filter(n => n.tag.toLowerCase().includes(activeTag.toLowerCase()));
        if (activeSearch.trim()) {
            const q = activeSearch.toLowerCase();
            data = data.filter(n => n.title.toLowerCase().includes(q) || n.text.toLowerCase().includes(q) || n.tag.toLowerCase().includes(q));
        }
        data.sort((a, b) => { const d = parseDate(b.date) - parseDate(a.date); return activeSort === "new" ? d : -d; });
        renderNews(data);
    }

    function renderNews(data) {
        const noFilter = activeTag === "all" && !activeSearch.trim();
        const featured = noFilter ? data.find(n => n.featured === "да" || n.featured === "yes") : null;
        const rest     = data.filter(n => n !== featured);
        let html = "";
        if (featured) {
            const href = featured.link ? `href="${featured.link}" target="_blank"` : 'href="#"';
            html += `<a ${href} class="news-featured" style="text-decoration:none;color:inherit;">
                <div class="featured-img">${imgHtml(featured.img)}<div class="featured-badge">Главное</div></div>
                <div class="featured-content">
                    <div class="news-meta"><span class="news-tag">${featured.tag}</span><span class="news-date">${featured.date}</span></div>
                    <div class="featured-title">${featured.title}</div>
                    <div class="featured-excerpt">${featured.text}</div>
                    <div class="news-readmore">Читать далее</div>
                </div>
            </a>`;
        }
        if (rest.length > 0) {
            html += `<div class="news-section-title">Все новости</div><div class="news-grid">`;
            rest.forEach(n => {
                const href = n.link ? `href="${n.link}" target="_blank"` : 'href="#"';
                html += `<a ${href} class="news-card" style="text-decoration:none;color:inherit;">
                    <div class="card-img">${imgHtml(n.img)}</div>
                    <div class="card-content">
                        <div class="news-meta"><span class="news-tag">${n.tag}</span><span class="news-date">${n.date}</span></div>
                        <div class="card-title">${n.title}</div>
                        <div class="card-excerpt">${n.text}</div>
                        <div class="card-readmore">Подробнее</div>
                    </div>
                </a>`;
            });
            html += "</div>";
        }
        if (!featured && rest.length === 0) {
            html = `<div class="empty-state"><div class="icon">🔍</div><p>Ничего не найдено. Попробуй другой запрос.</p></div>`;
        }
        document.getElementById("newsContainer").innerHTML = html;
    }

    async function loadNews() {
        try {
            const res = await fetch(NEWS_CSV_URL);
            if (!res.ok) throw new Error();
            const text = await res.text();
            const data = parseNewsCSV(text);
            if (!data.length) throw new Error();
            ALL_NEWS = data;
        } catch {
            ALL_NEWS = DEMO_NEWS;
        }
        applyNewsFilters();
    }

    const searchEl = document.getElementById("searchInput");
    const sortEl   = document.getElementById("sortSelect");
    if (searchEl) searchEl.addEventListener("input",  function() { activeSearch = this.value; applyNewsFilters(); });
    if (sortEl)   sortEl.addEventListener("change",   function() { activeSort   = this.value; applyNewsFilters(); });
    document.querySelectorAll(".filter-tag").forEach(btn => {
        btn.addEventListener("click", function() {
            document.querySelectorAll(".filter-tag").forEach(b => b.classList.remove("active"));
            this.classList.add("active");
            activeTag = this.dataset.tag;
            applyNewsFilters();
        });
    });

    loadNews();
}