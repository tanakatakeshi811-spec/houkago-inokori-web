# 放課後の居残り 公式サイト(デザイン案3)

ブラウザ3Dオンライン鬼ごっこゲーム「放課後の居残り」の公式サイト。
実画像(校舎の背景・ロゴ・ヒーロー画像)を使った、素のHTML/CSS/JS構成。ビルド不要。

## 公開URL

https://tanakatakeshi811-spec.github.io/houkago-inokori-web/

## ゲーム本体

このリポジトリにゲーム本体は含まれていない。「今すぐ遊ぶ」ボタンは
ゲーム本体の公開URLを直接指している。

- ゲーム本体: https://tanakatakeshi811-spec.github.io/houkago-inokori/
- ゲーム本体のリポジトリ: [tanakatakeshi811-spec/houkago-inokori](https://github.com/tanakatakeshi811-spec/houkago-inokori)

## ページ構成

| ファイル | 内容 |
|---|---|
| `index.html` | トップ |
| `rules.html` | ルール・遊び方(体験コーナーのミニゲーム含む) |
| `characters.html` | キャラ図鑑 |
| `history.html` | 歴史 |
| `ranking.html` | ランキング(Cloudflare Workerの `/api/leaderboard` から取得) |
| `about.html` | このゲームについて |

## 他のデザイン案

同じサイトの別案が2つある。どれを本採用するかは未定。

| 案 | URL |
|---|---|
| 複数ページ版 | https://tanakatakeshi811-spec.github.io/houkago-inokori/site/ |
| SPA版 | https://tanakatakeshi811-spec.github.io/houkago-inokori-lp/ |
| この案 | https://tanakatakeshi811-spec.github.io/houkago-inokori-web/ |

## 触るときの注意

詳細は `引き継ぎメモ.md` と `作業指示書_サイト公開まで.md` を参照。

- ヘッダーとフッターは6つのHTMLに同じものが書いてある。直すときは6ファイルとも直す
- キャラを増やす → `js/characters-data.js` に1件足す
- 更新履歴を増やす → `js/history-data.js` の末尾に1件足す(トップの「最新のアップデート」にも自動反映)
- 色を変える → `css/style.css` 先頭の `:root` 変数
- 背景画像の差し替え → `img/bg/` に同じファイル名で上書き
- `ranking.html?sample=1` でランキングをサンプルデータ表示(デザイン確認用)

## 独自ドメインを取得したら

各ページの `<head>` と `sitemap.xml` / `robots.txt` に仮ドメイン
`https://houkago-inokori.com/` が入っている。取得後に一括置換する
(`og:url` / `og:image` / サイトマップのURLで使用)。
