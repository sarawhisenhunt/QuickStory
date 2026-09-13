import { Check } from "lucide-react";
import { TEMPLATES } from "../templates";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export function TemplateRail({ selectedId, onSelect }: Props) {
  return (
    <section className="template-section" aria-labelledby="template-heading">
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">1 · PICK A FEEL</span>
          <h2 id="template-heading">Start with a look</h2>
        </div>
        <span className="section-note">Change it anytime</span>
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
              <span className="template-mood">{template.mood}</span>
              <span className="template-letter">Aa</span>
              <i />
              {selectedId === template.id && <span className="selected-mark"><Check size={15} /></span>}
            </div>
            <strong>{template.name}</strong>
            <small>{template.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
