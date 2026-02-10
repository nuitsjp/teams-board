import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MemberList } from '../../../src/components/MemberList.jsx';

// テスト用メンバーデータ（意図的にソート順をバラバラにする）
const mockMembers = [
  { id: 'm1', name: '佐藤', totalDurationSeconds: 3600, sessionIds: ['s1', 's2'] },
  { id: 'm2', name: '加藤', totalDurationSeconds: 1800, sessionIds: ['s1'] },
  { id: 'm3', name: '中島', totalDurationSeconds: 7200, sessionIds: ['s1', 's2', 's3'] },
  { id: 'm4', name: 'Alice', totalDurationSeconds: 900, sessionIds: ['s1'] },
];

const renderMemberList = (members = mockMembers) => {
  return render(
    <MemoryRouter>
      <MemberList members={members} />
    </MemoryRouter>
  );
};

describe('MemberList', () => {
  describe('名称昇順ソート', () => {
    it('メンバーが名称の昇順で表示されること', () => {
      renderMemberList();

      const rows = screen.getAllByTestId('member-row');
      const names = rows.map((row) => row.querySelector('h3').textContent);

      // localeCompare('ja') による昇順: Alice → 加藤 → 佐藤 → 中島
      expect(names).toEqual(['Alice', '加藤', '佐藤', '中島']);
    });

    it('日本語名・英語名が混在しても正しくソートされること', () => {
      const mixedMembers = [
        { id: 'm1', name: 'Bob', totalDurationSeconds: 100, sessionIds: ['s1'] },
        { id: 'm2', name: '伊藤', totalDurationSeconds: 200, sessionIds: ['s1'] },
        { id: 'm3', name: 'Alice', totalDurationSeconds: 300, sessionIds: ['s1'] },
      ];
      renderMemberList(mixedMembers);

      const rows = screen.getAllByTestId('member-row');
      const names = rows.map((row) => row.querySelector('h3').textContent);

      // localeCompare('ja') でソートされること（参加時間順ではないこと）
      expect(names[0]).toBe('Alice');
      expect(names[1]).toBe('Bob');
    });
  });

  describe('検索入力コントロール', () => {
    it('検索入力フィールドが表示されること', () => {
      renderMemberList();

      const searchInput = screen.getByPlaceholderText('名前で検索...');
      expect(searchInput).toBeInTheDocument();
    });

    it('検索入力フィールドが「メンバー」見出しの後に表示されること', () => {
      renderMemberList();

      expect(screen.getByText('メンバー')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('名前で検索...')).toBeInTheDocument();
    });
  });

  describe('インクリメンタルサーチ', () => {
    it('検索文字列を含むメンバーのみ表示されること（部分一致）', () => {
      renderMemberList();

      const searchInput = screen.getByPlaceholderText('名前で検索...');
      fireEvent.change(searchInput, { target: { value: '加藤' } });

      const rows = screen.getAllByTestId('member-row');
      expect(rows).toHaveLength(1);
      expect(screen.getByText('加藤')).toBeInTheDocument();
    });

    it('検索フィールドが空の場合すべてのメンバーが表示されること', () => {
      renderMemberList();

      const searchInput = screen.getByPlaceholderText('名前で検索...');
      // 一度検索してからクリア
      fireEvent.change(searchInput, { target: { value: '加藤' } });
      fireEvent.change(searchInput, { target: { value: '' } });

      const rows = screen.getAllByTestId('member-row');
      expect(rows).toHaveLength(4);
    });

    it('大文字・小文字を区別せずに検索できること', () => {
      renderMemberList();

      const searchInput = screen.getByPlaceholderText('名前で検索...');
      fireEvent.change(searchInput, { target: { value: 'alice' } });

      const rows = screen.getAllByTestId('member-row');
      expect(rows).toHaveLength(1);
      expect(screen.getByText('Alice')).toBeInTheDocument();
    });

    it('検索結果が0件の場合メッセージが表示されること', () => {
      renderMemberList();

      const searchInput = screen.getByPlaceholderText('名前で検索...');
      fireEvent.change(searchInput, { target: { value: '存在しない名前' } });

      expect(screen.queryAllByTestId('member-row')).toHaveLength(0);
      expect(screen.getByText('該当するメンバーが見つかりません')).toBeInTheDocument();
    });

    it('メンバー数バッジが絞り込み後の件数を反映すること', () => {
      renderMemberList();

      // 初期状態: 4名
      expect(screen.getByText('4 名')).toBeInTheDocument();

      const searchInput = screen.getByPlaceholderText('名前で検索...');
      fireEvent.change(searchInput, { target: { value: '加藤' } });

      // 絞り込み後: 1名
      expect(screen.getByText('1 名')).toBeInTheDocument();
      expect(screen.queryByText('4 名')).not.toBeInTheDocument();
    });

    it('検索フィルタ適用後もソート順が維持されること', () => {
      const members = [
        { id: 'm1', name: '佐藤一郎', totalDurationSeconds: 100, sessionIds: ['s1'] },
        { id: 'm2', name: '加藤', totalDurationSeconds: 200, sessionIds: ['s1'] },
        { id: 'm3', name: '佐藤二郎', totalDurationSeconds: 300, sessionIds: ['s1'] },
      ];
      renderMemberList(members);

      const searchInput = screen.getByPlaceholderText('名前で検索...');
      fireEvent.change(searchInput, { target: { value: '佐藤' } });

      const rows = screen.getAllByTestId('member-row');
      const names = rows.map((row) => row.querySelector('h3').textContent);

      // フィルタ後も名称昇順
      expect(names).toEqual(['佐藤一郎', '佐藤二郎']);
    });
  });
});
