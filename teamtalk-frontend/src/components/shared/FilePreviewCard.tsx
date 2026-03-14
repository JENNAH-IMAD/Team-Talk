import React from 'react';
import { X, FileText, FileArchive, FileSpreadsheet, File, Film } from 'lucide-react';
import type { PendingAttachment } from '@/types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(contentType: string) {
  if (contentType.startsWith('image/')) return null; // shows thumbnail
  if (contentType.startsWith('video/')) return <Film size={20} className="text-purple-500" />;
  if (contentType === 'application/pdf') return <FileText size={20} className="text-red-500" />;
  if (contentType.includes('zip')) return <FileArchive size={20} className="text-amber-500" />;
  if (contentType.includes('spreadsheet') || contentType.includes('excel')) return <FileSpreadsheet size={20} className="text-emerald-500" />;
  return <File size={20} className="text-brand-500" />;
}

interface FilePreviewCardProps {
  file: PendingAttachment;
  onRemove: () => void;
}

const FilePreviewCard: React.FC<FilePreviewCardProps> = ({ file, onRemove }) => {
  const isImage = file.contentType.startsWith('image/');

  return (
    <div className="relative group flex-shrink-0">
      {isImage && file.previewUrl ? (
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-subtle">
          <img src={file.previewUrl} alt={file.fileName} className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="flex items-center gap-2 h-12 px-3 bg-surface-100 dark:bg-surface-800 rounded-lg border border-subtle max-w-[180px]">
          {fileIcon(file.contentType)}
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate max-w-[120px]">{file.fileName}</p>
            <p className="text-[10px] text-gray-400">{formatBytes(file.fileSize)}</p>
          </div>
        </div>
      )}
      <button
        onClick={onRemove}
        className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
      >
        <X size={9} strokeWidth={3} />
      </button>
    </div>
  );
};

export default FilePreviewCard;
