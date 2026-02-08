## 1. 公開データの置き換え

- [x] 1.1 `public/data/index.json` のメンバー名4件をダミー名に置き換える（Nakamura→Suzuki, Yamaura→Tanaka, Sai→Yamamoto, Yato→Watanabe）
- [x] 1.2 `public/data/index.json` の勉強会名4件をダミー名に置き換える（もくもく勉強会→フロントエンド勉強会, React読書会→TypeScript読書会, アーキテクチャ設計塾→ソフトウェア設計勉強会, クラウド技術研究会→インフラ技術研究会）
- [x] 1.3 `public/data/sessions/*.json` の内容を確認し、人名・勉強会名が含まれていれば置き換える（メンバーIDのみの参照なら変更不要）

## 2. テストファイルの置き換え

- [x] 2.1 `tests/logic/csv-transformer.test.js` のテストデータを置き換える（テスト太郎→佐藤 一郎, テスト花子→高橋 美咲, taro@example.com→ichiro.sato@example.com, hanako@example.com→misaki.takahashi@example.com）
- [x] 2.2 `tests/data/data-fetcher.test.js` のテストデータを置き換える（もくもく勉強会→フロントエンド勉強会, テスト太郎→佐藤 一郎）
- [x] 2.3 `tests/data/index-merger.test.js` のテストデータを置き換える（もくもく勉強会→フロントエンド勉強会, テスト太郎→佐藤 一郎, テスト花子→高橋 美咲）
- [x] 2.4 `tests/react/components/MemberList.test.jsx` のテストデータを置き換える（たなか→佐藤, すずき→田中, やまだ→山本 等）
- [x] 2.5 `tests/react/components/GroupList.test.jsx` のテストデータを置き換える（もくもく勉強会→フロントエンド勉強会, React読書会→TypeScript読書会）
- [x] 2.6 `tests/react/pages/DashboardPage.test.jsx` のテストデータを置き換える（もくもく勉強会→フロントエンド勉強会, テスト太郎→佐藤 一郎, テスト花子→高橋 美咲）
- [x] 2.7 `tests/react/pages/MemberDetailPage.test.jsx` のテストデータを置き換える（もくもく勉強会→フロントエンド勉強会, テスト太郎→佐藤 一郎）
- [x] 2.8 `tests/react/pages/GroupDetailPage.test.jsx` のテストデータを置き換える（もくもく勉強会→フロントエンド勉強会, React読書会→TypeScript読書会, テスト太郎→佐藤 一郎, テスト花子→高橋 美咲）
- [x] 2.9 `tests/react/pages/AdminPage.test.jsx` のテストデータを置き換える（テスト勉強会→ダミー勉強会名, テスト太郎→佐藤 一郎）

## 3. E2Eテストの置き換え

- [x] 3.1 `e2e/dashboard.spec.js` の勉強会名4件をダミー名に置き換える
- [x] 3.2 `e2e/dashboard.spec.js` の人名（中村 充志）をダミー名（鈴木 太郎）に置き換える

## 4. ドキュメントの置き換え

- [x] 4.1 `docs/architecture.md` のサンプルデータ内の勉強会名をダミー名に置き換える
- [x] 4.2 `docs/architecture.md` のサンプルデータ内の人名をダミー名に置き換える

## 5. 検証

- [x] 5.1 リポジトリ全体をgrepし、元の実名（中村 充志、山浦 哲朗、崔 文、谷戸 大輔）が残っていないことを確認する（openspec/changes配下を除く）
- [x] 5.2 リポジトリ全体をgrepし、元の勉強会名（もくもく勉強会、React読書会、アーキテクチャ設計塾、クラウド技術研究会）が残っていないことを確認する（openspec/changes配下を除く）
- [x] 5.3 ユニットテストを実行し、全てパスすることを確認する
