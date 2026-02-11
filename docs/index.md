# Teams Board

## システム概要

**Teams Board** は、Microsoft Teams の出席レポート CSV を集約・可視化するダッシュボード SPA です。勉強会やミーティングのグループごとに参加状況を管理し、メンバーの活動時間を可視化します。

## ドキュメント案内

- [アーキテクチャ（現行実装）](architecture.md)
- [01.参加状況管理業務](01.参加状況管理業務/参加状況管理業務.md)
- [02.グループ情報管理業務](02.グループ情報管理業務/グループ情報管理業務.md)

---

## 概念モデル

```mermaid
classDiagram
    class Group {
        +String id
        +String name
        グループ（勉強会・ミーティング）
    }

    class Member {
        +String id
        +String name
        参加者
    }

    class Session {
        +String id
        +Date date
        会議の開催
    }

    class Attendance {
        +Duration duration
        出席記録
    }

    Group "1" -- "0..*" Session : 開催する
    Member "0..*" -- "0..*" Session : 参加する
    Session "1" *-- "1..*" Attendance : 含む
    Attendance "1" -- "1" Member : 記録する

    note for Group "フロントエンド勉強会<br/>TypeScript読書会<br/>などのグループ"
    note for Member "鈴木 太郎<br/>田中 浩二<br/>などの参加者"
    note for Session "2026-01-15 の開催<br/>2026-01-21 の開催"
    note for Attendance "鈴木 太郎が 59分32秒 参加"
```

---

## 登場する概念

| 概念 | 定義 | 例 |
|------|------|-----|
| **Group** | 勉強会やミーティングなどの活動グループ | フロントエンド勉強会、TypeScript読書会 |
| **Member** | 参加者 | 鈴木 太郎、田中 浩二 |
| **Session** | グループによる会議の1回の開催 | フロントエンド勉強会 2026-01-15 開催 |
| **Attendance** | セッションへのメンバーの参加記録（参加時間を含む） | 鈴木 太郎が 59分32秒 参加 |

---

## ユースケース

### CSV インポート
1. 管理者が Teams 出席レポート CSV をアップロード
2. システムが CSV を解析:
   - 会議タイトル → Group を特定または新規作成
   - 開催日 → Session を新規作成
   - 参加者リスト → 各 Member の Attendance を作成
3. データが永続化される

### グループ一覧表示
- すべての Group とそれぞれの総参加時間を表示
- 総参加時間 = そのグループの全セッションの全 Attendance の duration の合計

### メンバー一覧表示
- すべての Member とそれぞれの総参加時間を表示
- 総参加時間 = そのメンバーの全 Attendance の duration の合計

### セッション詳細表示
- 特定の Session の出席者リストと各自の参加時間を表示
- Attendance を通じて Member と duration を取得

---

## データの流れ

```
Teams 出席レポート CSV
  ↓
[解析]
  ↓
Group + Session + Attendance (+ Member) の概念が生成される
  ↓
[永続化]
  ↓
JSON ファイルとして Azure Blob Storage に保存
  ↓
[読み取り]
  ↓
ダッシュボードで可視化
```

---

## 実装上の補足

このドキュメントは概念モデルを示しています。実装では以下のような形で具体化されています:

- **Group**: `GroupSummary` として `index.json` に格納（集約データ）
- **Member**: `MemberSummary` として `index.json` に格納（集約データ）
- **Session**: `SessionRecord` として `data/sessions/{id}.json` に個別保存
- **Attendance**: `SessionRecord` 内の配列として保存

詳細な実装構成は [architecture.md](architecture.md) を参照してください。
