// ===============================
// GLOBAL STATE
// ===============================
let currentUserId = null;
let syncTimeout = null;

// ===============================
// INIT EVERYTHING (CRITICAL FIX)
// ===============================
function initEverything() {
  try {
    renderAll?.();
    initEventListeners?.();
    initDashboardFeatures?.();
    initModFeatures?.();
    console.log("✅ App fully initialized");
  } catch (e) {
    console.error("❌ Init error:", e);
  }
}

// ===============================
// USER KEY HELPER (FIX DATA BLEED)
// ===============================
function getUserKey(key) {
  return `${key}_${currentUserId || "guest"}`;
}

// ===============================
// AUTO SYNC (FIXED)
// ===============================
function triggerAutoSync() {
  clearTimeout(syncTimeout);

  syncTimeout = setTimeout(() => {
    syncToCloud?.();
    console.log("☁️ Auto sync triggered");
  }, 1200);
}

// ===============================
// FORCE SYNC (FIXED)
// ===============================
async function forceSyncNow() {
  try {
    await syncFromCloud?.();
    renderAll?.(); // 🔥 THIS FIXES “NEEDS REFRESH”
    console.log("✅ Force sync complete");
  } catch (e) {
    console.error("❌ Sync failed:", e);
  }
}

// ===============================
// CLEAN STATE ON LOGIN (FIX DATA BLEED)
// ===============================
function resetStateForUser(userId) {
  const keep = ['flux_splash_shown'];

  Object.keys(localStorage).forEach(key => {
    if (!keep.includes(key)) {
      localStorage.removeItem(key);
    }
  });

  currentUserId = userId;

  console.log("🧹 Clean state for:", userId);
}

// ===============================
// LOGIN FLOW FIX
// ===============================
function onLoginSuccess(user) {
  resetStateForUser(user.id);

  currentUserId = user.id;

  initEverything(); // 🔥 ensures clicks work
}

// ===============================
// GUEST MODE FIX
// ===============================
function enterGuestMode() {
  currentUserId = "guest";
  initEverything(); // 🔥 was missing before
}

// ===============================
// LOGOUT FIX (NO MORE GUEST BUG)
// ===============================
function logout() {
  localStorage.clear();
  sessionStorage.clear();

  // remove supabase session if exists
  try {
    supabase?.auth?.signOut?.();
  } catch (e) {}

  location.href = location.origin; // HARD RESET
}

// ===============================
// SIDEBAR TOGGLE FIX
// ===============================
function initSidebarToggle() {
  const btn = document.querySelector(".menu-toggle");
  const sidebar = document.querySelector(".sidebar");

  if (!btn || !sidebar) return;

  btn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

// ===============================
// SPLASH (FIRST TIME ONLY)
// ===============================
function handleSplash() {
  if (!localStorage.getItem("flux_splash_shown")) {
    showSplash?.();
    localStorage.setItem("flux_splash_shown", "true");
  }
}

// ===============================
// MAIN STARTUP FIX
// ===============================
document.addEventListener("DOMContentLoaded", () => {
  handleSplash();

  initSidebarToggle();

  // AUTH CHECK
  if (window.user) {
    onLoginSuccess(window.user);
  } else if (localStorage.getItem("flux_was_guest")) {
    enterGuestMode();
  } else {
    // show login screen
    document.getElementById("loginScreen")?.classList.add("visible");
  }
});

// ===============================
// CLOUD PAYLOAD FIX (NO COLORS)
// ===============================
function getCloudPayload() {
  return {
    tasks,
    classes,
    notes,
    grades
    // ❌ NO theme/accent
  };
}

// ===============================
// CLOUD LOAD FIX
// ===============================
function applyCloudData(data) {
  if (!data) return;

  delete data.theme;
  delete data.accent;

  tasks = data.tasks || [];
  classes = data.classes || [];
  notes = data.notes || [];
  grades = data.grades || [];

  renderAll?.();
}
