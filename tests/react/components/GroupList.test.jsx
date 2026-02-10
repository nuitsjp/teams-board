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
  { id: 'g1', name: 'フロントエンド勉強会', totalDurationSeconds: 3600, sessionIds: ['s1', 's2'] },
  { id: 'g2', name: 'TypeScript読書会', totalDurationSeconds: 1800, sessionIds: ['s3'] },
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

  it('開催回数と学習時間が表示されること', () => {
    renderGroupList();

    const rows = screen.getAllByTestId('group-row');
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[0]).toHaveTextContent('回開催');
    expect(rows[1]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('回開催');
  });
});
