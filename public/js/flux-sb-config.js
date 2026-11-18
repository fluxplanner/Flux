/* One copy of the Supabase project details. Before this, the URL, the anon
   key, the session key and the owner's id were pasted into every file that
   needed them; a typo in the owner id is silent and total. Load this first:
   every page puts it right before flux-app-visibility.js, and the planner and
   Owner Controls bundles start with it. The anon key is public by design (row
   level security guards the data); this is about one source, not secrecy. */
window.FluxSB = {
  url: 'https://lfigdijuqmbensebnevo.supabase.co',
  anon: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaWdkaWp1cW1iZW5zZWJuZXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNjEzMDgsImV4cCI6MjA4ODkzNzMwOH0.qG1d9DLKrs0qqLgAp-6UGdaU7xWvlg2sWq-oD-y2kVo',
  sessionKey: 'sb-lfigdijuqmbensebnevo-auth-token',
  ownerUid: 'eabe2b1f-e428-4181-8530-8e5366eb3975'
};
