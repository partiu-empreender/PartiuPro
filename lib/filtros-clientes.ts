import { dataDoTimestamp, diasEntre, hojeBrasil, partesDaData, somarDias } from '@/lib/datas';

/**
 * Filtros da lista de clientes.
 *
 * Não são filtros genéricos: cada um saiu de algo que a Tania descreveu na
 * reunião de 27/08, contando como funcionava o sistema da Reserva —
 * "você tem 10 contatos de aniversário, você tem 20 contatos de clientes que
 * não compram há seis meses". A ideia dela é que a lista vire a lista de quem
 * ligar hoje, e não um cadastro para consultar.
 *
 * A divisão de trabalho entre filtro e etiqueta é a regra que sustenta o
 * arquivo inteiro: **o que o sistema calcula sozinho é filtro, o que só a
 * aluna sabe é etiqueta**. "Sem comprar há 6 meses" como etiqueta manual
 * apodreceria — a cliente compra de novo e a etiqueta continua lá até alguém
 * lembrar de tirar. Como filtro, ela está sempre certa e custa zero trabalho.
 *
 * Tudo roda no navegador de propósito. Com 10 a 40 clientes por aluna, filtrar
 * em memória custa nada e evita uma ida ao servidor a cada clique — só a busca
 * por nome continua no banco, porque é a única que precisa varrer texto.
 */

export type SituacaoCliente =
  | 'todas'
  | 'aniversariantes-semana'
  | 'aniversariantes-mes'
  | 'novas'
  | 'compraram-30'
  | 'so-uma-compra'
  | 'recorrentes'
  | 'melhores'
  | 'sem-comprar-3'
  | 'sem-comprar-6'
  | 'sem-comprar-12'
  | 'nunca-compraram';

export type OrdemCliente =
  | 'nome'
  | 'ultima-compra'
  | 'maior-valor'
  | 'mais-compras'
  | 'cadastro-recente'
  | 'aniversario';

/** Como combinar mais de uma etiqueta marcada. */
export type ModoEtiqueta = 'qualquer' | 'todas';

export interface ClienteFiltravel {
  id: string;
  name: string;
  date_of_birth?: string | null;
  last_order_at?: string | null;
  created_at?: string | null;
  total_orders?: number | null;
  total_spent?: number | null;
  etiquetas?: { id: string }[];
}

export interface FiltrosClientes {
  situacao: SituacaoCliente;
  etiquetas: string[];
  modoEtiqueta: ModoEtiqueta;
  semEtiqueta: boolean;
  /**
   * Data comemorativa escolhida — os três campos andam juntos de propósito.
   *
   * Antes o id do evento e o rótulo moravam no estado da página e só os ids
   * ficavam aqui. Como só este objeto é guardado entre navegações, voltar pra
   * tela trazia a lista filtrada com o seletor dizendo "Qualquer época": a
   * aluna via 8 clientes de 40 e nada explicando por quê. Guardando os três
   * juntos, não existe estado onde um saiba do filtro e o outro não.
   */
  comemorativa: string;
  rotuloComemorativa: string | null;
  /** Quem comprou na janela; `null` = filtro desligado. */
  idsComemorativa: string[] | null;
  ordem: OrdemCliente;
}

export const FILTROS_PADRAO: FiltrosClientes = {
  situacao: 'todas',
  etiquetas: [],
  modoEtiqueta: 'qualquer',
  semEtiqueta: false,
  comemorativa: '',
  rotuloComemorativa: null,
  idsComemorativa: null,
  ordem: 'nome',
};

/**
 * Os cortes de inatividade, em DIAS.
 *
 * Em dias e não em meses de calendário porque `lib/lembretes.ts` importa
 * daqui: o lembrete "está há 3 meses sem comprar" e o filtro "Sem comprar há
 * 3 meses" precisam disparar no MESMO dia. Enquanto um contava 90 dias e o
 * outro somava três meses no calendário, existia uma janela de um ou dois
 * dias em que a agenda citava uma cliente que o filtro de mesmo nome não
 * listava — e quem visse isso concluiria, com razão, que um dos dois mente.
 *
 * "3 meses" continua sendo como se fala; 90 dias é como se conta.
 */
export const DIAS_SEM_COMPRAR = { tres: 90, seis: 180, doze: 365 } as const;

/** Até quantos dias atrás uma compra ainda conta como "recente". */
export const DIAS_COMPRA_RECENTE = 30;

export type GrupoSituacao = 'datas' | 'relacionamento' | 'valor';

export const GRUPOS_SITUACAO: { valor: GrupoSituacao; rotulo: string }[] = [
  { valor: 'datas', rotulo: 'Datas' },
  { valor: 'relacionamento', rotulo: 'Relacionamento' },
  { valor: 'valor', rotulo: 'Valor' },
];

export const SITUACOES: {
  valor: SituacaoCliente;
  rotulo: string;
  ajuda: string;
  grupo?: GrupoSituacao;
}[] = [
  { valor: 'todas', rotulo: 'Todas', ajuda: 'Sem filtro de situação' },

  {
    valor: 'aniversariantes-semana',
    rotulo: 'Aniversário nos próximos 7 dias',
    ajuda: 'Dá tempo de preparar e oferecer antes do dia',
    grupo: 'datas',
  },
  {
    valor: 'aniversariantes-mes',
    rotulo: 'Aniversariantes do mês',
    ajuda: 'Quem faz aniversário neste mês — o contato mais fácil de fazer',
    grupo: 'datas',
  },
  {
    valor: 'novas',
    rotulo: 'Novas na base (30 dias)',
    ajuda: 'Entraram no cadastro no último mês — boa hora pra uma boas-vindas',
    grupo: 'datas',
  },

  {
    valor: 'compraram-30',
    rotulo: 'Compraram nos últimos 30 dias',
    ajuda: 'Quem está quente agora',
    grupo: 'relacionamento',
  },
  {
    valor: 'so-uma-compra',
    rotulo: 'Compraram só uma vez',
    ajuda: 'Experimentaram e não voltaram — o grupo com mais dinheiro na mesa',
    grupo: 'relacionamento',
  },
  {
    valor: 'recorrentes',
    rotulo: 'Recorrentes (2+ compras)',
    ajuda: 'Já voltaram pelo menos uma vez',
    grupo: 'relacionamento',
  },
  {
    valor: 'sem-comprar-3',
    rotulo: 'Sem comprar há 3 meses',
    ajuda: 'Já compraram, mas esfriaram',
    grupo: 'relacionamento',
  },
  {
    valor: 'sem-comprar-6',
    rotulo: 'Sem comprar há 6 meses',
    ajuda: 'Clientes inativas — o exemplo que a Tania deu da Reserva',
    grupo: 'relacionamento',
  },
  {
    valor: 'sem-comprar-12',
    rotulo: 'Sem comprar há 1 ano',
    ajuda: 'Praticamente perdidas — vale uma última tentativa',
    grupo: 'relacionamento',
  },
  {
    valor: 'nunca-compraram',
    rotulo: 'Nunca compraram',
    ajuda: 'Estão na base mas ainda não compraram — lista de prospecção',
    grupo: 'relacionamento',
  },

  {
    valor: 'melhores',
    rotulo: 'Melhores clientes',
    ajuda:
      'As 20% que mais gastaram. Combinado com outro filtro, são as melhores DENTRO daquele recorte',
    grupo: 'valor',
  },
];

export const ORDENS: { valor: OrdemCliente; rotulo: string }[] = [
  { valor: 'nome', rotulo: 'Nome (A–Z)' },
  { valor: 'ultima-compra', rotulo: 'Compra mais recente' },
  { valor: 'maior-valor', rotulo: 'Quem mais gastou' },
  { valor: 'mais-compras', rotulo: 'Quem mais comprou' },
  { valor: 'cadastro-recente', rotulo: 'Entrou na base por último' },
  { valor: 'aniversario', rotulo: 'Aniversário mais próximo' },
];

/**
 * Completou (ou passou de) `dias` sem comprar.
 *
 * O `<=` não é detalhe: no dia exato em que a cliente fecha 90 dias, o
 * lembrete de retomada dispara. Com `<` estrito ela só apareceria no filtro no
 * dia seguinte, e a agenda citaria alguém que a lista de clientes nega.
 *
 * Quem nunca comprou não entra: "sem comprar há 6 meses" é sobre quem já foi
 * cliente e esfriou. Quem nunca comprou tem filtro próprio.
 */
function semComprarHa(cliente: ClienteFiltravel, dias: number, hoje: string): boolean {
  const ultima = dataDoTimestamp(cliente.last_order_at);
  if (!ultima) return false;
  return ultima <= somarDias(hoje, -dias);
}

/** Comprou dentro da janela recente. É o complemento exato de `semComprarHa`. */
function comprouNosUltimos(cliente: ClienteFiltravel, dias: number, hoje: string): boolean {
  const ultima = dataDoTimestamp(cliente.last_order_at);
  if (!ultima) return false;
  return ultima > somarDias(hoje, -dias);
}

/** 'MM-DD' do aniversário, ou null. Ignora o ano de nascimento de propósito. */
function diaEMesDoAniversario(cliente: ClienteFiltravel): string | null {
  if (!cliente.date_of_birth) return null;
  // A data vem como 'AAAA-MM-DD'. Lida por partes, e não com new Date(),
  // porque o construtor interpretaria como UTC e uma cliente nascida dia 1º
  // apareceria no mês anterior.
  const { mes, dia } = partesDaData(cliente.date_of_birth);
  if (!mes || !dia) return null;
  return `${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * Faltam no máximo `dias` para o aniversário (contando hoje).
 *
 * Compara só mês-dia, e por isso precisa lidar com a virada de ano: em 28 de
 * dezembro, a janela de 7 dias vai de '12-28' até '01-03', que é um intervalo
 * que "começa depois de terminar". Nesse caso a comparação vira OU em vez de E.
 */
export function aniversarioEmAte(cliente: ClienteFiltravel, dias: number, hoje: string): boolean {
  const alvo = diaEMesDoAniversario(cliente);
  if (!alvo) return false;

  const inicio = hoje.slice(5);
  const fim = somarDias(hoje, dias).slice(5);

  return inicio <= fim ? alvo >= inicio && alvo <= fim : alvo >= inicio || alvo <= fim;
}

/** Quantos dias faltam para o próximo aniversário. Infinity se não houver data. */
export function diasAteOAniversario(cliente: ClienteFiltravel, hoje: string): number {
  const alvo = diaEMesDoAniversario(cliente);
  if (!alvo) return Infinity;

  const { ano } = partesDaData(hoje);
  // 29 de fevereiro em ano comum: o Postgres não deixaria gravar uma data
  // inválida, mas a projeção para o ano corrente pode cair em 02-29 de um ano
  // sem o dia 29. Somar zero dias normaliza para 1º de março, que é onde a
  // maioria das pessoas comemora.
  const desteAno = somarDias(`${ano}-${alvo}`, 0);
  const faltam = diasEntre(hoje, desteAno);
  return faltam >= 0 ? faltam : diasEntre(hoje, somarDias(`${ano + 1}-${alvo}`, 0));
}

/**
 * As 20% que mais gastaram.
 *
 * Precisa da lista inteira — é um recorte relativo, não um teste que se faça
 * cliente a cliente. Quem nunca gastou nada fica de fora mesmo que a base seja
 * pequena: "melhor cliente" com R$ 0 seria mentira.
 *
 * Havia um piso de 3 pessoas aqui, pra lista não parecer vazia no começo. Ele
 * saiu porque mentia justamente na fase em que a aluna está: com 4 clientes
 * pagantes, devolvia 3 delas sob o rótulo "as 20% que mais gastaram". O
 * arredondamento pra cima já garante pelo menos uma pessoa sempre que existe
 * alguém que gastou.
 */
function idsDosMelhores(lista: ClienteFiltravel[]): Set<string> {
  const comGasto = lista
    .filter((c) => (c.total_spent ?? 0) > 0)
    .sort((a, b) => (b.total_spent ?? 0) - (a.total_spent ?? 0));

  return new Set(comGasto.slice(0, Math.ceil(comGasto.length * 0.2)).map((c) => c.id));
}

/**
 * Aplica a situação sobre a lista inteira.
 *
 * Recebe a lista, e não um cliente por vez, porque "melhores clientes" é um
 * recorte relativo ao grupo. Manter a assinatura no plural evita ter dois
 * caminhos diferentes de filtragem convivendo.
 */
export function filtrarPorSituacao<T extends ClienteFiltravel>(
  lista: T[],
  situacao: SituacaoCliente,
  hoje: string = hojeBrasil(),
): T[] {
  switch (situacao) {
    case 'aniversariantes-semana':
      return lista.filter((c) => aniversarioEmAte(c, 7, hoje));

    case 'aniversariantes-mes': {
      const mesAtual = String(partesDaData(hoje).mes).padStart(2, '0');
      return lista.filter((c) => diaEMesDoAniversario(c)?.startsWith(mesAtual));
    }

    case 'novas': {
      const limite = somarDias(hoje, -30);
      return lista.filter((c) => {
        const entrou = dataDoTimestamp(c.created_at);
        return entrou !== null && entrou >= limite;
      });
    }

    case 'compraram-30':
      return lista.filter((c) => comprouNosUltimos(c, DIAS_COMPRA_RECENTE, hoje));

    case 'so-uma-compra':
      return lista.filter((c) => (c.total_orders ?? 0) === 1);

    case 'recorrentes':
      return lista.filter((c) => (c.total_orders ?? 0) >= 2);

    case 'melhores': {
      const melhores = idsDosMelhores(lista);
      return lista.filter((c) => melhores.has(c.id));
    }

    case 'sem-comprar-3':
      return lista.filter((c) => semComprarHa(c, DIAS_SEM_COMPRAR.tres, hoje));

    case 'sem-comprar-6':
      return lista.filter((c) => semComprarHa(c, DIAS_SEM_COMPRAR.seis, hoje));

    case 'sem-comprar-12':
      return lista.filter((c) => semComprarHa(c, DIAS_SEM_COMPRAR.doze, hoje));

    case 'nunca-compraram':
      return lista.filter((c) => !c.last_order_at && !(c.total_orders ?? 0));

    case 'todas':
    default:
      return lista;
  }
}

/**
 * Filtro por etiqueta, com seleção múltipla.
 *
 * `qualquer` responde "quem é corporativo OU comprou no Dia das Mães" — é o
 * padrão porque é o que a pessoa espera ao marcar duas etiquetas. `todas`
 * responde "quem é as duas coisas", que é o recorte fino.
 *
 * `semEtiqueta` é o avesso e por isso não se combina com etiquetas marcadas:
 * marcar as duas coisas pediria uma lista vazia por definição. Quando ele
 * está ligado, as etiquetas marcadas são ignoradas.
 */
export function filtrarPorEtiquetas<T extends ClienteFiltravel>(
  lista: T[],
  etiquetas: string[],
  modo: ModoEtiqueta,
  semEtiqueta: boolean,
): T[] {
  if (semEtiqueta) return lista.filter((c) => (c.etiquetas?.length ?? 0) === 0);
  if (etiquetas.length === 0) return lista;

  return lista.filter((cliente) => {
    const dela = new Set((cliente.etiquetas ?? []).map((e) => e.id));
    return modo === 'todas'
      ? etiquetas.every((id) => dela.has(id))
      : etiquetas.some((id) => dela.has(id));
  });
}

export function ordenarClientes<T extends ClienteFiltravel>(
  lista: T[],
  ordem: OrdemCliente,
  hoje: string = hojeBrasil(),
): T[] {
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
    case 'cadastro-recente':
      return copia.sort((a, b) => {
        const ta = a.created_at ? new Date(a.created_at).getTime() : -Infinity;
        const tb = b.created_at ? new Date(b.created_at).getTime() : -Infinity;
        return tb - ta;
      });
    case 'aniversario':
      // Sem data de nascimento o valor é Infinity, então essas caem no fim
      // sozinhas, sem precisar de um caso à parte.
      return copia.sort((a, b) => diasAteOAniversario(a, hoje) - diasAteOAniversario(b, hoje));
    case 'nome':
    default:
      // localeCompare com pt-BR pra "Álvaro" ficar junto de "Alvaro", e não
      // depois de "Zilda" como aconteceria comparando por código de caractere.
      return copia.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
}

/**
 * "05/09 · em 5 dias" — a data do aniversário e o quanto falta.
 *
 * A lista mostrava seis nomes quando ela filtrava por aniversariantes e
 * nenhuma data: dava pra saber QUEM, não QUANDO. Sem isso ela não conseguia
 * separar quem é hoje de quem é sábado, que é a decisão que o filtro deveria
 * estar ajudando a tomar.
 */
export function descreverAniversario(cliente: ClienteFiltravel, hoje: string): string | null {
  if (!cliente.date_of_birth) return null;

  const { mes, dia } = partesDaData(cliente.date_of_birth);
  if (!mes || !dia) return null;

  const quando = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}`;
  const faltam = diasAteOAniversario(cliente, hoje);

  if (faltam === 0) return `${quando} · é hoje`;
  if (faltam === 1) return `${quando} · amanhã`;
  if (faltam <= 30) return `${quando} · em ${faltam} dias`;
  return quando;
}

/** Todos os filtros de uma vez, na ordem em que estreitam mais barato. */
export function aplicarFiltros<T extends ClienteFiltravel>(
  lista: T[],
  filtros: FiltrosClientes,
  hoje: string = hojeBrasil(),
): T[] {
  let resultado = lista;

  if (filtros.idsComemorativa) {
    const ids = new Set(filtros.idsComemorativa);
    resultado = resultado.filter((c) => ids.has(c.id));
  }

  resultado = filtrarPorEtiquetas(
    resultado,
    filtros.etiquetas,
    filtros.modoEtiqueta,
    filtros.semEtiqueta,
  );
  resultado = filtrarPorSituacao(resultado, filtros.situacao, hoje);

  return ordenarClientes(resultado, filtros.ordem, hoje);
}

/** Quantos filtros estão ligados — pro botão "Limpar" saber se tem o que limpar. */
export function contarFiltrosAtivos(filtros: FiltrosClientes): number {
  return (
    (filtros.situacao !== 'todas' ? 1 : 0) +
    (filtros.semEtiqueta ? 1 : filtros.etiquetas.length) +
    (filtros.idsComemorativa ? 1 : 0)
  );
}
