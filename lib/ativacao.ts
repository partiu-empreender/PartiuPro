// Onde cada aluna parou no caminho até a primeira venda.
//
// O painel admin media VENDAS e chamava isso de acompanhamento. O problema é
// que "não vendeu" junta três situações que pedem reações opostas: quem nunca
// abriu o sistema, quem abriu e não soube por onde começar, e quem montou o
// catálogo mas ainda não fechou negócio. As três apareciam com a mesma frase
// ("Nenhuma venda registrada") e a mentora não tinha como saber a quem ligar.
//
// O que este arquivo faz é separá-las. A régua é o caminho que a própria
// ferramenta pede: entrar -> configurar alguma coisa (produto, cliente ou
// meta) -> registrar a primeira venda.
//
// Fica em lib/ e não na rota porque é regra de negócio com resposta certa e
// errada — e regra assim se testa sem subir servidor nem banco, como
// lib/fechamento.ts e lib/datas.ts já fazem aqui.

/** Sinais de que a aluna mexeu em cada parte do sistema. */
export interface SinaisDeUso {
  temProduto: boolean;
  temCliente: boolean;
  temMeta: boolean;
  temAtendimento: boolean;
  temVenda: boolean;
}

/**
 * Os degraus, do mais frio ao mais quente. A ordem importa: é ela que define
 * a prioridade de quem a mentora procura primeiro.
 */
export type PassoDoFunil =
  | 'nunca_entrou'
  | 'entrou_sem_configurar'
  | 'configurou_sem_vender'
  | 'vendeu';

export const ROTULO_DO_PASSO: Record<PassoDoFunil, string> = {
  nunca_entrou: 'Nunca entrou',
  entrou_sem_configurar: 'Entrou, não cadastrou nada',
  configurou_sem_vender: 'Cadastrou, ainda não vendeu',
  vendeu: 'Registrando vendas',
};

/**
 * Em que degrau esta aluna está.
 *
 * `ultimoLogin` vem de auth.users.last_sign_in_at — é o ÚNICO jeito de
 * distinguir "nunca entrou" de "entrou e travou". Quando ele não pode ser
 * lido (a API do auth falhou), chega null e a função não inventa: quem tem
 * qualquer sinal de uso obviamente entrou, e o resto fica no degrau de baixo.
 * Errar pra "nunca entrou" é o lado seguro — a mentora confere ligando.
 */
export function passoDoFunil(
  ultimoLogin: string | null,
  sinais: SinaisDeUso,
): PassoDoFunil {
  if (sinais.temVenda) return 'vendeu';

  const configurou =
    sinais.temProduto || sinais.temCliente || sinais.temMeta || sinais.temAtendimento;
  if (configurou) return 'configurou_sem_vender';

  return ultimoLogin ? 'entrou_sem_configurar' : 'nunca_entrou';
}

/** Quantas alunas em cada degrau. */
export interface ResumoDoFunil {
  total: number;
  nuncaEntraram: number;
  entraramSemConfigurar: number;
  configuraramSemVender: number;
  venderam: number;
  /** Entraram nas últimas 24h — quem ainda está por perto pra ser ajudada. */
  ativasEm24h: number;
}

export function resumirFunil(
  alunas: { passo: PassoDoFunil; ultimo_login: string | null }[],
  agora: number = Date.now(),
): ResumoDoFunil {
  const contar = (p: PassoDoFunil) => alunas.filter((a) => a.passo === p).length;

  return {
    total: alunas.length,
    nuncaEntraram: contar('nunca_entrou'),
    entraramSemConfigurar: contar('entrou_sem_configurar'),
    configuraramSemVender: contar('configurou_sem_vender'),
    venderam: contar('vendeu'),
    ativasEm24h: alunas.filter((a) => {
      if (!a.ultimo_login) return false;
      const quando = new Date(a.ultimo_login).getTime();
      return Number.isFinite(quando) && agora - quando <= 24 * 60 * 60 * 1000;
    }).length,
  };
}

/**
 * Dias inteiros desde o último login. null quando nunca entrou — e não um
 * número grande, porque "nunca" não é "faz muito tempo": são estados
 * diferentes e a tela escreve frases diferentes pra cada um.
 */
export function diasDesde(iso: string | null, agora: number = Date.now()): number | null {
  if (!iso) return null;
  const quando = new Date(iso).getTime();
  if (!Number.isFinite(quando)) return null;
  return Math.floor((agora - quando) / (1000 * 60 * 60 * 24));
}
