// Manchas de cor que ficam atrás de tudo.
//
// Não é enfeite gratuito: `backdrop-filter` só produz efeito visível quando
// existe alguma cor por trás da superfície pra ser desfocada. Sobre um fundo
// chapado, os cartões de vidro ficariam idênticos a cartões brancos comuns.
// São estas manchas que dão o que borrar.
//
// aria-hidden + pointer-events-none: é decoração pura, não deve aparecer pra
// leitor de tela nem interceptar clique.
//
// As manchas são estáticas de propósito. Animá-las obrigaria cada superfície
// de vidro a refazer o desfoque a cada frame, o tempo todo — caro no celular,
// e pra um movimento que ninguém nota.
export default function Fundo() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />

      {/* Roxo forte no canto superior esquerdo, atrás do menu. */}
      <div className="absolute -left-32 -top-40 h-[32rem] w-[32rem] rounded-full bg-primary/25 blur-3xl" />

      {/* Lavanda difuso à direita, na altura dos cartões de indicador. */}
      <div className="absolute -right-24 top-24 h-[26rem] w-[26rem] rounded-full bg-violet-400/20 blur-3xl" />

      {/* Rosa bem lavado embaixo, pra a página não terminar em cinza. */}
      <div className="absolute -bottom-32 left-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/20 blur-3xl" />
    </div>
  );
}
