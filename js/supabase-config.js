// Shared Supabase client configuration for the public site + admin panel.
// The anon key is intentionally public — RLS policies in fcg.news control
// what each role can actually read or write.
window.FCG_SB = {
  url:  'https://wfstwbeehomzdudvikbt.supabase.co',
  anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indmc3R3YmVlaG9temR1ZHZpa2J0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3MjE5MDAsImV4cCI6MjA4NTI5NzkwMH0.IZpw9YGjz09Yl-PDR8_SYRHBdTwqEDdQeJvQBVo7Xdw',
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
