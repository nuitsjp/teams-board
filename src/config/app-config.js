/**
 * アプリケーション共通設定
 *
 * blobBaseUrl はビルド時に環境変数 VITE_BLOB_BASE_URL で指定可能。
 * Deploy-StaticFiles.ps1 がストレージアカウント名から自動設定する。
 */
export const APP_CONFIG = {
  blobBaseUrl:
    import.meta.env.VITE_BLOB_BASE_URL || 'https://strjstudylogprod.blob.core.windows.net/$web',
};
