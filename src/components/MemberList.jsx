import { memo, useLayoutEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { formatDuration } from '../utils/format-duration';
import { User, Clock, ChevronRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** メンバー1行の推定高さ（px）: padding 32 + avatar 40 + border 1 */
const ROW_HEIGHT_ESTIMATE = 73;

const MemberRow = memo(function MemberRow({ member, onNavigate }) {
    return (
        <div
            data-testid="member-row"
            onClick={() => onNavigate(`/members/${member.id}`)}
            className="list-accent-warm p-4 px-6 hover:bg-surface-muted cursor-pointer flex justify-between items-center group border-b border-border-light h-full"
        >
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 flex items-center justify-center text-primary-700 font-bold text-sm">
                    {member.name.charAt(0)}
                </div>
                <h3 className="font-medium text-text-primary">{member.name}</h3>
            </div>
            <div className="flex items-center text-sm text-text-secondary gap-4">
                <span className="flex items-center gap-1.5 bg-surface-muted px-2 py-1 rounded">
                    <span className="font-semibold text-text-primary font-display">
                        {member.sessionRevisions.length}
                    </span>{' '}
                    回
                </span>
                <span className="flex items-center gap-1.5 w-24 justify-end">
                    <Clock className="w-4 h-4 text-text-muted" />
                    <span className="font-display">{formatDuration(member.totalDurationSeconds)}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 transition-colors" />
            </div>
        </div>
    );
});

export function MemberList({ members }) {
    const navigate = useNavigate();
    const [inputValue, setInputValue] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [, startTransition] = useTransition();

    const listRef = useRef(null);
    const listOffsetRef = useRef(0);

    useLayoutEffect(() => {
        listOffsetRef.current = listRef.current?.offsetTop ?? 0;
    }, []);

    const handleSearchChange = (e) => {
        const value = e.target.value;
        setInputValue(value);
        startTransition(() => {
            setSearchQuery(value);
        });
    };

    const filteredMembers = useMemo(() => {
        if (searchQuery === '') return members;
        const loweredQuery = searchQuery.toLowerCase();
        return members.filter((member) => member.name.toLowerCase().includes(loweredQuery));
    }, [members, searchQuery]);

    const sortedMembers = useMemo(
        () => filteredMembers.toSorted((a, b) => a.name.localeCompare(b.name, 'ja')),
        [filteredMembers]
    );

    const virtualizer = useWindowVirtualizer({
        count: sortedMembers.length,
        estimateSize: () => ROW_HEIGHT_ESTIMATE,
        overscan: 5,
        scrollMargin: listOffsetRef.current,
    });

    return (
        <div className="card-base">
            {/* 検索ヘッダー — スクロール時にビューポート上部に固定 */}
            <div className="sticky top-16 z-[5] bg-surface rounded-t-2xl p-6 border-b border-border-light flex justify-between items-center gap-4">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 shrink-0">
                    <User className="w-5 h-5 text-primary-600" />
                    メンバー
                </h2>
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input
                        type="text"
                        placeholder="名前で検索..."
                        value={inputValue}
                        onChange={handleSearchChange}
                        className="w-full pl-8 pr-3 py-1.5 text-sm border border-border-light rounded-xl bg-surface focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500"
                    />
                </div>
                <span className="text-xs font-medium bg-primary-50 text-primary-600 px-2.5 py-1 rounded-full shrink-0">
                    {sortedMembers.length} 名
                </span>
            </div>

            {/* 仮想化メンバーリスト — ウィンドウスクロールで表示行のみDOMにレンダリング */}
            {sortedMembers.length === 0 ? (
                <div className="p-8 text-center text-text-muted">
                    該当するメンバーが見つかりません
                </div>
            ) : (
                <div
                    ref={listRef}
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        position: 'relative',
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => (
                        <div
                            key={sortedMembers[virtualRow.index].id}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start - virtualizer.options.scrollMargin}px)`,
                            }}
                        >
                            <MemberRow
                                member={sortedMembers[virtualRow.index]}
                                onNavigate={navigate}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
