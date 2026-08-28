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

      {/* Roxo no canto superior esquerdo, atrás do topo do menu.
          Ficava mais abaixo e tingia a faixa de página logo à direita do menu
          — bem na altura dos itens. Como o item ativo usa a cor do fundo pra
          parecer continuação dele, esse tingimento fazia os dois destoarem.
          Subindo o centro, a mancha continua dando o que desfocar no alto do
          menu e sai da altura onde a continuidade importa. */}
      <div className="absolute -left-40 -top-52 h-[30rem] w-[30rem] rounded-full bg-primary/20 blur-3xl" />

      {/* Lavanda difuso à direita, na altura dos cartões de indicador. */}
      <div className="absolute -right-24 top-24 h-[26rem] w-[26rem] rounded-full bg-violet-400/20 blur-3xl" />

      {/* Rosa bem lavado embaixo, pra a página não terminar em cinza. */}
      <div className="absolute -bottom-32 left-1/3 h-[28rem] w-[28rem] rounded-full bg-fuchsia-300/20 blur-3xl" />
    </div>
  );
}
