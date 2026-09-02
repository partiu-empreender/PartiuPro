import { dataDoTimestamp, diasEntre, montarData, partesDaData, somarDias } from '@/lib/datas';
import { DIAS_SEM_COMPRAR } from '@/lib/filtros-clientes';

/**
 * A agenda de contato.
 *
 * O desenho parte de uma constatação: quase nenhum lembrete precisa ser
 * digitado. Aniversário da cliente, um ano de cadastro, três meses sem
 * comprar — o banco já sabe tudo isso. O que faltava era alguém perguntar.
 *
 * Então os lembretes automáticos são CALCULADOS a cada leitura, não gravados
 * por um job. Três consequências, todas boas:
 *
 *   - não existe agendador pra manter (nem pra falhar em silêncio);
 *   - a lista nunca fica velha: se a cliente comprou ontem, o "retomar
 *     contato" some sozinho, sem ninguém limpar nada;
 *   - rodar duas vezes não duplica nada.
 *
 * O banco entra só pra guardar o que o cálculo não sabe: o que a aluna
 * escreveu à mão, e quais automáticos ela já resolveu. Ver a migration
 * `009_lembretes.sql`.
 */

export type OrigemLembrete = 'manual' | 'aniversario' | 'cliente-ha-um-ano' | 'retomar-contato';

export interface Lembrete {
  /** Uuid da linha quando gravada; a própria chave quando ainda é só cálculo. */
  id: string;
  /** Já existe linha no banco? É o que separa "editável/apagável" de "calculado". */
  gravado: boolean;
  customer_id: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  data: string;
  titulo: string;
  observacao: string | null;
  origem: OrigemLembrete;
  chave: string | null;
  concluido: boolean;
}

/** O que o gerador precisa saber de cada cliente. */
export interface ClienteParaLembrete {
  id: string;
  name: string;
  phone?: string | null;
  date_of_birth?: string | null;
  created_at?: string | null;
  last_order_at?: string | null;
}

/** Linha crua da tabela `lembretes`. */
export interface LembreteGravado {
  id: string;
  customer_id: string | null;
  data: string;
  titulo: string;
  observacao: string | null;
  origem: string;
  chave: string | null;
  concluido_em: string | null;
}

/**
 * Dias sem comprar que disparam o lembrete de retomada.
 *
 * Vem de `DIAS_SEM_COMPRAR.tres` e não de um 90 escrito aqui: o lembrete
 * "está há 3 meses sem comprar" e o filtro "Sem comprar há 3 meses" têm que
 * cair no mesmo dia, senão a agenda cita uma cliente que a lista de clientes
 * não mostra. Importando a constante, os dois não têm como divergir.
 *
 * Três meses e não seis: aos seis a cliente já esfriou de vez e o lembrete
 * chega tarde. Os seis meses continuam existindo como FILTRO, que é onde a
 * Tania quer varrer a base inteira de uma vez.
 */
export const DIAS_PARA_RETOMAR = DIAS_SEM_COMPRAR.tres;

/**
 * Quantos dias pra trás a agenda continua mostrando o que não foi feito.
 *
 * Sem isso, o aniversário de ontem que ela não viu sumiria da tela hoje — e
 * um lembrete que desaparece sozinho é pior do que não ter lembrete.
 */
export const DIAS_DE_ATRASO_VISIVEL = 30;

export const ROTULO_ORIGEM: Record<OrigemLembrete, string> = {
  manual: 'Criado por você',
  aniversario: 'Aniversário',
  'cliente-ha-um-ano': 'Tempo de casa',
  'retomar-contato': 'Sem comprar',
};

function candidato(
  cliente: ClienteParaLembrete,
  origem: OrigemLembrete,
  chave: string,
  data: string,
  titulo: string,
  observacao: string | null,
): Lembrete {
  return {
    id: chave,
    gravado: false,
    customer_id: cliente.id,
    cliente_nome: cliente.name,
    cliente_telefone: cliente.phone ?? null,
    data,
    titulo,
    observacao,
    origem,
    chave,
    concluido: false,
  };
}

/**
 * O aniversário da cliente projetado no primeiro ano em que ainda não passou.
 *
 * Só o mês e o dia importam — o ano de nascimento serviria pra dizer a idade,
 * que não é o que a agenda pergunta.
 */
function proximoAniversario(nascimento: string, desde: string): string | null {
  const { mes, dia } = partesDaData(nascimento);
  if (!mes || !dia) return null;

  const { ano } = partesDaData(desde);
  // somarDias(x, 0) normaliza 29/02 em ano comum para 1º de março, em vez de
  // devolver uma data que não existe no calendário daquele ano.
  const desteAno = somarDias(montarData(ano, mes, dia), 0);
  return desteAno >= desde ? desteAno : somarDias(montarData(ano + 1, mes, dia), 0);
}

/**
 * Lembretes automáticos com data dentro da janela [desde, ate].
 *
 * Cada regra é ancorada numa data específica de propósito. "Todo mundo que
 * está há mais de 90 dias sem comprar" encheria a agenda com as mesmas vinte
 * pessoas todo dia; "quem completa 90 dias sem comprar HOJE" é um item que
 * aparece uma vez, na data certa, e sai quando ela compra de novo. O que é
 * varredura de base continua sendo filtro na tela de clientes.
 */
export function gerarLembretesAutomaticos(
  clientes: ClienteParaLembrete[],
  desde: string,
  ate: string,
): Lembrete[] {
  const gerados: Lembrete[] = [];

  for (const cliente of clientes) {
    // 1. Aniversário da cliente.
    if (cliente.date_of_birth) {
      const data = proximoAniversario(cliente.date_of_birth, desde);
      if (data && data <= ate) {
        gerados.push(
          candidato(
            cliente,
            'aniversario',
            `aniversario:${cliente.id}:${partesDaData(data).ano}`,
            data,
            `Aniversário de ${cliente.name}`,
            'Mandar uma mensagem — e, se couber, oferecer o café da manhã do dia.',
          ),
        );
      }
    }

    // 2. Tempo de casa: a data em que ela entrou na base, completando anos.
    const entrou = dataDoTimestamp(cliente.created_at);
    if (entrou) {
      const data = proximoAniversario(entrou, desde);
      const anos = data ? partesDaData(data).ano - partesDaData(entrou).ano : 0;
      if (data && data <= ate && anos >= 1) {
        gerados.push(
          candidato(
            cliente,
            'cliente-ha-um-ano',
            `cliente-ha-um-ano:${cliente.id}:${anos}`,
            data,
            `${cliente.name} é sua cliente há ${anos} ano${anos > 1 ? 's' : ''}`,
            'Agradecer o tempo de casa custa uma mensagem e é lembrado por muito tempo.',
          ),
        );
      }
    }

    // 3. Retomada: o dia em que ela completa 90 dias sem comprar.
    //    A chave carrega a data da última compra, então uma compra nova gera
    //    outro lembrete lá na frente em vez de reabrir este.
    const ultimaCompra = dataDoTimestamp(cliente.last_order_at);
    if (ultimaCompra) {
      const data = somarDias(ultimaCompra, DIAS_PARA_RETOMAR);
      if (data >= desde && data <= ate) {
        gerados.push(
          candidato(
            cliente,
            'retomar-contato',
            `retomar-contato:${cliente.id}:${ultimaCompra}`,
            data,
            `${cliente.name} está há 3 meses sem comprar`,
            'A última compra foi em ' + formatarBR(ultimaCompra) + '. Vale um "sumida!".',
          ),
        );
      }
    }
  }

  return gerados;
}

/** 'AAAA-MM-DD' em 'DD/MM/AAAA', sem passar por Date (que jogaria o fuso em cima). */
export function formatarBR(iso: string): string {
  const { ano, mes, dia } = partesDaData(iso);
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

function paraLembrete(
  linha: LembreteGravado,
  clientePorId: Map<string, ClienteParaLembrete>,
): Lembrete {
  const cliente = linha.customer_id ? clientePorId.get(linha.customer_id) : undefined;
  return {
    id: linha.id,
    gravado: true,
    customer_id: linha.customer_id,
    cliente_nome: cliente?.name ?? null,
    cliente_telefone: cliente?.phone ?? null,
    data: linha.data,
    titulo: linha.titulo,
    observacao: linha.observacao,
    origem: (linha.origem as OrigemLembrete) ?? 'manual',
    chave: linha.chave,
    concluido: Boolean(linha.concluido_em),
  };
}

/**
 * Junta o que está no banco com o que foi calculado.
 *
 * A regra do encontro é uma só: linha gravada VENCE candidato de mesma chave.
 * É assim que "já liguei pra ela" sobrevive — o candidato continua sendo
 * gerado, mas quem aparece na tela é a linha marcada como concluída.
 */
export function juntarLembretes(
  gravados: LembreteGravado[],
  automaticos: Lembrete[],
  clientes: ClienteParaLembrete[],
): Lembrete[] {
  const clientePorId = new Map(clientes.map((c) => [c.id, c]));
  const jaGravados = gravados.map((linha) => paraLembrete(linha, clientePorId));
  const chavesGravadas = new Set(gravados.map((l) => l.chave).filter(Boolean));

  const restantes = automaticos.filter((a) => !chavesGravadas.has(a.chave));

  return [...jaGravados, ...restantes].sort((a, b) => {
    // Pendente antes de concluído; dentro de cada grupo, o mais antigo primeiro
    // — o atrasado é justamente o que precisa aparecer no topo.
    if (a.concluido !== b.concluido) return a.concluido ? 1 : -1;
    if (a.data !== b.data) return a.data < b.data ? -1 : 1;
    return a.titulo.localeCompare(b.titulo, 'pt-BR');
  });
}

/** 'Hoje', 'Amanhã', 'Atrasado há 3 dias'... — a agenda é lida por proximidade. */
export function comoFalarDaData(data: string, hoje: string): string {
  const dias = diasEntre(hoje, data);
  if (dias === 0) return 'Hoje';
  if (dias === 1) return 'Amanhã';
  if (dias === -1) return 'Era ontem';
  if (dias < 0) return `Atrasado há ${-dias} dias`;
  if (dias <= 7) return `Em ${dias} dias`;
  return formatarBR(data);
}

/**
 * Uma primeira frase pra abrir a conversa no WhatsApp.
 *
 * Não é para ser mandada como está — é para tirar a aluna da tela em branco,
 * que é onde o contato costuma morrer. O texto vai preenchido no aplicativo e
 * ela edita antes de enviar.
 */
export function mensagemSugerida(lembrete: Lembrete): string {
  const nome = (lembrete.cliente_nome ?? '').split(' ')[0] || 'oi';

  switch (lembrete.origem) {
    case 'aniversario':
      return `Oi, ${nome}! Passando só pra te desejar um feliz aniversário 🎉`;
    case 'cliente-ha-um-ano':
      return `Oi, ${nome}! Vi aqui que faz um tempo que você é minha cliente e queria te agradecer 💛`;
    case 'retomar-contato':
      return `Oi, ${nome}! Sumida! Tudo bem? Passando pra saber de você.`;
    default:
      return `Oi, ${nome}!`;
  }
}
