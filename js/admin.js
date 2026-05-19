/* ================================================================
 * FCG Admin — sign-in + News CRUD + cover-image upload to Storage.
 *
 * Auth: Supabase Auth user `admin@fcg.local` (created via migration).
 * The "username" field accepts either the raw username (admin) or the
 * full email — they map to the same Supabase user.
 * ================================================================ */
(function () {
  const sb = window.fcgSupabase();
  const TABLE  = window.FCG_SB.tableNews;   // 'fcg_news' (public passthrough view)
  const BUCKET = window.FCG_SB.bucket;      // 'fcg-news'

  const $ = (id) => document.getElementById(id);

  // Username "admin" → admin@fcg.local
  function resolveEmail(input) {
    if (!input) return '';
    return input.includes('@') ? input.trim() : input.trim() + '@fcg.local';
  }

  // ── view switching ────────────────────────────────────────────
  function showLogin()   { $('adminLogin').hidden = false; $('adminShell').hidden = true; }
  function showAdmin()   { $('adminLogin').hidden = true;  $('adminShell').hidden = false; }
  function showList()    { $('adminListPanel').hidden = false; $('adminEditPanel').hidden = true; renderList(); }
  function showEdit()    { $('adminListPanel').hidden = true;  $('adminEditPanel').hidden = false; }

  // ── state ─────────────────────────────────────────────────────
  let allPosts = [];
  let editing  = null;  // null = new post, otherwise the row object

  // ── login ─────────────────────────────────────────────────────
  $('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = resolveEmail($('adminUser').value);
    const password = $('adminPass').value;
    $('adminLoginErr').textContent = '';
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      $('adminLoginErr').textContent = error.message;
      return;
    }
    bootAuthed();
  });

  $('adminLogout').addEventListener('click', async () => {
    await sb.auth.signOut();
    showLogin();
  });

  async function bootAuthed() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { showLogin(); return; }
    $('adminBarUser').textContent = user.email || '';
    showAdmin();
    showList();
  }

  // ── list ──────────────────────────────────────────────────────
  async function fetchAll() {
    const { data, error } = await sb
      .from(TABLE)
      .select('id, slug, category, published_at, title_jp, is_published, cover_url')
      .order('published_at', { ascending: false });
    if (error) { console.error(error); allPosts = []; return; }
    allPosts = data || [];
  }
  async function renderList() {
    await fetchAll();
    const tbody = $('adminTable').querySelector('tbody');
    if (allPosts.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="admin-table__empty">暂无文章 — 点击「新建文章」开始。</td></tr>';
      return;
    }
    tbody.innerHTML = allPosts.map(p => `
      <tr data-id="${p.id}">
        <td class="admin-table__date">${(p.published_at || '').replace(/-/g, '.')}</td>
        <td><span class="admin-cat">${p.category.toUpperCase()}</span></td>
        <td>${escapeHtml(p.title_jp || '—')}</td>
        <td>${p.is_published ? '<span class="admin-pill is-on">已发布</span>' : '<span class="admin-pill">草稿</span>'}</td>
        <td><button type="button" class="admin-btn admin-btn--small" data-act="edit" data-id="${p.id}">编辑</button></td>
      </tr>
    `).join('');
    tbody.querySelectorAll('[data-act="edit"]').forEach(b => {
      b.addEventListener('click', () => loadForEdit(b.dataset.id));
    });
  }

  // ── new / load for edit ──────────────────────────────────────
  $('adminNew').addEventListener('click', () => {
    editing = null;
    $('adminEditTitle').textContent = '新建文章';
    $('fSlug').value = '';
    $('fCat').value  = 'info';
    $('fDate').value = new Date().toISOString().slice(0, 10);
    $('fPublished').checked = true;
    $('fTitleJp').value = '';
    $('fTitleEn').value = '';
    $('fTitleCn').value = '';
    $('fBodyJp').value  = '';
    $('fBodyEn').value  = '';
    $('fBodyCn').value  = '';
    $('fCoverUrl').value = '';
    setCoverPreview('');
    $('adminDelete').hidden = true;
    $('adminMsg').textContent = '';
    showEdit();
  });

  async function loadForEdit(id) {
    const { data, error } = await sb.from(TABLE).select('*').eq('id', id).single();
    if (error || !data) { alert('加载文章失败：' + (error?.message || '未找到')); return; }
    editing = data;
    $('adminEditTitle').textContent = '编辑文章';
    $('fSlug').value = data.slug;
    $('fCat').value  = data.category;
    $('fDate').value = data.published_at;
    $('fPublished').checked = !!data.is_published;
    $('fTitleJp').value = data.title_jp || '';
    $('fTitleEn').value = data.title_en || '';
    $('fTitleCn').value = data.title_cn || '';
    $('fBodyJp').value  = data.body_jp  || '';
    $('fBodyEn').value  = data.body_en  || '';
    $('fBodyCn').value  = data.body_cn  || '';
    $('fCoverUrl').value = data.cover_url || '';
    setCoverPreview(data.cover_url || '');
    $('adminDelete').hidden = false;
    $('adminMsg').textContent = '';
    showEdit();
  }

  $('adminBack').addEventListener('click', showList);

  // ── cover image upload ───────────────────────────────────────
  function setCoverPreview(url) {
    const box = $('fCoverPreview');
    if (url) {
      box.innerHTML = `<img src="${url}" alt="">`;
    } else {
      box.innerHTML = '<span>暂无图片</span>';
    }
  }
  $('fCoverUrl').addEventListener('input', (e) => setCoverPreview(e.target.value.trim()));
  $('fCoverClear').addEventListener('click', () => {
    $('fCoverUrl').value = '';
    $('fCoverFile').value = '';
    setCoverPreview('');
  });
  $('fCoverFile').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setCoverPreview('');
    $('adminMsg').textContent = '上传图片中…';
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = 'uploads/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + ext;
    const { error } = await sb.storage.from(BUCKET).upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type
    });
    if (error) { $('adminMsg').textContent = '上传失败：' + error.message; return; }
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    $('fCoverUrl').value = pub.publicUrl;
    setCoverPreview(pub.publicUrl);
    $('adminMsg').textContent = '图片上传成功 ✓';
  });

  // ── save (insert or update) ──────────────────────────────────
  $('adminEditForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('adminMsg').textContent = '保存中…';
    const row = {
      slug:         $('fSlug').value.trim(),
      category:     $('fCat').value,
      published_at: $('fDate').value,
      is_published: $('fPublished').checked,
      title_jp:     $('fTitleJp').value.trim(),
      title_en:     $('fTitleEn').value.trim() || null,
      title_cn:     $('fTitleCn').value.trim() || null,
      body_jp:      $('fBodyJp').value || null,
      body_en:      $('fBodyEn').value || null,
      body_cn:      $('fBodyCn').value || null,
      cover_url:    $('fCoverUrl').value.trim() || null
    };
    if (!row.slug || !row.title_jp || !row.category || !row.published_at) {
      $('adminMsg').textContent = 'SLUG、分类、发布日期 与日文标题为必填项。';
      return;
    }

    let q;
    if (editing) {
      q = sb.from(TABLE).update(row).eq('id', editing.id).select().single();
    } else {
      q = sb.from(TABLE).insert(row).select().single();
    }
    const { data, error } = await q;
    if (error) { $('adminMsg').textContent = '保存失败：' + error.message; return; }
    editing = data;
    $('adminMsg').textContent = '已保存 ✓';
    $('adminDelete').hidden = false;
  });

  // ── delete ───────────────────────────────────────────────────
  $('adminDelete').addEventListener('click', async () => {
    if (!editing) return;
    if (!confirm('确定删除这篇文章吗？此操作不可恢复。')) return;
    const { error } = await sb.from(TABLE).delete().eq('id', editing.id);
    if (error) { $('adminMsg').textContent = '删除失败：' + error.message; return; }
    editing = null;
    showList();
  });

  // ── boot ─────────────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  // If already signed in (from a previous session), skip the login screen
  sb.auth.getSession().then(({ data: { session } }) => {
    if (session) bootAuthed();
    else showLogin();
  });
})();
