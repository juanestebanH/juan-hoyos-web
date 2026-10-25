// Genera src/assets/title-shapes.json a partir de la fuente Inter Black (.woff).
// Los contornos se exportan en unidades em, con el eje Y hacia arriba (como los usa Three.js).
// Ejecutar una vez con: node scripts/build-title-shapes.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import opentype from 'opentype.js';

const TEXT = process.argv[2] ?? 'Juan Hoyos';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fontPath = join(root, 'public', 'fonts', 'inter-900.woff');
const outPath = join(root, 'src', 'assets', 'title-shapes.json');

const buffer = readFileSync(fontPath);
const ab = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
const font = opentype.parse(ab);
const upem = font.unitsPerEm;

const round = (n) => Math.round(n * 1e5) / 1e5;

const glyphs = [];
for (const char of TEXT) {
  const glyph = font.charToGlyph(char);
  const advance = glyph.advanceWidth ? glyph.advanceWidth / upem : 0.26;

  const contours = [];
  let current = null;
  for (const cmd of glyph.path.commands) {
    if (cmd.type === 'M') {
      current = { curves: [{ t: 'M', x: round(cmd.x / upem), y: round(cmd.y / upem) }] };
      contours.push(current);
    } else if (cmd.type === 'L') {
      current.curves.push({ t: 'L', x: round(cmd.x / upem), y: round(cmd.y / upem) });
    } else if (cmd.type === 'Q') {
      current.curves.push({
        t: 'Q',
        x1: round(cmd.x1 / upem),
        y1: round(cmd.y1 / upem),
        x: round(cmd.x / upem),
        y: round(cmd.y / upem),
      });
    } else if (cmd.type === 'C') {
      current.curves.push({
        t: 'C',
        x1: round(cmd.x1 / upem),
        y1: round(cmd.y1 / upem),
        x2: round(cmd.x2 / upem),
        y2: round(cmd.y2 / upem),
        x: round(cmd.x / upem),
        y: round(cmd.y / upem),
      });
    } else if (cmd.type === 'Z' && current) {
      current.curves.push({ t: 'Z' });
    }
  }

  glyphs.push({ char, advance: round(advance), contours });
}

const data = { text: TEXT, unitsPerEm: upem, glyphs };
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(data));

const contourCount = glyphs.reduce((n, g) => n + g.contours.length, 0);
const points = glyphs.reduce(
  (n, g) => n + g.contours.reduce((m, c) => m + c.curves.length, 0),
  0,
);
console.log(
  `title-shapes.json → "${TEXT}" · ${glyphs.length} glifos · ${contourCount} contornos · ${points} curvas`,
);
