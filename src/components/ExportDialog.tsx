import { CheckCircle2, Download, LoaderCircle, X } from "lucide-react";
import type { RenderStatus } from "../types";

interface Props {
  open: boolean;
  status: RenderStatus;
  progress: number;
  error?: string;
  downloadUrl?: string;
  downloadName?: string;
  exportFormat?: "MP4" | "WebM";
  onExport: () => void;
  onClose: () => void;
}

export function ExportDialog({ open, status, progress, error, downloadUrl, downloadName, exportFormat, onExport, onClose }: Props) {
  if (!open) return null;
  const busy = status === "rendering";
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <button className="icon-button export-close" onClick={onClose} disabled={busy} aria-label="Close"><X /></button>
        {status === "complete" ? (
          <>
            <CheckCircle2 className="success-icon" size={44} />
            <h2 id="export-title">Your story is ready</h2>
            <p>Your {exportFormat} was made on this device. Your original clips are untouched.</p>
            <a className="primary-button export-download" href={downloadUrl} download={downloadName}><Download size={18} />Download {exportFormat}</a>
          </>
        ) : (
          <>
            <span className="export-badge">PRIVATE · MADE ON THIS DEVICE</span>
            <h2 id="export-title">Make your video</h2>
            <p>QuickStory will play and record the finished story in this browser. Keep this tab open until it finishes.</p>
            {busy && (
              <div className="export-progress-wrap">
                <div className="export-progress"><i style={{ width: `${progress}%` }} /></div>
                <span><LoaderCircle className="spin" size={16} />Rendering on this device… {Math.round(progress)}%</span>
              </div>
            )}
            {error && <div className="error-message">{error}</div>}
            <button className="primary-button export-action" onClick={onExport} disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
              {busy ? "Working…" : error ? "Try again" : "Export video"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
