import assert from 'node:assert/strict';

const site = new URL(process.argv[2] || 'https://diamondliveapp.com/');
assert.equal(site.protocol, 'https:', 'Verify the public HTTPS site');

async function read(path, statuses = [200]) {
  const url = new URL(path, site);
  const response = await fetch(url, { signal: AbortSignal.timeout(20000), cache: 'no-store' });
  assert(statuses.includes(response.status), `${url.pathname}: unexpected HTTP ${response.status}`);
  return response;
}

async function verify() {
  const home = await (await read('./')).text();
  assert(home.includes('<div id="root"></div>'), 'Homepage must contain the React entry point');
  const script = home.match(/<script[^>]+src="([^"]+\.js)"/);
  assert(script, 'Homepage must reference the built application');
  const entryUrl = new URL(script[1], site);
  assert.equal(entryUrl.origin, site.origin, 'Application script must be served by this site');
  const entry = await (await read(entryUrl)).text();
  const prototype = entry.match(/(?:\.\/|\/assets\/)Prototype-[A-Za-z0-9_-]+\.js/);
  assert(prototype, 'Published application must include the clubhouse route');
  const prototypeUrl = new URL(prototype[0], entryUrl);
  const module = await (await read(prototypeUrl)).text();
  assert(module.includes('Consult the Rules'), 'Published clubhouse must include the umpire');
  assert(module.includes('Record assessment'), 'Published clubhouse must include player assessments');
  const authentication = entry.match(/(?:\.\/|\/assets\/)AuthPages-[A-Za-z0-9_-]+\.js/);
  assert(authentication, 'Published application must include the sign-in page');
  const authModule = await (await read(new URL(authentication[0], entryUrl))).text();
  assert(authModule.includes('Already have a Diamond Live account?'), 'Published sign-in must preserve existing account access');
  for (const route of ['prototype', 'prototype?capture=1', 'preview', 'sign-in', 'auth/connect', 'auth/callback']) {
    // GitHub Pages serves the SPA through 404.html on direct route entry.
    const html = await (await read(route, [200, 404])).text();
    assert(html.includes(script[1]), `${route}: SPA fallback must load the current application`);
    console.log(`Verified /${route}`);
  }
  for (const path of ['prototype/clubhouse.png', 'prototype/umpire.png']) {
    const response = await read(path);
    assert.match(response.headers.get('content-type') || '', /image\/png/);
    const data = new Uint8Array(await response.arrayBuffer());
    assert.deepEqual([...data.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    console.log(`Verified /${path} (${data.length} bytes)`);
  }
  console.log(`Public deployment verified: ${site.href}`);
}

// Allow the Pages CDN a short propagation window after deployment.
for (let attempt = 1; ; attempt++) {
  try { await verify(); break; }
  catch (error) {
    if (attempt === 6) throw error;
    console.log(`Attempt ${attempt}: ${error.message}. Retrying in 10 seconds.`);
    await new Promise((resolve) => setTimeout(resolve, 10000));
  }
}
