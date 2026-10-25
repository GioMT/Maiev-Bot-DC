/**
 * Maiev — Questlog Relay (Cloudflare Worker)
 *
 * NOT run by the bot. Paste this into a Cloudflare Worker (dash.cloudflare.com).
 *
 * Why: questlog.gg serves a Cloudflare JS challenge ("Just a moment...") to
 * datacenter IPs like bot-hosting.net. This Worker fetches the boss timers from
 * Cloudflare's own network and hands the JSON back to Maiev unchanged.
 *
 * Usage from Maiev (.env on bot-hosting.net):
 *   BOSS_TIMER_API_URL=https://<worker-name>.<subdomain>.workers.dev/?key=<RELAY_KEY>
 *
 * Optional secret (Worker > Settings > Variables and Secrets):
 *   RELAY_KEY  — if set, requests must include ?key=<RELAY_KEY>. Prevents
 *                strangers from using your Worker as a free proxy.
 *
 * Only the fieldBoss.timers endpoint can be fetched — this is not an open proxy.
 */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (env.RELAY_KEY && url.searchParams.get('key') !== env.RELAY_KEY) {
      return new Response('Unauthorized', { status: 401 });
    }

    const server = Number(url.searchParams.get('server') || 1507);
    if (!Number.isInteger(server) || server <= 0) {
      return new Response('Invalid server', { status: 400 });
    }

    const target =
      'https://questlog.gg/aion-2/api/trpc/fieldBoss.timers?input=' +
      encodeURIComponent(JSON.stringify({ server, language: 'en' }));

    let upstream;
    try {
      upstream = await fetch(target, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://questlog.gg/aion-2/'
        }
      });
    } catch (err) {
      return new Response(`Relay fetch failed: ${err.message}`, { status: 502 });
    }

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') || 'application/json',
        'Cache-Control': 'no-store',
        // Passed through so Maiev's error log shows if the Worker itself got challenged
        'cf-mitigated': upstream.headers.get('cf-mitigated') || 'none'
      }
    });
  }
};
