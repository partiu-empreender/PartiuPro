import { proximaDataComercial } from '@/lib/home';
import { horaCurta, momentoDoEncontro } from '@/lib/agenda';

// O sininho do topo.
//
// Hoje as notificações são CALCULADAS na hora, a partir do que o sistema já
// sabe (agenda, vendas, datas comerciais) — nenhuma tabela nova. Quando
// chegarem a tarefa do dia, os encontros e os desafios, eles entram aqui como
// mais fontes da mesma lista.
//
// O "já vi" mora no navegador, guardado pelo `id` de cada aviso. O id muda
// quando o conteúdo muda (outro dia, outra quantidade), e aí o aviso volta a
// contar como novo — é o que faz o número vermelho significar "tem coisa
// nova", e não "tem coisa".

/**
 * As pendências moram numa aba do Dashboard ("Vendas do Período"), então um
 * link comum não chega nelas: é preciso trocar de aba e rolar. Quem chega de
 * outra tela vem com `?ver=pendencias`; quem já está no Dashboard dispara o
 * evento, porque mudar só a query não remonta a página.
 */
export const LINK_PENDENCIAS = '/dashboard?ver=pendencias';
export const EVENTO_VER_PENDENCIAS = 'partiu:ver-pendencias';

export type TomDoAviso = 'urgente' | 'normal';

export interface Aviso {
  id: string;
  titulo: string;
  descricao?: string;
  href: string;
  tom: TomDoAviso;
}

export interface VendaPendente {
  status: string;
  entrega: string;
  delivery_date: string | null;
  faturamento_total: number | string;
}

export interface SituacaoDasVendas {
  entregasHoje: number;
  entregasAtrasadas: number;
  aReceber: number;
  valorAReceber: number;
}

/**
 * Conta o que pede ação nas vendas.
 *
 * Entrega só conta quando tem DATA: toda venda antiga nasceu com entrega
 * "pendente" (migration 013), e contar essas faria o sininho anunciar
 * centenas de entregas que já aconteceram.
 */
export function situacaoDasVendas(vendas: VendaPendente[], hoje: string): SituacaoDasVendas {
  const situacao: SituacaoDasVendas = {
    entregasHoje: 0,
    entregasAtrasadas: 0,
    aReceber: 0,
    valorAReceber: 0,
  };

  for (const venda of vendas) {
    if (venda.status === 'cancelada') continue;

    if (venda.entrega === 'pendente' && venda.delivery_date) {
      if (venda.delivery_date === hoje) situacao.entregasHoje += 1;
      else if (venda.delivery_date < hoje) situacao.entregasAtrasadas += 1;
    }

    if (venda.status === 'pendente') {
      situacao.aReceber += 1;
      situacao.valorAReceber += Number(venda.faturamento_total) || 0;
    }
  }

  return situacao;
}

/** Marcos do aviso de data comercial: ele reaparece ao cruzar cada um. */
const MARCOS_DA_DATA = [60, 45, 30, 15, 7, 1];

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export interface EncontroDoAviso {
  id: string;
  titulo: string;
  inicio: string;
  duracao_minutos: number;
}

export interface EntradaDosAvisos {
  hoje: string;
  lembretesHoje: number;
  lembretesAtrasados: number;
  vendas: SituacaoDasVendas | null;
  /** Encontros da mentoria que acontecem hoje. */
  encontrosHoje?: EncontroDoAviso[];
  /** Desafios abertos há até 7 dias que ela ainda não concluiu. */
  desafiosNovos?: { id: string; titulo: string }[];
  agora?: Date;
}

/** A lista do sininho, do mais urgente pro menos. */
export function montarAvisos({
  hoje,
  lembretesHoje,
  lembretesAtrasados,
  vendas,
  encontrosHoje = [],
  desafiosNovos = [],
  agora = new Date(),
}: EntradaDosAvisos): Aviso[] {
  const avisos: Aviso[] = [];

  // Encontro primeiro: é o único aviso com hora marcada. O id muda quando ele
  // começa, pra o "começando agora" tocar de novo mesmo quem já viu o de manhã.
  for (const encontro of encontrosHoje) {
    const momento = momentoDoEncontro(encontro.inicio, encontro.duracao_minutos, agora);
    if (momento === 'passou') continue;
    avisos.push({
      id: `encontro:${encontro.id}:${momento}`,
      titulo:
        momento === 'agora'
          ? `Encontro começando agora: ${encontro.titulo}`
          : `Encontro hoje às ${horaCurta(encontro.inicio)}`,
      descricao: momento === 'agora' ? 'O link da sala está na Agenda.' : encontro.titulo,
      href: '/dashboard/agenda',
      tom: momento === 'agora' ? 'urgente' : 'normal',
    });
  }

  if (lembretesAtrasados > 0) {
    avisos.push({
      id: `lembretes-atrasados:${hoje}:${lembretesAtrasados}`,
      titulo: `${plural(lembretesAtrasados, 'contato atrasado', 'contatos atrasados')} na agenda`,
      descricao: 'Clientes esperando o seu retorno.',
      href: '/dashboard/lembretes',
      tom: 'urgente',
    });
  }

  if (vendas && vendas.entregasAtrasadas > 0) {
    avisos.push({
      id: `entregas-atrasadas:${hoje}:${vendas.entregasAtrasadas}`,
      titulo: `${plural(vendas.entregasAtrasadas, 'entrega atrasada', 'entregas atrasadas')}`,
      descricao: 'Se já entregou, marque como entregue nas pendências.',
      href: LINK_PENDENCIAS,
      tom: 'urgente',
    });
  }

  if (vendas && vendas.entregasHoje > 0) {
    avisos.push({
      id: `entregas-hoje:${hoje}:${vendas.entregasHoje}`,
      titulo: `${plural(vendas.entregasHoje, 'entrega', 'entregas')} pra hoje`,
      href: LINK_PENDENCIAS,
      tom: 'normal',
    });
  }

  if (lembretesHoje > 0) {
    avisos.push({
      id: `lembretes-hoje:${hoje}:${lembretesHoje}`,
      titulo: `${plural(lembretesHoje, 'contato', 'contatos')} pra fazer hoje`,
      href: '/dashboard/lembretes',
      tom: 'normal',
    });
  }

  if (vendas && vendas.aReceber > 0) {
    // Sem a data no id: "a receber" é estado, não acontecimento do dia. Só
    // volta a ser novo quando a quantidade muda.
    avisos.push({
      id: `a-receber:${vendas.aReceber}`,
      titulo: `${plural(vendas.aReceber, 'venda', 'vendas')} a receber`,
      descricao: `${brl(vendas.valorAReceber)} esperando pagamento.`,
      href: LINK_PENDENCIAS,
      tom: 'normal',
    });
  }

  for (const desafio of desafiosNovos) {
    avisos.push({
      id: `desafio:${desafio.id}`,
      titulo: `Desafio novo: ${desafio.titulo}`,
      descricao: 'Bora colocar a mão na massa?',
      href: '/dashboard/mao-na-massa',
      tom: 'normal',
    });
  }

  const data = proximaDataComercial(hoje);
  if (data) {
    const marco = [...MARCOS_DA_DATA].reverse().find((m) => data.dias <= m) ?? data.dias;
    avisos.push({
      id: `data:${data.id}:${data.data}:${marco}`,
      titulo:
        data.dias === 0
          ? `Hoje é ${data.nome}!`
          : `${data.nome} em ${plural(data.dias, 'dia', 'dias')}`,
      descricao: data.dias > 15 ? 'Bom momento pra planejar e divulgar.' : 'Hora de abrir as encomendas.',
      href: '/dashboard/clientes',
      tom: 'normal',
    });
  }

  return avisos;
}
