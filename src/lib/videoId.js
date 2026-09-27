export function extractVideoId(input) {
  let url;
  try {
    url = new URL(input.startsWith('http') ? input : `https://${input}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^(www\.|m\.)/, '');
  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    return /^[\w-]{11}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com') {
    const v = url.searchParams.get('v');
    if (v && /^[\w-]{11}$/.test(v)) return v;
    const m = url.pathname.match(/^\/(shorts|embed|live)\/([\w-]{11})/);
    if (m) return m[2];
  }
  return null;
}
