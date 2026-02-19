import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GroupList } from '../../../src/components/GroupList.jsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGroups = [
  { id: 'g1', name: 'フロントエンド勉強会', totalDurationSeconds: 3600, sessionRevisions: ['s1/0', 's2/0'] },
  { id: 'g2', name: 'TypeScript読書会', totalDurationSeconds: 1800, sessionRevisions: ['s3/0'] },
];

const renderGroupList = (groups = mockGroups) => {
  return render(
    <MemoryRouter>
      <GroupList groups={groups} />
    </MemoryRouter>
  );
};

describe('GroupList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('グループ一覧が表示されること', () => {
    renderGroupList();

    expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    expect(screen.getByText('TypeScript読書会')).toBeInTheDocument();
  });

  it('グループをクリックすると詳細ページに遷移すること', () => {
    renderGroupList();

    const rows = screen.getAllByTestId('group-row');
    fireEvent.click(rows[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/groups/g1');
  });

  it('各グループ項目がクリック可能なスタイルであること', () => {
    renderGroupList();

    const rows = screen.getAllByTestId('group-row');
    for (const row of rows) {
      expect(row).toHaveClass('cursor-pointer');
    }
  });

  it('長いグループ名に truncate と tooltip が適用されること', () => {
    const longNameGroups = [
      {
        id: 'g-long',
        name: '複合ＳＩ・ソリューション勉強会',
        totalDurationSeconds: 3600,
        sessionRevisions: ['s1/0'],
      },
    ];
    renderGroupList(longNameGroups);

    const heading = screen.getByText('複合ＳＩ・ソリューション勉強会');
    expect(heading).toHaveClass('truncate');

    // ツールチップ用の data-fulltext 属性がラッパーに設定されていること
    const tooltipWrapper = heading.closest('[data-fulltext]');
    expect(tooltipWrapper).toHaveAttribute('data-fulltext', '複合ＳＩ・ソリューション勉強会');
    expect(tooltipWrapper).toHaveClass('truncate-with-tooltip');
  });

  it('テキスト省略時にホバーで data-truncated が付与されること', () => {
    renderGroupList();

    const heading = screen.getByText('フロントエンド勉強会');
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
    renderGroupList();

    const heading = screen.getByText('フロントエンド勉強会');
    const tooltipWrapper = heading.closest('[data-fulltext]');
    const truncateEl = tooltipWrapper.querySelector('.truncate');

    // scrollWidth === clientWidth（省略なし）
    Object.defineProperty(truncateEl, 'scrollWidth', { value: 100, configurable: true });
    Object.defineProperty(truncateEl, 'clientWidth', { value: 100, configurable: true });

    fireEvent.mouseEnter(tooltipWrapper);
    expect(tooltipWrapper).not.toHaveAttribute('data-truncated');
  });

  it('開催回数と参加時間が表示されること', () => {
    renderGroupList();

    const rows = screen.getAllByTestId('group-row');
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[0]).toHaveTextContent('回開催');
    expect(rows[1]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('回開催');
  });
});
