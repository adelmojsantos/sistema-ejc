const fs = require('fs');
const dotenv = fs.readFileSync('.env', 'utf-8');
let supabaseUrl = '';
let supabaseKey = '';
dotenv.split('\n').forEach(line => {
  if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.replace('VITE_SUPABASE_URL=', '').trim();
  if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.replace('VITE_SUPABASE_ANON_KEY=', '').trim();
});
supabaseUrl = supabaseUrl.replace(/\"|'/g, '');
supabaseKey = supabaseKey.replace(/\"|'/g, '');

console.log('Using Key Format:', supabaseKey.substring(0, 10) + '...');

async function test() {
  const authRes = await fetch(supabaseUrl + '/auth/v1/token?grant_type=password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'apikey': supabaseKey },
    body: JSON.stringify({ email: 'adelmojsantos1985@gmail.com', password: 'J@yset1509' })
  });
  const authData = await authRes.json();
  if (!authData.access_token) return console.error('Auth failed', authData);
  const token = authData.access_token;
  
  const res = await fetch(supabaseUrl + '/rest/v1/grupos?select=id,nome', {
    headers: { apikey: supabaseKey, Authorization: 'Bearer ' + token }
  });
  console.log('Grupos status:', res.status);
  console.log('Grupos output:', await res.text());
  
  const pRes = await fetch(supabaseUrl + '/functions/v1/admin-users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ action: 'list' })
  });
  console.log('Edge Function Status:', pRes.status);
  console.log('Edge Function Output:', await pRes.text());
}
test();
