//новости
if (document.getElementById("newsContainer")) {
    const DEMO_NEWS = [
        { publishedAt: new Date().toISOString(), tag: "Результаты", title: "ВНИМАНИЕ", text: "ЭТО — ТЕСТОВОЕ СООБЩЕНИЕ. ЕСЛИ ВЫ ЕГО ВИДИТЕ, ОБНОВИТЕ СТРАНИЦУ!", img: "", link: "", featured: true },
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

    function escNews(str) {
        return String(str || "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    function formatNewsDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
    }

    function applyNewsFilters() {
        let data = [...ALL_NEWS];
        if (activeTag !== "all") data = data.filter(n => (n.tag || "").toLowerCase().includes(activeTag.toLowerCase()));
        if (activeSearch.trim()) {
            const q = activeSearch.toLowerCase();
            data = data.filter(n =>
                (n.title || "").toLowerCase().includes(q) ||
                (n.text  || "").toLowerCase().includes(q) ||
                (n.tag   || "").toLowerCase().includes(q)
            );
        }
        data.sort((a, b) => {
            const d = new Date(b.publishedAt) - new Date(a.publishedAt);
            return activeSort === "new" ? d : -d;
        });
        renderNews(data);
    }

    function renderNews(data) {
        const noFilter = activeTag === "all" && !activeSearch.trim();
        const featured = noFilter ? data.find(n => n.featured === true) : null;
        const rest     = data.filter(n => n !== featured);
        let html = "";
        if (featured) {
            const href = featured.link ? `href="${escNews(featured.link)}" target="_blank"` : 'href="#"';
            html += `<a ${href} class="news-featured" style="text-decoration:none;color:inherit;">
                <div class="featured-img">${imgHtml(featured.img)}<div class="featured-badge">Главное</div></div>
                <div class="featured-content">
                    <div class="news-meta"><span class="news-tag">${escNews(featured.tag)}</span><span class="news-date">${formatNewsDate(featured.publishedAt)}</span></div>
                    <div class="featured-title">${escNews(featured.title)}</div>
                    <div class="featured-excerpt">${escNews(featured.text)}</div>
                    <div class="news-readmore">Читать далее</div>
                </div>
            </a>`;
        }
        if (rest.length > 0) {
            html += `<div class="news-section-title">Все новости</div><div class="news-grid">`;
            rest.forEach(n => {
                const href = n.link ? `href="${escNews(n.link)}" target="_blank"` : 'href="#"';
                html += `<a ${href} class="news-card" style="text-decoration:none;color:inherit;">
                    <div class="card-img">${imgHtml(n.img)}</div>
                    <div class="card-content">
                        <div class="news-meta"><span class="news-tag">${escNews(n.tag)}</span><span class="news-date">${formatNewsDate(n.publishedAt)}</span></div>
                        <div class="card-title">${escNews(n.title)}</div>
                        <div class="card-excerpt">${escNews(n.text)}</div>
                        <div class="card-readmore">Подробнее</div>
                    </div>
                </a>`;
            });
            html += "</div>";
        }
        if (!featured && rest.length === 0) {
            html = `<div class="empty-state"><div class="icon">${iconSvg("search")}</div><p>Ничего не найдено. Попробуй другой запрос.</p></div>`;
        }
        document.getElementById("newsContainer").innerHTML = html;
    }

    async function loadNews() {
        try {
            const res = await fetch("/api/news");
            if (!res.ok) throw new Error();
            const data = await res.json();
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