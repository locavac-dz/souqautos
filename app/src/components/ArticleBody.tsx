import { Children } from "react";
import Markdown, { type Components } from "react-markdown";

// Lot 111 — corps d'un essai, écrit en Markdown par l'équipe (administrateurs).
//
// Le rendu est volontairement restreint : le texte est du contenu éditorial, pas
// une page libre.
//  - Pas de HTML brut (`skipHtml`) : un `<script>` ou un `<iframe>` collé dans le
//    texte disparaît au lieu d'être exécuté.
//  - Pas d'images : la seule image d'un essai est sa photo de couverture.
//  - Les adresses passent par le filtre par défaut de react-markdown, qui écarte
//    `javascript:` et autres protocoles non web ; les liens externes s'ouvrent
//    sans transmettre l'origine et sans transmettre d'autorité de référencement.
//  - Un `#` (titre de niveau 1) est ramené au niveau 2 : la page a déjà son
//    unique <h1>, le titre de l'essai.
function Heading2({ children }: { children?: React.ReactNode }) {
  return <h2 className="mt-8 text-xl font-semibold text-slate-900">{children}</h2>;
}

function Heading3({ children }: { children?: React.ReactNode }) {
  return <h3 className="mt-6 text-lg font-semibold text-slate-900">{children}</h3>;
}

const components: Components = {
  h1: Heading2,
  h2: Heading2,
  h3: Heading3,
  h4: Heading3,
  h5: Heading3,
  h6: Heading3,
  // Un paragraphe qui ne contenait qu'une image (retirée) ne laisse pas de vide.
  p: ({ children }) => (Children.toArray(children).length === 0 ? null : <p>{children}</p>),
  ul: ({ children }) => <ul className="list-disc space-y-1 ps-6">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal space-y-1 ps-6">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="border-s-4 border-slate-300 ps-4 text-slate-600">{children}</blockquote>
  ),
  hr: () => <hr className="border-slate-200" />,
  a: ({ href, children }) => {
    // Adresse écartée par le filtre (`javascript:`…) : le texte reste, sans lien.
    if (!href) return <>{children}</>;
    const external = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        className="underline hover:text-slate-900"
        {...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {})}
      >
        {children}
      </a>
    );
  },
};

export function ArticleBody({ content }: { content: string }) {
  return (
    <div className="mt-8 space-y-4 text-sm leading-relaxed text-slate-700">
      <Markdown skipHtml disallowedElements={["img"]} components={components}>
        {content}
      </Markdown>
    </div>
  );
}
