/* linkprofile homepage: the hero entrance.
   Loaded after GSAP in assets/js/home.js. Without this script the page is complete and static. */
(function () {
  'use strict';
  var gsap = window.gsap;
  if (!gsap) return;

  var $ = function (sel, el) { return (el || document).querySelector(sel); };
  var $$ = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

  // ---- Hero entrance: one orchestrated moment, only when motion is welcome. ----
  var mm = gsap.matchMedia();
  var entered = false;
  mm.add('(prefers-reduced-motion: no-preference)', function () {
    if (entered) return;
    entered = true;
    // Play only before the page has been seen: if the script arrives late (slow network),
    // hiding visible content to replay it would be a flash, so the page simply stays as it is.
    var painted = performance.getEntriesByType('paint').some(function (e) { return e.name === 'first-contentful-paint'; });
    if (painted || performance.now() > 800) return;
    var title = $('[data-hero="title"]');
    var fan = $('#themes');
    if (!title || !fan) return;

    var phones = $$(':scope > a', fan);
    var labels = phones.map(function (a) { return $('p', a); });
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    // The headline moves as one block: splitting it into words changes how it wraps
    // while the web font loads, which shifts the layout.
    tl.from(title, { y: 22, opacity: 0, duration: 0.55, clearProps: 'transform,opacity' }, 0)
      .from('[data-hero="sub"]', { y: 14, opacity: 0, duration: 0.45, clearProps: 'transform,opacity' }, 0.3)
      .from($$('[data-hero="actions"] > a'), { y: 12, opacity: 0, duration: 0.4, stagger: 0.06, clearProps: 'transform,opacity' }, 0.45);

    if (window.matchMedia('(min-width: 901px)').matches) {
      // The phones start stacked in the middle of the row and fan out to where the CSS puts them.
      // The <a> wrappers move; each .phone keeps its CSS fan rotation (and hover lift) throughout.
      var box = fan.getBoundingClientRect();
      var mid = box.left + box.width / 2;
      var centre = (phones.length - 1) / 2;
      tl.set(phones, { zIndex: function (i) { return 10 - Math.round(Math.abs(i - centre)); } }, 0)
        .set(labels, { opacity: 0 }, 0)
        .from(phones, {
          x: function (i, el) { var r = el.getBoundingClientRect(); return mid - (r.left + r.width / 2); },
          y: 50,
          duration: 0.75,
          ease: 'power3.inOut',
          clearProps: 'all',
        }, 0.5)
        .from(phones, { opacity: 0, duration: 0.3, ease: 'power1.out', clearProps: 'opacity' }, 0.5)
        .to(labels, { opacity: 1, duration: 0.3, clearProps: 'opacity' }, 1.05);
    } else {
      // Swipe row: the phones just rise in, one after another.
      tl.from(phones, { y: 24, opacity: 0, duration: 0.5, stagger: 0.08, clearProps: 'transform,opacity' }, 0.5);
    }
    tl.from('[data-hero="note"]', { opacity: 0, duration: 0.4, clearProps: 'opacity' }, 1.0);
  });
})();
