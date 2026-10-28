import { diaDaSemana, nomeDoMes, partesDaData, recorteDoMes, somarDias } from '@/lib/datas';
import { rotuloDaForma } from '@/lib/situacao-venda';
import type { ResumoDoMes } from '@/lib/home';
import type { Encontro } from '@/lib/agenda';

// As contas dos cartões da home: os gráficos e as tabelas do topo do
// Dashboard. Puro, sem banco, pra ser testado — a rota /api/home só busca
// as linhas e passa por aqui.

const valor = (v: number | string | null | undefined) => Number(v) || 0;

/* ------------------------------------------------------------------------ */
/* Meses                                                                     */
/* ------------------------------------------------------------------------ */

export interface MesDoGrafico {
  ano: number;
  mes: number;
  /** "Mai", "Jun"... */
  rotulo: string;
}

/** Os últimos `quantos` meses, terminando no de `hoje`, do mais antigo pro atual. */
export function ultimosMeses(hoje: string, quantos = 6): MesDoGrafico[] {
  const { ano, mes } = partesDaData(hoje);
  const meses: MesDoGrafico[] = [];
  for (let i = quantos - 1; i >= 0; i--) {
    // Conta em "meses desde o ano zero" pra virar o ano sem caso especial.
    const total = ano * 12 + (mes - 1) - i;
    const m = (total % 12) + 1;
    meses.push({ ano: Math.floor(total / 12), mes: m, rotulo: nomeDoMes(m).slice(0, 3) });
  }
  return meses;
}

/** Primeiro e último dia de um mês do gráfico; o atual termina em hoje. */
export function recorteDoMesAteHoje(m: MesDoGrafico, hoje: string): { inicio: string; fim: string } {
  const recorte = recorteDoMes(m.ano, m.mes) ?? { inicio: hoje, fim: hoje };
  return { inicio: recorte.inicio, fim: recorte.fim < hoje ? recorte.fim : hoje };
}

/** Quanto do mês já passou, de 0 a 100. Dia 15 de um mês de 30 é 50%. */
export function progressoDoMes(hoje: string): { dia: number; diasNoMes: number; percentual: number } {
  const { ano, mes, dia } = partesDaData(hoje);
  const diasNoMes = partesDaData(recorteDoMes(ano, mes)?.fim ?? hoje).dia;
  return { dia, diasNoMes, percentual: (dia / diasNoMes) * 100 };
}

/* ------------------------------------------------------------------------ */
/* Vendas do mês                                                             */
/* ------------------------------------------------------------------------ */

export interface ItemDaVenda {
  produto_nome: string | null;
  quantidade: number | string | null;
  subtotal: number | string | null;
  tipo?: string | null;
}

export interface VendaDoMes {
  id: string;
  data: string;
  cliente_nome: string | null;
  faturamento_total: number | string;
  status: string;
  forma_pagamento: string | null;
  venda_itens?: ItemDaVenda[] | null;
}

export interface Recebimento {
  pago: number;
  aReceber: number;
  /** Parte já paga do vendido no mês, de 0 a 100. null sem venda. */
  percentualPago: number | null;
}

export function recebimentoDoMes(vendas: VendaDoMes[]): Recebimento {
  let pago = 0;
  let aReceber = 0;
  for (const venda of vendas) {
    if (venda.status === 'pago') pago += valor(venda.faturamento_total);
    else if (venda.status === 'pendente') aReceber += valor(venda.faturamento_total);
  }
  const total = pago + aReceber;
  return { pago, aReceber, percentualPago: total > 0 ? (pago / total) * 100 : null };
}

export interface FatiaDaForma {
  rotulo: string;
  total: number;
  quantidade: number;
}

/**
 * Como as clientes pagaram, pra pizza. A forma é opcional no cadastro da
 * venda, então "Não informado" existe — e fica por último, pra não parecer
 * a forma preferida de ninguém só porque o campo ficou vazio.
 */
export function formasDePagamento(vendas: VendaDoMes[]): FatiaDaForma[] {
  const porForma = new Map<string, FatiaDaForma>();
  for (const venda of vendas) {
    if (venda.status === 'cancelada') continue;
    const rotulo = rotuloDaForma(venda.forma_pagamento) ?? 'Não informado';
    const fatia = porForma.get(rotulo) ?? { rotulo, total: 0, quantidade: 0 };
    fatia.total += valor(venda.faturamento_total);
    fatia.quantidade += 1;
    porForma.set(rotulo, fatia);
  }

  return [...porForma.values()].sort((a, b) => {
    if (a.rotulo === 'Não informado') return 1;
    if (b.rotulo === 'Não informado') return -1;
    return b.total - a.total;
  });
}

export interface ProdutoVendido {
  nome: string;
  quantidade: number;
  total: number;
}

/**
 * Os produtos que mais faturaram no mês. Adicional (embalagem, cartão) fica
 * de fora: ele acompanha o produto, e no topo da lista só ocuparia espaço.
 * O nome é comparado sem diferença de maiúsculas, que é como a aluna digita.
 */
export function maisVendidos(vendas: VendaDoMes[], quantos = 5): ProdutoVendido[] {
  const porNome = new Map<string, ProdutoVendido>();
  for (const venda of vendas) {
    if (venda.status === 'cancelada') continue;
    for (const item of venda.venda_itens ?? []) {
      if (item.tipo === 'adicional') continue;
      const nome = (item.produto_nome ?? '').trim();
      if (!nome) continue;
      const chave = nome.toLocaleLowerCase('pt-BR');
      const produto = porNome.get(chave) ?? { nome, quantidade: 0, total: 0 };
      produto.quantidade += valor(item.quantidade);
      produto.total += valor(item.subtotal);
      porNome.set(chave, produto);
    }
  }
  return [...porNome.values()].sort((a, b) => b.total - a.total).slice(0, quantos);
}

/* ------------------------------------------------------------------------ */
/* Semana                                                                    */
/* ------------------------------------------------------------------------ */

const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export interface DiaDaSemana {
  data: string;
  rotulo: string;
  dia: number;
  hoje: boolean;
}

/** Domingo a sábado da semana de `hoje`. */
export function semanaDe(hoje: string): DiaDaSemana[] {
  const domingo = somarDias(hoje, -diaDaSemana(hoje));
  return Array.from({ length: 7 }, (_, i) => {
    const data = somarDias(domingo, i);
    return { data, rotulo: DIAS_CURTOS[i] ?? '', dia: partesDaData(data).dia, hoje: data === hoje };
  });
}

/* ------------------------------------------------------------------------ */
/* O que a rota /api/home devolve                                            */
/* ------------------------------------------------------------------------ */

export interface EntregaDaHome {
  id: string;
  cliente_nome: string | null;
  delivery_date: string;
  delivery_period: string | null;
  entregue: boolean;
}

export interface PainelDaHome {
  hoje: string;
  resumo: ResumoDoMes;
  meses: { rotulo: string; total: number; atual: boolean }[];
  meta: number;
  atendimentos: number;
  recebimento: Recebimento;
  formas: FatiaDaForma[];
  maisVendidos: ProdutoVendido[];
  ultimasVendas: {
    id: string;
    cliente_nome: string | null;
    data: string;
    valor: number;
    status: string;
  }[];
  clientes: { total: number; novosNoMes: number };
  aReceber: { quantidade: number; valor: number };
  entregas: EntregaDaHome[];
  /** Encontros desta semana em diante (os próximos, até 10). */
  encontros: Encontro[];
}
