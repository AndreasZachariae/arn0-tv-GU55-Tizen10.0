// Packages src/ into dist/arn0-launcher.wgt — a .wgt is just a ZIP.
//
// Cross-platform replacement for scripts/build.sh: it needs only Node (no `sh`, no `zip`),
// so the same `npm run build` works on Windows, Linux and macOS. The .wgt is unsigned;
// Apps2Samsung (or Tizen Studio) signs it on install.
import { readdir, readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { deflateRawSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const srcDir = resolve(root, 'src');
const outFile = resolve(root, 'dist', 'arn0-launcher.wgt');

// --- the same pre-steps build.sh runs -------------------------------------------------
// index.html always loads this; create an empty one so its absence isn't a console error.
const localConfig = join(srcDir, 'js', 'config.local.js');
if (!existsSync(localConfig)) {
    await writeFile(localConfig, '/* No local overrides. See config.local.example.js. */\n');
}
if (!existsSync(join(srcDir, 'icon.png'))) await import('./make-icon.mjs');
await import('./build-marks.mjs'); // regenerate src/img/tiles/*.svg from brands.js

// --- collect the files that go into the package ---------------------------------------
// Mirrors build.sh's exclusions: brand mark sources (only the recoloured tiles ship),
// the gitignored easter-egg assets, and any dotfile (.DS_Store, ._*, …).
const EXCLUDE_PREFIX = ['img/marks/', 'img/easter-egg/'];
async function walk(dir, prefix = '') {
    const out = [];
    for (const name of await readdir(dir)) {
        if (name.startsWith('.')) continue;
        const abs = join(dir, name);
        const rel = prefix ? prefix + '/' + name : name; // POSIX separators for ZIP entries
        if ((await stat(abs)).isDirectory()) out.push(...await walk(abs, rel));
        else if (!EXCLUDE_PREFIX.some((p) => rel.startsWith(p))) out.push({ abs, rel });
    }
    return out;
}
const files = (await walk(srcDir)).sort((a, b) => a.rel.localeCompare(b.rel));

// --- minimal ZIP writer (deflate), no dependencies ------------------------------------
const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
function crc32(buf) {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

const DOS_DATE = 0x0021; // 1980-01-01; .wgt timestamps are irrelevant
const locals = [];
const centrals = [];
let offset = 0;

for (const f of files) {
    const data = await readFile(f.abs);
    const name = Buffer.from(f.rel, 'utf8');
    const crc = crc32(data);
    const comp = deflateRawSync(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);            // version needed
    local.writeUInt16LE(0, 6);             // flags
    local.writeUInt16LE(8, 8);             // method: deflate
    local.writeUInt16LE(0, 10);            // mod time
    local.writeUInt16LE(DOS_DATE, 12);     // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(comp.length, 18);  // compressed size
    local.writeUInt32LE(data.length, 22);  // uncompressed size
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);            // extra len
    locals.push(local, name, comp);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);          // version made by
    central.writeUInt16LE(20, 6);          // version needed
    central.writeUInt16LE(0, 8);           // flags
    central.writeUInt16LE(8, 10);          // method
    central.writeUInt16LE(0, 12);          // mod time
    central.writeUInt16LE(DOS_DATE, 14);   // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(comp.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);          // extra len
    central.writeUInt16LE(0, 32);          // comment len
    central.writeUInt16LE(0, 34);          // disk start
    central.writeUInt16LE(0, 36);          // internal attrs
    central.writeUInt32LE(0, 38);          // external attrs
    central.writeUInt32LE(offset, 42);     // local header offset
    centrals.push(central, name);

    offset += local.length + name.length + comp.length;
}

const centralBuf = Buffer.concat(centrals);
const eocd = Buffer.alloc(22);
eocd.writeUInt32LE(0x06054b50, 0);
eocd.writeUInt16LE(0, 4);                  // this disk
eocd.writeUInt16LE(0, 6);                  // CD start disk
eocd.writeUInt16LE(files.length, 8);
eocd.writeUInt16LE(files.length, 10);
eocd.writeUInt32LE(centralBuf.length, 12);
eocd.writeUInt32LE(offset, 16);            // CD offset
eocd.writeUInt16LE(0, 20);                 // comment len

const zip = Buffer.concat([...locals, centralBuf, eocd]);
await mkdir(resolve(root, 'dist'), { recursive: true });
await writeFile(outFile, zip);

console.log(`Built ${outFile} (${files.length} files, ${(zip.length / 1024).toFixed(0)} KB)`);
for (const f of files) console.log('  ' + f.rel);
