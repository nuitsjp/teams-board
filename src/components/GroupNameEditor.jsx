import { useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';

/**
 * グループ名のインライン編集コンポーネント
 */
export function GroupNameEditor({ groupId, initialName, onSave, disabled = false }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');

  const handleEdit = () => {
    setName(initialName);
    setError('');
    setIsEditing(true);
  };

  const handleCancel = () => {
    setName(initialName);
    setError('');
    setIsEditing(false);
  };

  const validateName = (value) => {
    if (value.length === 0 || value.trim().length === 0) {
      return 'グループ名を入力してください';
    }
    if (value.length > 256) {
      return 'グループ名は256文字以内で入力してください';
    }
    return null;
  };

  const handleSave = async () => {
    const validationError = validateName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    const success = await onSave(groupId, name);
    if (success) {
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (!isEditing) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-text-primary font-medium">{initialName}</span>
        <button
          onClick={handleEdit}
          disabled={disabled}
          className="p-1 text-primary-600 hover:text-primary-800 hover:bg-primary-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="グループ名を編集"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 border border-border-light rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-500"
          placeholder="グループ名を入力"
          autoFocus
        />
        <button
          onClick={handleSave}
          disabled={disabled}
          className="p-2 bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="保存"
        >
          <Save className="w-4 h-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={disabled}
          className="p-2 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="キャンセル"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
