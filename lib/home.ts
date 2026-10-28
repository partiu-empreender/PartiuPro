import { DATAS_COMEMORATIVAS } from '@/lib/datas-comemorativas';
import { diasEntre, montarData, nomeDoMes, partesDaData, recorteDoMes } from '@/lib/datas';

// Contas da home (o topo do Dashboard). Tudo puro, pra ser testado sem
// navegador: a home é a primeira coisa que a aluna vê, e um número errado ali
// ("você vendeu menos que mês passado" quando vendeu mais) é o tipo de erro
// que ela percebe na hora.

const formatadorHora = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Sao_Paulo',
  hour: 'numeric',
  hourCycle: 'h23',
});

/** Hora (0-23) no Brasil, e não a do computador. */
export function horaBrasil(momento: Date = new Date()): number {
  return Number(formatadorHora.format(momento)) % 24;
}

/** "Bom dia" das 5h às 11h, "Boa tarde" das 12h às 17h, "Boa noite" no resto. */
export function saudacao(hora: number): string {
  if (hora >= 5 && hora < 12) return 'Bom dia';
  if (hora >= 12 && hora < 18) return 'Boa tarde';
  return 'Boa noite';
}

export interface VendaParaResumo {
  data: string;
  faturamento_total: number | string;
}

export interface ResumoDoMes {
  /** Vendido do dia 1º até hoje. */
  vendido: number;
  quantidade: number;
  /** Vendido no mês passado, do dia 1º até o mesmo dia de hoje. */
  vendidoAntes: number;
  /** Variação contra o mesmo período do mês passado. null quando não há base. */
  variacao: number | null;
  /** Faturamento de cada dia do mês até hoje (índice 0 = dia 1º). */
  porDia: number[];
  mes: string;
  mesAnterior: string;
}

/**
 * O primeiro número da home: quanto ela vendeu no mês, com comparação.
 *
 * A comparação é com o MESMO PERÍODO do mês passado (1º a 10 contra 1º a 10),
 * e não com o mês inteiro. No dia 10, comparar com os 30 dias de setembro
 * mostraria queda todo começo de mês, mesmo quando ela está vendendo mais.
 *
 * Quando o mês passado é mais curto (31/03 contra fevereiro), o recorte para
 * no último dia dele.
 */
export function resumoDoMes(vendas: VendaParaResumo[], hoje: string): ResumoDoMes {
  const { ano, mes, dia } = partesDaData(hoje);
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
  const fimDoAnterior = recorteDoMes(anterior.ano, anterior.mes)?.fim ?? hoje;
  const diaLimite = Math.min(dia, partesDaData(fimDoAnterior).dia);

  const inicioDoMes = montarData(ano, mes, 1);
  const inicioDoAnterior = montarData(anterior.ano, anterior.mes, 1);
  const limiteDoAnterior = montarData(anterior.ano, anterior.mes, diaLimite);

  const porDia = Array.from({ length: dia }, () => 0);
  let vendido = 0;
  let quantidade = 0;
  let vendidoAntes = 0;

  for (const venda of vendas) {
    // Number(): coluna NUMERIC pode chegar como texto.
    const valor = Number(venda.faturamento_total) || 0;
    if (venda.data >= inicioDoMes && venda.data <= hoje) {
      vendido += valor;
      quantidade += 1;
      const indice = partesDaData(venda.data).dia - 1;
      porDia[indice] = (porDia[indice] ?? 0) + valor;
    } else if (venda.data >= inicioDoAnterior && venda.data <= limiteDoAnterior) {
      vendidoAntes += valor;
    }
  }

  return {
    vendido,
    quantidade,
    vendidoAntes,
    variacao: vendidoAntes > 0 ? ((vendido - vendidoAntes) / vendidoAntes) * 100 : null,
    porDia,
    mes: nomeDoMes(mes),
    mesAnterior: nomeDoMes(anterior.mes),
  };
}

export interface ProximaData {
  id: string;
  nome: string;
  data: string;
  dias: number;
}

/**
 * A próxima data comercial que vem pela frente, se estiver a até `limite`
 * dias. Sessenta porque é a antecedência que o escopo pede pro aviso — é o
 * tempo de planejar cardápio, divulgar e abrir encomendas.
 */
export function proximaDataComercial(hoje: string, limite = 60): ProximaData | null {
  const { ano } = partesDaData(hoje);
  let melhor: ProximaData | null = null;

  for (const evento of DATAS_COMEMORATIVAS) {
    // Este ano e o próximo: em dezembro, o Ano Novo que vem é o de janeiro.
    for (const alvo of [ano, ano + 1]) {
      const data = evento.quando(alvo);
      if (data < hoje) continue;
      const dias = diasEntre(hoje, data);
      if (dias <= limite && (!melhor || dias < melhor.dias)) {
        melhor = { id: evento.id, nome: evento.nome, data, dias };
      }
      break;
    }
  }

  return melhor;
}
