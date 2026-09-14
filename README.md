# QuickStory

QuickStory is a fast, template-first social video maker. Upload a batch of photos and videos, let QuickStory choose the best-fit storyboard and build the cut, then export or fine-tune individual moments.

The product opens directly in the editor. There is no dashboard, approval process, login, or required multi-step wizard.

## Included in the first release

- Six media-aware storyboards: one-video recap, two-video memories, three-video highlight, three-video-only rush, photo pop, and flexible mix
- Automatic best-template selection based on the number of original videos and photos
- Deliberate video beats that reuse different sections of source footage between photo runs
- Mixed transition sequences within each story, including snap-pop, punch-zoom, flip, spin, wipe, flash, slide, and dissolve
- Template-specific zoom, drift, bold-color, film-grain, sweep, and subtle-push effects
- Drag-and-drop photo and video uploads
- Automatic multi-moment cuts from different sections of longer source videos
- One-click Remix generation for a different randomized edit
- Reorderable visual timeline
- Live 9:16, 1:1, and 16:9 previews
- Headline, subtitle, and accent color controls
- Optional per-clip trim, speed, duration, crop, position, zoom, rotation, color, volume, and text controls
- On-device autosave using IndexedDB, including source media
- On-device video export through Canvas, Web Audio, and MediaRecorder
- Four original, royalty-free built-in instrumental loops plus optional MP3, M4A, WAV, AAC, OGG, or WebM music uploads
- MP4 output when the browser supports MP4 recording, with WebM as the compatibility fallback
- Installable PWA metadata

## How browser export works

QuickStory plays the finished composition into an offscreen canvas at 30 frames per second. Video audio is mixed with the Web Audio API, and MediaRecorder creates the downloadable file. Nothing is uploaded during export.

Browser rendering happens in real time: a 30-second story takes about 30 seconds to export. Keep the tab visible until it finishes. Current Chrome, Edge, and Safari releases are the supported targets. The browser decides which recording container is available, so some devices produce WebM rather than MP4.

## Local development

```bash
npm install
npm run dev
```

## Cloudflare deployment

The app uses Cloudflare Workers static assets and works on the free Workers plan. It does not require Docker, Containers, R2, or D1.

```bash
npx wrangler login
npm run deploy
```

## Verification

```bash
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
```

## Deliberate first-release limits

- Export resolution is 720×1280, 720×720, or 1280×720 to keep browser rendering practical.
- Export runs in real time and the tab must remain open and visible.
- Long or numerous high-resolution clips can exceed a browser's memory limits.
- MP4 availability depends on the browser; WebM is used when MP4 recording is unavailable.
- No bundled commercial music until licensed tracks are selected.
- Only the current draft is restored from the device in this first UI.

The previous R2, D1, and FFmpeg architecture can be restored later if dependable server-side MP4 rendering becomes worth the paid infrastructure.
