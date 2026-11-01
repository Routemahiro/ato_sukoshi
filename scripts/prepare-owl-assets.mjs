#!/usr/bin/env node
/** One-off: convert owl PNG delivery into ato-sukoshi-assets/owl webp (640×640, ~existing theme size). */
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcRoot = process.env.OWL_SRC || '/tmp/owl-assets';
const upload = resolve(root, 'ato-sukoshi-assets/owl/upload');
const nextGen = resolve(root, 'ato-sukoshi-assets/owl/next-gen');
mkdirSync(upload, { recursive: true });
mkdirSync(nextGen, { recursive: true });

const map = [
  ['owl-ready.webp', '01_待機/01_森の子_栗_食前待機_手を上げる.png'],
  ['owl-chew-0.webp', '02_食事アニメーション/01_森の子_栗100pct_口とじ.png'],
  ['owl-chew-1.webp', '02_食事アニメーション/02_森の子_栗100pct_口ひらき.png'],
  ['owl-chew-2.webp', '02_食事アニメーション/03_森の子_栗75pct_口とじ.png'],
  ['owl-chew-3.webp', '02_食事アニメーション/04_森の子_栗75pct_口ひらき.png'],
  ['owl-chew-4.webp', '02_食事アニメーション/05_森の子_栗45pct_口とじ.png'],
  ['owl-chew-5.webp', '02_食事アニメーション/06_森の子_栗45pct_口ひらき.png'],
  ['owl-chew-6.webp', '02_食事アニメーション/07_森の子_栗15pct_口とじ.png'],
  ['owl-chew-7.webp', '02_食事アニメーション/08_森の子_栗15pct_口ひらき.png'],
  ['owl-chew-8.webp', '02_食事アニメーション/09_森の子_栗0pct_食べ終わり笑顔.png'],
  ['owl-next-tidy.webp', '03_生活イラスト/02_森の子_栗_おかたづけ.png'],
  ['owl-next-meal.webp', '03_生活イラスト/03_森の子_栗_ごはん.png'],
  ['owl-next-bath.webp', '03_生活イラスト/04_森の子_栗_おふろ.png'],
  ['owl-next-out.webp', '03_生活イラスト/05_森の子_栗_おでかけ.png'],
  ['owl-next-brush.webp', '03_生活イラスト/06_森の子_栗_はみがき.png'],
  ['owl-next-sleep.webp', '03_生活イラスト/07_森の子_栗_ねんね.png'],
];

function toWebp(pngRel, outPath) {
  const png = resolve(srcRoot, pngRel);
  if (!existsSync(png)) throw new Error(`Missing source PNG: ${png}`);
  execFileSync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', png,
    '-vf', 'scale=640:640',
    '-compression_level', '6',
    '-lossless', '0',
    '-q:v', '80',
    outPath,
  ], { stdio: 'inherit' });
}

for (const [name, pngRel] of map) {
  const dir = name.startsWith('owl-next-') ? nextGen : upload;
  toWebp(pngRel, resolve(dir, name));
  console.log(name);
}
console.log('Done. Add chestnut.svg to upload manually, then run import-theme-assets.mjs');
