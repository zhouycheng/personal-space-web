import { createDomInstances } from '../../../justin-kit/runtime/domInstances';

createDomInstances('[data-works-portfolio]', root => {
      const viewport = root.querySelector("[data-project-viewport]");
      const track = root.querySelector("[data-project-track]");
      const page = root.closest(".app-page");
      const tabs = Array.from(root.querySelectorAll("[data-project-tab]"));
      const panels = Array.from(root.querySelectorAll("[data-project-panel]"));
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const WHEEL_THRESHOLD = 72;
      const TOUCH_THRESHOLD = 42;
      const ANIMATION_LOCK_MS = reduceMotion ? 80 : 620;

      if (!(viewport instanceof HTMLElement) || !(track instanceof HTMLElement) || tabs.length === 0 || panels.length === 0) {
        return;
      }

      let activeIndex = 0;
      let resizeFrame = 0;
      let wheelIntent = 0;
      let wheelDirection = 0;
      let unlockTimer = 0;
      let isAnimating = false;
      let touchStartY = 0;
      let routeActive = isRouteActive();
      let suspended = false;
      const events = new AbortController();
      const options = { signal: events.signal };

      function isRouteActive() {
        return !document.hidden && (!page || page.classList.contains("is-active"));
      }

      function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
      }

      function setActiveProject(index) {
        const nextIndex = clamp(index, 0, panels.length - 1);
        activeIndex = nextIndex;
        viewport.style.setProperty("--active-project-index", String(nextIndex));

        tabs.forEach((tab, tabIndex) => {
          const isActive = tabIndex === nextIndex;
          tab.classList.toggle("is-active", isActive);
          tab.setAttribute("aria-selected", String(isActive));
        });

        panels.forEach((panel, panelIndex) => {
          panel.setAttribute("aria-hidden", String(panelIndex !== nextIndex));
        });
      }

      function lockAnimation() {
        isAnimating = true;
        track.classList.add("is-animating");
        if (unlockTimer) window.clearTimeout(unlockTimer);
        unlockTimer = window.setTimeout(() => {
          isAnimating = false;
          wheelIntent = 0;
          wheelDirection = 0;
          track.classList.remove("is-animating");
        }, ANIMATION_LOCK_MS);
      }

      function goToProject(index) {
        const nextIndex = clamp(index, 0, panels.length - 1);
        if (nextIndex === activeIndex) return false;
        setActiveProject(nextIndex);
        lockAnimation();
        return true;
      }

      function moveByDirection(direction) {
        if (!direction || isAnimating) return;
        goToProject(activeIndex + direction);
      }

      function handleWheel(event) {
        if (!routeActive) return;
        event.preventDefault();
        if (isAnimating) return;

        const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
        const direction = dominantDelta > 0 ? 1 : -1;

        if (direction !== wheelDirection) {
          wheelDirection = direction;
          wheelIntent = 0;
        }

        wheelIntent += Math.abs(dominantDelta);

        if (wheelIntent >= WHEEL_THRESHOLD) {
          wheelIntent = 0;
          moveByDirection(direction);
        }
      }

      tabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          if (!routeActive) return;
          const index = Number(tab.getAttribute("data-project-index") ?? "0");
          goToProject(index);
        }, options);
      });

      viewport.addEventListener("keydown", (event) => {
        if (!routeActive) return;
        if (event.key === "ArrowDown" || event.key === "PageDown") {
          event.preventDefault();
          goToProject(activeIndex + 1);
        }

        if (event.key === "ArrowUp" || event.key === "PageUp") {
          event.preventDefault();
          goToProject(activeIndex - 1);
        }

        if (event.key === "Home") {
          event.preventDefault();
          goToProject(0);
        }

        if (event.key === "End") {
          event.preventDefault();
          goToProject(panels.length - 1);
        }
      }, options);

      viewport.addEventListener("wheel", handleWheel, { ...options, passive: false });

      viewport.addEventListener("touchstart", (event) => {
        if (!routeActive) return;
        touchStartY = event.touches[0]?.clientY ?? 0;
      }, { ...options, passive: true });

      viewport.addEventListener("touchmove", (event) => {
        if (!routeActive) return;
        if (!touchStartY || isAnimating) return;
        const currentY = event.touches[0]?.clientY ?? touchStartY;
        const delta = touchStartY - currentY;
        if (Math.abs(delta) < TOUCH_THRESHOLD) return;
        event.preventDefault();
        moveByDirection(delta > 0 ? 1 : -1);
        touchStartY = 0;
      }, { ...options, passive: false });

      window.addEventListener("resize", () => {
        if (!routeActive) return;
        if (resizeFrame) return;
        resizeFrame = window.requestAnimationFrame(() => {
          resizeFrame = 0;
          setActiveProject(activeIndex);
        });
      }, options);

      function stop() {
        clearTimeout(unlockTimer);
        cancelAnimationFrame(resizeFrame);
        resizeFrame = unlockTimer = wheelIntent = wheelDirection = touchStartY = 0;
        isAnimating = false;
        track.classList.remove('is-animating');
      }
      function updateActivity() {
        routeActive = !suspended && isRouteActive();
        if (routeActive) setActiveProject(activeIndex);
        else stop();
      }
      const pageObserver = new MutationObserver(updateActivity);
      if (page) pageObserver.observe(page, { attributes: true, attributeFilter: ['class'] });
      document.addEventListener('visibilitychange', updateActivity, options);
      window.addEventListener('pagehide', () => { suspended = true; updateActivity(); }, options);
      window.addEventListener('pageshow', () => { suspended = false; updateActivity(); }, options);
      viewport.addEventListener('touchcancel', () => { touchStartY = 0; }, options);

      setActiveProject(0);
      return () => { stop(); events.abort(); pageObserver.disconnect(); };
}).init();
