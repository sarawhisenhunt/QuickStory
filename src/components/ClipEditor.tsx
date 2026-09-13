import { Copy, RotateCcw, Trash2, X } from "lucide-react";
import { constrain } from "../lib/project";
import type { MediaClip } from "../types";

interface Props {
  clip: MediaClip;
  onChange: (clip: MediaClip) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

interface RangeProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}

function RangeControl({ label, value, min, max, step = 1, suffix = "", onChange }: RangeProps) {
  return (
    <label className="range-control">
      <span><b>{label}</b><output>{Number.isInteger(value) ? value : value.toFixed(1)}{suffix}</output></span>
      <input type="range" value={value} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

export function ClipEditor({ clip, onChange, onDuplicate, onDelete, onClose }: Props) {
  const update = (patch: Partial<MediaClip["edits"]>) => onChange({ ...clip, edits: { ...clip.edits, ...patch } });
  const style = {
    objectFit: clip.edits.crop === "fill" ? "cover" : "contain",
    objectPosition: `${clip.edits.positionX * 100}% ${clip.edits.positionY * 100}%`,
    transform: `scale(${clip.edits.zoom}) rotate(${clip.edits.rotation}deg)`,
    filter: `brightness(${100 + clip.edits.brightness}%) contrast(${clip.edits.contrast}%) saturate(${clip.edits.saturation}%)`
  } as const;

  const reset = () => update({
    trimStart: 0,
    trimEnd: clip.type === "video" ? clip.sourceDuration : 0,
    duration: 2.2,
    speed: 1,
    crop: "fill",
    positionX: 0.5,
    positionY: 0.5,
    zoom: 1,
    rotation: 0,
    brightness: 0,
    contrast: 100,
    saturation: 100,
    volume: 100,
    text: ""
  });

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="clip-editor" role="dialog" aria-modal="true" aria-labelledby="clip-editor-title">
        <header>
          <div>
            <span className="eyebrow">OPTIONAL FINE-TUNING</span>
            <h2 id="clip-editor-title">Edit clip</h2>
            <p>{clip.name}</p>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close editor"><X /></button>
        </header>

        <div className="editor-grid">
          <div className="clip-editor-preview">
            {clip.type === "image" ? <img src={clip.objectUrl} alt="Clip preview" style={style} /> : <video src={clip.objectUrl} controls playsInline style={style} />}
            {clip.edits.text && <strong>{clip.edits.text}</strong>}
          </div>

          <div className="editor-controls">
            {clip.type === "video" ? (
              <fieldset>
                <legend>Trim & speed</legend>
                <RangeControl label="Start" value={clip.edits.trimStart} min={0} max={Math.max(0, clip.edits.trimEnd - 0.25)} step={0.1} suffix="s" onChange={(trimStart) => update({ trimStart })} />
                <RangeControl label="End" value={clip.edits.trimEnd} min={Math.min(0.25, clip.sourceDuration)} max={clip.sourceDuration} step={0.1} suffix="s" onChange={(trimEnd) => update({ trimEnd: Math.max(trimEnd, clip.edits.trimStart + 0.25) })} />
                <div className="segmented speed-options">
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((speed) => (
                    <button key={speed} className={clip.edits.speed === speed ? "active" : ""} onClick={() => update({ speed })}>{speed}×</button>
                  ))}
                </div>
              </fieldset>
            ) : (
              <fieldset>
                <legend>Timing</legend>
                <RangeControl label="Photo duration" value={clip.edits.duration} min={0.8} max={8} step={0.1} suffix="s" onChange={(duration) => update({ duration })} />
              </fieldset>
            )}

            <fieldset>
              <legend>Crop & position</legend>
              <div className="segmented">
                <button className={clip.edits.crop === "fill" ? "active" : ""} onClick={() => update({ crop: "fill" })}>Fill frame</button>
                <button className={clip.edits.crop === "fit" ? "active" : ""} onClick={() => update({ crop: "fit" })}>Show all</button>
              </div>
              <RangeControl label="Zoom" value={clip.edits.zoom} min={1} max={2} step={0.05} suffix="×" onChange={(zoom) => update({ zoom })} />
              <RangeControl label="Move left / right" value={Math.round(clip.edits.positionX * 100)} min={0} max={100} suffix="%" onChange={(value) => update({ positionX: value / 100 })} />
              <RangeControl label="Move up / down" value={Math.round(clip.edits.positionY * 100)} min={0} max={100} suffix="%" onChange={(value) => update({ positionY: value / 100 })} />
              <div className="rotation-row">
                <span>Rotation</span>
                {[0, 90, 180, 270].map((rotation) => <button key={rotation} className={clip.edits.rotation === rotation ? "active" : ""} onClick={() => update({ rotation })}>{rotation}°</button>)}
              </div>
            </fieldset>

            <fieldset>
              <legend>Look</legend>
              <RangeControl label="Brightness" value={clip.edits.brightness} min={-50} max={50} suffix="" onChange={(brightness) => update({ brightness })} />
              <RangeControl label="Contrast" value={clip.edits.contrast} min={50} max={160} suffix="%" onChange={(contrast) => update({ contrast })} />
              <RangeControl label="Color" value={clip.edits.saturation} min={0} max={180} suffix="%" onChange={(saturation) => update({ saturation })} />
              {clip.type === "video" && <RangeControl label="Clip volume" value={clip.edits.volume} min={0} max={100} suffix="%" onChange={(volume) => update({ volume })} />}
            </fieldset>

            <fieldset>
              <legend>Clip text</legend>
              <input className="wide-input" value={clip.edits.text} maxLength={80} placeholder="Optional words just for this moment" onChange={(event) => update({ text: event.target.value })} />
            </fieldset>
          </div>
        </div>

        <footer>
          <button className="danger-button" onClick={onDelete}><Trash2 size={16} />Delete</button>
          <button className="secondary-button" onClick={onDuplicate}><Copy size={16} />Duplicate</button>
          <button className="secondary-button" onClick={reset}><RotateCcw size={16} />Restore original</button>
          <button className="primary-button" onClick={onClose}>Done editing</button>
        </footer>
      </section>
    </div>
  );
}
