-- P30.1 Equation OCR → LaTeX — photo to editable LaTeX for STEM notes.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_equation_ocr_latex',
    'Convert equation photos to editable LaTeX via Gemini vision (manual correct step before insert)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
