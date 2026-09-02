// Fonte única da paleta de etiquetas.
//
// Antes esta lista existia duas vezes — uma na API, outra no componente de
// badge. Se as duas divergissem, a API aceitaria salvar uma cor que a tela não
// sabe desenhar, e a etiqueta apareceria cinza sem ninguém entender por quê.
//
// A paleta é fechada de propósito: a cor vira classe do Tailwind, e o Tailwind
// decide o que entra no CSS varrendo o código-fonte, não o banco. Uma classe
// montada em tempo de execução — `bg-${cor}-100` — simplesmente não existiria
// no build.
export const CORES_ETIQUETA = [
  'slate',
  'red',
  'rose',
  'orange',
  'amber',
  'emerald',
  'teal',
  'sky',
  'violet',
  'fuchsia',
] as const;

export type CorEtiqueta = (typeof CORES_ETIQUETA)[number];

export const COR_PADRAO: CorEtiqueta = 'slate';

export function ehCorValida(cor: unknown): cor is CorEtiqueta {
  return CORES_ETIQUETA.includes(cor as CorEtiqueta);
}

// A lista que o Rogério fechou com a Tania. Aparece como sugestão na tela de
// Clientes; a aluna adiciona as que quiser (ou todas de uma vez) e pode criar
// as dela por cima.
//
// A lista já foi maior. Cinco saíram em 2026-08-31, por dois motivos
// diferentes — e ambos são a mesma regra vista de dois ângulos.
//
// "Pagamento pendente" e "Aguardando entrega de pedido" eram atributos do
// PEDIDO, não da cliente: a etiqueta fica pendurada na pessoa depois que o
// pedido já foi pago ou entregue, e na segunda compra ninguém sabe mais a qual
// pedido ela se referia. Esse estado pertence à venda.
//
// "Melhores Clientes", "Clientes Inativos" e "Clientes Mornos/Frios" o sistema
// já sabe sozinho: viraram filtros em `lib/filtros-clientes.ts`, calculados a
// partir de `total_spent` e `last_order_at`. Como etiqueta manual elas
// apodreciam — a cliente inativa compra de novo e continua marcada como
// inativa até alguém lembrar de tirar. Sugerir as duas versões lado a lado era
// convidar a aluna pra manter à mão o que já se mantém sozinho.
//
// "Cliente VIP" ficou de propósito: pode ser um julgamento dela ("essa aqui eu
// atendo de madrugada"), que nenhum cálculo de valor gasto alcança.
//
// As cores foram escolhidas pelo significado, não pela ordem: quem vale mais
// é quente (âmbar, esmeralda), quem exige ação é vermelho/laranja, quem é
// neutro ou administrativo é cinza/teal, e quem esfriou é cinza/azul.
export const ETIQUETAS_SUGERIDAS: { nome: string; cor: CorEtiqueta }[] = [
  { nome: 'Cliente VIP', cor: 'amber' },
  { nome: 'Cliente Corporativo', cor: 'violet' },
  { nome: 'Dia das Mães', cor: 'rose' },
  { nome: 'NF', cor: 'teal' },
  { nome: 'Observação no pedido', cor: 'fuchsia' },
];

// ============================================
// Etiquetas de VENDA (ocasião da compra)
// ============================================
//
// Ficam na venda, não na cliente — ver o comentário de
// supabase/migrations/010_etiquetas_na_venda.sql. A distinção que sustenta as
// duas listas: acima é o que a pessoa É ("Cliente VIP", vale sempre); aqui é o
// que a compra FOI ("Aniversário", vale pra aquela venda e só).
//
// Por isso "Cliente VIP" não aparece aqui e "Aniversário" não aparece lá: a
// mesma cliente compra pro aniversário em junho e pro Natal em dezembro, e
// pendurar as duas nela pra sempre não diria nada sobre nenhuma das compras.
//
// Datas comemorativas que o sistema já reconhece pela data da venda
// (lib/datas-comemorativas.ts) entram assim mesmo, de propósito: a data cobre
// quem comprou NA SEMANA do evento, e a etiqueta cobre o resto — a encomenda
// de Natal fechada em outubro, o presente de Dia das Mães comprado com um mês
// de antecedência. O filtro soma as duas fontes.
export const ETIQUETAS_DE_VENDA_SUGERIDAS: { nome: string; cor: CorEtiqueta }[] = [
  { nome: 'Aniversário', cor: 'fuchsia' },
  { nome: 'Dia dos Namorados', cor: 'red' },
  { nome: 'Dia das Mães', cor: 'rose' },
  { nome: 'Natal', cor: 'emerald' },
  { nome: 'Corporativo', cor: 'violet' },
  { nome: 'Autopresente', cor: 'amber' },
];

// O seletor de cor mostra estes rótulos. Sem eles a Tania escolheria entre
// "fuchsia" e "teal", que não dizem nada em português.
export const NOME_DA_COR: Record<CorEtiqueta, string> = {
  slate: 'Cinza',
  red: 'Vermelho',
  rose: 'Rosa',
  orange: 'Laranja',
  amber: 'Dourado',
  emerald: 'Verde',
  teal: 'Verde-água',
  sky: 'Azul',
  violet: 'Roxo',
  fuchsia: 'Magenta',
};
