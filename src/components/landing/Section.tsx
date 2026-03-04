import { useEffect, useRef, useState, type ReactNode } from 'react';

interface SectionProps {
  children: ReactNode;
  id?: string;
  className?: string;
  background?: 'default' | 'secondary' | 'accent' | 'gradient' | 'glass';
  noPadding?: boolean;
}

const backgroundClassMap: Record<NonNullable<SectionProps['background']>, string> = {
  default: 'landing-section--default',
  secondary: 'landing-section--secondary',
  accent: 'landing-section--accent',
  gradient: 'landing-section--gradient',
  glass: 'landing-section--glass'
};

export function Section({ children, id, className = '', background = 'default', noPadding = false }: SectionProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const node = sectionRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <section
      id={id}
      ref={sectionRef}
      className={[
        'landing-section',
        backgroundClassMap[background],
        noPadding ? 'landing-section--no-padding' : '',
        isVisible ? 'is-visible' : '',
        className
      ].join(' ').trim()}
    >
      <div className="container landing-section__inner">
        {children}
      </div>
    </section>
  );
}
