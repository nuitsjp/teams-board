## 1. IndexEditorサービスの作成

- [x] 1.1 `src/services/index-editor.js`を作成し、`IndexEditor`クラスを実装
- [x] 1.2 `updateGroupName(index, groupId, newName)`メソッドを実装（グループIDでnameフィールドを更新、updatedAtを現在時刻に設定）
- [x] 1.3 バリデーション関数を実装（空文字、空白のみ、256文字超過をチェック）
- [x] 1.4 `tests/data/index-editor.test.js`を作成し、単体テストを実装（正常系、異常系、バリデーションエラー）

## 2. GroupNameEditorコンポーネントの作成

- [x] 2.1 `src/components/GroupNameEditor.jsx`を作成（インライン編集UI）
- [x] 2.2 編集モード切り替えロジックを実装（表示⇔編集）
- [x] 2.3 入力フィールド、保存ボタン、キャンセルボタンを実装
- [x] 2.4 クライアント側バリデーションを実装（エラーメッセージ表示）
- [x] 2.5 `tests/react/components/GroupNameEditor.test.jsx`を作成し、コンポーネントテストを実装

## 3. Admin画面のグループ一覧表示

- [x] 3.1 `AdminPage.jsx`にグループ一覧取得ロジックを追加（DataFetcherで`index.json`を取得）
- [x] 3.2 グループ管理セクションのUIを追加（CSVインポートセクションの下に配置）
- [x] 3.3 グループ一覧テーブル/リストを実装（id、name、totalDurationSeconds、sessionIds数を表示）
- [x] 3.4 各行に`GroupNameEditor`コンポーネントを配置

## 4. グループ名保存ロジックの実装

- [x] 4.1 保存ハンドラー`handleSaveGroupName`を実装（IndexEditorでindex.jsonを更新）
- [x] 4.2 楽観的ロック実装（保存前にDataFetcherで最新index.jsonを取得し、updatedAt比較）
- [x] 4.3 競合検出時の警告表示を実装
- [x] 4.4 BlobWriterの`executeWriteSequence`を呼び出し、index.jsonをBlob Storageに保存
- [x] 4.5 保存成功後、最新index.jsonを再取得してグループ一覧を更新
- [x] 4.6 保存失敗時のエラーハンドリングを実装（エラーメッセージ表示、UI状態をロールバック）

## 5. 状態管理とUI反映

- [x] 5.1 Admin画面のローカルstateを実装（グループ一覧、編集中グループID、保存中状態）
- [x] 5.2 編集中の状態表示を実装（保存ボタンの無効化、ローディングスピナー等）
- [x] 5.3 成功メッセージの表示を実装（保存完了時）

## 6. テストの作成と実行

- [x] 6.1 `tests/react/pages/AdminPage.test.jsx`を更新（グループ管理セクションのテストを追加）
- [x] 6.2 E2Eテストを作成（`e2e/admin-group-edit.spec.js`：グループ名編集フロー）
- [x] 6.3 すべてのテストを実行し、既存テストが壊れていないことを確認（`pnpm test`）
- [x] 6.4 E2Eテストを実行（`pnpm run test:e2e`）

## 7. コード品質と仕上げ

- [x] 7.1 ESLintを実行し、警告を修正（`pnpm run lint`）
- [x] 7.2 Prettierでフォーマット（`pnpm run format`）
- [x] 7.3 dev-fixtures/data/index.jsonで動作確認（`pnpm run dev`で開発サーバー起動、Admin画面で編集テスト）
- [x] 7.4 コードレビュー用のコメント追加（複雑なロジックがあれば）
