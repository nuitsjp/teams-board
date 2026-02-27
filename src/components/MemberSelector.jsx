import { useState, useRef, useEffect, useCallback } from 'react';
import { GraduationCap, X, Plus, Search } from 'lucide-react';

/**
 * 汎用メンバー選択コンポーネント — アイテムリストからの選択と新規追加
 *
 * @param {object} props
 * @param {{ id: string, name: string }[]} props.items - 選択候補アイテムの配列
 * @param {string[]} props.selectedIds - 選択済みアイテム ID の配列
 * @param {function} props.onSelectionChange - 選択変更コールバック（ID 配列を受け取る）
 * @param {function} props.onAddNew - 新規追加コールバック（名前を受け取り、新規 ID を返す）
 * @param {boolean} [props.disabled] - 無効化フラグ
 * @param {string} [props.label] - セクションラベル
 * @param {import('react').ComponentType} [props.icon] - ラベル横のアイコンコンポーネント
 * @param {string} [props.searchPlaceholder] - 検索入力のプレースホルダー
 * @param {function} [props.addNewLabelFn] - 新規追加ラベル生成関数
 * @param {boolean} [props.multiple] - 複数選択モード（デフォルト: true）
 */
export function MemberSelector({
    items = [],
    selectedIds = [],
    onSelectionChange,
    onAddNew,
    disabled = false,
    label = '講師',
    icon: Icon = GraduationCap,
    searchPlaceholder = 'メンバーを検索または新規追加...',
    addNewLabelFn = (name) => `「${name}」を新しい${label}として追加`,
    multiple = true,
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

    // アイテム名のマッピング
    const itemMap = new Map(items.map((item) => [item.id, item.name]));

    // 未選択アイテムのフィルタリング
    const filteredItems = items.filter((item) => {
        if (selectedIds.includes(item.id)) return false;
        if (!searchText.trim()) return true;
        return item.name.toLowerCase().includes(searchText.toLowerCase());
    });

    // 入力テキストが既存アイテムに完全一致しない場合、新規追加候補として表示
    const trimmedSearch = searchText.trim();
    const isExactMatch = items.some(
        (item) => item.name.toLowerCase() === trimmedSearch.toLowerCase()
    );
    const showAddNew = trimmedSearch.length > 0 && !isExactMatch;

    const handleSelectItem = useCallback(
        (itemId) => {
            if (disabled) return;
            const newIds = multiple ? [...selectedIds, itemId] : [itemId];
            onSelectionChange(newIds);
            setSearchText('');
            setIsDropdownOpen(false);
        },
        [selectedIds, onSelectionChange, disabled, multiple]
    );

    const handleRemoveItem = useCallback(
        (itemId) => {
            if (disabled) return;
            const newIds = selectedIds.filter((id) => id !== itemId);
            onSelectionChange(newIds);
        },
        [selectedIds, onSelectionChange, disabled]
    );

    const handleAddNew = useCallback(async () => {
        if (disabled || !trimmedSearch) return;
        const newId = await onAddNew(trimmedSearch);
        if (newId) {
            const newIds = multiple ? [...selectedIds, newId] : [newId];
            onSelectionChange(newIds);
        }
        setSearchText('');
        setIsDropdownOpen(false);
    }, [disabled, trimmedSearch, onAddNew, selectedIds, onSelectionChange, multiple]);

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
                <Icon className="w-4 h-4 text-text-muted" aria-hidden="true" />
                <span className="text-sm font-medium text-text-primary">{label}</span>
            </div>

            {/* 選択済みアイテムのタグ表示 */}
            {selectedIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3" role="list" aria-label={`選択済み${label}`}>
                    {selectedIds.map((id) => (
                        <span
                            key={id}
                            role="listitem"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary-50 text-primary-700 rounded-lg text-xs font-medium"
                        >
                            {itemMap.get(id) ?? id}
                            <button
                                type="button"
                                onClick={() => handleRemoveItem(id)}
                                disabled={disabled}
                                className="inline-flex items-center justify-center w-4 h-4 rounded-full hover:bg-primary-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label={`${itemMap.get(id) ?? id} を削除`}
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
                        placeholder={searchPlaceholder}
                        aria-label={`${label}を検索`}
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
                        aria-label={`${label}候補`}
                    >
                        {filteredItems.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="option"
                                aria-selected={false}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-muted transition-colors first:rounded-t-xl last:rounded-b-xl"
                                onClick={() => handleSelectItem(item.id)}
                            >
                                {item.name}
                            </button>
                        ))}

                        {/* 新規追加オプション */}
                        {showAddNew && (
                            <button
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 transition-colors flex items-center gap-2 border-t border-border-light"
                                onClick={handleAddNew}
                            >
                                <Plus className="w-4 h-4" aria-hidden="true" />
                                {addNewLabelFn(trimmedSearch)}
                            </button>
                        )}

                        {filteredItems.length === 0 && !showAddNew && (
                            <div className="px-3 py-2 text-sm text-text-muted">
                                該当するアイテムがありません
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 講師選択コンポーネント — MemberSelector の後方互換ラッパー
 */
export function InstructorSelector({
    members = [],
    selectedInstructorIds = [],
    onInstructorChange,
    onAddNewMember,
    disabled = false,
}) {
    return (
        <MemberSelector
            items={members}
            selectedIds={selectedInstructorIds}
            onSelectionChange={onInstructorChange}
            onAddNew={onAddNewMember}
            disabled={disabled}
            label="講師"
            icon={GraduationCap}
            searchPlaceholder="メンバーを検索または新規追加..."
            addNewLabelFn={(name) => `「${name}」を新しい講師として追加`}
            multiple={true}
        />
    );
}
