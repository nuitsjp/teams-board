## 1. 期算出ユーティリティの実装

- [ ] 1.1 `src/utils/fiscal-period.js` を新規作成する。`getFiscalPeriod(dateString)` 関数を実装し、日付文字列（`YYYY-MM-DD`）から `{ fiscalYear, half, label, sortKey }` を返す。上期=4〜9月、下期=10〜3月、年度は4月始まり（1〜3月は前年度の下期）
- [ ] 1.2 `tests/logic/fiscal-period.test.js` を新規作成し、spec のシナリオ（上期分類・下期10〜12月・下期1〜3月・年度境界3/31→4/1）をカバーするテストを実装する

## 2. dev-fixtures の上期セッションデータ追加

- [ ] 2.1 `dev-fixtures/data/sessions/` に2025年度上期のセッションJSONファイルを4件追加する。フロントエンド勉強会（`b20ae593`）に2件（2025-06-15, 2025-08-20）、TypeScript読書会（`75aa4f8f`）に2件（2025-05-12, 2025-09-08）。メンバー `d2ede157`, `7c35db6e`, `70c5a8d7` が参加するデータとする
- [ ] 2.2 `dev-fixtures/data/index.json` を更新する。各グループの `sessionIds` に新規セッションIDを追加し、`totalDurationSeconds` を加算する。各メンバーの `sessionIds` と `totalDurationSeconds` も同様に更新する

## 3. MemberDetailPage の期別グルーピングロジック実装

- [ ] 3.1 `MemberDetailPage.jsx` の useEffect 内で、既存のグループ別グルーピング処理の前に `getFiscalPeriod` を使って全セッションを期別にグルーピングする。結果を `periodAttendances` state に格納する（降順ソート済み）
- [ ] 3.2 `selectedPeriodLabel` state を追加し、初期値を最新の期（`periodAttendances[0].label`）に設定する。期の選択切り替え関数 `selectPeriod(label)` を実装する

## 4. 期サマリーリストUIの実装

- [ ] 4.1 左列に期サマリーリストを実装する。各期を `button` 要素で表示し、`label`（「2025年度 下期」等）、参加回数（`totalSessions`）、合計時間（`totalDurationSeconds`）を表示する
- [ ] 4.2 選択中の期に `bg-primary-50 border-l-4 border-l-primary-500` スタイルを適用し、非選択は `hover:bg-surface-muted` とする。`aria-pressed` 属性で選択状態を伝達する

## 5. 2カラムレスポンシブレイアウトの実装

- [ ] 5.1 メンバーヘッダーカードの下に `lg:grid lg:grid-cols-[280px_1fr] gap-6` のグリッドレイアウトを適用する。左列に期サマリーリスト、右列に選択中の期のグループ別アコーディオンを配置する
- [ ] 5.2 `lg` 未満では `grid-cols-1` で縦積み表示になることを確認する

## 6. 右列のセッション表示を選択した期でフィルタ

- [ ] 6.1 右列のグループ別アコーディオンを、`selectedPeriodLabel` に一致する期の `groupAttendances` のみで描画するように変更する。既存のアコーディオン構造（サマリーカード＋展開テーブル）はそのまま維持する

## 7. テストの更新

- [ ] 7.1 `tests/react/pages/MemberDetailPage.test.jsx` を更新する。モックデータに複数期のセッションを追加し、期サマリーリストの表示・デフォルト選択・期の切り替えをテストする
- [ ] 7.2 `pnpm test` で全テストがパスすることを確認する

## 8. E2Eテストの確認

- [ ] 8.1 既存のE2Eテストでメンバー明細画面に関連するセレクターが壊れていないか確認し、必要に応じて修正する
