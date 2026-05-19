/* ================================================================
 * News article view — reads ?slug=... and fetches one row.
 * ================================================================ */
(function () {
  const root = document.getElementById('articleRoot');
  if (!root) return;
  const sb = window.fcgSupabase();

  const params = new URLSearchParams(location.search);
  const slug = params.get('slug');

  function lang() { return (window.fcgGetLang && window.fcgGetLang()) || 'jp'; }
  function pickT(row, key) {
    const l = lang();
    if (l === 'en') return row[key + '_en'] || row[key + '_jp'];
    if (l === 'cn') return row[key + '_cn'] || row[key + '_jp'];
    return row[key + '_jp'];
  }
  function fmtDate(d) { return (d || '').replace(/-/g, '.'); }

  function render404(msg) {
    root.innerHTML = `
      <section class="p-sub__hero">
        <div>
          <div class="p-sub__crumb">FCG / News</div>
          <h1 class="p-sub__h">404<span class="jp">記事が見つかりません</span></h1>
        </div>
      </section>
      <section class="p-sub__section">
        <p class="p-article__body">${msg || 'The article you requested could not be found.'}</p>
        <p style="margin-top:24px;"><a class="p-article__back" href="news.html">← Back to News</a></p>
      </section>
    `;
  }

  let currentRow = null;
  function render() {
    if (!currentRow) return;
    const title = pickT(currentRow, 'title');
    const body  = pickT(currentRow, 'body') || '';
    const cover = currentRow.cover_url;
    root.innerHTML = `
      <section class="p-sub__hero">
        <div>
          <div class="p-sub__crumb">FCG / News · ${currentRow.category.toUpperCase()}</div>
          <h1 class="p-sub__h p-article__title">${title}</h1>
        </div>
        <div class="p-sub__count"><b>${fmtDate(currentRow.published_at)}</b>${currentRow.category.toUpperCase()}</div>
      </section>
      ${cover ? `
      <section class="p-sub__section p-article__cover-wrap">
        <img class="p-article__cover" src="${cover}" alt="">
      </section>` : ''}
      <section class="p-sub__section">
        <div class="p-article__body">${body}</div>
        <p style="margin-top:48px;"><a class="p-article__back" href="news.html">← Back to News</a></p>
      </section>
    `;
  }

  async function load() {
    if (!slug) { render404('No article slug provided.'); return; }
    const { data, error } = await sb
      .from(window.FCG_SB.tableNews)
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .maybeSingle();
    if (error || !data) {
      render404(error ? error.message : 'Article not found.');
      return;
    }
    currentRow = data;
    document.title = (pickT(data, 'title') || 'News') + ' — FCG';
    render();
  }

  // Re-render on language change
  window.addEventListener('fcg:lang', () => { if (currentRow) render(); });

  load();
})();
