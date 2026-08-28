import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

const THRESHOLD = 80;

function scrollMetrics(): { el: HTMLElement; top: number; max: number } {
  const root = document.getElementById('root');
  const shell = document.querySelector('.sidepanel-shell');
  const doc = document.scrollingElement as HTMLElement | null;
  const candidates = [shell, root, doc, document.documentElement, document.body].filter(
    (node): node is HTMLElement => node instanceof HTMLElement
  );

  let el = candidates[0] ?? document.documentElement;
  let overflow = -1;
  for (const candidate of candidates) {
    const next = candidate.scrollHeight - candidate.clientHeight;
    if (next > overflow) {
      el = candidate;
      overflow = next;
    }
  }

  return {
    el,
    top: el.scrollTop,
    max: Math.max(0, el.scrollHeight - el.clientHeight),
  };
}

const ScrollJumpButtons: React.FC = () => {
  const [showTop, setShowTop] = useState(false);
  const [showBottom, setShowBottom] = useState(false);

  useEffect(() => {
    const update = () => {
      const { top, max } = scrollMetrics();
      setShowTop(top > THRESHOLD);
      setShowBottom(max - top > THRESHOLD);
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    const observer = new MutationObserver(update);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, []);

  const jump = (to: 'top' | 'bottom') => {
    const { el, max } = scrollMetrics();
    el.scrollTo({ top: to === 'top' ? 0 : max, behavior: 'smooth' });
  };

  return (
    <>
      {showBottom ? (
        <button
          type="button"
          title="Jump to bottom"
          aria-label="Jump to bottom"
          onClick={() => jump('bottom')}
          className="fixed top-3 right-3 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md hover:bg-gray-50"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      ) : null}
      {showTop ? (
        <button
          type="button"
          title="Jump to top"
          aria-label="Jump to top"
          onClick={() => jump('top')}
          className="fixed bottom-3 right-3 z-50 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 shadow-md hover:bg-gray-50"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      ) : null}
    </>
  );
};

export default ScrollJumpButtons;
