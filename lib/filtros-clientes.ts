import { partesHojeBrasil } from '@/lib/datas';

/**
 * Filtros da lista de clientes.
 *
 * Não são filtros genéricos: cada um saiu de algo que a Tania descreveu na
 * reunião de 27/08, contando como funcionava o sistema da Reserva —
 * "você tem 10 contatos de aniversário, você tem 20 contatos de clientes que
 * não compram há seis meses". A ideia dela é que a lista vire a lista de quem
 * ligar hoje, e não um cadastro para consultar.
 *
 * Tudo roda no navegador de propósito. Com 10 a 40 clientes por aluna, filtrar
 * em memória custa nada e evita uma ida ao servidor a cada clique — e a busca
 * por nome e a etiqueta, que já filtram no banco, continuam como estão.
 */

export type SituacaoCliente =
  | 'todas'
  | 'aniversariantes'
  | 'sem-comprar-3'
  | 'sem-comprar-6'
  | 'nunca-compraram';

export type OrdemCliente = 'nome' | 'ultima-compra' | 'maior-valor' | 'mais-compras';

export interface ClienteFiltravel {
  name: string;
  date_of_birth?: string | null;
  last_order_at?: string | null;
  total_orders?: number | null;
  total_spent?: number | null;
}

export const SITUACOES: { valor: SituacaoCliente; rotulo: string; ajuda: string }[] = [
  { valor: 'todas', rotulo: 'Todas', ajuda: 'Sem filtro de situação' },
  {
    valor: 'aniversariantes',
    rotulo: 'Aniversariantes do mês',
    ajuda: 'Quem faz aniversário neste mês — o contato mais fácil de fazer',
  },
  {
    valor: 'sem-comprar-3',
    rotulo: 'Sem comprar há 3 meses',
    ajuda: 'Já compraram, mas esfriaram',
  },
  {
    valor: 'sem-comprar-6',
    rotulo: 'Sem comprar há 6 meses',
    ajuda: 'Clientes inativas — o exemplo que a Tania deu da Reserva',
  },
  {
    valor: 'nunca-compraram',
    rotulo: 'Nunca compraram',
    ajuda: 'Estão na base mas ainda não compraram — lista de prospecção',
  },
];

export const ORDENS: { valor: OrdemCliente; rotulo: string }[] = [
  { valor: 'nome', rotulo: 'Nome (A–Z)' },
  { valor: 'ultima-compra', rotulo: 'Compra mais recente' },
  { valor: 'maior-valor', rotulo: 'Quem mais gastou' },
  { valor: 'mais-compras', rotulo: 'Quem mais comprou' },
];

/** Instante de N meses atrás. setMonth já resolve a virada de ano. */
function mesesAtras(meses: number): number {
  const data = new Date();
  data.setMonth(data.getMonth() - meses);
  return data.getTime();
}

function comprouAntesDe(cliente: ClienteFiltravel, limite: number): boolean {
  // Quem nunca comprou não entra aqui: "sem comprar há 6 meses" é sobre quem
  // já foi cliente e esfriou. Quem nunca comprou tem filtro próprio.
  if (!cliente.last_order_at) return false;
  return new Date(cliente.last_order_at).getTime() < limite;
}

export function passaNaSituacao(cliente: ClienteFiltravel, situacao: SituacaoCliente): boolean {
  switch (situacao) {
    case 'aniversariantes': {
      // A data vem como 'AAAA-MM-DD'. Lida por partes, e não com new Date(),
      // porque o construtor interpretaria como UTC e uma cliente nascida dia 1º
      // apareceria no mês anterior.
      if (!cliente.date_of_birth) return false;
      const mesDoAniversario = Number(cliente.date_of_birth.split('-')[1] ?? 0);
      return mesDoAniversario === partesHojeBrasil().mes;
    }
    case 'sem-comprar-3':
      return comprouAntesDe(cliente, mesesAtras(3));
    case 'sem-comprar-6':
      return comprouAntesDe(cliente, mesesAtras(6));
    case 'nunca-compraram':
      return !cliente.last_order_at && !(cliente.total_orders ?? 0);
    case 'todas':
    default:
      return true;
  }
}

export function ordenarClientes<T extends ClienteFiltravel>(lista: T[], ordem: OrdemCliente): T[] {
  const copia = [...lista];

  switch (ordem) {
    case 'ultima-compra':
      // Quem nunca comprou vai pro fim: a pergunta aqui é "quem comprou por
      // último", e sem compra não há resposta — zero mentiria.
      return copia.sort((a, b) => {
        const ta = a.last_order_at ? new Date(a.last_order_at).getTime() : -Infinity;
        const tb = b.last_order_at ? new Date(b.last_order_at).getTime() : -Infinity;
        return tb - ta;
      });
    case 'maior-valor':
      return copia.sort((a, b) => (b.total_spent ?? 0) - (a.total_spent ?? 0));
    case 'mais-compras':
      return copia.sort((a, b) => (b.total_orders ?? 0) - (a.total_orders ?? 0));
    case 'nome':
    default:
      // localeCompare com pt-BR pra "Álvaro" ficar junto de "Alvaro", e não
      // depois de "Zilda" como aconteceria comparando por código de caractere.
      return copia.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
}
