#!/usr/bin/env python3
"""Import the approved v8 archive without changing its runtime or artwork.

Local use: python3 scripts/import-confirmed-v8.py --archive /path/to/v8.zip
SOURCE_URL may be used by the one-time import workflow. Both archive and HTML
are verified against fixed hashes before anything is written.
"""
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen
import argparse
import hashlib
import io
import json
import re
import subprocess
import textwrap
import zipfile

ARCHIVE_SHA = 'c7893ccb190d8a023d15a84f0a8b61a690dab26cee4e6df0b04aee8aea69c401'
HTML_SHA = 'e7fb6e864451254b065fd80d9885de97cd277628b98304233d15e53a67842403'
ROOT = Path(__file__).resolve().parents[1]


def write(name, content):
    path = ROOT / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content if isinstance(content, bytes) else content.encode('utf-8'))


def main():
    import os
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive')
    args = parser.parse_args()
    if args.archive:
        raw = Path(args.archive).read_bytes()
    else:
        url = os.environ['SOURCE_URL']
        parsed = urlparse(url)
        if parsed.scheme != 'https' or not (parsed.hostname or '').endswith('.oaiusercontent.com'):
            raise RuntimeError('The source must be a verified conversation file URL.')
        with urlopen(url, timeout=60) as response:
            raw = response.read(2_000_001)
    if len(raw) > 2_000_000 or hashlib.sha256(raw).hexdigest() != ARCHIVE_SHA:
        raise RuntimeError('Archive hash mismatch; no files imported.')
    allowed = {'index.html', 'README.md', 'validation/release.json',
               'validation/ui-test-results.json', 'validation/unchanged-components.json'}
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        if set(archive.namelist()) != allowed:
            raise RuntimeError('Unexpected archive entries; no files imported.')
        if sum(i.file_size for i in archive.infolist()) > 2_000_000:
            raise RuntimeError('Unexpected uncompressed archive size.')
        html_bytes = archive.read('index.html')
        if hashlib.sha256(html_bytes).hexdigest() != HTML_SHA:
            raise RuntimeError('HTML hash mismatch; no files imported.')
        if (ROOT / 'index.html').exists() and (ROOT / 'index.html').read_bytes() != html_bytes:
            raise RuntimeError('Existing index.html differs; refusing to overwrite it.')
        html = html_bytes.decode('utf-8')
        styles = re.findall(r'<style>([\s\S]*?)</style>', html)
        scripts = re.findall(r'<script>([\s\S]*?)</script>', html)
        if len(styles) != 1 or len(scripts) != 4:
            raise RuntimeError('Unexpected v8 document structure.')
        write('index.html', html_bytes)
        write('docs/V8_RELEASE_NOTES.md', archive.read('README.md'))
        for name in allowed:
            if name.startswith('validation/'):
                write('validation/original-v8/' + Path(name).name, archive.read(name))

    template = html.replace(styles[0], '__STYLES__', 1)
    write('src/styles.css', styles[0])
    for name, token, code in zip(
        ['timer-core.js', 'snack-core.js', 'assets.js', 'app.js'],
        ['__TIMER_CORE__', '__SNACK_CORE__', '__ASSETS__', '__APP__'], scripts
    ):
        write('src/' + name, code)
        template = template.replace(code, token, 1)
    write('src/index.template.html', template)
    write('scripts/build.mjs', textwrap.dedent('''\
        import { readFileSync, writeFileSync } from 'node:fs';
        import { fileURLToPath } from 'node:url';
        import { dirname, resolve } from 'node:path';
        import { createHash } from 'node:crypto';
        const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
        let html = readFileSync(resolve(root, 'src/index.template.html'), 'utf8');
        for (const [token, file] of Object.entries({
          '__STYLES__': 'styles.css', '__TIMER_CORE__': 'timer-core.js',
          '__SNACK_CORE__': 'snack-core.js', '__ASSETS__': 'assets.js', '__APP__': 'app.js'
        })) {
          if (html.split(token).length !== 2) throw new Error(`Expected exactly one ${token}`);
          html = html.replace(token, () => readFileSync(resolve(root, 'src', file), 'utf8'));
        }
        const output = Buffer.from(html, 'utf8');
        if (process.argv.includes('--check')) {
          if (!readFileSync(resolve(root, 'index.html')).equals(output)) {
            console.error('index.html is out of date. Run npm run build.'); process.exit(1);
          }
          console.log('PASS: distribution is byte-identical to editable sources.');
        } else {
          writeFileSync(resolve(root, 'index.html'), output);
          console.log(`Built index.html (${output.length} bytes).`);
        }
        console.log(`SHA-256: ${createHash('sha256').update(output).digest('hex')}`);
        '''))
    write('scripts/export-assets.mjs', textwrap.dedent('''\
        import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
        import { dirname, resolve, basename } from 'node:path';
        import { fileURLToPath } from 'node:url';
        import vm from 'node:vm';
        const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
        const sandbox = { window: {} };
        vm.runInNewContext(readFileSync(resolve(root, 'src/assets.js'), 'utf8'), sandbox, { timeout: 2000 });
        const directory = resolve(root, 'assets-export'); mkdirSync(directory, { recursive: true });
        for (const [name, uri] of Object.entries(sandbox.window.TimerAssets)) {
          if (basename(name) !== name) throw new Error('Unexpected asset name');
          const match = /^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(uri);
          if (!match) throw new Error(`Unexpected data URL: ${name}`);
          writeFileSync(resolve(directory, name), Buffer.from(match[2], 'base64'));
          console.log(name);
        }
        console.log('Export only: src/assets.js remains the authoritative asset source.');
        '''))
    write('package.json', json.dumps({
        'name': 'ato-sukoshi', 'version': '8.0.0', 'private': True,
        'description': '子どもの切り替えを助ける、りすとどんぐりのWebタイマー',
        'scripts': {'build': 'node scripts/build.mjs', 'check': 'node scripts/build.mjs --check',
                    'test': 'node --test tests/*.test.cjs',
                    'dev': 'python3 -m http.server 8080 --bind 127.0.0.1',
                    'export:assets': 'node scripts/export-assets.mjs'}
    }, ensure_ascii=False, indent=2) + '\n')
    write('.gitignore', 'node_modules/\n__pycache__/\n*.py[cod]\n.venv/\n.DS_Store\n.env\n.env.*\nartifacts/\nassets-export/\n')
    write('AGENTS.md', '''# 編集するエージェントへ

この会話で確定したv8が今回の初期版です。`docs/REQUIREMENTS.md` を先に確認してください。
`index.html` は配布版、`src/` が編集用です。編集後は `npm run build`、`npm test`、`npm run check` を実行します。

## 維持すること
- アニメーションはいったん確定済み。依頼なしに画像、コマ順、10秒周期、サイズ、音を変更しない。
- 「あと、どれくらい？」は数字と「分」のシンプルな時間ボタン。ここをチェックボックスに変えない。
- 表示候補は「音・表示」の中のチェックボックスで管理する。候補の変更だけで今回の時間を変えない。
- 「いま していること」の入力・表示を復活させない。内部のcurrentは旧セッションとの互換用。
- 計測中・一時停止中は長押しメニュー。終了後の2画面は再スタートと準備画面へ戻るボタンを直接表示。
- 準備画面へ戻る際に追加確認を入れない。終了音を切る設定を追加しない。
- バックエンド、アカウント、広告、外部解析、外部フォントを必要なく追加しない。
- 元画像を無圧縮で二重に埋め込む等、HTMLが巨大化する変更を避ける。
- 公開URLでの確認、実機確認、HTML直接読み込みの確認を区別して記録する。
- 公開先、課金、ドメイン、リポジトリ公開範囲は依頼なしに変更しない。
''')
    write('docs/REQUIREMENTS.md', '''# 確定仕様：あとすこし v8

## 目的
子どもが活動を切り上げる際、残り時間と次の行動を親子で共有するWebタイマー。

## 準備
「あと、どれくらい？」はシンプルな時間ボタン。初期表示は1・3・5・10分。
「音・表示」の候補チェックボックスで、1・3・5・10・15・20・30・45・60分を表示／非表示にする。
表示候補の変更と今回の時間選択は別操作であり、候補を隠しても今回の時間は勝手に変わらない。
「ほかの時間にする」で1秒〜60分を指定できる。
次の行動はおかたづけ、ごはん、おふろ、おでかけ、はみがき、ねんね。
「いま していること」の入力・表示は設けない。

## 計測とアニメーション
現行の画像・アニメーションは変更しない。10秒で取る2秒・食べる6秒・食後2秒。
最後の10秒未満の端数では終了時刻を延ばさない。食べたどんぐりは元の場所に戻さない。
10分を超える場合は60個ずつ表示し、続きの個数を示す。
計測中・一時停止中は大人用長押しメニューで操作する。

## 終了後
「つぎへ いこう」の時点から、次の行動のりすイラストを表示する。
押下後は「いっしょに、はじめよう。」を表示。
両方の画面で大人メニューを隠し、「タイマーを最初から」「準備画面に戻る」を直接表示する。
最初からは同じ時間・同じ次の行動。準備画面へは追加確認なし。設定は維持する。

## 制約
画像と内蔵音を含む自己完結HTML。設定はlocalStorage、セッションはsessionStorage。
差し替え音声はそのタブ内だけで利用し外部送信しない。2MB以下・0.05〜2秒。
咀嚼音の設定はあるが、終了音を切るUIは設けない。
画面を開いたまま利用する。ロック中・背景タブの音、端末時刻の変更等には制約が残る。
''')
    write('docs/DEPLOY.md', '''# 公開用メモ

今回の作業はGitHubへのコード保存までです。一般公開URL、ドメイン、ホスティング契約は設定していません。

`index.html` が自己完結した配布・公開用ファイルです。静的ホスティングの公開ディレクトリへ配置できます。
画像・音も同じHTMLに含まれます。ランタイムサーバーやデータベースは不要です。
編集後は `npm run build`、`npm test`、`npm run check` を実行します。

公開時には、実際のHTTPSのURLとiPhone/Android実機で画像、音、消灯、20秒おためし、長押し、終了後の直接操作、設定保存を確認してください。
このv8にService Workerは組み込まれていません。HTMLファイルの保存利用とPWAインストールは別です。
''')
    write('README.md', '''# あとすこし / ato_sukoshi

子どもの「あとすこし」を、りすとどんぐりで見える形にするWebタイマーです。
親子で終わりの時間と次の行動を共有するための小さな道具です。

**会話で確定したv8を収録しています。アニメーションや画面の動作は変更していません。**

## 使う

`index.html` を保存してブラウザで開くだけで動きます。画像と内蔵音声も同じファイルに含まれています。
ビルドやログインは不要です。「まずは20秒で おためし」で開始から終了まで試せます。

## 主な仕様

- 1秒〜60分のタイマー。10秒ごとにりすがどんぐりを1個ずつ食べます。
- 「あと、どれくらい？」はシンプルな時間ボタン。初期表示は1・3・5・10分です。
- 「音・表示」内のチェックボックスで1・3・5・10・15・20・30・45・60分の表示を切り替えます。
  表示候補の変更だけでは、今回の時間は変わりません。
- 次の行動は、おかたづけ・ごはん・おふろ・おでかけ・はみがき・ねんね。
- 計測中・一時停止中は長押しメニュー。終了後の2画面では再スタート・準備画面へ戻るボタンを直接表示します。
- かわいい合成咀嚼音と終了チャイム。咀嚼音の差し替えにも対応します。
- 「いま していること」の入力・表示はありません。

## 編集する

Node.jsを使用します。外部npmパッケージは使わないため、`npm install` は不要です。

```sh
npm run build   # src/ から配布用index.htmlを生成
npm test        # コード・素材・時間計算の検証
npm run check   # 配布版と編集用ソースが一致するか確認
npm run dev     # Python 3でローカルサーバーを起動
```

`npm run dev` のアクセス先は `http://127.0.0.1:8080` です。
通常は `src/index.template.html`、`src/styles.css`、`src/app.js` を編集します。
`src/assets.js` に画像・音、`src/snack-core.js` にアニメーションの時間制御を収録しています。
素材だけを取り出す場合は `npm run export:assets` を実行すると `assets-export/` に書き出せます。

## 構成

- `index.html`：そのまま開ける・配置できるv8
- `src/`：編集用HTML・CSS・JavaScript・内蔵素材
- `scripts/`：ビルドと素材書き出し、v8取り込み用スクリプト
- `tests/`：自動検証
- `docs/`：確定仕様、公開メモ、v8の変更履歴
- `validation/`：取り込み時の同一性と検証記録
- `AGENTS.md`：今後AIに編集を任せる際に維持する仕様

## 公開と注意

**GitHubへのソース保存とWebサイトの公開は別です。一般公開URLやドメインは設定していません。**
公開用ファイルは `index.html` です。詳しくは `docs/DEPLOY.md` を参照してください。

画面を開いたまま使います。画面ロック中や別アプリ使用中に必ず鳴るアラームではありません。
音量・自動再生・自動消灯防止は端末やブラウザの条件に影響されます。

移行前v8の検証記録は `validation/original-v8/`、今回のコード検証は `validation/import-checks.json` を参照してください。
公開URLやiPhone/Android実機での検証まで完了したという意味ではありません。
''')
    write('tests/import.test.cjs', r'''const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const {Countdown,formatTime}=require('../src/timer-core.js');
const {snackState}=require('../src/snack-core.js');
const root=path.resolve(__dirname,'..');
const read=n=>fs.readFileSync(path.join(root,n),'utf8');
test('distribution matches editable sources',()=>cp.execFileSync(process.execPath,['scripts/build.mjs','--check'],{cwd:root}));
test('all JavaScript sources parse',()=>{for(const f of ['timer-core.js','snack-core.js','assets.js','app.js'])new vm.Script(read('src/'+f));});
test('no duplicate HTML ids',()=>{const ids=[...read('index.html').matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);});
test('embedded assets are complete data URLs',()=>{const s={window:{}};vm.runInNewContext(read('src/assets.js'),s,{timeout:2000});const a=s.window.TimerAssets;assert.ok(Object.keys(a).length>=16);for(const [name,url]of Object.entries(a)){const m=/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/.exec(url);assert.ok(m,name);assert.ok(Buffer.from(m[2],'base64').length>50,name);}assert.equal(a['chew-8.webp'],a['squirrel-ready.webp']);for(const k of ['tidy','meal','bath','out','brush','sleep'])assert.ok(a['next-'+k+'.webp']);});
for(const d of [1000,20000,60000,180000,300000,600000,900000,1200000,1800000,2700000,3600000])test(`exact deadline ${d}`,()=>{let now=1000;const t=new Countdown(()=>now);t.start(d);now+=d-1;assert.equal(t.remaining(),1);assert.equal(t.tick(),false);now++;assert.equal(t.tick(),true);assert.equal(t.tick(),false);});
test('pause freezes remaining time',()=>{let now=1000;const t=new Countdown(()=>now);t.start(20000);now+=4123;t.pause();now+=600000;assert.equal(t.remaining(),15877);t.resume();now+=15877;assert.ok(t.tick());});
test('acknowledgement follows finish',()=>{let now=1;const t=new Countdown(()=>now);t.start(1000);assert.equal(t.acknowledge(),false);now+=1000;t.tick();assert.equal(t.acknowledge(),true);assert.equal(t.status,'acknowledged');});
test('positive fractions do not display zero',()=>assert.equal(formatTime(1),'00:01'));
for(const [ms,phase]of [[0,'reach'],[1999,'reach'],[2000,'chew'],[7999,'chew'],[8000,'settle'],[9999,'settle']])test(`preserved animation phase ${ms}`,()=>assert.equal(snackState(20000,20000-ms).phase,phase));
test('short remainder keeps its deadline',()=>{assert.equal(snackState(11000,100).stepMs,1000);assert.equal(snackState(11000,0).phase,'complete');});
test('long timer uses next tray',()=>assert.equal(snackState(3600000,3000000).pageStart,60));
test('nine visibility choices remain separate from time selection',()=>{const h=read('index.html');assert.equal((h.match(/data-visible-preset="/g)||[]).length,9);assert.ok(h.includes('id="custom-minutes"'));assert.ok(!h.includes('id="current-activity"'));});
test('both direct completion buttons exist',()=>{const h=read('index.html');assert.ok(h.includes('id="finished-restart-button"'));assert.ok(h.includes('id="finished-reset-button"'));});
''')
    baseline = {
        'version': '8.0.0', 'source_html_sha256': HTML_SHA,
        'source_archive_sha256': ARCHIVE_SHA, 'html_bytes': len(html_bytes),
        'html_unchanged': True, 'animation_changed': False,
        'source_hashes': {str(p.relative_to(ROOT)): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in sorted((ROOT / 'src').glob('*'))}
    }
    write('validation/import-baseline.json', json.dumps(baseline, ensure_ascii=False, indent=2) + '\n')
    subprocess.run(['node', 'scripts/build.mjs', '--check'], cwd=ROOT, check=True)
    result = subprocess.run(['node', '--test', 'tests/import.test.cjs'], cwd=ROOT, text=True, capture_output=True)
    write('validation/import-test-results.txt', result.stdout + result.stderr)
    if result.returncode:
        print(result.stdout + result.stderr)
        raise RuntimeError('Import validation failed; do not commit this import.')
    baseline['tests_passed'] = int(re.search(r'# pass (\d+)', result.stdout)[1])
    baseline['tests_failed'] = int(re.search(r'# fail (\d+)', result.stdout)[1])
    baseline['browser_validation'] = 'Preserved prior v8 results in validation/original-v8; no new device/public-URL claim.'
    baseline['website_published'] = False
    write('validation/import-checks.json', json.dumps(baseline, ensure_ascii=False, indent=2) + '\n')
    print('PASS: imported the approved v8 byte-for-byte; tests:', baseline['tests_passed'])


if __name__ == '__main__':
    main()
