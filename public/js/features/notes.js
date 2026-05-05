let notesAutosaveTimer;

/**
 * Debounced autosave for the notes rich editor; calls app’s `saveNote` via bridge.
 */
export function setupEditor(editor, debounceMs = 450) {
  if (!editor || editor.dataset.fluxKitNotesBound === '1') return;
  editor.dataset.fluxKitNotesBound = '1';
  editor.addEventListener('input', () => {
    clearTimeout(notesAutosaveTimer);
    notesAutosaveTimer = setTimeout(() => {
      try {
        window.__fluxSaveNote?.();
      } catch {
        /* ignore */
      }
    }, debounceMs);
  });
}

export function attachNotesEditorIfPresent() {
  const editor = document.getElementById('noteEditor');
  setupEditor(editor);
}
