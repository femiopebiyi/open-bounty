"use client";

import { SUPPORTED_LANGUAGES, LANGUAGE_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface LanguageFilterProps {
  selected: string[];
  onChange: (langs: string[]) => void;
}

export function LanguageFilter({ selected, onChange }: LanguageFilterProps) {
  const toggle = (lang: string) => {
    if (selected.includes(lang)) {
      onChange(selected.filter((l) => l !== lang));
    } else {
      onChange([...selected, lang]);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-2xs font-medium text-ink-500 uppercase tracking-[0.06em]">
          Language
        </h3>
        {selected.length > 0 && (
          <button
            onClick={() => onChange([])}
            className="text-2xs text-ink-400 hover:text-ink-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>
      <div className="space-y-px">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = selected.includes(lang);
          return (
            <button
              key={lang}
              onClick={() => toggle(lang)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] transition-colors text-left group",
                active
                  ? "bg-ink-100 text-ink-950"
                  : "text-ink-600 hover:text-ink-900 hover:bg-ink-50"
              )}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: LANGUAGE_COLORS[lang] }}
              />
              <span className="flex-1">{lang}</span>
              {active && <Check className="w-3 h-3 text-ink-700" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
