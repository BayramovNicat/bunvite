type Child = HTMLElement | SVGElement | string | number | boolean | null | undefined | Child[];

export function h(
  tag: string | ((props: Record<string, unknown>, ...children: Child[]) => HTMLElement),
  props: Record<string, unknown> | null,
  ...children: Child[]
): HTMLElement | SVGElement {
  if (typeof tag === 'function') {
    return tag(props ?? {}, ...children);
  }

  const isSvg = tag === 'svg' || tag === 'path';
  const el = isSvg
    ? document.createElementNS('http://www.w3.org/2000/svg', tag)
    : document.createElement(tag);

  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value == null) continue;
      if (key.startsWith('on') && typeof value === 'function') {
        const eventName = key.slice(2).toLowerCase();
        el.addEventListener(eventName, value as EventListener);
      } else if (key === 'className' || key === 'class') {
        el.setAttribute('class', String(value));
      } else if (key in el && !isSvg) {
        (el as unknown as Record<string, unknown>)[key] = value;
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }

  const append = (child: Child) => {
    if (child == null || typeof child === 'boolean') return;
    if (Array.isArray(child)) {
      child.forEach(append);
    } else if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  };

  children.forEach(append);
  return el;
}

export const Fragment = (_props: unknown, ...children: Child[]) => children;
