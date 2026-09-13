import { useEffect, useRef } from "react";
import { ImagePlus, Pause, Play, RotateCcw } from "lucide-react";
import type { AspectRatio, MediaClip, StoryTemplate } from "../types";

interface Props {
  clip?: MediaClip;
  template: StoryTemplate;
  title: string;
  subtitle: string;
  accent: string;
  aspectRatio: AspectRatio;
  isPlaying: boolean;
  progress: number;
  onTogglePlay: () => void;
  onAdd: () => void;
}

export function Stage({
  clip,
  template,
  title,
  subtitle,
  accent,
  aspectRatio,
  isPlaying,
  progress,
  onTogglePlay,
  onAdd
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !clip || clip.type !== "video") return;
    video.currentTime = clip.edits.trimStart;
    video.playbackRate = clip.edits.speed;
    video.volume = Math.min(1, clip.edits.volume / 100);
    if (isPlaying) video.play().catch(() => undefined);
    else video.pause();
  }, [clip?.id, clip?.edits.trimStart, clip?.edits.speed, clip?.edits.volume, isPlaying]);

  const mediaStyle = clip ? {
    objectFit: clip.edits.crop === "fill" ? "cover" : "contain",
    objectPosition: `${clip.edits.positionX * 100}% ${clip.edits.positionY * 100}%`,
    transform: `scale(${clip.edits.zoom}) rotate(${clip.edits.rotation}deg)`,
    filter: `brightness(${100 + clip.edits.brightness}%) contrast(${clip.edits.contrast}%) saturate(${clip.edits.saturation}%)`
  } as const : undefined;

  return (
    <section className="stage-panel">
      <div className="stage-toolbar">
        <span className="eyebrow">LIVE PREVIEW</span>
        <span>{aspectRatio}</span>
      </div>
      <div className={`stage-frame ratio-${aspectRatio.replace(":", "-")} ${template.previewClass}`} style={{ "--accent": accent } as React.CSSProperties}>
        {clip ? (
          <>
            {clip.type === "image" ? (
              <img src={clip.objectUrl} alt="Current clip" style={mediaStyle} />
            ) : (
              <video ref={videoRef} src={clip.objectUrl} muted={clip.edits.volume === 0} playsInline style={mediaStyle} />
            )}
            <div className="stage-shade" />
            <div className="stage-copy">
              <span>{template.mood}</span>
              <h1>{clip.edits.text || title}</h1>
              {!clip.edits.text && <p>{subtitle}</p>}
            </div>
            <div className="stage-accent" />
          </>
        ) : (
          <button className="empty-stage" onClick={onAdd}>
            <ImagePlus size={34} />
            <strong>Drop in today’s moments</strong>
            <span>Photos and video clips</span>
          </button>
        )}
      </div>
      <div className="preview-controls">
        <button className="icon-button" onClick={() => window.location.reload()} aria-label="Restart preview">
          <RotateCcw size={17} />
        </button>
        <button className="play-button" onClick={onTogglePlay} disabled={!clip}>
          {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          {isPlaying ? "Pause" : "Play story"}
        </button>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="preview-progress"><i style={{ width: `${progress * 100}%` }} /></div>
    </section>
  );
}
