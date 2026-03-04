import { useEffect } from 'react';

type MetaDefinition = { name: string; content: string } | { property: string; content: string };

function upsertMetaTag(definition: MetaDefinition) {
  const isProperty = 'property' in definition;
  const key = isProperty ? 'property' : 'name';
  const value = isProperty ? definition.property : definition.name;
  const selector = `meta[${key}="${value}"]`;
  let element = document.querySelector<HTMLMetaElement>(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(key, value);
    document.head.appendChild(element);
  }

  element.setAttribute('content', definition.content);
}

function upsertCanonicalLink(url: string) {
  let link = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }

  link.setAttribute('href', url);
}

export function SEO() {
  useEffect(() => {
    const title = 'EJC Capelinha | Encontro de Jovens com Cristo e Pré-Cadastro';
    const description =
      'Participe do EJC Capelinha. Uma experiência de fé, amizade e renovação para jovens. Faça seu pré-cadastro e receba as próximas orientações.';
    const url = window.location.href;
    const image = `${window.location.origin}/landing_hero.png`;

    document.title = title;
    document.documentElement.lang = 'pt-BR';
    upsertCanonicalLink(url);

    const metaTags: MetaDefinition[] = [
      { name: 'description', content: description },
      { name: 'theme-color', content: '#2563eb' },
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: 'pt_BR' },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:url', content: url },
      { property: 'og:site_name', content: 'EJC Capelinha' },
      { property: 'og:image', content: image },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: image }
    ];

    metaTags.forEach(upsertMetaTag);
  }, []);

  return null;
}
