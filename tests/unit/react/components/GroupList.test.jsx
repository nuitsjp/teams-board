import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { GroupList } from '../../../../src/components/GroupList.jsx';

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

  it('主催者名が設定されている場合に表示されること', () => {
    const groupsWithOrganizer = [
      { id: 'g1', name: 'フロントエンド勉強会', organizerId: 'org1', totalDurationSeconds: 3600, sessionRevisions: ['s1/0'] },
    ];
    const organizers = [{ id: 'org1', name: 'フロントエンド推進室' }];

    render(
      <MemoryRouter>
        <GroupList groups={groupsWithOrganizer} organizers={organizers} />
      </MemoryRouter>
    );

    expect(screen.getByText('フロントエンド推進室')).toBeInTheDocument();
  });

  it('organizerId が存在するが organizers に見つからない場合は主催者が表示されないこと', () => {
    const groupsWithUnknownOrganizer = [
      { id: 'g1', name: 'フロントエンド勉強会', organizerId: 'unknown-org', totalDurationSeconds: 3600, sessionRevisions: ['s1/0'] },
    ];

    render(
      <MemoryRouter>
        <GroupList groups={groupsWithUnknownOrganizer} organizers={[]} />
      </MemoryRouter>
    );

    // グループ名は表示されるが、主催者セクション（text-xs text-text-muted の子テキスト）は表示されない
    expect(screen.getByText('フロントエンド勉強会')).toBeInTheDocument();
    const row = screen.getByTestId('group-row');
    // organizerName が null/undefined なので主催者表示の div (.text-xs.text-text-muted with Building2) は存在しない
    expect(row.querySelector('.lucide-building-2')).not.toBeInTheDocument();
  });

  it('organizerId が null の場合は主催者が表示されないこと', () => {
    const groupsWithNullOrganizer = [
      { id: 'g1', name: 'フロントエンド勉強会', organizerId: null, totalDurationSeconds: 3600, sessionRevisions: ['s1/0'] },
    ];

    render(
      <MemoryRouter>
        <GroupList groups={groupsWithNullOrganizer} organizers={[{ id: 'org1', name: 'テスト主催者' }]} />
      </MemoryRouter>
    );

    expect(screen.queryByText('テスト主催者')).not.toBeInTheDocument();
  });
});
