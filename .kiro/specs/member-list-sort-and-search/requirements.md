# Requirements Document

## Introduction
メンバー一覧（`MemberList` コンポーネント）の使い勝手を改善するための要件定義。現在は勉強時間の降順でソートされているが、名称の昇順に変更する。また、メンバーが増えた場合に素早く目的のメンバーを見つけられるよう、インクリメンタルサーチ機能を追加する。

## Requirements

### Requirement 1: メンバー一覧の名称昇順ソート
**Objective:** 管理者として、メンバー一覧が名前順に並んでいてほしい。直感的にメンバーを探せるようにするため。

#### Acceptance Criteria
1. The MemberList shall メンバー一覧を名称（`name`）の昇順（あいうえお順 / アルファベット順）で表示する
2. When メンバーデータが読み込まれた時, the MemberList shall 既存の勉強時間降順ソートを名称昇順ソートに置き換える
3. The MemberList shall ロケール対応の文字列比較（`localeCompare`）を使用し、日本語名・英語名の混在に対応する

### Requirement 2: 検索入力コントロールの配置
**Objective:** ユーザーとして、メンバー一覧のヘッダー部分に検索ボックスが表示されていてほしい。検索機能にすぐアクセスできるようにするため。

#### Acceptance Criteria
1. The MemberList shall 「メンバー」見出しの右側（メンバー数バッジの左側）に検索入力フィールドを表示する
2. The 検索入力フィールド shall プレースホルダーテキスト（例：「名前で検索...」）を表示する
3. The 検索入力フィールド shall 既存のヘッダーレイアウトと一貫したデザイン（Tailwindユーティリティクラス）で表示される

### Requirement 3: インクリメンタルサーチによる絞り込み
**Objective:** ユーザーとして、文字を入力するたびにメンバー一覧がリアルタイムで絞り込まれてほしい。目的のメンバーを素早く見つけられるようにするため。

#### Acceptance Criteria
1. When ユーザーが検索フィールドに文字を入力した時, the MemberList shall 入力文字列を含むメンバーのみを表示する（部分一致）
2. When 検索フィールドが空の時, the MemberList shall すべてのメンバーを表示する
3. The MemberList shall 大文字・小文字を区別せずに検索する（ケースインセンシティブ）
4. When 検索結果が0件の時, the MemberList shall 「該当するメンバーが見つかりません」等のメッセージを表示する
5. The MemberList shall 検索後もメンバー数バッジに絞り込み後の件数を反映する（例：「3 名」→ 絞り込み後「1 名」）
6. While 検索が適用されている状態で, the MemberList shall 絞り込まれた結果に対して名称昇順ソートを維持する
