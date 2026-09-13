import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, Film, FolderOpen, Plus, Save, Settings2, Sparkles } from "lucide-react";
import { ClipEditor } from "./components/ClipEditor";
import { ExportDialog } from "./components/ExportDialog";
import { Stage } from "./components/Stage";
import { TemplateRail } from "./components/TemplateRail";
import { Timeline } from "./components/Timeline";
import { exportProject } from "./lib/api";
import { clearLocalProject, loadLocalProject, saveLocalProject } from "./lib/idb";
import { fileToClip } from "./lib/media";
import { clipDuration, createProject, totalDuration } from "./lib/project";
import { getTemplate } from "./templates";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const template = useMemo(() => getTemplate(project.templateId), [project.templateId]);
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
    setProject((current) => ({ ...current, clips: [...current.clips, ...accepted], updatedAt: new Date().toISOString() }));
    if (project.clips.length === 0) setActiveIndex(0);
  };

  const selectTemplate = (templateId: string) => {
    const next = getTemplate(templateId);
    setProject((current) => ({
      ...current,
      templateId,
      accent: next.accent,
      clips: current.clips.map((clip) => clip.type === "image" ? { ...clip, edits: { ...clip.edits, duration: next.imageDuration } } : clip),
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

  const shuffleClips = () => {
    setProject((current) => {
      const clips = [...current.clips];
      for (let index = clips.length - 1; index > 0; index -= 1) {
        const target = Math.floor(Math.random() * (index + 1));
        [clips[index], clips[target]] = [clips[target], clips[index]];
      }
      return { ...current, clips, updatedAt: new Date().toISOString() };
    });
    setActiveIndex(0);
  };

  const newProject = async () => {
    if (project.clips.length && !window.confirm("Start a new story? This clears the current draft from this device.")) return;
    project.clips.forEach((clip) => clip.objectUrl && URL.revokeObjectURL(clip.objectUrl));
    await clearLocalProject().catch(() => undefined);
    setProject(createProject());
    setActiveIndex(0);
    setProgress(0);
    setIsPlaying(false);
  };

  const runExport = async () => {
    setRenderStatus("uploading");
    setRenderProgress(0);
    setRenderError(undefined);
    try {
      const result = await exportProject(project, (completed, total) => setRenderProgress((completed / total) * 70));
      setProject(result.project);
      setRenderStatus("rendering");
      setRenderProgress(88);
      setDownloadUrl(result.downloadUrl);
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
          <button className="header-button" onClick={newProject}><Plus size={17} />New</button>
          <button className="header-button muted" title="Saved drafts are coming in the next release"><FolderOpen size={17} />Drafts</button>
          <button className="export-button" onClick={() => setExportOpen(true)} disabled={!project.clips.length}><Download size={17} />Export</button>
        </nav>
      </header>

      <main>
        <div className="hero-copy">
          <span className="hero-chip"><Sparkles size={14} />Fast by default. Flexible when you want it.</span>
          <h1>Today’s clips.<br /><i>One good story.</i></h1>
          <p>Pick a look, add your moments, and QuickStory does the first edit. Fine-tune only what you want.</p>
        </div>

        <TemplateRail selectedId={project.templateId} onSelect={selectTemplate} />

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
          onShuffle={shuffleClips}
          onMove={moveClip}
        />

        <section className="finish-bar">
          <div><span className="eyebrow">4 · THAT’S IT</span><h2>Ready when you are.</h2><p>Preview it once, or trust the template and go.</p></div>
          <button className="big-export" onClick={() => setExportOpen(true)} disabled={!project.clips.length}><Download />Export my story <span>MP4</span></button>
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
        onExport={runExport}
        onClose={() => setExportOpen(false)}
      />

      {draggingOver && <div className="drop-overlay"><Download size={42} /><strong>Drop them anywhere</strong><span>We’ll put the first edit together.</span></div>}
    </div>
  );
}

export default App;
