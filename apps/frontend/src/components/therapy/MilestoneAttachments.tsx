import { useRef, useState } from 'react';
import { Download, Loader2, Paperclip, Trash2, Upload } from 'lucide-react';
import { cn } from '../../lib/utils';
import { therapyPlanApi } from '../../lib/therapyPlanApi';
import {
  useDeleteAttachment,
  useSetAttachmentInExport,
  useUploadMilestoneAttachment,
} from '../../hooks/useTherapyPlanQueries';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_MIME_TYPES } from '@budget/shared';
import type { AttachmentMimeTypeDTO, MilestoneAttachmentDTO } from '@budget/shared';

/**
 * Browsers are unreliable about `file.type`: it comes back empty for a HEIC on
 * some platforms and as `image/jpg` on others. The extension is the fallback,
 * and between the two one of them always answers.
 */
const BY_EXTENSION: Record<string, AttachmentMimeTypeDTO> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  heic: 'image/heic',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
};

const ACCEPT = '.pdf,.jpg,.jpeg,.png,.heic,.webp,.txt,.csv';

function resolveMimeType(file: File): AttachmentMimeTypeDTO | null {
  if ((ATTACHMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    return file.type as AttachmentMimeTypeDTO;
  }
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return BY_EXTENSION[extension] ?? null;
}

function readBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // readAsDataURL gives "data:<mime>;base64,<payload>"; only the payload
      // is sent, so the server never has to trust a prefix
      const result = String(reader.result);
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Impossibile leggere il file'));
    reader.readAsDataURL(file);
  });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface MilestoneAttachmentsProps {
  milestoneId: string;
  attachments: MilestoneAttachmentDTO[];
}

/**
 * The reports filed under a date on the schedule.
 *
 * The checkbox is the point of the whole block: a file lives here for as long
 * as it is useful, but only the ones ticked travel into the next export. An
 * export built for a model is a thing you compose, not everything ever
 * uploaded sent along by default.
 */
export function MilestoneAttachments({ milestoneId, attachments }: MilestoneAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const upload = useUploadMilestoneAttachment();
  const setInExport = useSetAttachmentInExport();
  const removeAttachment = useDeleteAttachment();

  const handleFile = async (file: File) => {
    setError(null);
    if (file.size > ATTACHMENT_MAX_BYTES) {
      setError(`«${file.name}» supera ${Math.round(ATTACHMENT_MAX_BYTES / (1024 * 1024))} MB`);
      return;
    }
    const mimeType = resolveMimeType(file);
    if (!mimeType) {
      setError('Formato non supportato: PDF, immagini, TXT o CSV');
      return;
    }
    try {
      const content = await readBase64(file);
      await upload.mutateAsync({ milestoneId, data: { fileName: file.name, mimeType, content } });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Caricamento non riuscito');
    }
  };

  const handleDownload = async (attachment: MilestoneAttachmentDTO) => {
    setError(null);
    setDownloadingId(attachment.id);
    try {
      await therapyPlanApi.downloadAttachment(attachment.id, attachment.fileName);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Download non riuscito');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="mt-2">
      {attachments.length > 0 && (
        <ul className="mb-1.5 space-y-1">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1"
            >
              <Paperclip className="w-3 h-3 shrink-0 text-slate-400" />
              <button
                type="button"
                onClick={() => void handleDownload(attachment)}
                disabled={downloadingId === attachment.id}
                className="min-w-0 flex-1 truncate text-left text-[11px] text-slate-600 hover:text-slate-900 hover:underline"
                title={`Scarica ${attachment.fileName}`}
              >
                {attachment.fileName}
              </button>
              <span className="shrink-0 text-[10px] text-slate-400">
                {formatSize(attachment.sizeBytes)}
              </span>
              <label
                className={cn(
                  'flex shrink-0 items-center gap-1 rounded px-1 text-[10px] cursor-pointer',
                  attachment.includeInExport ? 'text-emerald-700' : 'text-slate-400'
                )}
                title="Includi questo file nel prossimo export per l’AI"
              >
                <input
                  type="checkbox"
                  checked={attachment.includeInExport}
                  onChange={(e) =>
                    setInExport.mutate({ id: attachment.id, includeInExport: e.target.checked })
                  }
                  className="w-3 h-3 accent-emerald-600"
                />
                export
              </label>
              {downloadingId === attachment.id ? (
                <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-slate-400" />
              ) : (
                <Download className="w-3.5 h-3.5 shrink-0 text-slate-300" />
              )}
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Eliminare «${attachment.fileName}»?`)) {
                    removeAttachment.mutate(attachment.id);
                  }
                }}
                className="shrink-0 rounded p-0.5 text-slate-400 hover:text-red-600"
                aria-label={`Elimina ${attachment.fileName}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared straight away, or picking the same file twice in a row
          // fires no change event the second time
          e.target.value = '';
          if (file) void handleFile(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={upload.isPending}
        className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 disabled:opacity-50"
      >
        {upload.isPending ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Upload className="w-3.5 h-3.5" />
        )}
        Allega referto
      </button>

      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
