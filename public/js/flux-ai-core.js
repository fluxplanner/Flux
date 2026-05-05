/**
 * Flux AI core — long-term memory hooks, task routing labels, quiz helper.
 * Loads after app.js; uses getSB/currentUser when signed in.
 */
(function () {
  'use strict';

  async function storeMemory(type, key, value) {
    if (typeof getSB !== 'function' || typeof currentUser === 'undefined' || !currentUser) return;
    try {
      var sb = getSB();
      await sb.from('flux_user_memory').upsert(
        {
          user_id: currentUser.id,
          type: type,
          key: key,
          value: value,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,type,key' }
      );
    } catch (e) {
      console.warn('[FluxAICore] storeMemory', e);
    }
  }

  function afterExchange(userMsg, aiMsg) {
    var u = String(userMsg || '');
    var low = u.toLowerCase();
    if (/i struggle|hard for me|confused about|don't understand/i.test(low)) {
      storeMemory('weakness', 'last_hint', { text: u.slice(0, 500) });
    }
    if (/remind me|every (day|week)|don't let me forget/i.test(low)) {
      storeMemory('habit', 'reminder_pattern', { text: u.slice(0, 400) });
    }
  }

  function detectTaskType(prompt) {
    var p = String(prompt || '').toLowerCase();
    if (/analyze|explain deeply|prove|why\b/.test(p)) return 'reasoning';
    if (/research|latest news|sources?\b/.test(p)) return 'research';
    if (String(prompt || '').length < 50) return 'fast';
    return 'chat';
  }

  /** Uses the same AI proxy as chat; call from UI when you add a Quiz button. */
  async function generateQuiz(topic, difficulty) {
    topic = String(topic || '').trim() || 'your course material';
    difficulty = difficulty || 'medium';
    if (typeof API === 'undefined' || !API.ai) {
      if (typeof showToast === 'function') showToast('AI unavailable', 'error');
      return '';
    }
    var body = {
      system:
        'You write clear study materials. Output markdown only: sections for questions, then an Answer key with brief explanations.',
      messages: [
        {
          role: 'user',
          content:
            'Create a quiz on: ' +
            topic +
            '. Difficulty: ' +
            difficulty +
            '. Include 6–10 questions (mix MCQ and short answer) and answers at the end.',
        },
      ],
    };
    try {
      var headers = typeof fluxAuthHeaders === 'function' ? await fluxAuthHeaders() : {};
      var res = await fetch(API.ai, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
      });
      var data = await res.json().catch(function () {
        return {};
      });
      if (!res.ok) throw new Error(data.error || 'HTTP ' + res.status);
      var text = '';
      if (data.content && data.content[0] && data.content[0].text) text = data.content[0].text;
      return text || "Couldn't generate a quiz.";
    } catch (e) {
      if (typeof showToast === 'function') showToast(e.message || 'Quiz failed', 'error');
      return '';
    }
  }

  window.FluxAICore = {
    storeMemory: storeMemory,
    afterExchange: afterExchange,
    detectTaskType: detectTaskType,
    generateQuiz: generateQuiz,
  };
})();
