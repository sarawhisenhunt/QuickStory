import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Film, FolderOpen, Music2, Plus, RotateCcw, Save, Settings2, Sparkles, Trash2 } from "lucide-react";
import { ClipEditor } from "./components/ClipEditor";
import { ExportDialog } from "./components/ExportDialog";
import { Stage } from "./components/Stage";
import { TemplateRail } from "./components/TemplateRail";
import { Timeline } from "./components/Timeline";
import { exportInBrowser } from "./lib/browserExport";
import { BUILTIN_TRACKS, createBuiltinMusicFile } from "./lib/builtinMusic";
import { clearLocalProject, loadLocalProject, saveLocalProject } from "./lib/idb";
import { fileToClip } from "./lib/media";
import { clipDuration, createProject, totalDuration } from "./lib/project";
import { buildTemplateStory, mediaCounts } from "./lib/remix";
import { getTemplate, recommendTemplate } from "./templates";
import type { AspectRatio, MediaClip, RenderStatus, StoryProject } from "./types";

function App() {
  const [project, setProject] = useState<StoryProject>(() => createProject());
  const [hydrated, setHydrated] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [editorClipId, setEditorClipId] = useState<string>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [draggingOver, setDraggingOver] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("idle");
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderError, setRenderError] = useState<string>();
  const [downloadUrl, setDownloadUrl] = useState<string>();
  const [downloadName, setDownloadName] = useState<string>();
  const [exportFormat, setExportFormat] = useState<"MP4" | "WebM">();
  const [musicLibraryOpen, setMusicLibraryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const template = useMemo(() => getTemplate(project.templateId), [project.templateId]);
  const inventory = useMemo(() => mediaCounts(project.clips), [project.clips]);
  const recommendedTemplate = useMemo(() => recommendTemplate(inventory.videos, inventory.photos), [inventory]);
  const activeClip = project.clips[activeIndex];
  const editorClip = project.clips.find((clip) => clip.id === editorClipId);

  useEffect(() => {
    loadLocalProject()
      .then((saved) => saved && setProject(saved))
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = window.setTimeout(() => saveLocalProject(project).catch(() => undefined), 500);
    return () => window.clearTimeout(timeout);
  }, [project, hydrated]);

  useEffect(() => {
    if (!isPlaying || !activeClip) return;
    const duration = clipDuration(activeClip);
    const before = project.clips.slice(0, activeIndex).reduce((sum, clip) => sum + clipDuration(clip), 0);
    const total = Math.max(totalDuration(project.clips), duration);
    const started = performance.now();
    let animation = 0;
    const update = () => {
      const elapsed = Math.min(duration, (performance.now() - started) / 1000);
      setProgress(Math.min(1, (before + elapsed) / total));
      animation = requestAnimationFrame(update);
    };
    animation = requestAnimationFrame(update);
    const timeout = window.setTimeout(() => {
      if (activeIndex < project.clips.length - 1) setActiveIndex((index) => index + 1);
      else {
        setIsPlaying(false);
        setProgress(1);
      }
    }, duration * 1000);
    return () => {
      cancelAnimationFrame(animation);
      window.clearTimeout(timeout);
    };
  }, [isPlaying, activeIndex, activeClip?.id, project.clips]);

  const updateProject = (patch: Partial<StoryProject>) => {
    setProject((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  };

  const addFiles = async (files: FileList | File[]) => {
    const accepted = (await Promise.all(Array.from(files).map((file) => fileToClip(file, template)))).filter(Boolean) as MediaClip[];
    if (!accepted.length) return;
    setProject((current) => ({
      ...(() => {
        const sources = [...current.clips, ...accepted];
        const counts = mediaCounts(sources);
        const best = recommendTemplate(counts.videos, counts.photos);
        return {
          ...current,
          templateId: best.id,
          accent: best.accent,
          clips: buildTemplateStory(sources, best),
          updatedAt: new Date().toISOString()
        };
      })()
    }));
    if (project.clips.length === 0) setActiveIndex(0);
  };

  const selectTemplate = (templateId: string) => {
    const next = getTemplate(templateId);
    setProject((current) => ({
      ...current,
      templateId,
      accent: next.accent,
      clips: current.clips.length ? buildTemplateStory(current.clips, next) : current.clips,
      updatedAt: new Date().toISOString()
    }));
  };

  const activateClip = (id: string) => {
    const index = project.clips.findIndex((clip) => clip.id === id);
    if (index < 0) return;
    setIsPlaying(false);
    setActiveIndex(index);
    const before = project.clips.slice(0, index).reduce((sum, clip) => sum + clipDuration(clip), 0);
    setProgress(totalDuration(project.clips) ? before / totalDuration(project.clips) : 0);
  };

  const replaceClip = (nextClip: MediaClip) => {
    setProject((current) => ({
      ...current,
      clips: current.clips.map((clip) => clip.id === nextClip.id ? nextClip : clip),
      updatedAt: new Date().toISOString()
    }));
  };

  const deleteClip = (id: string) => {
    setProject((current) => ({ ...current, clips: current.clips.filter((clip) => clip.id !== id), updatedAt: new Date().toISOString() }));
    setEditorClipId(undefined);
    setActiveIndex((index) => Math.max(0, Math.min(index, project.clips.length - 2)));
  };

  const duplicateClip = (id: string) => {
    setProject((current) => {
      const index = current.clips.findIndex((clip) => clip.id === id);
      if (index < 0) return current;
      const duplicate = { ...current.clips[index], id: crypto.randomUUID(), edits: { ...current.clips[index].edits } };
      const clips = [...current.clips];
      clips.splice(index + 1, 0, duplicate);
      return { ...current, clips, updatedAt: new Date().toISOString() };
    });
  };

  const moveClip = (fromId: string, toId: string) => {
    setProject((current) => {
      const from = current.clips.findIndex((clip) => clip.id === fromId);
      const to = current.clips.findIndex((clip) => clip.id === toId);
      if (from < 0 || to < 0 || from === to) return current;
      const clips = [...current.clips];
      const [moved] = clips.splice(from, 1);
      clips.splice(to, 0, moved);
      return { ...current, clips, updatedAt: new Date().toISOString() };
    });
  };

  const remixClips = () => {
    setProject((current) => ({
      ...current,
      clips: buildTemplateStory(current.clips, getTemplate(current.templateId)),
      updatedAt: new Date().toISOString()
    }));
    setActiveIndex(0);
    setProgress(0);
    setIsPlaying(false);
  };

  const addMusic = (file?: File, builtinId?: string) => {
    if (!file || (!file.type.startsWith("audio/") && !/\.(mp3|m4a|wav|aac|ogg)$/i.test(file.name))) return;
    if (project.music?.objectUrl) URL.revokeObjectURL(project.music.objectUrl);
    updateProject({
      music: {
        id: crypto.randomUUID(),
        builtinId,
        file,
        name: file.name,
        mimeType: file.type || "audio/mpeg",
        objectUrl: URL.createObjectURL(file),
        volume: 28
      }
    });
    setMusicLibraryOpen(false);
  };

  const addBuiltinMusic = (id: string) => {
    const track = BUILTIN_TRACKS.find((candidate) => candidate.id === id);
    if (track) addMusic(createBuiltinMusicFile(track), track.id);
  };

  const removeMusic = () => {
    if (project.music?.objectUrl) URL.revokeObjectURL(project.music.objectUrl);
    updateProject({ music: undefined });
    setMusicLibraryOpen(true);
  };

  const newProject = async () => {
    if ((project.clips.length || project.music) && !window.confirm("Start over? This will remove all photos, videos, music, and edits from the current project.")) return;
    project.clips.forEach((clip) => clip.objectUrl && URL.revokeObjectURL(clip.objectUrl));
    if (project.music?.objectUrl) URL.revokeObjectURL(project.music.objectUrl);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    await clearLocalProject().catch(() => undefined);
    setProject(createProject());
    setActiveIndex(0);
    setProgress(0);
    setIsPlaying(false);
    setEditorClipId(undefined);
    setExportOpen(false);
    setRenderStatus("idle");
    setRenderProgress(0);
    setRenderError(undefined);
    setDownloadUrl(undefined);
    setDownloadName(undefined);
    setExportFormat(undefined);
    setMusicLibraryOpen(false);
  };

  const runExport = async () => {
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setRenderStatus("rendering");
    setRenderProgress(0);
    setRenderError(undefined);
    setDownloadUrl(undefined);
    setDownloadName(undefined);
    setExportFormat(undefined);
    try {
      const result = await exportInBrowser(project, setRenderProgress);
      setDownloadUrl(result.downloadUrl);
      setDownloadName(result.fileName);
      setExportFormat(result.formatLabel);
      setRenderProgress(100);
      setRenderStatus("complete");
    } catch (error) {
      setRenderStatus("error");
      setRenderError(error instanceof Error ? error.message : "Export failed. Please try again.");
    }
  };

  return (
    <div
      className={`app-shell ${draggingOver ? "dragging-over" : ""}`}
      onDragEnter={(event) => { event.preventDefault(); setDraggingOver(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => event.currentTarget === event.target && setDraggingOver(false)}
      onDrop={(event) => { event.preventDefault(); setDraggingOver(false); void addFiles(event.dataTransfer.files); }}
    >
      <header className="app-header">
        <button className="brand" onClick={newProject} aria-label="QuickStory home">
          <span><Film size={21} /></span>
          <strong>QuickStory</strong>
          <em>beta</em>
        </button>
        <div className="project-name">
          <Save size={15} />
          <span>{hydrated ? "Saved on this device" : "Opening draft…"}</span>
        </div>
        <nav>
          <button className="header-button reset-header" onClick={newProject} disabled={!project.clips.length && !project.music}><RotateCcw size={16} />Start over</button>
          <button className="header-button muted" title="Saved drafts are coming in the next release"><FolderOpen size={17} />Drafts</button>
          <button className="export-button" onClick={() => setExportOpen(true)} disabled={!project.clips.length}><Download size={17} />Export</button>
        </nav>
      </header>

      <main>
        <div className="hero-copy">
          <span className="hero-chip"><Sparkles size={14} />The fastest path from camera roll to recap.</span>
          <h1>Upload everything.<br /><i>Get the story.</i></h1>
          <p>QuickStory counts your photos and videos, picks the right storyboard, finds several moments in longer clips, and builds the first cut.</p>
          <button className="hero-upload" onClick={() => fileInputRef.current?.click()}>
            <Plus size={20} />
            <span><strong>{project.clips.length ? "Add more photos + videos" : "Upload photos + videos"}</strong><small>Select everything from your day at once</small></span>
          </button>
          {!!project.clips.length && <div className="auto-pick-note"><Sparkles size={15} /><span><strong>{recommendedTemplate.name}</strong> is the best match for {inventory.videos} video{inventory.videos === 1 ? "" : "s"} and {inventory.photos} photo{inventory.photos === 1 ? "" : "s"}.</span></div>}
        </div>

        <TemplateRail
          selectedId={project.templateId}
          recommendedId={recommendedTemplate.id}
          videoCount={inventory.videos}
          photoCount={inventory.photos}
          onSelect={selectTemplate}
        />

        <section className="workspace-section">
          <div className="workspace-copy">
            <span className="eyebrow">3 · MAKE IT YOURS</span>
            <h2>Polish the story</h2>
            <label>
              <span>Headline</span>
              <input value={project.title} maxLength={60} onChange={(event) => updateProject({ title: event.target.value })} />
            </label>
            <label>
              <span>Small text</span>
              <input value={project.subtitle} maxLength={90} onChange={(event) => updateProject({ subtitle: event.target.value })} />
            </label>
            <div className="field-group">
              <span>Format</span>
              <div className="segmented format-options">
                {(["9:16", "1:1", "16:9"] as AspectRatio[]).map((ratio) => (
                  <button key={ratio} className={project.aspectRatio === ratio ? "active" : ""} onClick={() => updateProject({ aspectRatio: ratio })}>{ratio}</button>
                ))}
              </div>
            </div>
            <label>
              <span>Accent color</span>
              <div className="color-field">
                <input type="color" value={project.accent} onChange={(event) => updateProject({ accent: event.target.value })} />
                <input value={project.accent} maxLength={7} onChange={(event) => updateProject({ accent: event.target.value })} />
              </div>
            </label>
            <div className="music-field">
              <div className="music-heading"><span>Music</span><em>Original QuickStory tracks · royalty-free</em></div>
              {project.music ? (
                <div className="music-track">
                  <div><Music2 size={17} /><span><strong>{project.music.name}</strong><small>Mixed under clip audio</small></span></div>
                  <audio src={project.music.objectUrl} controls preload="metadata" />
                  <label>
                    <span>Music volume <b>{project.music.volume}%</b></span>
                    <input type="range" min="0" max="100" value={project.music.volume} onChange={(event) => updateProject({ music: { ...project.music!, volume: Number(event.target.value) } })} />
                  </label>
                  <div className="music-track-actions">
                    <button className="change-music" onClick={() => setMusicLibraryOpen((open) => !open)}><Music2 size={13} />{musicLibraryOpen ? "Close library" : "Choose another"}</button>
                    <button className="remove-music" onClick={removeMusic}><Trash2 size={14} />Remove</button>
                  </div>
                </div>
              ) : null}
              {(!project.music || musicLibraryOpen) && (
                <div className="music-library">
                  <div className="builtin-tracks">
                    {BUILTIN_TRACKS.map((track) => (
                      <button key={track.id} className={project.music?.builtinId === track.id ? "selected" : ""} onClick={() => addBuiltinMusic(track.id)} style={{ "--track-color": track.color } as React.CSSProperties}>
                        <span className="track-play">♪</span>
                        <span><strong>{track.name}</strong><small>{track.mood} · {track.bpm} BPM</small></span>
                      </button>
                    ))}
                  </div>
                  <button className="add-music" onClick={() => musicInputRef.current?.click()}><Plus size={16} /><span><strong>Use my own song</strong><small>MP3, M4A or WAV from your device</small></span></button>
                </div>
              )}
            </div>
            <button className="advanced-note" onClick={() => activeClip && setEditorClipId(activeClip.id)} disabled={!activeClip}>
              <Settings2 size={18} />
              <span><strong>Want more control?</strong><small>Trim, crop, speed, color and clip text</small></span>
              <ChevronDown size={17} />
            </button>
          </div>
          <Stage
            clip={activeClip}
            template={template}
            title={project.title}
            subtitle={project.subtitle}
            accent={project.accent}
            aspectRatio={project.aspectRatio}
            isPlaying={isPlaying}
            progress={progress}
            clipIndex={activeIndex}
            onTogglePlay={() => {
              if (progress >= 1) { setActiveIndex(0); setProgress(0); }
              setIsPlaying((playing) => !playing);
            }}
            onAdd={() => fileInputRef.current?.click()}
          />
        </section>

        <Timeline
          clips={project.clips}
          activeId={activeClip?.id}
          onActivate={activateClip}
          onEdit={setEditorClipId}
          onAdd={() => fileInputRef.current?.click()}
          onShuffle={remixClips}
          onMove={moveClip}
        />

        <section className="finish-bar">
          <div><span className="eyebrow">4 · THAT’S IT</span><h2>Ready when you are.</h2><p>Preview it once, or trust the template and go.</p></div>
          <button className="big-export" onClick={() => setExportOpen(true)} disabled={!project.clips.length}><Download />Export my story <span>VIDEO</span></button>
        </section>
      </main>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,video/mp4,video/quicktime,video/webm"
        multiple
        hidden
        onChange={(event) => { if (event.target.files) void addFiles(event.target.files); event.target.value = ""; }}
      />
      <input
        ref={musicInputRef}
        type="file"
        accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,audio/ogg,audio/webm"
        hidden
        onChange={(event) => { addMusic(event.target.files?.[0]); event.target.value = ""; }}
      />

      {editorClip && (
        <ClipEditor
          clip={editorClip}
          onChange={replaceClip}
          onDuplicate={() => duplicateClip(editorClip.id)}
          onDelete={() => deleteClip(editorClip.id)}
          onClose={() => setEditorClipId(undefined)}
        />
      )}

      <ExportDialog
        open={exportOpen}
        status={renderStatus}
        progress={renderProgress}
        error={renderError}
        downloadUrl={downloadUrl}
        downloadName={downloadName}
        exportFormat={exportFormat}
        onExport={runExport}
        onClose={() => setExportOpen(false)}
      />

      {draggingOver && <div className="drop-overlay"><Download size={42} /><strong>Drop them anywhere</strong><span>We’ll put the first edit together.</span></div>}
    </div>
  );
}

export default App;
