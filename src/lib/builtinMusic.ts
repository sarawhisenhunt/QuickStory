export interface BuiltinTrack {
  id: string;
  name: string;
  mood: string;
  bpm: number;
  color: string;
}

export const BUILTIN_TRACKS: BuiltinTrack[] = [
  { id: "sunny-pop", name: "Sunny Pop", mood: "Bright + playful", bpm: 124, color: "#ffd84d" },
  { id: "little-wins", name: "Little Wins", mood: "Bouncy + upbeat", bpm: 136, color: "#ff6c8a" },
  { id: "memory-glow", name: "Memory Glow", mood: "Warm + nostalgic", bpm: 96, color: "#f4a66a" },
  { id: "big-day", name: "Big Day", mood: "Bold + celebratory", bpm: 116, color: "#9b7bff" }
];

function writeAscii(view: DataView, offset: number, text: string) {
  for (let index = 0; index < text.length; index += 1) view.setUint8(offset + index, text.charCodeAt(index));
}

function midi(note: number) {
  return 440 * Math.pow(2, (note - 69) / 12);
}

function wave(phase: number, shape: "sine" | "triangle" = "sine") {
  if (shape === "triangle") return 2 * Math.asin(Math.sin(phase)) / Math.PI;
  return Math.sin(phase);
}

function synthSample(track: BuiltinTrack, time: number, duration: number) {
  const beatLength = 60 / track.bpm;
  const beat = time / beatLength;
  const beatPhase = beat % 1;
  const eighthPhase = (beat * 2) % 1;
  const bar = Math.floor(beat / 4);
  const progressions: Record<string, number[]> = {
    "sunny-pop": [60, 67, 69, 65],
    "little-wins": [62, 69, 66, 67],
    "memory-glow": [57, 65, 60, 67],
    "big-day": [55, 62, 64, 60]
  };
  const root = progressions[track.id][bar % 4];
  const chord = [root, root + 4, root + 7].reduce((sum, note) => sum + wave(2 * Math.PI * midi(note) * time, "triangle"), 0) / 3;
  const bass = wave(2 * Math.PI * midi(root - 12) * time) * Math.exp(-beatPhase * 3.5);
  const melodyNotes = track.id === "memory-glow" ? [7, 4, 2, 4, 7, 9, 7, 4] : [7, 9, 11, 7, 4, 7, 9, 12];
  const melodyNote = root + melodyNotes[Math.floor(beat * 2) % melodyNotes.length];
  const melody = wave(2 * Math.PI * midi(melodyNote) * time) * Math.exp(-eighthPhase * (track.id === "memory-glow" ? 5 : 8));
  const kickPhase = time % beatLength;
  const kick = Math.sin(2 * Math.PI * (70 - kickPhase * 45) * kickPhase) * Math.exp(-kickPhase * 18);
  const clapBeat = Math.floor(beat) % 4;
  const clap = (clapBeat === 1 || clapBeat === 3) && beatPhase < 0.16
    ? (Math.sin(time * 11003) + Math.sin(time * 17011)) * 0.12 * Math.exp(-beatPhase * 24)
    : 0;
  const hat = (Math.sin(time * 26003) > 0 ? 1 : -1) * 0.025 * Math.exp(-eighthPhase * 14);
  const calm = track.id === "memory-glow";
  const raw = chord * (calm ? 0.14 : 0.09) + bass * 0.19 + melody * (calm ? 0.11 : 0.16) + kick * (calm ? 0.12 : 0.22) + clap + hat;
  const edgeFade = Math.min(1, time / 0.04, (duration - time) / 0.04);
  return Math.max(-1, Math.min(1, raw * Math.max(0, edgeFade)));
}

export function createBuiltinMusicFile(track: BuiltinTrack) {
  const sampleRate = 22050;
  const duration = 32 * 60 / track.bpm;
  const samples = Math.floor(duration * sampleRate);
  const buffer = new ArrayBuffer(44 + samples * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  writeAscii(view, 8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) {
    view.setInt16(44 + index * 2, Math.round(synthSample(track, index / sampleRate, duration) * 32767), true);
  }
  return new File([buffer], `${track.name}.wav`, { type: "audio/wav" });
}
