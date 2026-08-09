//новости
if (document.getElementById("newsContainer")) {
    const DEMO_NEWS = [
        { _id: "demo", publishedAt: new Date().toISOString(), tag: "Результаты", title: "ВНИМАНИЕ", text: "ЭТО — ТЕСТОВОЕ СООБЩЕНИЕ. ЕСЛИ ВЫ ЕГО ВИДИТЕ, ОБНОВИТЕ СТРАНИЦУ!", img: "", link: "", featured: true },
    ];

    const REACTIONS = [
        { key: "flame",    icon: "flame",    label: "Огонь" },
        { key: "sad",      icon: "sad",      label: "Грустно" },
        { key: "angry",    icon: "angry",    label: "Злит" },
        { key: "thumbsUp", icon: "thumbsUp", label: "Нравится" },
    ];

    let ALL_NEWS     = [];
    let activeTag    = "all";
    let activeSort   = "new";
    let activeSearch = "";
    let _currentUser = null;
    let _modalNewsId = null;

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

    function formatCommentDate(iso) {
        const d = new Date(iso);
        if (isNaN(d.getTime())) return "";
        return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) + " в " +
               d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
    }

    // ── Список новостей ─────────────────────────────────────────────────
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
            html += `<div class="news-featured" onclick="openNewsModal('${featured._id}')">
                <div class="featured-img">${imgHtml(featured.img)}<div class="featured-badge">Главное</div></div>
                <div class="featured-content">
                    <div class="news-meta"><span class="news-tag">${escNews(featured.tag)}</span><span class="news-date">${formatNewsDate(featured.publishedAt)}</span></div>
                    <div class="featured-title">${escNews(featured.title)}</div>
                    <div class="featured-excerpt">${escNews(featured.text)}</div>
                    <div class="news-readmore">Читать далее</div>
                </div>
            </div>`;
        }
        if (rest.length > 0) {
            html += `<div class="news-section-title">Все новости</div><div class="news-grid">`;
            rest.forEach(n => {
                html += `<div class="news-card" onclick="openNewsModal('${n._id}')">
                    <div class="card-img">${imgHtml(n.img)}</div>
                    <div class="card-content">
                        <div class="news-meta"><span class="news-tag">${escNews(n.tag)}</span><span class="news-date">${formatNewsDate(n.publishedAt)}</span></div>
                        <div class="card-title">${escNews(n.title)}</div>
                        <div class="card-excerpt">${escNews(n.text)}</div>
                        <div class="card-readmore">Подробнее</div>
                    </div>
                </div>`;
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

    // ── Модалка чтения новости ──────────────────────────────────────────
    window.openNewsModal = async function(id) {
        if (id === "demo") return; // демо-заглушка при недоступном API — открывать нечего
        _modalNewsId = id;
        const modal = document.getElementById("newsModal");
        const body  = document.getElementById("newsModalBody");
        const imgWrap = document.getElementById("newsModalImgWrap");
        imgWrap.innerHTML = "";
        body.innerHTML = `<div class="state-box"><div class="spinner"></div></div>`;
        modal.classList.remove("p-modal-hidden");
        document.body.style.overflow = "hidden";

        try {
            const res = await fetch(`/api/news/${id}`);
            if (!res.ok) throw new Error();
            const news = await res.json();
            renderNewsModal(news);
        } catch {
            body.innerHTML = `<div class="empty-state"><p>Не удалось загрузить новость.</p></div>`;
        }
    };

    window.closeNewsModal = function() {
        document.getElementById("newsModal").classList.add("p-modal-hidden");
        document.body.style.overflow = "";
        _modalNewsId = null;
    };
    document.getElementById("newsModal").addEventListener("click", e => {
        if (e.target.id === "newsModal") closeNewsModal();
    });
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && _modalNewsId) closeNewsModal();
    });

    function renderNewsModal(news) {
        document.getElementById("newsModalImgWrap").innerHTML =
            news.img ? `<img src="${escNews(news.img)}" class="nm-img" onerror="this.style.display='none'">` : "";

        const reactionsHtml = REACTIONS.map(r => {
            const count  = (news.reactions && news.reactions[r.key]) || 0;
            const active = news.myReaction === r.key;
            return `<button class="nm-react-btn ${active ? "active" : ""}" ${_currentUser ? "" : "disabled"}
                        onclick="reactToNews('${news._id}','${r.key}')" title="${r.label}">
                        <i class="icon" data-icon="${r.icon}" aria-hidden="true"></i>
                        <span>${count}</span>
                    </button>`;
        }).join("");

        const commentsHtml = news.comments.length
            ? news.comments.map(c => `
                <div class="nm-comment">
                    ${c.author?.avatar ? `<img class="nm-comment-avatar" src="${escNews(c.author.avatar)}" onerror="this.style.display='none'">` : `<div class="nm-comment-avatar" style="background:#1a2128;"></div>`}
                    <div class="nm-comment-body">
                        <div class="nm-comment-head">
                            <span class="nm-comment-author">${escNews(c.author?.displayName || "Игрок")}</span>
                            <span class="nm-comment-date">${formatCommentDate(c.createdAt)}</span>
                        </div>
                        <div class="nm-comment-text">${escNews(c.text)}</div>
                    </div>
                    ${(c.isMine || (_currentUser && _currentUser.isAdmin)) ? `<button class="nm-comment-del" onclick="deleteNewsComment('${news._id}','${c._id}')" title="Удалить"><i class="icon" data-icon="trash" aria-hidden="true"></i></button>` : ""}
                </div>`).join("")
            : `<div class="nm-comments-empty">Пока никто не прокомментировал. Будь первым.</div>`;

        const commentFormHtml = _currentUser
            ? `<div class="nm-comment-form">
                   <textarea id="nmCommentInput" placeholder="Написать комментарий..." maxlength="1000"></textarea>
                   <button onclick="submitNewsComment('${news._id}')">Отправить</button>
               </div>`
            : `<div class="nm-login-hint">Чтобы оставить реакцию или комментарий, <a href="/auth/steam?redirect=/news.html">войди через Steam</a>.</div>`;

        document.getElementById("newsModalBody").innerHTML = `
            <div class="nm-meta">
                <span class="news-tag">${escNews(news.tag)}</span>
                <span class="news-date" style="color:#5c6b7f;">${formatNewsDate(news.publishedAt)}</span>
            </div>
            <div class="nm-title">${escNews(news.title)}</div>
            <div class="nm-text">${escNews(news.text)}</div>
            ${news.link ? `<a href="${escNews(news.link)}" target="_blank" class="nm-original-link">${iconSvg("link")} Оригинальный пост</a>` : ""}

            <div class="nm-reactions">${reactionsHtml}</div>

            <div class="nm-comments-title">Комментарии (${news.comments.length})</div>
            ${commentFormHtml}
            <div id="nmCommentsList">${commentsHtml}</div>
        `;
    }

    window.reactToNews = async function(id, emoji) {
        if (!_currentUser) return;
        try {
            const res = await fetch(`/api/news/${id}/react`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ emoji }),
            });
            if (!res.ok) return;
            // перезагружаем актуальное состояние новости (счётчики + моя реакция)
            const fresh = await fetch(`/api/news/${id}`);
            if (fresh.ok) renderNewsModal(await fresh.json());
        } catch {}
    };

    window.submitNewsComment = async function(id) {
        const input = document.getElementById("nmCommentInput");
        const text = (input?.value || "").trim();
        if (!text) return;
        try {
            const res = await fetch(`/api/news/${id}/comments`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text }),
            });
            const data = await res.json();
            if (!res.ok) { alert(data.error || "Не удалось отправить комментарий"); return; }
            const list = document.getElementById("nmCommentsList");
            const emptyNote = list.querySelector(".nm-comments-empty");
            if (emptyNote) emptyNote.remove();
            const div = document.createElement("div");
            div.className = "nm-comment";
            div.innerHTML = `
                ${data.author?.avatar ? `<img class="nm-comment-avatar" src="${escNews(data.author.avatar)}" onerror="this.style.display='none'">` : `<div class="nm-comment-avatar" style="background:#1a2128;"></div>`}
                <div class="nm-comment-body">
                    <div class="nm-comment-head">
                        <span class="nm-comment-author">${escNews(data.author?.displayName || "Игрок")}</span>
                        <span class="nm-comment-date">${formatCommentDate(data.createdAt)}</span>
                    </div>
                    <div class="nm-comment-text">${escNews(data.text)}</div>
                </div>
                <button class="nm-comment-del" onclick="deleteNewsComment('${id}','${data._id}')" title="Удалить"><i class="icon" data-icon="trash" aria-hidden="true"></i></button>
            `;
            list.appendChild(div);
            renderIcons(div);
            input.value = "";
            const titleEl = document.querySelector(".nm-comments-title");
            if (titleEl) titleEl.textContent = `Комментарии (${list.children.length})`;
        } catch { alert("Ошибка соединения"); }
    };

    window.deleteNewsComment = async function(newsId, commentId) {
        try {
            const res = await fetch(`/api/news/${newsId}/comments/${commentId}`, { method: "DELETE" });
            if (!res.ok) return;
            const fresh = await fetch(`/api/news/${newsId}`);
            if (fresh.ok) renderNewsModal(await fresh.json());
        } catch {}
    };

    (async function init() {
        _currentUser = await checkAuth().catch(() => null);
        loadNews();
    })();
}