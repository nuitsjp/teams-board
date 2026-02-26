import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { MemberList } from '../../../src/components/MemberList.jsx';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: vi.fn(),
  };
});

// テスト用メンバーデータ（意図的にソート順をバラバラにする）
const mockMembers = [
  { id: 'm1', name: '佐藤', totalDurationSeconds: 3600, sessionRevisions: ['s1', 's2'] },
  { id: 'm2', name: '加藤', totalDurationSeconds: 1800, sessionRevisions: ['s1'] },
  { id: 'm3', name: '中島', totalDurationSeconds: 7200, sessionRevisions: ['s1', 's2', 's3'] },
  { id: 'm4', name: 'Alice', totalDurationSeconds: 900, sessionRevisions: ['s1'] },
];

const renderMemberList = (members = mockMembers) => {
  return render(
    <MemoryRouter>
      <MemberList members={members} />
    </MemoryRouter>
  );
};

describe('MemberList', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useNavigate.mockReturnValue(mockNavigate);
  });

  describe('メンバー行クリック', () => {
    it('メンバー行をクリックすると詳細ページに遷移すること', () => {
      renderMemberList();

      const rows = screen.getAllByTestId('member-row');
      fireEvent.click(rows[0]);

      expect(mockNavigate).toHaveBeenCalledWith(expect.stringMatching(/^\/members\//));
    });
  });

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
        { id: 'm1', name: 'Bob', totalDurationSeconds: 100, sessionRevisions: ['s1'] },
        { id: 'm2', name: '伊藤', totalDurationSeconds: 200, sessionRevisions: ['s1'] },
        { id: 'm3', name: 'Alice', totalDurationSeconds: 300, sessionRevisions: ['s1'] },
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

    it('長いメンバー名に truncate と tooltip が適用されること', () => {
      const longNameMembers = [
        {
          id: 'm-long',
          name: '複合ＳＩ・ソリューション勉強会メンバー太郎',
          totalDurationSeconds: 3600,
          sessionRevisions: ['s1'],
        },
      ];
      renderMemberList(longNameMembers);

      const heading = screen.getByText('複合ＳＩ・ソリューション勉強会メンバー太郎');
      expect(heading).toHaveClass('truncate');

      // ツールチップ用の data-fulltext 属性がラッパーに設定されていること
      const tooltipWrapper = heading.closest('[data-fulltext]');
      expect(tooltipWrapper).toHaveAttribute(
        'data-fulltext',
        '複合ＳＩ・ソリューション勉強会メンバー太郎'
      );
      expect(tooltipWrapper).toHaveClass('truncate-with-tooltip');
    });

    it('テキスト省略時にホバーで data-truncated が付与されること', () => {
      renderMemberList();

      const heading = screen.getByText('佐藤');
      const tooltipWrapper = heading.closest('[data-fulltext]');
      const truncateEl = tooltipWrapper.querySelector('.truncate');

      // scrollWidth > clientWidth をモックして省略状態をシミュレート
      Object.defineProperty(truncateEl, 'scrollWidth', { value: 200, configurable: true });
      Object.defineProperty(truncateEl, 'clientWidth', { value: 100, configurable: true });

      fireEvent.mouseEnter(tooltipWrapper);
      expect(tooltipWrapper).toHaveAttribute('data-truncated');

      fireEvent.mouseLeave(tooltipWrapper);
      expect(tooltipWrapper).not.toHaveAttribute('data-truncated');
    });

    it('テキスト非省略時にホバーしても data-truncated が付与されないこと', () => {
      renderMemberList();

      const heading = screen.getByText('佐藤');
      const tooltipWrapper = heading.closest('[data-fulltext]');
      const truncateEl = tooltipWrapper.querySelector('.truncate');

      // scrollWidth === clientWidth（省略なし）
      Object.defineProperty(truncateEl, 'scrollWidth', { value: 100, configurable: true });
      Object.defineProperty(truncateEl, 'clientWidth', { value: 100, configurable: true });

      fireEvent.mouseEnter(tooltipWrapper);
      expect(tooltipWrapper).not.toHaveAttribute('data-truncated');
    });

    it('検索フィルタ適用後もソート順が維持されること', () => {
      const members = [
        { id: 'm1', name: '佐藤一郎', totalDurationSeconds: 100, sessionRevisions: ['s1'] },
        { id: 'm2', name: '加藤', totalDurationSeconds: 200, sessionRevisions: ['s1'] },
        { id: 'm3', name: '佐藤二郎', totalDurationSeconds: 300, sessionRevisions: ['s1'] },
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

  describe('講師回数の表示', () => {
    it('instructorCount > 0 のメンバーに講師回数バッジが表示されること', () => {
      const members = [
        { id: 'm1', name: '佐藤', totalDurationSeconds: 3600, instructorCount: 3, sessionRevisions: ['s1'] },
      ];
      renderMemberList(members);

      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('回')).toBeInTheDocument();
    });

    it('instructorCount が 0 のメンバーには講師回数バッジが表示されないこと', () => {
      const members = [
        { id: 'm1', name: '佐藤', totalDurationSeconds: 3600, instructorCount: 0, sessionRevisions: ['s1'] },
      ];
      renderMemberList(members);

      expect(screen.queryByText('回')).not.toBeInTheDocument();
    });

    it('instructorCount 未設定のメンバー（既存データ互換）でも正常に表示されること', () => {
      // mockMembers には instructorCount がないが、エラーなく表示される
      renderMemberList();

      const rows = screen.getAllByTestId('member-row');
      expect(rows).toHaveLength(4);
      // 「回」テキストは講師バッジ由来のものが表示されないこと
      expect(screen.queryByText('回')).not.toBeInTheDocument();
    });
  });
});
