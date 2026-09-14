import { GripVertical, Image as ImageIcon, Pencil, Plus, Sparkles, Video } from "lucide-react";
import { clipDuration, formatTime, totalDuration } from "../lib/project";
import type { MediaClip } from "../types";

interface Props {
  clips: MediaClip[];
  activeId?: string;
  onActivate: (id: string) => void;
  onEdit: (id: string) => void;
  onAdd: () => void;
  onShuffle: () => void;
  onMove: (fromId: string, toId: string) => void;
}

export function Timeline({ clips, activeId, onActivate, onEdit, onAdd, onShuffle, onMove }: Props) {
  return (
    <section className="timeline-section" aria-labelledby="media-heading">
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">YOUR AUTO EDIT</span>
          <h2 id="media-heading">Every slot is still editable</h2>
        </div>
        <div className="timeline-actions">
          <span>{clips.length} clips · {formatTime(totalDuration(clips))}</span>
          <button className="secondary-button remix-button" onClick={onShuffle} disabled={!clips.length}><Sparkles size={15} />Remix story</button>
        </div>
      </div>
      <div className="timeline" onDragOver={(event) => event.preventDefault()}>
        {!clips.length && (
          <button className="timeline-empty" onClick={onAdd}>
            <Plus size={24} />
            <strong>Add photos or video</strong>
            <span>Drop them here or choose files</span>
          </button>
        )}
        {clips.map((clip, index) => (
          <article
            key={clip.id}
            className={`timeline-clip ${activeId === clip.id ? "active" : ""}`}
            draggable
            onDragStart={(event) => event.dataTransfer.setData("text/clip-id", clip.id)}
            onDrop={(event) => {
              event.preventDefault();
              const fromId = event.dataTransfer.getData("text/clip-id");
              if (fromId) onMove(fromId, clip.id);
            }}
            onClick={() => onActivate(clip.id)}
          >
            <div className="clip-thumb">
              {clip.type === "image" ? <img src={clip.objectUrl} alt="" /> : <video src={clip.objectUrl} muted playsInline />}
              <span className="clip-type">{clip.type === "image" ? <ImageIcon size={12} /> : <Video size={12} />}</span>
              <span className="clip-number">{index + 1}</span>
              <button className="edit-clip-button" onClick={(event) => { event.stopPropagation(); onEdit(clip.id); }}>
                <Pencil size={11} /> Edit clip
              </button>
            </div>
            <div className="clip-meta">
              <GripVertical size={12} />
              <span>{clip.name}</span>
              <time>{clipDuration(clip).toFixed(1)}s</time>
            </div>
          </article>
        ))}
        {!!clips.length && <button className="timeline-add" onClick={onAdd}><Plus size={22} /><span>Add more</span></button>}
      </div>
    </section>
  );
}
