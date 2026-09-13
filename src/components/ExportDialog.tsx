import { CheckCircle2, Download, LoaderCircle, X } from "lucide-react";
import type { RenderStatus } from "../types";

interface Props {
  open: boolean;
  status: RenderStatus;
  progress: number;
  error?: string;
  downloadUrl?: string;
  onExport: () => void;
  onClose: () => void;
}

export function ExportDialog({ open, status, progress, error, downloadUrl, onExport, onClose }: Props) {
  if (!open) return null;
  const busy = status === "uploading" || status === "rendering";
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="export-dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <button className="icon-button export-close" onClick={onClose} disabled={busy} aria-label="Close"><X /></button>
        {status === "complete" ? (
          <>
            <CheckCircle2 className="success-icon" size={44} />
            <h2 id="export-title">Your story is ready</h2>
            <p>We made a social-ready MP4. Your original clips are untouched.</p>
            <a className="primary-button export-download" href={downloadUrl} download><Download size={18} />Download MP4</a>
          </>
        ) : (
          <>
            <span className="export-badge">MP4 · HIGH QUALITY</span>
            <h2 id="export-title">Make your video</h2>
            <p>QuickStory will securely upload the source clips, assemble the template, and return one finished video.</p>
            {busy && (
              <div className="export-progress-wrap">
                <div className="export-progress"><i style={{ width: `${progress}%` }} /></div>
                <span><LoaderCircle className="spin" size={16} />{status === "uploading" ? `Uploading ${Math.round(progress)}%` : "Rendering your story…"}</span>
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
