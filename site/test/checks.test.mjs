import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { buildSite } from '../build.mjs';
import { checkSite } from '../lib/checks.mjs';

let dist;
before(async () => {
  dist = await mkdtemp(join(tmpdir(), 'lp-checks-'));
  await buildSite({ outDir: dist });
});
after(() => rm(dist, { recursive: true, force: true }));

async function withInjected(file, html, fn) {
  const copy = await mkdtemp(join(tmpdir(), 'lp-checks-copy-'));
  try {
    await cp(dist, copy, { recursive: true });
    const path = join(copy, file);
    const src = await readFile(path, 'utf8');
    await writeFile(path, src.replace('</body>', `${html}</body>`));
    return await fn(copy);
  } finally {
    await rm(copy, { recursive: true, force: true });
  }
}
const PAGE = 'docs/getting-started/index.html';
const HOME_SCRIPT = '<script src="assets/js/home.js" defer></script>';

async function withHomeScript(replacement, fn) {
  const copy = await mkdtemp(join(tmpdir(), 'lp-checks-home-'));
  try {
    await cp(dist, copy, { recursive: true });
    const path = join(copy, 'index.html');
    const src = await readFile(path, 'utf8');
    assert.ok(src.includes(HOME_SCRIPT), 'homepage script tag not found');
    await writeFile(path, src.replace(HOME_SCRIPT, replacement));
    return await fn(copy);
  } finally {
    await rm(copy, { recursive: true, force: true });
  }
}

test('clean build passes', async () => {
  assert.deepEqual(await checkSite(dist, { siteBase: '/linkprofile/' }), []);
});

test('broken relative link reported', () => withInjected(PAGE, '<a href="../nope/">x</a>', async (d) => {
  const p = await checkSite(d);
  assert.equal(p.length, 1);
  assert.equal(p[0].file, PAGE);
  assert.match(p[0].message, /\.\.\/nope\//);
}));

test('missing anchor reported', () => withInjected(PAGE, "<a href='../getting-started/#nope'>x</a>", async (d) => {
  const p = await checkSite(d);
  assert.equal(p.length, 1);
  assert.match(p[0].message, /missing anchor.*nope/);
}));

test('external stylesheet reported', () => withInjected(PAGE, '<link rel=stylesheet href="https://x.test/a.css">', async (d) => {
  const p = await checkSite(d);
  assert.ok(p.some((x) => /external resource/.test(x.message)));
}));

test('external CSS url() reported', () => withInjected(PAGE, '<style>a{background:url(https://x.test/a.png)}</style>', async (d) => {
  assert.ok((await checkSite(d)).some((x) => /external CSS/.test(x.message)));
}));

test('script tag reported', () => withInjected(PAGE, '<script>1</script>', async (d) => {
  assert.ok((await checkSite(d)).some((x) => /<script>/.test(x.message)));
}));

test('script with a src on a docs page reported', () => withInjected(PAGE, '<script src="../../assets/js/home.js"></script>', async (d) => {
  assert.ok((await checkSite(d)).some((x) => /<script>/.test(x.message)));
}));

test('the homepage may load its own bundled script, and only that', async () => {
  assert.deepEqual(await checkSite(dist), []);
  await withHomeScript('<script>alert(1)</script>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => x.file === 'index.html' && /inline <script>/.test(x.message)));
  });
  await withHomeScript(`${HOME_SCRIPT}<script src="assets/js/home.js"></script>`, async (d) => {
    assert.ok((await checkSite(d)).some((x) => x.file === 'index.html' && /more than one <script>/.test(x.message)));
  });
  await withHomeScript('<script src="https://cdn.x.test/gsap.js"></script>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /external resource <script/.test(x.message)));
  });
  await withHomeScript('<script src="assets/js/nope.js"></script>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /broken link "assets\/js\/nope\.js"/.test(x.message)));
  });
  await withHomeScript('<script src="data:text/javascript,alert(1)"></script>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /not a local file/.test(x.message)));
  });
  await withHomeScript('<script src="assets/js/home.js"> 1 </script>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /inline <script>/.test(x.message)));
  });
});

test('the homepage script is pinned to assets/js/home.js as a classic script', async () => {
  await withHomeScript('<script src="assets/site.css" defer></script>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /must be <script src="assets\/js\/home\.js">/.test(x.message)));
  });
  await withHomeScript('<script type="module" src="assets/js/home.js"></script>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /type="module"/.test(x.message)));
  });
  await withHomeScript('<script type="text/javascript" src="assets/js/home.js" defer></script>', async (d) => {
    assert.deepEqual(await checkSite(d), []);
  });
});

test('empty comments <!--> and <!---> do not hide what follows', async () => {
  for (const comment of ['<!-->', '<!--->']) {
    await withInjected(PAGE, `${comment}<script>alert(1)</script>-->`, async (d) => {
      assert.ok((await checkSite(d)).some((x) => x.file === PAGE && /<script>/.test(x.message)), comment);
    });
    await withHomeScript(`<script src="assets/js/home.js" defer></script>${comment}<script>alert(1)</script>-->`, async (d) => {
      assert.ok((await checkSite(d)).some((x) => x.file === 'index.html' && /more than one <script>/.test(x.message)), comment);
    });
  }
});

test('event handler attributes, javascript: URLs and srcdoc are reported on every page', async () => {
  for (const [file, inject] of [[PAGE, (h) => withInjected(PAGE, h, (d) => checkSite(d))],
    ['index.html', (h) => withInjected('index.html', h, (d) => checkSite(d))]]) {
    const has = async (html, re) => assert.ok((await inject(html)).some((x) => x.file === file && re.test(x.message)), `${file}: ${html}`);
    await has('<img src="../../assets/site.css" onerror="alert(1)">'.replace('../../', file === PAGE ? '../../' : ''), /event handler.*onerror/);
    await has('<div ONCLICK=x>a</div>', /event handler.*onclick/);
    await has('<a href="javascript:alert(1)">x</a>', /javascript: URL/);
    await has('<a href=" JaVa\tScRiPt:alert(1)">x</a>', /javascript: URL/);
    await has('<a href="&#106;avascript:alert(1)">x</a>', /javascript: URL/);
    await has('<form action="javascript:alert(1)"></form>', /javascript: URL/);
    await has('<iframe srcdoc="<p>x</p>"></iframe>', /srcdoc/);
  }
});

test('external links, mailto and tel are allowed', () => withInjected(PAGE,
  '<a href="https://example.com/">a</a><a href="mailto:a@b.c">b</a><a href="tel:+123">c</a>', async (d) => {
    assert.deepEqual(await checkSite(d), []);
  }));

test('unquoted attribute values are checked', async () => {
  await withInjected(PAGE, '<a href=../nope/>x</a>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /\.\.\/nope\//.test(x.message)));
  });
  await withInjected(PAGE, '<link rel=stylesheet href=https://x.test/a.css>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /external resource/.test(x.message)));
  });
});

test('poster, data and srcset are checked', async () => {
  await withInjected(PAGE, '<video poster="https://x.test/p.png"></video>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /poster/.test(x.message)));
  });
  await withInjected(PAGE, '<object data="../missing.swf"></object>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /missing\.swf/.test(x.message)));
  });
  await withInjected(PAGE, '<img srcset="../../assets/site.css 1x, https://x.test/b.png 2x">', async (d) => {
    const p = await checkSite(d);
    assert.equal(p.length, 1);
    assert.match(p[0].message, /srcset.*x\.test/);
  });
  await withInjected(PAGE, '<img srcset="../../nope.png 1x">', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /broken srcset/.test(x.message)));
  });
});

test('CSS @import to an external URL is reported', async () => {
  await withInjected(PAGE, '<style>@import "https://x.test/a.css";</style>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /@import/.test(x.message)));
  });
  await withInjected(PAGE, "<style>@import 'https://x.test/a.css';</style>", async (d) => {
    assert.ok((await checkSite(d)).some((x) => /@import/.test(x.message)));
  });
});

test('local CSS url() targets must exist', async () => {
  await withInjected(PAGE, '<style>a{background:url(../../assets/nope.png)}</style>', async (d) => {
    assert.ok((await checkSite(d)).some((x) => /broken CSS url/.test(x.message)));
  });
  const copy = await mkdtemp(join(tmpdir(), 'lp-css-'));
  try {
    await cp(dist, copy, { recursive: true });
    const css = join(copy, 'assets/site.css');
    await writeFile(css, (await readFile(css, 'utf8')) + '@font-face{src:url(fonts/gone.woff2)}');
    const p = await checkSite(copy);
    assert.equal(p.length, 1);
    assert.equal(p[0].file, 'assets/site.css');
  } finally {
    await rm(copy, { recursive: true, force: true });
  }
});

test('unquoted id and anchor resolve', () => withInjected(PAGE, '<h2 id=intro-x>t</h2><a href=#intro-x>x</a><a href=#nope-x>y</a>', async (d) => {
  const p = await checkSite(d);
  assert.equal(p.length, 1);
  assert.match(p[0].message, /nope-x/);
}));

test('quoted ">" in an attribute does not hide the tag', () => withInjected(PAGE, '<a title="p>q" href="../nope2/">x</a>', async (d) => {
  assert.ok((await checkSite(d)).some((x) => /nope2/.test(x.message)));
}));

test('attribute-like text inside a value is not a link', () => withInjected(PAGE, '<a title="see href=../nope3/" href="#">x</a><!-- <a href="../nope4/"> -->', async (d) => {
  assert.deepEqual(await checkSite(d), []);
}));

test('srcset keeps data: URIs with commas whole', () => withInjected(PAGE, '<img srcset="data:image/png;base64,AAA 1x, ../../assets/site.css 2x">', async (d) => {
  assert.deepEqual(await checkSite(d), []);
}));

test('relative URLs resolve under a sub-path', async () => {
  const walk = async (dir, base = '') => {
    const out = [];
    for (const e of await readdir(join(dist, dir), { withFileTypes: true })) {
      const rel = posix.join(dir, e.name);
      if (e.isDirectory()) { if (rel !== 'demos') out.push(...(await walk(rel))); }
      else if (e.name.endsWith('.html')) out.push(rel);
    }
    return out;
  };
  const pages = (await walk('.')).filter((f) => f !== '404.html');
  assert.ok(pages.length > 3);
  for (const page of pages) {
    const html = await readFile(join(dist, page), 'utf8');
    for (const m of html.matchAll(/\s(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const url = m[1] ?? m[2];
      if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) continue;
      assert.ok(!url.startsWith('/'), `${page}: ${url} is root-absolute`);
      const resolved = posix.normalize(posix.join(posix.dirname(page), url.split(/[?#]/)[0]));
      assert.ok(!resolved.startsWith('..'), `${page}: ${url} escapes dist`);
    }
  }
});

test('404 uses SITE_BASE', async () => {
  const out = await mkdtemp(join(tmpdir(), 'lp-404-'));
  try {
    await buildSite({ outDir: out, siteBase: '/x/' });
    const html = await readFile(join(out, '404.html'), 'utf8');
    assert.match(html, /href="\/x\/"/);
    assert.match(html, /href="\/x\/docs\/"/);
    assert.match(html, /\/x\/assets\/fonts\/space-grotesk/);
    assert.doesNotMatch(html, /\{\{|linkprofile\/assets/);
    assert.deepEqual(await checkSite(out, { siteBase: '/x/' }), []);
    assert.ok((await checkSite(out, { siteBase: '/y/' })).some((p) => p.file === '404.html'));
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});

test('rejects an invalid siteBase', async () => {
  const out = await mkdtemp(join(tmpdir(), 'lp-bad-'));
  try {
    await assert.rejects(buildSite({ outDir: out, siteBase: 'no-slash' }), /siteBase/);
  } finally {
    await rm(out, { recursive: true, force: true });
  }
});
