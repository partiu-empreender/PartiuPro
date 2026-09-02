import { diaDaSemana, montarData, partesDaData, somarDias } from '@/lib/datas';

/**
 * Datas comemorativas que movem o faturamento de quem vende café da manhã.
 *
 * Existem por causa de uma conclusão da conversa sobre etiquetas: marcar
 * "Dia das Mães" na mão em cada cliente é trabalho que a aluna vai esquecer de
 * fazer — e o sistema já sabe a resposta, porque toda venda tem data. Quem
 * comprou na última semana das Mães é uma consulta, não uma etiqueta.
 *
 * A etiqueta manual continua útil pro caso que o histórico não alcança ("essa
 * aqui SEMPRE encomenda pra sogra, mesmo que ano passado ela tenha pulado").
 * As duas convivem.
 */

export interface DataComemorativa {
  id: string;
  nome: string;
  /** Quantos dias antes da data as encomendas costumam acontecer. */
  diasDeJanela: number;
  /** A data no ano pedido, em 'AAAA-MM-DD'. */
  quando: (ano: number) => string;
}

/**
 * Domingo de Páscoa pelo algoritmo gregoriano anônimo (Meeus/Jones/Butcher).
 * É aritmética pura de calendário — sem tabela pra manter e sem validade.
 */
function domingoDePascoa(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return montarData(ano, mes, dia);
}

/** O n-ésimo dia-da-semana de um mês — "segundo domingo de maio". */
function enesimoDiaDaSemana(ano: number, mes: number, semana: number, diaAlvo: number): string {
  const primeiro = montarData(ano, mes, 1);
  // Quantos dias andar do dia 1º até o primeiro dia-da-semana procurado.
  const ate = (diaAlvo - diaDaSemana(primeiro) + 7) % 7;
  return somarDias(primeiro, ate + (semana - 1) * 7);
}

const DOMINGO = 0;

export const DATAS_COMEMORATIVAS: DataComemorativa[] = [
  // A janela de cada uma é o tempo em que a encomenda realmente acontece.
  // Natal e Mães puxam encomenda com semanas de antecedência; Namorados é
  // mais em cima da hora.
  { id: 'maes', nome: 'Dia das Mães', diasDeJanela: 14, quando: (a) => enesimoDiaDaSemana(a, 5, 2, DOMINGO) },
  { id: 'pais', nome: 'Dia dos Pais', diasDeJanela: 14, quando: (a) => enesimoDiaDaSemana(a, 8, 2, DOMINGO) },
  { id: 'natal', nome: 'Natal', diasDeJanela: 21, quando: (a) => montarData(a, 12, 25) },
  { id: 'pascoa', nome: 'Páscoa', diasDeJanela: 14, quando: domingoDePascoa },
  { id: 'namorados', nome: 'Dia dos Namorados', diasDeJanela: 10, quando: (a) => montarData(a, 6, 12) },
  { id: 'mulher', nome: 'Dia da Mulher', diasDeJanela: 7, quando: (a) => montarData(a, 3, 8) },
  { id: 'criancas', nome: 'Dia das Crianças', diasDeJanela: 10, quando: (a) => montarData(a, 10, 12) },
  { id: 'ano-novo', nome: 'Ano Novo', diasDeJanela: 10, quando: (a) => montarData(a, 1, 1) },
];

export function acharDataComemorativa(id: string): DataComemorativa | undefined {
  return DATAS_COMEMORATIVAS.find((d) => d.id === id);
}

/**
 * A janela de compra da ÚLTIMA vez que essa data aconteceu.
 *
 * "Última vez" e não "ano passado" de propósito: em setembro, o Dia das Mães
 * que interessa é o de maio deste ano; em março, é o do ano passado. Fixar
 * "ano - 1" faria a aluna consultar uma lista de dois anos atrás durante mais
 * da metade do calendário.
 *
 * A janela fecha um dia DEPOIS da data porque encomenda entregue no próprio
 * dia costuma ser registrada no dia — e às vezes no seguinte.
 */
export function janelaDaUltimaOcorrencia(
  evento: DataComemorativa,
  hoje: string,
): { inicio: string; fim: string; ano: number } {
  const { ano } = partesDaData(hoje);
  const desteAno = evento.quando(ano);
  const anoAlvo = desteAno <= hoje ? ano : ano - 1;
  const data = evento.quando(anoAlvo);

  return {
    inicio: somarDias(data, -evento.diasDeJanela),
    fim: somarDias(data, 1),
    ano: anoAlvo,
  };
}
