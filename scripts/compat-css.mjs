// Post-build: makes Tailwind v4 CSS work in old Android System WebView (Chrome < 111).
// - unwraps @layer blocks (WebView < 99 drops the whole block => page looks unstyled)
// - converts oklch() to rgb() (WebView < 111 doesn't know oklch)
// Zero dependencies. Usage: node scripts/compat-css.mjs [distDir]
import fs from 'node:fs';
import path from 'node:path';

const dist = process.argv[2] || 'dist';

function unwrapLayers(css) {
  // remove statement form: @layer a, b, c;
  css = css.replace(/@layer\s+[\w\s,.-]+;/g, '');
  // unwrap block form: @layer name { ... }
  let out = '';
  let i = 0;
  while (i < css.length) {
    const m = /@layer\s*[\w.-]*\s*\{/y;
    m.lastIndex = i;
    const hit = css[i] === '@' && m.exec(css);
    if (hit) {
      let depth = 1;
      let j = m.lastIndex;
      const start = j;
      while (j < css.length && depth > 0) {
        const ch = css[j++];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
      }
      out += unwrapLayers(css.slice(start, j - 1));
      i = j;
    } else {
      out += css[i++];
    }
  }
  return out;
}

function oklchToRgb(L, C, H, A) {
  const h = (H * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  let r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_;
  let g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_;
  let bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_;
  const enc = (v) => {
    v = Math.min(1, Math.max(0, v));
    v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    return Math.round(v * 255);
  };
  const rgb = [enc(r), enc(g), enc(bl)];
  return A < 1 ? `rgba(${rgb.join(',')},${+A.toFixed(3)})` : `rgb(${rgb.join(',')})`;
}

function convertOklch(css) {
  return css.replace(/oklch\(\s*([^)]+?)\s*\)/g, (full, inner) => {
    const [main, alpha] = inner.split('/').map((s) => s.trim());
    const p = main.split(/\s+/);
    if (p.length < 3 || /var\(|calc\(|from/.test(inner)) return full;
    let L = parseFloat(p[0]);
    if (p[0].endsWith('%')) L /= 100;
    const C = p[1] === "none" ? 0 : parseFloat(p[1]);
    const H = p[2] === "none" ? 0 : parseFloat(p[2]) || 0;
    let A = 1;
    if (alpha !== undefined) A = alpha.endsWith('%') ? parseFloat(alpha) / 100 : parseFloat(alpha);
    if ([L, C, H, A].some(Number.isNaN)) return full;
    return oklchToRgb(L, C, H, A);
  });
}

// Chrome < 104: no individual translate/scale/rotate properties -> use transform.
// Chrome < 111: no "in oklab" interpolation in gradients (whole gradient dropped).
// Chrome < 108: no dvh units.
function legacyFixes(css) {
  // scale percentages -> numbers (scale(1.05) works everywhere, scale(105%) does not)
  css = css.replace(/(--tw-scale-[xyz])\s*:\s*(-?[\d.]+)%/g, (_, n, v) => `${n}:${+(parseFloat(v) / 100).toFixed(4)}`);
  const T = 'transform:translate(var(--tw-translate-x,0),var(--tw-translate-y,0)) scale(var(--tw-scale-x,1),var(--tw-scale-y,1))';
  css = css.replace(/(?<![-\w])translate:\s*var\(--tw-translate-x\)\s+var\(--tw-translate-y\)/g, T);
  css = css.replace(/(?<![-\w])scale:\s*var\(--tw-scale-x\)\s+var\(--tw-scale-y\)/g, T);
  css = css.replace(/(--tw-gradient-position\s*:[^;}]*?)\s+in\s+[\w-]+(?:\s+(?:shorter|longer|increasing|decreasing)\s+hue)?/g, '$1');
  css = css.replace(/(height|min-height|max-height)\s*:\s*(100)dvh/g, '$1:$2vh');
  return css;
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]
  );
}

for (const f of walk(dist).filter((f) => f.endsWith('.css'))) {
  const before = fs.readFileSync(f, 'utf8');
  const after = legacyFixes(convertOklch(unwrapLayers(before)));
  fs.writeFileSync(f, after);
  console.log(`compat-css: ${f} ${before.length} -> ${after.length} bytes, @layer left: ${(after.match(/@layer/g) || []).length}, oklch left: ${(after.match(/oklch\(/g) || []).length}`);
}
