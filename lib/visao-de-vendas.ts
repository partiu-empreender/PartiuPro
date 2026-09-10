/**
 * A visão agregada das vendas de uma aluna, para o painel da mentora.
 *
 * POR QUE ISTO SUBSTITUI A LISTA NOME A NOME
 *
 * O painel mostrava "Vendas recentes (mês atual)" como uma lista de clientes:
 * Maria comprou X, Joana comprou Y. Isso responde "quem comprou", que é a
 * pergunta da aluna — ela conhece a Maria. Para a mentora, que olha 68 alunas,
 * o nome da cliente não diz nada: são pessoas que ela nunca vai encontrar.
 *
 * A analogia que o João usou: uma empresa com vários colaboradores. O gestor
 * não olha para quem cada vendedor vendeu — olha QUANTO, QUANDO e O QUÊ. Essas
 * três perguntas são as funções abaixo.
 *
 * Há também um ganho de privacidade que vem de graça: a mentora deixa de ver
 * nomes de clientes finais, que são dados de terceiros que ela não precisa
 * para orientar a aluna.
 */

export interface ItemVendido {
  produto_nome: string;
  quantidade: number;
  subtotal: number;
  tipo?: string;
}

export interface VendaParaVisao {
  data: string;
  faturamento_total: number;
  venda_itens?: ItemVendido[] | null;
}

export interface DiaDeVenda {
  data: string;
  vendas: number;
  faturamento: number;
}

export interface ProdutoVendido {
  nome: string;
  quantidade: number;
  faturamento: number;
}

export interface ResumoDeVendas {
  faturamento: number;
  vendas: number;
  ticketMedio: number;
  /** Faturamento por dia, do mais recente para o mais antigo. */
  porDia: DiaDeVenda[];
  /** O que vendeu, do que mais faturou para o que menos faturou. */
  porProduto: ProdutoVendido[];
  /** Dia de maior faturamento. Null quando não houve venda. */
  melhorDia: DiaDeVenda | null;
}

export function resumirVendas(vendas: VendaParaVisao[]): ResumoDeVendas {
  const faturamento = vendas.reduce((soma, v) => soma + (Number(v.faturamento_total) || 0), 0);

  const porDiaMapa = new Map<string, DiaDeVenda>();
  const porProdutoMapa = new Map<string, ProdutoVendido>();

  for (const venda of vendas) {
    const dia = porDiaMapa.get(venda.data) ?? { data: venda.data, vendas: 0, faturamento: 0 };
    dia.vendas += 1;
    dia.faturamento += Number(venda.faturamento_total) || 0;
    porDiaMapa.set(venda.data, dia);

    for (const item of venda.venda_itens || []) {
      const nome = item.produto_nome?.trim() || 'Sem nome';
      const atual = porProdutoMapa.get(nome) ?? { nome, quantidade: 0, faturamento: 0 };
      atual.quantidade += Number(item.quantidade) || 0;
      atual.faturamento += Number(item.subtotal) || 0;
      porProdutoMapa.set(nome, atual);
    }
  }

  const porDia = [...porDiaMapa.values()].sort((a, b) => (a.data > b.data ? -1 : 1));

  // Ordenado por FATURAMENTO, e não por quantidade: dez chaveiros vendidos não
  // são mais relevantes que duas cestas grandes quando a pergunta é onde o
  // dinheiro está.
  const porProduto = [...porProdutoMapa.values()].sort((a, b) => b.faturamento - a.faturamento);

  const melhorDia = porDia.reduce<DiaDeVenda | null>(
    (maior, dia) => (!maior || dia.faturamento > maior.faturamento ? dia : maior),
    null,
  );

  return {
    faturamento,
    vendas: vendas.length,
    // Divisão protegida: sem vendas, o ticket é 0 e não NaN — que apareceria
    // na tela como "R$ NaN".
    ticketMedio: vendas.length > 0 ? faturamento / vendas.length : 0,
    porDia,
    porProduto,
    melhorDia,
  };
}
