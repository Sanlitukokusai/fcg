// Shared Supabase client configuration for the public site + admin panel.
// The anon key is intentionally public — RLS policies in fcg.news control
// what each role can actually read or write.
window.FCG_SB = {
  url:  'https://main-api.the-moon.biz',
  anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzg1OTIwNjg1LCJleHAiOjE5NDM2MDA2ODV9.pxzmJr7sBHK1pxOl3QJUguAQ_DWo_NsvaOsxzXF1AMY',
  // Public passthrough view that mirrors fcg.news (PostgREST only exposes `public`)
  tableNews: 'fcg_news',
  bucket: 'fcg-news'
};
window.fcgSupabase = function () {
  if (!window._fcgSb) {
    window._fcgSb = window.supabase.createClient(window.FCG_SB.url, window.FCG_SB.anon, {
      auth: { persistSession: true, storageKey: 'fcg-auth' }
    });
  }
  return window._fcgSb;
};
