// Datas de negócio no fuso de São Paulo.
//
// O servidor da Vercel roda em UTC. Usar `new Date().toISOString()` pra
// definir "hoje" fazia a venda registrada depois das 21h de Brasília receber
// a data do dia seguinte — e a venda do dia 31 às 22h cair no mês seguinte,
// furando o faturamento mensal. Mesma coisa no navegador: `toISOString()`
// converte pra UTC antes de cortar a string, então o bug aparece no cliente
// também, mesmo com o computador da aluna no fuso certo.
//
// Aqui a data é sempre formatada explicitamente em America/Sao_Paulo. O
// locale 'en-CA' é usado porque produz exatamente YYYY-MM-DD, que é o formato
// que o Postgres espera nas colunas DATE.

const FUSO_BRASIL = 'America/Sao_Paulo';

const formatadorData = new Intl.DateTimeFormat('en-CA', {
  timeZone: FUSO_BRASIL,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Converte um instante para a data-calendário correspondente no Brasil (YYYY-MM-DD). */
export function dataBrasil(momento: Date = new Date()): string {
  return formatadorData.format(momento);
}

/** Data de hoje no Brasil, no formato YYYY-MM-DD. */
export function hojeBrasil(): string {
  return dataBrasil();
}

/** Ano, mês (1-12) e dia de hoje no Brasil. */
export function partesHojeBrasil(): { ano: number; mes: number; dia: number } {
  const partes = hojeBrasil().split('-');
  return {
    ano: Number(partes[0] ?? 0),
    mes: Number(partes[1] ?? 0),
    dia: Number(partes[2] ?? 0),
  };
}

/** Primeiro dia do mês corrente no Brasil, no formato YYYY-MM-DD. */
export function primeiroDiaDoMesBrasil(): string {
  const { ano, mes } = partesHojeBrasil();
  return `${ano}-${String(mes).padStart(2, '0')}-01`;
}

/** Data de N dias atrás, no formato YYYY-MM-DD. */
export function diasAtrasBrasil(dias: number): string {
  return dataBrasil(new Date(Date.now() - dias * 24 * 60 * 60 * 1000));
}

// ============================================
// Aritmética de data-calendário (YYYY-MM-DD)
// ============================================
//
// A partir daqui as funções trabalham com a STRING, nunca com um Date local.
// O motivo é o mesmo do resto do arquivo: `new Date('2026-09-14')` é lido como
// meia-noite UTC, e num navegador em Brasília isso vira 13/09 às 21h. Somar um
// dia a partir daí devolveria 14/09 quando a resposta certa é 15/09.
//
// Convertendo as partes com Date.UTC, o cálculo acontece num calendário sem
// fuso nenhum — que é o que uma data de aniversário ou de agenda realmente é.

/** Converte 'AAAA-MM-DD' em partes numéricas. Devolve zeros se vier lixo. */
export function partesDaData(iso: string): { ano: number; mes: number; dia: number } {
  const [ano, mes, dia] = (iso || '').split('-');
  return { ano: Number(ano) || 0, mes: Number(mes) || 0, dia: Number(dia) || 0 };
}

/** Monta 'AAAA-MM-DD' a partir das partes, com o zero à esquerda que o Postgres espera. */
export function montarData(ano: number, mes: number, dia: number): string {
  return `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/** Instante UTC correspondente à data-calendário — só para cálculo, nunca para exibir. */
function instanteUTC(iso: string): number {
  const { ano, mes, dia } = partesDaData(iso);
  return Date.UTC(ano, mes - 1, dia);
}

/** Soma (ou subtrai, com número negativo) dias a uma data-calendário. */
export function somarDias(iso: string, dias: number): string {
  const d = new Date(instanteUTC(iso) + dias * 86400000);
  return montarData(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** Quantos dias separam duas datas-calendário (positivo se `fim` vem depois). */
export function diasEntre(inicio: string, fim: string): number {
  return Math.round((instanteUTC(fim) - instanteUTC(inicio)) / 86400000);
}

/** Dia da semana da data-calendário: 0 = domingo. */
export function diaDaSemana(iso: string): number {
  return new Date(instanteUTC(iso)).getUTCDay();
}

/**
 * Até quantos anos atrás uma venda pode ser lançada.
 *
 * A Tania pediu pra alimentar meses anteriores — o sistema não pode começar a
 * existir só no dia em que ela instalou. Mas sem limite nenhum, um ano digitado
 * errado (2016 no lugar de 2026) entra calado e some do relatório, porque
 * nenhuma tela olha tão pra trás. Três anos cobrem o histórico que ela tem e
 * ainda pegam o erro de digitação.
 */
export const ANOS_DE_LANCAMENTO_RETROATIVO = 3;

/**
 * Valida a data de uma venda lançada à mão. Devolve o motivo da recusa, ou
 * null quando a data serve.
 *
 * Vive aqui, e não na rota, porque a tela precisa da MESMA resposta pra avisar
 * antes de enviar. Duas cópias da regra divergiriam, e a aluna veria o
 * formulário aceitar o que o servidor recusa.
 */
export function motivoDataDeVendaInvalida(
  iso: string,
  hoje: string = hojeBrasil(),
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) {
    return 'Data inválida.';
  }

  const { ano, mes, dia } = partesDaData(iso);
  // Pega 31/02 e 15/13: se a data não existe, o calendário devolve outro dia.
  if (montarData(ano, mes, dia) !== iso || mes < 1 || mes > 12 || dia < 1 || dia > 31) {
    return 'Data inválida.';
  }
  if (new Date(Date.UTC(ano, mes - 1, dia)).getUTCDate() !== dia) {
    return 'Essa data não existe no calendário.';
  }

  // Venda futura é encomenda, e encomenda já tem campo próprio
  // (delivery_date). Registrar faturamento que ainda não aconteceu inflaria a
  // meta do mês com dinheiro que não entrou.
  if (iso > hoje) {
    return 'A venda não pode ser lançada com data futura.';
  }

  const limite = montarData(
    partesDaData(hoje).ano - ANOS_DE_LANCAMENTO_RETROATIVO,
    partesDaData(hoje).mes,
    partesDaData(hoje).dia,
  );
  if (iso < limite) {
    return `Data muito antiga. Só dá pra lançar vendas dos últimos ${ANOS_DE_LANCAMENTO_RETROATIVO} anos.`;
  }

  return null;
}

/**
 * A data-calendário de um TIMESTAMP do banco (last_order_at, created_at),
 * já convertida para o dia correspondente no Brasil.
 */
export function dataDoTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const momento = new Date(iso);
  return Number.isNaN(momento.getTime()) ? null : dataBrasil(momento);
}
