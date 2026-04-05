# Zwift TTT Calculator

Zwift の Team Time Trial (TTT) をシミュレートする個人利用向けツールです。

- **フロントエンド**: GitHub Pages（静的 HTML/CSS/JS）
- **API**: Cloudflare Workers (TypeScript)
- **DB**: Cloudflare D1 (SQLite)

---

## ディレクトリ構成

```
TTT-Calculator/
├── docs/                    # GitHub Pages フロントエンド
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── config.js        # API_BASE URL 設定
│       ├── api.js           # APIクライアント
│       ├── app.js           # ルーター
│       └── pages/
│           ├── courses.js   # コース一覧
│           ├── gear.js      # 機材一覧
│           ├── teams.js     # チーム管理
│           ├── lineups.js   # ラインナップ作成
│           └── main.js      # メインシミュレーター
└── worker/                  # Cloudflare Workers API
    ├── wrangler.toml
    ├── package.json
    ├── tsconfig.json
    ├── migrations/
    │   ├── 0001_schema.sql  # DDL
    │   └── 0002_seed.sql    # サンプルデータ
    └── src/
        ├── index.ts         # ルーター
        ├── types.ts         # 型定義
        ├── response.ts      # 統一レスポンス
        └── routes/
            ├── routes.ts
            ├── frames.ts
            ├── wheels.ts
            ├── riders.ts
            ├── teams.ts
            ├── lineups.ts
            └── simulate.ts
```

---

## ローカル開発手順

### 前提

- Node.js 18 以上
- Cloudflare アカウント（wrangler login）

### 1. 依存パッケージのインストール

```bash
cd worker
npm install
```

### 2. D1 データベースの作成（初回のみ）

```bash
npx wrangler d1 create ttt-calculator
```

表示される `database_id` を `wrangler.toml` の `database_id` に貼り付けてください。

### 3. マイグレーション & シードデータ投入

```bash
# スキーマ作成
npm run db:migrate:local

# サンプルデータ投入
npm run db:seed:local
```

### 4. Cloudflare Secret の設定（必須）

`SECRET_PASSWORD` を Cloudflare の Secret として設定してください。今回の想定値は `TMR` です。

```bash
# worker/ ディレクトリで実行
npx wrangler secret put SECRET_PASSWORD
# プロンプトで TMR を入力
```

ローカル開発時も `wrangler dev` で同じ Secret が利用されます。

### 5. Workers をローカル起動

```bash
npm run dev
# → http://localhost:8787 で起動
```

### 5. フロントエンド確認

`docs/index.html` をブラウザで直接開くか、任意の静的サーバーで配信してください。

```bash
# Python を使う場合
cd docs
python3 -m http.server 8080
# → http://localhost:8080
```

> **注意**: `docs/js/config.js` の `API_BASE` が `http://localhost:8787` になっていることを確認してください。

---

## API エンドポイント一覧

| メソッド | パス | 説明 |
|---|---|---|
| GET | /routes | コース一覧 |
| GET | /routes/:id | コース詳細 |
| GET | /frames | フレーム一覧 |
| GET | /wheels | ホイール一覧 |
| POST | /riders | ライダー作成 |
| PUT | /riders/:id | ライダー更新 |
| GET | /teams | チーム一覧 |
| GET | /teams/:id | チーム詳細 |
| POST | /teams | チーム作成 |
| POST | /teams/:id/members | メンバー追加 |
| DELETE | /teams/:id/members/:riderId | メンバー削除 |
| POST | /lineups | ラインナップ作成 |
| GET | /lineups/:id | ラインナップ詳細 |
| PUT | /lineups/:id | ラインナップ更新 |
| POST | /lineups/:id/members | ラインナップメンバー追加 |
| PUT | /lineups/:id/members/:memberId | メンバー更新 |
| DELETE | /lineups/:id/members/:memberId | メンバー削除 |
| POST | /simulate | シミュレーション実行 |

### エラーレスポンス形式

```json
{
  "error": {
    "code": "LINEUP_MEMBER_LIMIT_EXCEEDED",
    "message": "lineup members cannot exceed 8"
  }
}
```

### POST /simulate リクエスト例

```json
{
  "route_id": 1,
  "lineup_id": 1,
  "target_speed_kph": 45,
  "draft_factor_second": 0.80,
  "draft_factor_other": 0.75
}
```

---

## デプロイ手順

### Cloudflare Workers (API)

```bash
cd worker

# 本番用 D1 データベース作成（初回のみ）
npx wrangler d1 create ttt-calculator
# → 表示された database_id を wrangler.toml に設定

# Secret 設定（必須）
npx wrangler secret put SECRET_PASSWORD
# プロンプトで TMR を入力

# 本番マイグレーション
npm run db:migrate:remote
npm run db:seed:remote

# デプロイ
npm run deploy
# → https://ttt-calculator-api.<あなたのサブドメイン>.workers.dev
```

### GitHub Pages (フロントエンド)

1. `docs/js/config.js` の `API_BASE` を Workers の URL に変更

```js
export const API_BASE = 'https://ttt-calculator-api.your-subdomain.workers.dev';
```

2. GitHub リポジトリの Settings → Pages → Source を `docs/` フォルダに設定

3. プッシュすると自動デプロイされます

> **CORS**: Workers の `response.ts` は `Access-Control-Allow-Origin: *` を返すため、GitHub Pages からの呼び出しが可能です。本番環境では特定オリジンに絞ることを推奨します。

---

## シミュレーション計算モデル（MVPの簡略版）

MVPでは平坦コース近似の物理モデルを使用しています。

```
v = target_speed_kph / 3.6  [m/s]

CdA = 0.32
    - (frame.aero_score - 5) × 0.005   ← フレーム空力補正
    - (wheel.aero_score - 5) × 0.004   ← ホイール空力補正

F_aero = 0.5 × 1.225 × CdA × v²
F_roll = 0.004 × (体重 + 8kg) × 9.81
P_head = (F_aero + F_roll) × v         ← 先頭必要パワー

ドラフト係数:
  1番手: 係数なし（P_head）
  2番手: P_head × 0.80
  3番手以降: P_head × 0.75
```

**補足**:
- 勾配・風の影響は含まれません
- Zwift の実際の物理エンジンとは異なる近似値です
- フレーム/ホイールの aero_score は仮データです

---

## 拡張候補 (post-MVP TODO)

- [ ] 勾配を考慮した区間ごとのパワー計算
- [ ] Zwift 実際の物理モデル（CdA 精密計算）
- [ ] simulate 結果の DB 保存・履歴表示
- [ ] React/Vite へのフロントエンド移行
- [ ] ZwifterBikes からの frame/wheel データ自動同期
- [ ] コース高度プロファイルの実データ取得
- [ ] ライダー選択UI改善（rider_id 直接入力 → 名前で選択）
- [ ] PWA 対応（オフライン利用）
- [ ] lineup 複数パターンの比較機能
- [ ] 認証（Cloudflare Access）
