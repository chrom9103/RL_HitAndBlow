# 文化祭展示用ポスター

CPU(強化学習 / DQN)の仕組みを中高生向けにまとめた 2 枚組のポスターです。

| ファイル | 内容 |
|---|---|
| `poster-shiroku.pdf` | 四六判(788 × 1091 mm)× 2 ページ。模造紙への印刷用 |
| `poster-a4.pdf` | A4 × 2 ページ。同じレイアウトの縮小版(本文は約 6pt。配布・確認用) |
| `poster.html` | 原稿。図とグラフはページ内の JavaScript で描画 |
| `build.ps1` | `poster.html` から 2 つの PDF を作る(Chrome / Edge のヘッドレス印刷) |

各シートは 3 トピック × 2 段(上段 1→2→3、下段 4→5→6)で、段ごとに見出しの高さをそろえています。

- 1 枚目: ルール、候補集合、強化学習 / 報酬、Q 値・ベルマン方程式、学習の流れ
- 2 枚目: 特徴量、ネットワーク、DQN の工夫 / 学習曲線、難易度ごとの対局例、結果とまとめ(見出しの横にアプリへの QR コード)

## 作り直す

```powershell
powershell -ExecutionPolicy Bypass -File docs/poster/build.ps1
```

フォントは Google Fonts から読み込むため、ネットワーク接続が必要です。
`poster.html` をブラウザで開くと画面でも確認できます(`poster.html?a4` で A4 版、`?measure` で各シートの高さを `<body data-measure>` に出力)。

## 数値の出どころ

- 結果・回数の分布: `training/results.json`
- 学習曲線: `python evaluate.py --scan runs/main --games 500`(シード 12345)
- Q 値の例・対局例(秘密の数字 7683): `runs/main` の ep600 / ep1300 / ep30000 の重みで計算
