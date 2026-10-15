(() => {
"use strict";

const header = document.querySelector("[data-header]");
const scrollTop = document.querySelector(".scroll-top");
const toggle = document.querySelector(".menu-toggle");
const mobilePanel = document.querySelector(".mobile-panel");
const mobileOverlay = document.querySelector(".mobile-overlay");
const slides = Array.from(document.querySelectorAll(".slide"));
const dotsWrap = document.querySelector(".slider-dots");
const prev = document.querySelector(".slider-arrow.prev");
const next = document.querySelector(".slider-arrow.next");
const yearEl = document.getElementById("copy-year");
const toast = document.querySelector(".forgewell-toast");

if (yearEl) {
  const currentYear = new Date().getFullYear();
  yearEl.textContent = currentYear > 2015 ? `2015-${currentYear}` : "2015-2026";
}

/* ---- Toast ---- */
let toastTimer = 0;
window.ForgewellToast = (msg, duration) => {
if (!toast || typeof msg !== "string") return;
clearTimeout(toastTimer);
toast.textContent = msg;
toast.classList.add("show");
toastTimer = setTimeout(() => toast.classList.remove("show"), duration || 3200);
};

/* ---- Reveal on scroll ---- */
const revealSections = Array.from(document.querySelectorAll("[data-reveal]"));
if (revealSections.length && "IntersectionObserver" in window) {
const io = new IntersectionObserver(
(entries) => {
entries.forEach((entry) => {
if (entry.isIntersecting) {
entry.target.classList.add("revealed");
io.unobserve(entry.target);
}
});
},
{ threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
);
revealSections.forEach((el) => io.observe(el));
}

/* ---- Animated counters (XSS-safe: uses textContent + appendChild, never innerHTML) ---- */
const counters = Array.from(document.querySelectorAll("[data-count]"));
if (counters.length && "IntersectionObserver" in window) {
const counterIO = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.getAttribute("data-count"), 10);
      if (isNaN(target)) { counterIO.unobserve(el); return; }
      const suffix = el.querySelector(".accent");
      const suffixClone = suffix ? suffix.cloneNode(true) : null;
      const updateCounter = (value) => {
        while (el.firstChild) el.removeChild(el.firstChild);
        el.appendChild(document.createTextNode(String(value)));
        if (suffixClone) el.appendChild(suffixClone.cloneNode(true));
      };
      let current = 0;
      const duration = 1800;
      const startTime = performance.now();
      const step = (now) => {
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        current = Math.round(ease * target);
        updateCounter(current);
        if (progress < 1) requestAnimationFrame(step);
        else { updateCounter(target); counterIO.unobserve(el); }
      };
      requestAnimationFrame(step);
    });
  },
  { threshold: 0.3 }
);
counters.forEach((el) => counterIO.observe(el));
}

/* ---- Smooth scroll with offset + active nav highlighting ---- */
const navLinks = Array.from(document.querySelectorAll('.desktop-nav a[href^="#"]'));
const updateActiveNav = (targetId) => {
  navLinks.forEach((link) => {
    const isMatch = link.getAttribute("href") === "#" + targetId;
    link.setAttribute("aria-current", isMatch ? "page" : "false");
  });
};
document.addEventListener("click", (e) => {
  const anchor = e.target.closest('a[href^="#"]');
  if (!anchor) return;
  const id = anchor.getAttribute("href").slice(1);
  if (!id) return;
  const target = document.getElementById(id);
  if (!target) return;
  e.preventDefault();
  const offset = 80;
  const top = target.getBoundingClientRect().top + window.scrollY - offset;
  window.scrollTo({ top, behavior: "smooth" });
  updateActiveNav(id);
});

/* ---- Mobile overlay click-to-close ---- */
const closeMenu = () => {
document.body.classList.remove("menu-open");
if (toggle) toggle.setAttribute("aria-expanded", "false");
if (mobilePanel) mobilePanel.setAttribute("aria-hidden", "true");
};
if (mobileOverlay) {
mobileOverlay.addEventListener("click", closeMenu, { passive: true });
}

/* ---- Slider ---- */
let active = 0;
let timer = 0;

const setHeader = () => {
if (!header) return;
const y = window.scrollY;
header.classList.toggle("active", y > 80);
if (scrollTop) scrollTop.classList.toggle("show", y > 480);
};

if (toggle) {
toggle.addEventListener("click", () => {
const isOpen = document.body.classList.toggle("menu-open");
toggle.setAttribute("aria-expanded", String(isOpen));
if (mobilePanel) mobilePanel.setAttribute("aria-hidden", String(!isOpen));
});
}

if (mobilePanel) {
mobilePanel.addEventListener("click", (event) => {
if (event.target.closest("a")) closeMenu();
});
}

window.addEventListener("keydown", (event) => {
if (event.key === "Escape") closeMenu();
});

let ticking = false;
const onScroll = () => {
if (ticking) return;
ticking = true;
window.requestAnimationFrame(() => {
setHeader();
ticking = false;
});
};
window.addEventListener("scroll", onScroll, { passive: true });
setHeader();

const showSlide = (index) => {
if (!slides.length) return;
active = ((index % slides.length) + slides.length) % slides.length;
for (let i = 0; i < slides.length; i++) {
const isActive = i === active;
slides[i].classList.toggle("is-active", isActive);
slides[i].setAttribute("aria-hidden", isActive ? "false" : "true");
}
if (dotsWrap) {
const dots = dotsWrap.querySelectorAll("button");
for (let i = 0; i < dots.length; i++) {
const isActive = i === active;
dots[i].classList.toggle("is-active", isActive);
dots[i].setAttribute("aria-current", isActive ? "true" : "false");
}
}
};

const queueSlider = () => {
if (timer) window.clearInterval(timer);
if (slides.length < 2) return;
if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
timer = window.setInterval(() => showSlide(active + 1), 5200);
};

const bindHoverPause = (root) => {
if (!root) return;
let paused = false;
const stop = () => { paused = true; if (timer) { window.clearInterval(timer); timer = 0; } };
const start = () => { if (paused) { paused = false; queueSlider(); } };
root.addEventListener("mouseenter", stop, { passive: true });
root.addEventListener("mouseleave", start, { passive: true });
root.addEventListener("focusin", stop);
root.addEventListener("focusout", start);
};

if (slides.length && dotsWrap) {
for (let i = 0; i < slides.length; i++) {
const dot = document.createElement("button");
dot.type = "button";
dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
dot.addEventListener("click", () => {
showSlide(i);
queueSlider();
});
dotsWrap.appendChild(dot);
}
if (prev) prev.addEventListener("click", () => { showSlide(active - 1); queueSlider(); });
if (next) next.addEventListener("click", () => { showSlide(active + 1); queueSlider(); });
const slider = document.querySelector(".hero-slider");
if (slider) {
let touchStartX = 0;
slider.addEventListener("touchstart", (e) => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
slider.addEventListener("touchend", (e) => {
const dx = e.changedTouches[0].clientX - touchStartX;
if (Math.abs(dx) > 50) {
showSlide(active + (dx < 0 ? 1 : -1));
queueSlider();
}
}, { passive: true });
}
bindHoverPause(document.querySelector(".hero-style-2"));
showSlide(0);
queueSlider();
}

const newsletter = document.querySelector(".newsletter");
if (newsletter) {
newsletter.addEventListener("submit", (event) => {
event.preventDefault();
const input = newsletter.querySelector("input[type=email]");
if (input && input.checkValidity()) {
event.currentTarget.reset();
window.ForgewellToast("Thanks — we will be in touch.");
} else if (input) {
input.reportValidity();
}
});
}

if ("serviceWorker" in navigator && location.protocol !== "file:") {
window.addEventListener("load", () => {
navigator.serviceWorker.register("sw.js").catch(() => {});
});
}
})();
