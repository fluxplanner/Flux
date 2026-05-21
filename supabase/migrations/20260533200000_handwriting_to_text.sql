-- P34.1 Handwriting-to-text — on-device Tesseract OCR for note photos.

INSERT INTO public.flux_feature_flags (key, description, default_enabled, category) VALUES
  (
    'enable_handwriting_to_text',
    'Scan handwriting from photos into notes using on-device Tesseract OCR (editable before insert)',
    false,
    'student'
  )
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description,
  category = EXCLUDED.category;
