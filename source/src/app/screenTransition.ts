export function createScreenTransition(workshop: HTMLElement) {
  const curtain = document.createElement('div');
  curtain.className = 'screen-transition';
  curtain.setAttribute('aria-hidden', 'true');
  curtain.innerHTML = '<div class="transition-orbit"></div><div class="transition-route"></div>';
  document.body.append(curtain);
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let busy = false;
  let disposed = false;
  const animations = new Set<Animation>();
  async function animate(element: HTMLElement, frames: Keyframe[], duration: number) {
    const animation = element.animate(frames, { duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
    animations.add(animation);
    // Background surfaces can suspend animation timelines; navigation must still finish.
    let timer = 0;
    await Promise.race([
      animation.finished.catch(() => {}),
      new Promise<void>(resolve => { timer = window.setTimeout(resolve, duration + 100); }),
    ]);
    window.clearTimeout(timer);
    return animation;
  }
  return {
    async run(from: HTMLElement, to: HTMLElement, swap: () => void, focus: HTMLElement, style: 'city' | 'gallery' = 'city') {
      if (busy || disposed) return;
      busy = true;
      workshop.inert = true;
      workshop.setAttribute('aria-busy', 'true');
      try {
        const gallery = style === 'gallery';
        curtain.classList.toggle('is-gallery', gallery);
        if (!motion.matches) {
          curtain.classList.add('is-active');
          await Promise.all([
            animate(from, [{ opacity: 1, transform: 'translateY(0) scale(1)' }, { opacity: 0, transform: gallery ? 'translateY(-6px)' : 'translateY(-18px) scale(.975)' }], gallery ? 360 : 240),
            animate(curtain, [{ opacity: 0 }, { opacity: 1 }], gallery ? 360 : 240),
          ]);
        }
        if (disposed) return;
        swap();
        // Allow the destination canvas to resize and render before revealing it.
        if (!motion.matches) {
          await new Promise<void>(resolve => {
            const timer = window.setTimeout(resolve, 100);
            requestAnimationFrame(() => requestAnimationFrame(() => { window.clearTimeout(timer); resolve(); }));
          });
          if (disposed) return;
          await Promise.all([
            animate(to, [{ opacity: 0, transform: gallery ? 'translateY(12px)' : 'translateY(24px) scale(1.025)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], gallery ? 760 : 560),
            animate(curtain, [{ opacity: 1 }, { opacity: 0 }], gallery ? 680 : 480),
          ]);
        }
      } finally {
        animations.forEach(animation => animation.cancel());
        animations.clear();
        curtain.classList.remove('is-active');
        workshop.inert = false;
        workshop.removeAttribute('aria-busy');
        busy = false;
        if (!disposed && !to.hidden) focus.focus({ preventScroll: true });
      }
    },
    dispose() { disposed = true; animations.forEach(animation => animation.cancel()); curtain.remove(); },
  };
}
