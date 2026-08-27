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
