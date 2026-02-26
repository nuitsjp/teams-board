import { useState, useRef, useEffect, useCallback } from 'react';
import { GraduationCap, X, Plus, Search } from 'lucide-react';

/**
 * 講師選択コンポーネント — 既存メンバーからの選択と新規講師の手入力追加
 */
export function InstructorSelector({
    members = [],
    selectedInstructorIds = [],
    onInstructorChange,
    onAddNewMember,
    disabled = false,
}) {
    const [searchText, setSearchText] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const containerRef = useRef(null);
    const inputRef = useRef(null);

    // ドロップダウン外クリックで閉じる
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // メンバー名のマッピング
    const memberMap = new Map(members.map((m) => [m.id, m.name]));

    // 未選択メンバーのフィルタリング
    const filteredMembers = members.filter((m) => {
        if (selectedInstructorIds.includes(m.id)) return false;
        if (!searchText.trim()) return true;
        return m.name.toLowerCase().includes(searchText.toLowerCase());
    });

    // 入力テキストが既存メンバーに完全一致しない場合、新規追加候補として表示
    const trimmedSearch = searchText.trim();
    const isExactMatch = members.some(
        (m) => m.name.toLowerCase() === trimmedSearch.toLowerCase()
    );
    const showAddNew = trimmedSearch.length > 0 && !isExactMatch;

    const handleSelectMember = useCallback(
        (memberId) => {
            if (disabled) return;
            const newIds = [...selectedInstructorIds, memberId];
            onInstructorChange(newIds);
            setSearchText('');
            setIsDropdownOpen(false);
        },
        [selectedInstructorIds, onInstructorChange, disabled]
    );

    const handleRemoveInstructor = useCallback(
        (memberId) => {
            if (disabled) return;
            const newIds = selectedInstructorIds.filter((id) => id !== memberId);
            onInstructorChange(newIds);
        },
        [selectedInstructorIds, onInstructorChange, disabled]
    );

    const handleAddNewMember = useCallback(async () => {
        if (disabled || !trimmedSearch) return;
        const newMemberId = await onAddNewMember(trimmedSearch);
        if (newMemberId) {
            const newIds = [...selectedInstructorIds, newMemberId];
            onInstructorChange(newIds);
        }
        setSearchText('');
        setIsDropdownOpen(false);
    }, [disabled, trimmedSearch, onAddNewMember, selectedInstructorIds, onInstructorChange]);

    const handleInputFocus = () => {
        if (!disabled) setIsDropdownOpen(true);
    };

    const handleInputChange = (event) => {
        setSearchText(event.target.value);
        if (!isDropdownOpen) setIsDropdownOpen(true);
    };

    const handleKeyDown = (event) => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape') {
            setIsDropdownOpen(false);
            inputRef.current?.blur();
        }
    };

    return (
        <div className="pt-4 border-t border-border-light">
            <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-4 h-4 text-text-muted" aria-hidden="true" />
                <span className="text-sm font-medium text-text-primary">講師</span>
            </div>

            {/* 選択済み講師のタグ表示 */}
            {selectedInstructorIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3" role="list" aria-label="選択済み講師">
                    {selectedInstructorIds.map((id) => (
                        <span
                            key={id}
                            role="listitem"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium"
                        >
                            {memberMap.get(id) ?? id}
                            <button
                                type="button"
                                onClick={() => handleRemoveInstructor(id)}
                                disabled={disabled}
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label={`${memberMap.get(id) ?? id} を削除`}
                            >
                                <X className="w-3 h-3" aria-hidden="true" />
                            </button>
                        </span>
                    ))}
                </div>
            )}

            {/* 検索入力 + ドロップダウン */}
            <div ref={containerRef} className="relative">
                <div className="relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none"
                        aria-hidden="true"
                    />
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchText}
                        onChange={handleInputChange}
                        onFocus={handleInputFocus}
                        onKeyDown={handleKeyDown}
                        disabled={disabled}
                        className="w-full pl-9 pr-3 py-2 border border-border-light rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500 disabled:bg-surface-muted disabled:cursor-not-allowed"
                        placeholder="メンバーを検索または新規追加..."
                        aria-label="講師を検索"
                        aria-expanded={isDropdownOpen}
                        role="combobox"
                        aria-haspopup="listbox"
                    />
                </div>

                {/* ドロップダウンメニュー */}
                {isDropdownOpen && !disabled && (
                    <div
                        className="absolute z-10 mt-1 w-full bg-white border border-border-light rounded-xl shadow-lg max-h-48 overflow-y-auto"
                        role="listbox"
                        aria-label="メンバー候補"
                    >
                        {filteredMembers.map((member) => (
                            <button
                                key={member.id}
                                type="button"
                                role="option"
                                aria-selected={false}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
                                onClick={() => handleSelectMember(member.id)}
                            >
                                {member.name}
                            </button>
                        ))}

                        {/* 新規講師追加オプション */}
                        {showAddNew && (
                            <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors flex items-center gap-2 border-t border-border-light"
                                onClick={handleAddNewMember}
                            >
                                <Plus className="w-4 h-4" aria-hidden="true" />
                                「{trimmedSearch}」を新しい講師として追加
                            </button>
                        )}

                        {filteredMembers.length === 0 && !showAddNew && (
                            <div className="px-3 py-2 text-sm text-text-muted">
                                該当するメンバーがありません
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
