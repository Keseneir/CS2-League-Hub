// ── Библиотека иконок (замена эмодзи) ───────────────────────────────────
// Тонкие контурные SVG в стиле Feather/Lucide — рендерятся одинаково у всех,
// красятся через currentColor. Никаких внешних CDN — иконки встроены прямо тут.
//
// Использование в статичной HTML-разметке:
//   <i class="icon" data-icon="trophy" aria-hidden="true"></i>
//   ... и вызвать renderIcons() (делается автоматически на DOMContentLoaded)
//
// Использование внутри JS-шаблонов (динамический рендер карточек и т.п.):
//   `${iconSvg("trophy")} Приз`

const ICONS = {
  shield:        '<path d="M12 3l8 3v6c0 4.5-3 8-8 9-5-1-8-4.5-8-9V6l8-3Z"/>',
  swords:        '<path d="M6 19 19 6M15 3h6v6M6 19l-3 2 2-3M9 4 4 9l2 4 4 2 5-5M15 20l3 2-2-3M20 15l-5-5-4 2-2 4 5 5Z"/>',
  x:             '<path d="M18 6 6 18M6 6l12 12"/>',
  users:         '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  refresh:       '<path d="M21 12a9 9 0 0 1-15.5 6.36M3 12a9 9 0 0 1 15.5-6.36"/><path d="M21 3v6h-6M3 21v-6h6"/>',
  trophy:        '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4a2 2 0 0 0 0 4h1.5M17 5h3a2 2 0 0 1 0 4h-1.5"/>',
  lock:          '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  alert:         '<path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  gamepad:       '<rect x="2" y="8" width="20" height="10" rx="4"/><path d="M6 12h4M8 10v4M15 11h.01M18 13h.01"/>',
  check:         '<path d="M20 6 9 17l-5-5"/>',
  checkCircle:   '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  link:          '<path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 1 1 0 10h-2M8 12h8"/>',
  clipboard:     '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/>',
  crown:         '<path d="M3 18h18l-1.5-9-4.5 4-3-6-3 6-4.5-4L3 18Z"/><path d="M5 21h14"/>',
  calendar:      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  palette:       '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 21a9 9 0 1 1 0-18c4 0 7 2 7 5.5 0 2-1.5 3.5-3.5 3.5H14c-.8 0-1.5.7-1.3 1.5.2.9-.4 1.7-1.3 1.7H12a2 2 0 0 0-2 2c0 1.5 1 3.8 2 3.8Z"/>',
  clock:         '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  logout:        '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  scroll:        '<path d="M8 21h8a2 2 0 0 0 2-2V7l-5-5H8a2 2 0 0 0-2 2v10"/><path d="M14 2v5h5M9 13h6M9 17h4"/>',
  coins:         '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18M7 6h1v4M16.71 13.88l.7.71-.71.71"/>',
  folder:        '<path d="M4 19V6a2 2 0 0 1 2-2h4l2 3h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z"/>',
  trash:         '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6"/><path d="M10 11v6M14 11v6"/>',
  skull:         '<path d="M12 2a8 8 0 0 0-8 8c0 3 1.5 4.5 2 6h12c.5-1.5 2-3 2-6a8 8 0 0 0-8-8Z"/><circle cx="9" cy="10" r="1.5"/><circle cx="15" cy="10" r="1.5"/><path d="M9 20v-2h2v2m2-2v2h2v-2"/>',
  cart:          '<circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.5 3h2l2.7 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L22 7H6"/>',
  user:          '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  package:       '<path d="m21 8-9-5-9 5 9 5 9-5Z"/><path d="M3 8v8l9 5 9-5V8M12 13v8"/>',
  bell:          '<path d="M6 8a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  ban:           '<circle cx="12" cy="12" r="9"/><path d="m5.5 5.5 13 13"/>',
  wallet:        '<path d="M3 7a2 2 0 0 1 2-2h13a1 1 0 0 1 1 1v2M3 7v11a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-4a2 2 0 0 0 0 4h5"/>',
  chart:         '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-4"/>',
  edit:          '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  bulb:          '<path d="M9 18h6M10 22h4"/><path d="M12 2a6 6 0 0 0-4 10.5c.7.7 1 1.4 1 2.5h6c0-1.1.3-1.8 1-2.5A6 6 0 0 0 12 2Z"/>',
  banknote:      '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  store:         '<path d="M3 9 4 4h16l1 5M3 9v10a1 1 0 0 0 1 1h4V15h8v5h4a1 1 0 0 0 1-1V9M3 9h18"/>',
  gift:          '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-7"/><path d="M12 8c-1.5 0-3-1-3-2.5S10 3 12 4c2-1 3.5 0 3.5 1.5S13.5 8 12 8Z"/>',
  sparkles:      '<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="M5 18l.7 2 2 .7-2 .7L5 23l-.7-2-2-.7 2-.7L5 18ZM19 15l.6 1.7 1.7.6-1.7.6L19 19l-.6-1.7-1.7-.6 1.7-.6L19 15Z"/>',
  radio:         '<circle cx="12" cy="12" r="2"/><path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13"/>',
  image:         '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  target:        '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  book:          '<path d="M12 5a5 5 0 0 0-5-2H3v15h4a5 5 0 0 1 5 2 5 5 0 0 1 5-2h4V3h-4a5 5 0 0 0-5 2Z"/><path d="M12 5v15"/>',
  map:           '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z"/><path d="M9 4v14M15 6v14"/>',
  party:         '<path d="M3 21 7 10c3 0 6 1.5 8 3.5L3 21Z"/><circle cx="10" cy="8" r="1"/><circle cx="14" cy="5" r="1"/><path d="M16 3l1.3 1.3M19.5 5.5l1.3 1.3M18 9l1.3 1.3"/>',
  info:          '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  zap:           '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
  megaphone:     '<path d="M3 11v2a2 2 0 0 0 2 2h1l3 6 2-1-2.5-5H11l8 4V6l-8 4H5a2 2 0 0 0-2 2Z"/><path d="M18 8a4 4 0 0 1 0 8"/>',
  mail:          '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 7 10-7"/>',
  flame:         '<path d="M12 22c3.5 0 6-2.5 6-6 0-3-2-5-3-8-.5 2-2 3-3 3-1.5 0-2-2-1-5-3 1.5-5 5-5 8 0 4.5 2.5 8 6 8Z"/>',
  rocket:        '<path d="M12 2c3 1 6 4 6 9 0 3-1 5-2 6H8c-1-1-2-3-2-6 0-5 3-8 6-9Z"/><circle cx="12" cy="9" r="1.8"/><path d="M9 17l-2 4 3-1.5M15 17l2 4-3-1.5"/>',
  scale:         '<path d="M12 3v18M7 21h10M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0L5 7Z"/><path d="M19 7l-3 6a3 3 0 0 0 6 0l-3-6Z"/>',
  search:        '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>',
};

// Возвращает <svg> целиком с классом .icon — для использования в JS-шаблонах
function iconSvg(name, extraClass) {
  const inner = ICONS[name];
  if (!inner) return "";
  const cls = "icon" + (extraClass ? " " + extraClass : "");
  return `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// Заполняет содержимым все <... data-icon="name"> внутри root (по умолчанию всю страницу)
function renderIcons(root) {
  (root || document).querySelectorAll("[data-icon]").forEach(el => {
    const name = el.getAttribute("data-icon");
    const inner = ICONS[name];
    if (!inner) return;
    if (!el.classList.contains("icon")) el.classList.add("icon");
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  });
}

document.addEventListener("DOMContentLoaded", () => renderIcons());