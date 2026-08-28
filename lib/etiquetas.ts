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
// As cores foram escolhidas pelo significado, não pela ordem: quem vale mais
// é quente (âmbar, esmeralda), quem exige ação é vermelho/laranja, quem é
// neutro ou administrativo é cinza/teal, e quem esfriou é cinza/azul.
export const ETIQUETAS_SUGERIDAS: { nome: string; cor: CorEtiqueta }[] = [
  { nome: 'Cliente VIP', cor: 'amber' },
  { nome: 'Pagamento pendente', cor: 'red' },
  { nome: 'Aguardando entrega de pedido', cor: 'orange' },
  { nome: 'Dia das Mães', cor: 'rose' },
  { nome: 'Melhores Clientes', cor: 'emerald' },
  { nome: 'NF', cor: 'teal' },
  { nome: 'Clientes Inativos', cor: 'slate' },
  { nome: 'Cliente Corporativo', cor: 'violet' },
  { nome: 'Observação no pedido', cor: 'fuchsia' },
  { nome: 'Clientes Mornos/Frios', cor: 'sky' },
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
