import { serializableProject } from "./project";
import type { MediaClip, StoryProject } from "../types";

interface UploadTicket {
  mediaId: string;
  key: string;
  partSize: number;
}

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`);
  return body as T;
}

export async function uploadClip(projectId: string, clip: MediaClip): Promise<string> {
  if (clip.remoteKey) return clip.remoteKey;
  if (!clip.file) throw new Error(`The original file for ${clip.name} is unavailable.`);
  const ticket = await jsonRequest<UploadTicket>("/api/uploads", {
    method: "POST",
    body: JSON.stringify({
      projectId,
      name: clip.name,
      mimeType: clip.mimeType,
      size: clip.file.size
    })
  });
  const parts: Array<{ partNumber: number; etag: string }> = [];
  for (let offset = 0, partNumber = 1; offset < clip.file.size; offset += ticket.partSize, partNumber += 1) {
    const part = clip.file.slice(offset, Math.min(offset + ticket.partSize, clip.file.size));
    const upload = await fetch(`/api/uploads/${ticket.mediaId}/parts/${partNumber}`, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: part
    });
    const result = await upload.json().catch(() => ({})) as { etag?: string; error?: string };
    if (!upload.ok || !result.etag) throw new Error(result.error || `Upload failed for ${clip.name}.`);
    parts.push({ partNumber, etag: result.etag });
  }
  await jsonRequest(`/api/uploads/${ticket.mediaId}/complete`, {
    method: "POST",
    body: JSON.stringify({ parts })
  });
  return ticket.key;
}

export async function exportProject(
  project: StoryProject,
  onProgress: (completed: number, total: number) => void
) {
  // Create the project row before media rows so the database relationship is valid.
  await jsonRequest("/api/projects", {
    method: "PUT",
    body: JSON.stringify(serializableProject(project))
  });
  const uploaded = [] as StoryProject["clips"];
  for (let index = 0; index < project.clips.length; index += 1) {
    const clip = project.clips[index];
    const remoteKey = await uploadClip(project.id, clip);
    uploaded.push({ ...clip, remoteKey });
    onProgress(index + 1, project.clips.length);
  }
  const readyProject = { ...project, clips: uploaded };
  await jsonRequest("/api/projects", {
    method: "PUT",
    body: JSON.stringify(serializableProject(readyProject))
  });
  const render = await jsonRequest<{ jobId: string; downloadUrl: string }>("/api/renders", {
    method: "POST",
    body: JSON.stringify(serializableProject(readyProject))
  });
  return { ...render, project: readyProject };
}
