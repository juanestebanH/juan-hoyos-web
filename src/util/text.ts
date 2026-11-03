export function splitMaskWords(element: HTMLElement | null): HTMLElement[] {
  if (!element) return [];
  if (element.dataset.split === 'words') {
    return Array.from(
      element.querySelectorAll<HTMLElement>('.mask-word__inner'),
    );
  }

  const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  element.textContent = '';
  element.dataset.split = 'words';
  const pieces = text.split(' ');
  const inners: HTMLElement[] = [];

  pieces.forEach((piece, index) => {
    const word = document.createElement('span');
    word.className = 'mask-word';
    word.setAttribute('aria-hidden', 'true');

    const inner = document.createElement('span');
    inner.className = 'mask-word__inner';
    inner.textContent = piece;

    word.appendChild(inner);
    element.appendChild(word);
    inners.push(inner);

    if (index < pieces.length - 1) {
      element.appendChild(document.createTextNode(' '));
    }
  });

  element.setAttribute('aria-label', text);
  return inners;
}

export function splitChars(element: HTMLElement | null): HTMLElement[] {
  if (!element) return [];
  if (element.dataset.split === 'chars') {
    return Array.from(element.querySelectorAll<HTMLElement>('.split-char'));
  }

  const text = element.textContent ?? '';
  element.textContent = '';
  element.dataset.split = 'chars';
  const chars: HTMLElement[] = [];

  for (const char of text) {
    if (char === ' ') {
      element.appendChild(document.createTextNode(' '));
      continue;
    }
    const span = document.createElement('span');
    span.className = 'split-char';
    span.textContent = char;
    element.appendChild(span);
    chars.push(span);
  }

  element.setAttribute('aria-label', text);
  return chars;
}
