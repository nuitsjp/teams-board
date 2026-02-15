## Why

現在、トップページに勉強会一覧が表示されているが、各勉強会の詳細を確認する手段がない。メンバー詳細ページでは勉強会別サマリーとセッション履歴の閲覧が可能になっているが、「勉強会」を軸とした閲覧導線が存在しない。勉強会ごとの開催履歴や参加者の詳細を確認できるサマリーページを追加することで、勉強会の活動状況を俯瞰・把握できるようにする。

## What Changes

- トップページの勉強会一覧（`StudyGroupList`）にリンクを追加し、勉強会詳細ページへ遷移可能にする
- 勉強会詳細ページ（`StudyGroupDetailPage`）を新規作成する
  - 勉強会のヘッダー情報（名前、総開催回数、合計学習時間）を表示
  - 開催されたセッションの一覧をサマリーカード形式で表示
  - セッションを選択（アコーディオン展開）すると参加者の詳細（名前、学習時間）が表示される
- ルーティングに `#/study-groups/:studyGroupId` を追加する
- メンバー詳細ページの構造（サマリーカード＋アコーディオン展開パターン）を踏襲し、UI全体の一貫性を保つ

## Capabilities

### New Capabilities

- `study-group-detail-page`: 勉強会詳細ページの表示。勉強会のサマリー情報、セッション一覧、セッション内の参加者詳細のアコーディオン表示を含む
- `study-group-navigation`: トップページから勉強会詳細ページへの遷移導線。StudyGroupListコンポーネントのリンク化とルーティング追加を含む

### Modified Capabilities

なし

## Impact

- **ページ追加**: `src/pages/StudyGroupDetailPage.jsx` を新規作成
- **コンポーネント変更**: `src/components/StudyGroupList.jsx` にリンク機能を追加
- **ルーティング変更**: `src/App.jsx` に新規ルートを追加
- **データ取得**: 既存の `DataFetcher.fetchIndex()` と `DataFetcher.fetchSession()` をそのまま利用（API変更なし）
- **テスト**: 新規ページのE2Eテスト追加
