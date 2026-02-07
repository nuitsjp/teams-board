import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudyGroupList } from '../../../src/components/StudyGroupList.jsx';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockGroups = [
  { id: 'g1', name: 'もくもく勉強会', totalDurationSeconds: 3600, sessionIds: ['s1', 's2'] },
  { id: 'g2', name: 'React読書会', totalDurationSeconds: 1800, sessionIds: ['s3'] },
];

const renderStudyGroupList = (groups = mockGroups) => {
  return render(
    <MemoryRouter>
      <StudyGroupList groups={groups} />
    </MemoryRouter>
  );
};

describe('StudyGroupList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('勉強会一覧が表示されること', () => {
    renderStudyGroupList();

    expect(screen.getByText('もくもく勉強会')).toBeInTheDocument();
    expect(screen.getByText('React読書会')).toBeInTheDocument();
  });

  it('勉強会をクリックすると詳細ページに遷移すること', () => {
    renderStudyGroupList();

    const rows = screen.getAllByTestId('study-group-row');
    fireEvent.click(rows[0]);

    expect(mockNavigate).toHaveBeenCalledWith('/study-groups/g1');
  });

  it('各勉強会項目がクリック可能なスタイルであること', () => {
    renderStudyGroupList();

    const rows = screen.getAllByTestId('study-group-row');
    for (const row of rows) {
      expect(row).toHaveClass('cursor-pointer');
    }
  });

  it('開催回数と学習時間が表示されること', () => {
    renderStudyGroupList();

    // もくもく勉強会: 2回開催
    const rows = screen.getAllByTestId('study-group-row');
    expect(rows[0]).toHaveTextContent('2');
    expect(rows[0]).toHaveTextContent('回開催');
    // React読書会: 1回開催
    expect(rows[1]).toHaveTextContent('1');
    expect(rows[1]).toHaveTextContent('回開催');
  });
});
