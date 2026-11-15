/* =============================================================
   kauz.js: tiny auto-init for the design system.
   -------------------------------------------------------------
   Drop at the end of <body> (or in <head> with `defer`):
     <script src="js/kauz.js" defer></script>

   Currently handles:
   -------------------------------------------------------------
   • <input type="range">  → updates `--_pct` so the track fill
                              shows progress in Chrome/Safari/Edge.
                              Firefox uses native ::-moz-range-progress
                              so the variable is just a no-op there.
   • <input type="range">  → if a sibling <output> exists (anywhere
                              in the same parent), its value is kept
                              in sync. Recognised relationships:
                                <output for="myslider">
                                or sibling <output> next to the input.
   ============================================================= */

(function () {
  'use strict';

  function pct(el) {
    var min = parseFloat(el.min) || 0;
    var max = parseFloat(el.max);
    if (isNaN(max)) max = 100;
    var v = parseFloat(el.value);
    if (isNaN(v)) v = min;
    var span = max - min;
    if (span <= 0) return 0;
    return ((v - min) / span) * 100;
  }

  function findOutput(input) {
    // Prefer <output for="id"> within the same form/document.
    if (input.id) {
      var byFor = document.querySelector('output[for~="' + input.id + '"]');
      if (byFor) return byFor;
    }
    // Otherwise: nearest <output> among siblings of the input.
    var sib = input.parentElement
      ? input.parentElement.querySelector(':scope > output')
      : null;
    return sib;
  }

  function update(input) {
    var p = pct(input);
    input.style.setProperty('--_pct', p.toFixed(2) + '%');
    var out = findOutput(input);
    if (out) out.value = input.value;
  }

  function wire(input) {
    update(input);
    input.addEventListener('input', function () { update(input); });
    input.addEventListener('change', function () { update(input); });
  }

  function init() {
    var ranges = document.querySelectorAll('input[type="range"]');
    for (var i = 0; i < ranges.length; i++) wire(ranges[i]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
