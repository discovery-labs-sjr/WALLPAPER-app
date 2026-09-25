(() => {
  'use strict';
  // The main gallery renderer now owns the profile rail and its data lifecycle.
  // Keep this legacy entry point inert to avoid duplicate DOM/event bindings.
  if (window.__wallverseProfileRailManaged) return;
  window.__wallverseProfileRailManaged = true;
})();
