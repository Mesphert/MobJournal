let mq;
export function applyTheme(mode) {
  const root = document.documentElement;
  mq ??= window.matchMedia('(prefers-color-scheme: dark)');
  const dark = mode === 'dark' || (mode === 'system' && mq.matches);
  root.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0f17' : '#f4f6fb');
}

export function watchSystemTheme(getMode) {
  mq ??= window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener('change', () => getMode() === 'system' && applyTheme('system'));
}
