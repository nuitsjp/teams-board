# Marp プレゼンテーション設計書

## 概要

Teams Board プロダクトを紹介する Marp ベースのプレゼンテーションを作成する。
社内LT、外部カンファレンス、ポートフォリオなど複数シーンで汎用利用可能な構成とする。

### プロダクトの利用背景

- 非オープンで、社内などのクローズド環境での利用を想定
- シンプルで低コストな運用
- 秘匿性の高くない情報を扱う前提のアーキテクチャ

## ディレクトリ構成

```
docs/
└── presentation/
    ├── slides.md              # Marp スライドソース
    ├── theme.css              # カスタムテーマ
    └── images/                # Playwright キャプチャ画像
        ├── dashboard.png
        ├── csv-upload.png
        ├── group-detail.png
        └── member-detail.png

scripts/
└── capture-screenshots.mjs   # Playwright スクリーンショット取得スクリプト
```

## pnpm スクリプト

```json
{
  "presentation:capture": "node scripts/capture-screenshots.mjs",
  "presentation:build": "marp docs/presentation/slides.md --html --theme docs/presentation/theme.css -o docs/presentation/index.html",
  "presentation:preview": "marp docs/presentation/slides.md --html --theme docs/presentation/theme.css --preview"
}
```

### 依存関係

- `@marp-team/marp-cli` を devDependencies に追加
- Playwright は既存のプロジェクト設定を利用

## スライド構成（10枚）

ストーリーライン： **課題 → 解決策 → デモ → 仕組み → 導入コスト**

| # | タイトル | 内容 | 画像 |
|---|---------|------|------|
| 1 | **Teams Board** | タイトル、キャッチコピー「Teams 会議の参加状況を、もっと見やすく」 | ダッシュボード全景 |
| 2 | **こんな課題ありませんか？** | Teams 出席レポート CSV の問題点（バラバラのCSV、手作業の集計、一覧性の欠如） | — |
| 3 | **Teams Board とは** | CSVをドラッグ&ドロップするだけで可視化できるダッシュボード。サーバー不要、低コスト運用 | — |
| 4 | **ダッシュボード** | グループ別・メンバー別の参加状況を一覧表示。直感的なUI | `dashboard.png` |
| 5 | **CSV アップロード** | ドラッグ&ドロップで即座にデータ登録。Teams 出席レポート CSV をそのまま利用可能 | `csv-upload.png` |
| 6 | **グループ・メンバー分析** | グループ別の詳細分析、メンバーごとの参加履歴の可視化 | `group-detail.png` |
| 7 | **アーキテクチャ** | サーバーレス SPA + Azure Blob Storage。Mermaid 図でデータフローを表示 | Mermaid 図 |
| 8 | **技術スタック** | React 19 / Vite / Tailwind CSS 4 / recharts / Vitest + Playwright | アイコン or リスト |
| 9 | **運用コスト** | Azure Blob Storage のみ → 月額数十円〜。クローズド環境に最適、シンプル運用 | — |
| 10 | **まとめ** | 要点の振り返り、リポジトリリンク | — |

## カスタムテーマ

### カラーパレット（プロダクトのデザイントークンに準拠）

`src/index.css` の `@theme` 定義に合わせる。

| 用途 | カラー | 変数名 |
|------|--------|--------|
| プライマリ（見出し、アクセント） | `#2a9d8f` | `--color-primary-500` |
| プライマリ濃 | `#207d72` | `--color-primary-600` |
| アクセント（強調） | `#e76f51` | `--color-accent-500` |
| 背景 | `#f5f7f6` | `--color-page-bg` |
| サーフェス | `#ffffff` | `--color-surface` |
| テキスト | `#1a2e2a` | `--color-text-primary` |
| テキスト（セカンダリ） | `#4a6560` | `--color-text-secondary` |

### スタイル方針

- **16:9** アスペクト比
- **フォント**: Noto Sans JP（日本語）+ Inter（英語・コード）
- タイトルスライド： プライマリカラー背景 + 白テキスト
- コンテンツスライド： 白背景 + ダークテキスト
- 画像： シャドウ付きで配置し、実際の画面感を演出

## Playwright スクリーンショット

### キャプチャ対象

| ファイル名 | 画面 | URL | 内容 |
|-----------|------|-----|------|
| `dashboard.png` | ダッシュボード | `/#/` | グループ一覧・メンバー一覧・サマリーカード |
| `csv-upload.png` | 管理画面 | `/#/admin` | CSVドロップゾーン + プレビュー状態 |
| `group-detail.png` | グループ詳細 | `/#/groups/:groupId` | グループの参加履歴グラフ |
| `member-detail.png` | メンバー詳細 | `/#/members/:memberId` | メンバーの参加履歴グラフ |

### 実行フロー

1. dev サーバーを起動（`?token=dev` で管理者モード）
2. 各画面に遷移し、レンダリング完了を待機
3. `docs/presentation/images/` にスクリーンショットを保存
4. dev サーバーを停止

### 設定

- ビューポートサイズ： 1280x720（16:9）
- 画像形式： PNG
- dev-fixtures のサンプルデータを使用（本番データ不要）
