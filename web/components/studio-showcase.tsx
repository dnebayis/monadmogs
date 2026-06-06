"use client";

import { useEffect, useRef, useState } from "react";
import type { StudioProject } from "@/lib/studio";
import { API_BASE_URL } from "@/lib/urls";

type SubmitForm = {
  title: string;
  description: string;
  url: string;
  imageUrl: string;
  builder: string;
};

const emptyForm: SubmitForm = { title: "", description: "", url: "", imageUrl: "", builder: "" };

export function StudioShowcase() {
  const [projects, setProjects] = useState<StudioProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [form, setForm] = useState<SubmitForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/studio`)
      .then((res) => res.json())
      .then((data) => setProjects(data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setIsLoading(false));
  }, []);

  function updateField(field: keyof SubmitForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSubmitResult(null);
  }

  async function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setSubmitResult({ ok: false, message: "Image must be under 2MB." });
      return;
    }

    setIsUploading(true);
    setSubmitResult(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/studio/upload`, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      const data = await res.json();

      if (!res.ok) {
        setSubmitResult({ ok: false, message: data.error || "Upload failed." });
        return;
      }

      setForm((current) => ({ ...current, imageUrl: data.url }));
    } catch {
      setSubmitResult({ ok: false, message: "Upload failed. Try again." });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/studio/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        setSubmitResult({ ok: false, message: data.error || "Submission failed." });
        return;
      }

      setSubmitResult({ ok: true, message: "Project submitted. It's live now." });
      setForm(emptyForm);
      setShowForm(false);

      // Refresh project list (bypass cache)
      const refreshed = await fetch(`${API_BASE_URL}/api/studio`, { cache: "no-store" }).then((r) => r.json());
      setProjects(refreshed.projects || []);
    } catch {
      setSubmitResult({ ok: false, message: "Network error. Try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="studio-section">
      <div className="section-heading">
        <p className="eyebrow">Studio</p>
        <h2>Projects built with the Mogs API.</h2>
        <p className="section-copy">
          Image generators, trait tools, bots, and creative experiments from the Monad Mogs community. Build something
          and submit it.
        </p>
      </div>

      {isLoading ? (
        <p className="studio-loading">Loading projects...</p>
      ) : projects.length > 0 ? (
        <div className="studio-grid">
          {projects.map((project) => (
            <a
              key={project.id}
              className="studio-card"
              href={project.url}
              target="_blank"
              rel="noreferrer"
            >
              <div className="studio-card-image">
                <img src={project.imageUrl} alt={project.title} loading="lazy" />
              </div>
              <div className="studio-card-body">
                <strong>{project.title}</strong>
                <p>{project.description}</p>
                <span className="studio-builder">{project.builder}</span>
              </div>
            </a>
          ))}
        </div>
      ) : (
        <div className="studio-empty">
          <p>No projects yet. Be the first to submit one.</p>
        </div>
      )}

      <div className="studio-submit-section">
        <button
          type="button"
          className="secondary-action"
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "Close" : "Submit a Project"}
        </button>

        {showForm && (
          <form className="studio-form" onSubmit={handleSubmit}>
            <label>
              <span>Project name</span>
              <input
                value={form.title}
                onChange={(e) => updateField("title", e.target.value)}
                placeholder="Mog Avatar Generator"
                maxLength={80}
                required
              />
            </label>
            <label>
              <span>Description</span>
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                placeholder="What does your project do?"
                maxLength={280}
                required
              />
            </label>
            <label>
              <span>Project URL</span>
              <input
                value={form.url}
                onChange={(e) => updateField("url", e.target.value)}
                placeholder="https://your-project.vercel.app"
                type="url"
                required
              />
            </label>
            <label>
              <span>Preview image</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleImageUpload}
                disabled={isUploading}
              />
              {isUploading && <span className="studio-uploading">Uploading...</span>}
              {form.imageUrl && !isUploading && (
                <span className="studio-uploaded">Image uploaded</span>
              )}
            </label>
            <label>
              <span>Your name</span>
              <input
                value={form.builder}
                onChange={(e) => updateField("builder", e.target.value)}
                placeholder="Builder name or handle"
                maxLength={40}
                required
              />
            </label>
            <div className="studio-form-actions">
              <button
                className="primary-action"
                type="submit"
                disabled={isSubmitting || isUploading || !form.imageUrl}
              >
                {isSubmitting ? "Submitting..." : "Submit Project"}
              </button>
            </div>
            {submitResult && (
              <p className={submitResult.ok ? "studio-success" : "error"}>
                {submitResult.message}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
