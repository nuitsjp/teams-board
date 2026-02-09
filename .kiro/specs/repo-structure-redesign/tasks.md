# Implementation Plan

- [x] 1. アプリケーションコアのディレクトリ移動
- [x] 1.1 ソースコードをルート直下に移動する
  - `frontend/dashboard/src/` の全内容をルート直下の `src/` に `git mv` で移動する
  - 内部構造（components, pages, hooks, services, utils）はそのまま維持する
  - `frontend/dashboard/local-batch/` を `src/local-batch/` に `git mv` で移動する
  - 移動後、`src/` 内部のファイル間インポートに変更が不要であることを確認する
  - _Requirements: 1.1, 1.3, 1.4, 4.1_

- [x] 1.2 テストおよびE2Eディレクトリをルート直下に移動する
  - `frontend/dashboard/tests/` をルート直下の `tests/` に `git mv` で移動する
  - `tests/` 配下のサブディレクトリ構造（data, fixtures, integration, local-batch, logic, react）を維持する
  - `frontend/dashboard/e2e/` をルート直下の `e2e/` に `git mv` で移動する
  - _Requirements: 2.1, 2.2, 2.4_

- [x] 1.3 静的アセットとデータディレクトリを移動する
  - `frontend/dashboard/public/` をルート直下の `public/` に `git mv` で移動する
  - `data/sample/` はルート直下のまま変更しない
  - _Requirements: 5.1, 5.2_

- [x] 1.4 設定ファイルをルート直下に移動する
  - `frontend/dashboard/` 直下の設定ファイル群（`package.json`, `package-lock.json`, `vite.config.js`, `tailwind.config.js`, `postcss.config.js`, `playwright.config.js`, `index.html`, `inspect-page.cjs`）をルート直下に `git mv` で移動する
  - `frontend/staticwebapp.config.json` をルート直下に移動する
  - Vitest用セットアップファイル（`tests/vitest.setup.js`）は既にテスト移動で対応済みであることを確認する
  - _Requirements: 1.2, 3.3, 6.4, 6.5, 6.6_

- [x] 1.5 スクリプトの再配置と統合を行う
  - ルート直下の既存 `scripts/` 内のインフラスクリプト（PowerShellファイル群など）を `scripts/infra/` サブディレクトリに退避する
  - `frontend/dashboard/scripts/convert-local-data.mjs` を `scripts/` 直下に移動する
  - _Requirements: 4.2, 4.3_

- [x] 1.6 不要ディレクトリを削除する
  - `backend/` ディレクトリを完全に削除する
  - `frontend/` ディレクトリの残留ファイルを確認し、完全に削除する
  - 削除後、ルート直下に `backend/` も `frontend/` も存在しないことを確認する
  - _Requirements: 3.1, 3.2, 8.3_

- [x] 2. インポートパスの一括修正
- [x] 2.1 テストファイルのインポートパスを修正する
  - `tests/local-batch/` 配下のテストファイルで、ローカルバッチモジュールへの参照先を新しい配置に合わせて修正する（`../../local-batch/` → `../../src/local-batch/`）
  - `tests/integration/` 配下のテストファイルで、ローカルバッチへのインポートパスを同様に修正する（`../../local-batch/` → `../../src/local-batch/`）
  - `src/` への参照パスは `tests/` と `src/` の相対位置が変わらないため修正不要
  - _Requirements: 2.3, 1.4_

- [x] 2.2 (P) ローカルバッチモジュールのインポートパスを修正する
  - `src/local-batch/` 内のファイルが `src/services/` を参照する際のパスを修正する（`../src/services/` → `../services/`）
  - `src/local-batch/` 内のモジュール間の相互参照（`./xxx.js`）は変更不要であることを確認する
  - _Requirements: 4.1_

- [x] 2.3 (P) バッチ実行スクリプトのパス解決を修正する
  - `scripts/convert-local-data.mjs` のローカルバッチモジュールへのインポートパスを新配置に合わせて修正する
  - 同スクリプト内のプロジェクトルート解決ロジックを、ルート直下からの1段上の解決に簡素化する
  - ダッシュボードルートの参照を削除し、プロジェクトルートと統一する
  - `data/sample/` の入力パスと `public/data/` の出力パスが正しく解決されることを確認する
  - _Requirements: 4.4, 5.3_

- [x] 3. CI/CDワークフローの更新
- [x] 3.1 GitHub Actionsのワークフロー定義を新しいディレクトリ構造に対応させる
  - ワークフローのデフォルト作業ディレクトリ設定を削除し、ルート直下で実行するよう変更する
  - トリガー条件のパスフィルタを新構造のパスに更新する
  - 依存キャッシュのパス参照をルート直下のロックファイルに変更する
  - _Requirements: 6.3_

- [x] 4. ドキュメントの更新
- [x] 4.1 (P) READMEのセットアップ手順とディレクトリ構造図を更新する
  - セットアップ手順からサブディレクトリへの移動コマンドを削除し、ルート直下での操作に変更する
  - ディレクトリ構造図を新しい構造に書き換える
  - _Requirements: 7.4_

- [x] 4.2 (P) CLAUDE.mdとAGENTS.mdのパス参照を更新する
  - `frontend/dashboard/` への参照をルート直下のパスに更新する
  - テストやソースコードへのパス記述を新構造に合わせる
  - _Requirements: 7.5_

- [x] 4.3 (P) アーキテクチャドキュメントを新構造に全面更新する
  - ディレクトリ構造図を新構造に書き換える
  - 各フロー説明内のパス参照を更新する
  - `backend/` への言及を削除する
  - _Requirements: 7.6_

- [x] 5. 検証とビルド確認
- [x] 5.1 依存パッケージを再インストールし、全テストを実行する
  - ルート直下で `pnpm install` を実行し、`node_modules` が正しく生成されることを確認する
  - `pnpm run test` で全ユニットテスト・統合テストがパスすることを確認する
  - テスト実行で `Module not found` エラーが発生しないことを確認する
  - _Requirements: 6.2, 2.3_

- [x] 5.2 ビルドとバッチ実行を検証する
  - `pnpm run build` でViteビルドがエラーなく完了し、`dist/` に出力されることを確認する
  - `pnpm run convert:local-data` でローカル変換バッチが正常動作し、`data/sample/` から読み取り `public/data/` へ出力することを確認する
  - _Requirements: 6.1, 4.4, 5.3_

- [x] 5.3 最終的なディレクトリ構造を検証する
  - ルート直下のトップレベルディレクトリが目標構造（`src/`, `tests/`, `e2e/`, `public/`, `data/`, `scripts/`, `docs/`, `.kiro/`, `.github/`）と一致することを確認する
  - ルート直下に `package.json`, `vite.config.js`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `playwright.config.js` が存在することを確認する
  - `backend/` および `frontend/` ディレクトリが存在しないことを確認する
  - _Requirements: 8.1, 8.2, 8.3_
