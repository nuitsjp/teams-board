import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { OrganizerList } from '../../../src/components/OrganizerList.jsx';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return { ...actual, useNavigate: () => mockNavigate };
});

const mockOrganizers = [
    { id: 'org1', name: 'フロントエンド推進室' },
    { id: 'org2', name: '技術戦略部' },
];

const mockGroups = [
    { id: 'g1', name: 'グループA', organizerId: 'org1', totalDurationSeconds: 3600, sessionRevisions: ['s1', 's2'] },
    { id: 'g2', name: 'グループB', organizerId: 'org1', totalDurationSeconds: 1800, sessionRevisions: ['s3'] },
    { id: 'g3', name: 'グループC', organizerId: 'org2', totalDurationSeconds: 7200, sessionRevisions: ['s4'] },
    { id: 'g4', name: 'グループD', organizerId: null, totalDurationSeconds: 900, sessionRevisions: ['s5'] },
];

describe('OrganizerList', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('主催者一覧が表示されること', () => {
        render(
            <MemoryRouter>
                <OrganizerList organizers={mockOrganizers} groups={mockGroups} />
            </MemoryRouter>
        );

        expect(screen.getByText('主催者')).toBeInTheDocument();
        expect(screen.getByText('フロントエンド推進室')).toBeInTheDocument();
        expect(screen.getByText('技術戦略部')).toBeInTheDocument();
    });

    it('各主催者のグループ数が正しく表示されること', () => {
        render(
            <MemoryRouter>
                <OrganizerList organizers={mockOrganizers} groups={mockGroups} />
            </MemoryRouter>
        );

        const rows = screen.getAllByTestId('organizer-row');
        // org1: グループA, グループB → 2グループ
        expect(rows[0]).toHaveTextContent('2');
        expect(rows[0]).toHaveTextContent('グループ');
        // org2: グループC → 1グループ
        expect(rows[1]).toHaveTextContent('1');
    });

    it('主催者クリックで詳細ページに遷移すること', async () => {
        const user = userEvent.setup();

        render(
            <MemoryRouter>
                <OrganizerList organizers={mockOrganizers} groups={mockGroups} />
            </MemoryRouter>
        );

        const rows = screen.getAllByTestId('organizer-row');
        await user.click(rows[0]);

        expect(mockNavigate).toHaveBeenCalledWith('/organizers/org1');
    });
});
