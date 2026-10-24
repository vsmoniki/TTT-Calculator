# Zwift TTT Calculator

Zwift の Team Time Trial (TTT) をシミュレートする個人利用向けツールです。

コースと編成と機材を選ぶと、ローテーションを回したときの**予想ゴールタイム**（WTRL ルール: 4番目の完走者で計時）を計算します。逆に、目標タイムから必要なプル強度を逆算することもできます。

- **フロントエンド**: GitHub Pages（静的 HTML/CSS/JS）のみで完結
- サーバー・データベース・アカウントは不要で、計算はすべてブラウザの中で行われます
- ライダー登録はブラウザの localStorage に保存されます。編成は共有リンク（URL）で他の人に渡せます

公開先: https://vsmoniki.github.io/TTT-Calculator/

---

## 画面

- **TTT シミュレーター**: コース・機材・編成・プル設定（プル秒数 / プル強度%FTP / 千切れる閾値）から予想タイムを計算。結果にはライダーごとの平均パワー・%FTP・プル回数、ボトルネックのライダー、ローテーション表が含まれます。目標タイムからの逆算モードもあります
- **ライダー管理**: 名前・体重・身長・FTP を登録/編集。登録したライダーは編成に組み込めます（その場限りのゲスト追加も可、並び替え対応）
- **コース一覧**: 同梱している WTRL 系コース12件（距離・獲得標高・標高プロファイル）
- **目標W/kg計算機**: コースの目標W/kgバンドから必要パワーの目安を出す補助計算機

## 計算モデル

Zwift 向けの近似モデルです（実走とは誤差があります）。

```
P = P_gravity + P_roll + P_aero
P_gravity = M * g * v * sin(atan(grade))   ← 標高プロファイルを約300m区間に分け、区間ごとに勾配を適用
P_roll    = M * g * v * Crr                ← Crr = 0.004
P_aero    = 0.5 * rho * CdA * v^3          ← rho = 1.225
M = ライダー体重 + バイク 8kg

CdA = (Cd * A) * 0.76                      ← Tempus Fugit 実測で較正
A_road = 0.0276 * h^0.725 * m^0.425 + 0.1647
A_tt   = 0.0293 * h^0.725 * m^0.425 + 0.0604

機材補正（ZwifterBikes の flat_delta_sec から推定）:
CdA_multiplier = 1 + 3 * (flat_delta_sec_total / 1668)   ← clamp(0.7, 1.3)
flat_delta_sec_total は frame + wheel の平坦タイム差（秒、マイナスほど速い）を合算

ドラフト係数（CdA への乗数）:
  1番手: ×1.00 / 2番手: ×0.78 / 3番手: ×0.74 / 4番手以降: ×0.72
  ※ Zwift の TTT では TT バイクでもドラフトが効く仕様のため、バイク種別で区別しません
```

シミュレーションは2秒ステップで進みます。先頭のライダーが設定したプル強度（%FTP）で引き、そのパワーで出せる速度に集団が追従します。後続ライダーの必要パワーが閾値（%FTP）を超えると脱落（千切れ）として記録され、脱落した地点以降はそのライダーは単独走でフィニッシュする前提で、チームの計時は4番目の完走者で行います。

## データ

コース・機材の初期データは `worker/migrations/` の seed SQL から生成し、`docs/js/data.js` に同梱しています（生成スクリプトで SQL から機械的に変換。手作業の転記ではありません）。機材データの出典は ZwifterBikes です。

## ローカルで開く

```bash
cd docs
python3 -m http.server 8080
# → http://localhost:8080
```

## デプロイ

GitHub Pages のみです。リポジトリの Settings → Pages → Source を `docs/` フォルダに設定し、`docs/` 配下を push すると自動で反映されます。

## ディレクトリ構成

```
TTT-Calculator/
├── docs/                    # GitHub Pages フロントエンド（現行版はこの中だけで完結）
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js           # ハッシュルーター（認証なし）
│       ├── engine.js        # 物理エンジン（DOM非依存の純粋モジュール）
│       ├── data.js          # 同梱データ（コース/機材/設定）
│       ├── store.js         # localStorage 保存
│       └── pages/
│           ├── simulator.js # TTT シミュレーター
│           ├── riders.js    # ライダー管理
│           ├── courses.js   # コース一覧
│           └── wkg.js       # 目標W/kg計算機
└── worker/                  # 旧版の Cloudflare Workers API（現行フロントからは未使用・参考用に残置）
```

> 旧版は Cloudflare Workers + D1 + パスワード認証という構成でしたが、2026-10-24 の大改修でブラウザ完結に作り替えました。`worker/` はもう呼ばれません。Cloudflare 側のリソース（Worker / D1）は削除して問題ありません。
