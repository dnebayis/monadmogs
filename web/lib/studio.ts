import { kv } from "@vercel/kv";

export const STUDIO_PROJECTS_KEY = "studio:projects";

export type StudioProject = {
  id: string;
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  builder: string;
  status: "pending" | "approved";
  createdAt: string;
};

export type StudioSubmission = {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  builder: string;
};

type ValidationResult =
  | { ok: true; data: StudioSubmission }
  | { ok: false; error: string };

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateStudioSubmission(body: unknown): ValidationResult {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required." };
  }

  const { title, description, url, imageUrl, builder } = body as Record<string, unknown>;

  if (typeof title !== "string" || title.trim().length < 2 || title.trim().length > 80) {
    return { ok: false, error: "Title must be between 2 and 80 characters." };
  }

  if (typeof description !== "string" || description.trim().length < 5 || description.trim().length > 280) {
    return { ok: false, error: "Description must be between 5 and 280 characters." };
  }

  if (typeof url !== "string" || !isValidUrl(url.trim())) {
    return { ok: false, error: "A valid project URL is required." };
  }

  if (typeof imageUrl !== "string" || !isValidUrl(imageUrl.trim())) {
    return { ok: false, error: "A valid preview image URL is required." };
  }

  if (typeof builder !== "string" || builder.trim().length < 1 || builder.trim().length > 40) {
    return { ok: false, error: "Builder name must be between 1 and 40 characters." };
  }

  return {
    ok: true,
    data: {
      title: title.trim(),
      description: description.trim(),
      url: url.trim(),
      imageUrl: imageUrl.trim(),
      builder: builder.trim(),
    },
  };
}

export async function getApprovedProjects(): Promise<StudioProject[]> {
  try {
    const projects = await kv.lrange<StudioProject>(STUDIO_PROJECTS_KEY, 0, -1);
    return projects.filter((p) => p.status === "approved");
  } catch {
    return [];
  }
}

export async function submitProject(data: StudioSubmission): Promise<StudioProject> {
  const project: StudioProject = {
    id: crypto.randomUUID(),
    ...data,
    status: "approved",
    createdAt: new Date().toISOString(),
  };

  await kv.lpush(STUDIO_PROJECTS_KEY, project);
  return project;
}
