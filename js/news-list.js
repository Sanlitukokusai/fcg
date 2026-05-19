/* ================================================================
 * News listing — fetches from Supabase, supports lang switch + filter.
 * Each item links to news-detail.html?slug=...
 * ================================================================ */
(function () {
  const listEl = document.getElementById('newsList');
  const filterButtons = document.querySelectorAll('.p-news__filter button');
  if (!listEl) return;

  const sb = window.fcgSupabase();

  let allRows = [];
  let activeCat = 'all';

  function lang() { return (window.fcgGetLang && window.fcgGetLang()) || 'jp'; }
  function pickTitle(row) {
    const l = lang();
    if (l === 'en') return row.title_en || row.title_jp;
    if (l === 'cn') return row.title_cn || row.title_jp;
    return row.title_jp;
  }
  function formatDate(d) {
    if (!d) return '';
    return d.replace(/-/g, '.');
  }

  function render() {
    const visible = activeCat === 'all'
      ? allRows
      : allRows.filter(r => r.category === activeCat);
    if (visible.length === 0) {
      listEl.innerHTML = '<div class="p-news__empty">— no posts —</div>';
      return;
    }
    listEl.innerHTML = visible.map(row => `
      <a href="news-detail.html?slug=${encodeURIComponent(row.slug)}" class="p-news__item" data-cat="${row.category}">
        <span class="p-news__date">${formatDate(row.published_at)}</span>
        <span class="p-news__cat">${row.category.toUpperCase()}</span>
        <span class="p-news__title">${pickTitle(row)}</span>
        <span class="p-news__arrow">→</span>
      </a>
    `).join('');
  }

  async function load() {
    const { data, error } = await sb
      .from(window.FCG_SB.tableNews)
      .select('slug, category, published_at, title_jp, title_en, title_cn')
      .eq('is_published', true)
      .order('published_at', { ascending: false });
    if (error) {
      console.error('[fcg] news fetch failed:', error);
      listEl.innerHTML = '<div class="p-news__empty">Failed to load news. ' + error.message + '</div>';
      return;
    }
    allRows = data || [];
    render();
  }

  // Filter buttons
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      filterButtons.forEach(b => b.classList.remove('is-on'));
      btn.classList.add('is-on');
      activeCat = btn.dataset.cat;
      render();
    });
  });

  // Re-render when language changes
  window.addEventListener('fcg:lang', render);

  load();
})();
