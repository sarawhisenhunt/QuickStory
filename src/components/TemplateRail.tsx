import { Check, Sparkles } from "lucide-react";
import { TEMPLATES } from "../templates";

interface Props {
  selectedId: string;
  recommendedId: string;
  videoCount: number;
  photoCount: number;
  onSelect: (id: string) => void;
}

export function TemplateRail({ selectedId, recommendedId, videoCount, photoCount, onSelect }: Props) {
  return (
    <section className="template-section" aria-labelledby="template-heading">
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">2 · YOUR BEST-FIT STORY</span>
          <h2 id="template-heading">We picked the structure</h2>
        </div>
        <span className="section-note">{videoCount} video{videoCount === 1 ? "" : "s"} · {photoCount} photo{photoCount === 1 ? "" : "s"} · Change it anytime</span>
      </div>
      <div className="template-rail">
        {TEMPLATES.map((template) => (
          <button
            className={`template-card ${selectedId === template.id ? "selected" : ""}`}
            key={template.id}
            onClick={() => onSelect(template.id)}
            aria-pressed={selectedId === template.id}
          >
            <div className={`template-art ${template.previewClass}`}>
              {template.id === recommendedId && (videoCount > 0 || photoCount > 0) && <span className="best-match"><Sparkles size={11} />Best match</span>}
              <span className="template-mood">{template.mood}</span>
              <span className="template-letter">Aa</span>
              <i />
              {selectedId === template.id && <span className="selected-mark"><Check size={15} /></span>}
            </div>
            <strong>{template.name}</strong>
            <span className="template-fit">{template.fitLabel}</span>
            <small>{template.description}</small>
            <span className="template-details">
              <em>{template.transitionLabel}</em>
              <em>{template.effectLabel}</em>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
