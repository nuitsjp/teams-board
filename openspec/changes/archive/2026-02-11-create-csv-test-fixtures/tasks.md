## 1. 既存データの分析と準備

- [x] 1.1 `dev-fixtures/data/index.json` を読み込み、4つのグループ（groupId, name）を確認
- [x] 1.2 `dev-fixtures/data/index.json` を読み込み、4人のメンバー（memberId, name）を確認
- [x] 1.3 `dev-fixtures/data/sessions/` の17件のセッションJSONを確認（sessionId, groupId, date, attendances）
- [x] 1.4 `dev-fixtures/csv/` ディレクトリを作成

## 2. ID 逆算ツールの作成

- [x] 2.1 SHA-256 の先頭8桁が一致する文字列を探索するスクリプトを作成（Node.js）
- [x] 2.2 既存の4つの groupId に対応するグループ名を逆算（ブルートフォース）
- [x] 2.3 既存の4人の memberId に対応するメールアドレス（example.com ドメイン）を逆算（ブルートフォース）
- [x] 2.4 逆算結果をJSON形式で保存（groupId → groupName, memberId → email のマッピング）

## 3. CSV ファイルの作成（フロントエンド勉強会）

- [x] 3.1 `フロントエンド勉強会-2026-01-15.csv` を作成（UTF-16LE / タブ区切り / 3セクション構成）
- [x] 3.2 `フロントエンド勉強会-2026-01-21.csv` を作成
- [x] 3.3 `フロントエンド勉強会-2026-01-26.csv` を作成
- [x] 3.4 `フロントエンド勉強会-2026-01-27.csv` を作成
- [x] 3.5 `フロントエンド勉強会-2026-01-28.csv` を作成
- [x] 3.6 `フロントエンド勉強会-2026-01-29.csv` を作成
- [x] 3.7 `フロントエンド勉強会-2026-02-02.csv` を作成
- [x] 3.8 `フロントエンド勉強会-2026-02-03.csv` を作成
- [x] 3.9 `フロントエンド勉強会-2026-02-04.csv` を作成
- [x] 3.10 `フロントエンド勉強会-2026-02-06.csv` を作成

## 4. CSV ファイルの作成（その他のグループ）

- [x] 4.1 `TypeScript読書会-2026-01-20.csv` を作成（UTF-16LE / タブ区切り / 3セクション構成）
- [x] 4.2 `TypeScript読書会-2026-02-03.csv` を作成
- [x] 4.3 `TypeScript読書会-2026-02-07.csv` を作成
- [x] 4.4 `ソフトウェア設計勉強会-2026-01-22.csv` を作成
- [x] 4.5 `ソフトウェア設計勉強会-2026-02-05.csv` を作成
- [x] 4.6 `インフラ技術研究会-2026-01-25.csv` を作成
- [x] 4.7 `インフラ技術研究会-2026-02-01.csv` を作成

## 5. JSON ファイルの更新

- [x] 5.1 CsvTransformer を使って各CSVファイルを変換し、生成されるIDを確認
- [x] 5.2 `dev-fixtures/data/index.json` の groups セクションを更新（groupId, name, sessionIds）
- [x] 5.3 `dev-fixtures/data/index.json` の members セクションを更新（memberId, name, sessionIds）
- [x] 5.4 `dev-fixtures/data/sessions/*.json` を更新（sessionId, groupId, attendances の memberId）

## 6. 検証とテスト

- [x] 6.1 各CSVファイルのエンコーディングがUTF-16LEであることを確認
- [x] 6.2 各CSVファイルの区切り文字がタブであることを確認
- [x] 6.3 各CSVファイルが3セクション構成（要約、参加者、会議中のアクティビティ）であることを確認
- [x] 6.4 CsvTransformer で変換した結果が `dev-fixtures/data/` の JSON と一致することを検証
- [x] 6.5 `pnpm test` を実行し、すべてのユニットテストがパスすることを確認
- [x] 6.6 `pnpm run test:e2e` を実行し、すべてのE2Eテストがパスすることを確認
- [x] 6.7 `dev-fixtures/csv/` のファイル数が17であることを確認
