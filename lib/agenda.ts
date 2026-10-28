import { DATAS_COMEMORATIVAS } from '@/lib/datas-comemorativas';
import { dataBrasil, diaDaSemana, diasEntre, montarData, recorteDoMes, somarDias } from '@/lib/datas';

// Agenda (Marco 1, item 1.8): os encontros da mentoria e as datas comerciais,
// num calendário mensal. Puro, pra ser testado.

/* ------------------------------------------------------------------------ */
/* Horário dos encontros                                                     */
/* ------------------------------------------------------------------------ */

/**
 * "2026-11-04" + "19:30" → o instante em Brasília, pronto pro banco.
 *
 * O deslocamento é fixo em -03:00 porque o Brasil não tem horário de verão
 * desde 2019. Se um dia voltar, é aqui o único lugar a mudar.
 */
export function inicioEmBrasilia(data: string, hora: string): string {
  return `${data}T${hora}:00-03:00`;
}

const formatadorHora = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** O instante do banco de volta em data e hora de Brasília, pros campos do formulário. */
export function partesEmBrasilia(iso: string): { data: string; hora: string } {
  const momento = new Date(iso);
  return { data: dataBrasil(momento), hora: formatadorHora.format(momento) };
}

/** "19h" ou "19h30". */
export function horaCurta(iso: string): string {
  const [h, m] = formatadorHora.format(new Date(iso)).split(':');
  return m === '00' ? `${h}h` : `${h}h${m}`;
}

export type MomentoDoEncontro = 'futuro' | 'agora' | 'passou';

/**
 * Se o encontro ainda vai acontecer, está acontecendo ou já passou.
 *
 * "Agora" começa 15 minutos antes: é quando a aluna precisa do link da
 * sala, e o botão de entrar acende.
 */
export function momentoDoEncontro(
  inicio: string,
  duracaoMinutos: number,
  agora: Date = new Date(),
): MomentoDoEncontro {
  const comeco = new Date(inicio).getTime() - 15 * 60 * 1000;
  const fim = new Date(inicio).getTime() + duracaoMinutos * 60 * 1000;
  const t = agora.getTime();
  if (t < comeco) return 'futuro';
  if (t <= fim) return 'agora';
  return 'passou';
}

/** "hoje às 19h", "amanhã às 19h30", "em 5 dias", "acontecendo agora". */
export function quandoEhOEncontro(
  inicio: string,
  duracaoMinutos: number,
  agora: Date = new Date(),
): string {
  const momento = momentoDoEncontro(inicio, duracaoMinutos, agora);
  if (momento === 'agora') return 'acontecendo agora';
  if (momento === 'passou') return 'já aconteceu';

  const dias = diasEntre(dataBrasil(agora), dataBrasil(new Date(inicio)));
  if (dias === 0) return `hoje às ${horaCurta(inicio)}`;
  if (dias === 1) return `amanhã às ${horaCurta(inicio)}`;
  return `em ${dias} dias`;
}

/* ------------------------------------------------------------------------ */
/* O calendário                                                              */
/* ------------------------------------------------------------------------ */

export interface DiaDoCalendario {
  data: string;
  dia: number;
  /** false nos dias do mês anterior/seguinte que completam a primeira e a última semana. */
  doMes: boolean;
}

/**
 * As semanas do mês, de domingo a sábado, completando as pontas com os dias
 * dos meses vizinhos — como um calendário de parede. Quatro a seis semanas.
 */
export function semanasDoMes(ano: number, mes: number): DiaDoCalendario[][] {
  const recorte = recorteDoMes(ano, mes);
  if (!recorte) return [];

  const primeiroDomingo = somarDias(recorte.inicio, -diaDaSemana(recorte.inicio));
  const ultimoSabado = somarDias(recorte.fim, 6 - diaDaSemana(recorte.fim));
  const semanas: DiaDoCalendario[][] = [];

  for (let data = primeiroDomingo; data <= ultimoSabado; data = somarDias(data, 7)) {
    semanas.push(
      Array.from({ length: 7 }, (_, i) => {
        const dia = somarDias(data, i);
        return {
          data: dia,
          dia: Number(dia.slice(8, 10)),
          doMes: dia >= recorte.inicio && dia <= recorte.fim,
        };
      }),
    );
  }

  return semanas;
}

/* ------------------------------------------------------------------------ */
/* Datas comerciais                                                          */
/* ------------------------------------------------------------------------ */

export type FaseDaData = 'planejar' | 'divulgar' | 'encomendas' | 'hoje';

export interface DataComercialProxima {
  id: string;
  nome: string;
  data: string;
  dias: number;
  fase: FaseDaData;
}

export const ROTULO_DA_FASE: Record<FaseDaData, string> = {
  planejar: 'Hora de planejar',
  divulgar: 'Hora de divulgar',
  encomendas: 'Encomendas abertas',
  hoje: 'É hoje!',
};

/**
 * Em que pé está a preparação pra uma data comercial.
 *
 * O aviso começa 60 dias antes (escopo do Marco 1: "45 a 60 dias antes de
 * cada data"). De 60 a 46 é planejar — cardápio, fornecedores; de 45 até a
 * janela de encomendas é divulgar; dentro da janela, a encomenda acontece.
 */
export function faseDaData(dias: number, diasDeJanela: number): FaseDaData | null {
  if (dias < 0 || dias > 60) return null;
  if (dias === 0) return 'hoje';
  if (dias <= diasDeJanela) return 'encomendas';
  if (dias <= 45) return 'divulgar';
  return 'planejar';
}

/** As datas comerciais dos próximos `limite` dias, da mais próxima pra mais distante. */
export function proximasDatasComerciais(hoje: string, limite = 120): DataComercialProxima[] {
  const ano = Number(hoje.slice(0, 4));
  const lista: DataComercialProxima[] = [];

  for (const evento of DATAS_COMEMORATIVAS) {
    for (const alvo of [ano, ano + 1]) {
      const data = evento.quando(alvo);
      const dias = diasEntre(hoje, data);
      if (dias < 0 || dias > limite) continue;
      lista.push({
        id: `${evento.id}:${alvo}`,
        nome: evento.nome,
        data,
        dias,
        fase: faseDaData(dias, evento.diasDeJanela) ?? 'planejar',
      });
    }
  }

  return lista.sort((a, b) => a.dias - b.dias);
}

/** As datas comerciais que caem dentro do mês, pro calendário. */
export function datasComerciaisDoMes(ano: number, mes: number): { id: string; nome: string; data: string }[] {
  return DATAS_COMEMORATIVAS.map((evento) => ({
    id: evento.id,
    nome: evento.nome,
    data: evento.quando(ano),
  }))
    .filter((d) => d.data.startsWith(montarData(ano, mes, 1).slice(0, 7)))
    .sort((a, b) => a.data.localeCompare(b.data));
}

/* ------------------------------------------------------------------------ */
/* Validação do cadastro                                                     */
/* ------------------------------------------------------------------------ */

export const ehDataISO = (v: unknown): v is string =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`));

export const ehHora = (v: unknown): v is string =>
  typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/**
 * O link da sala, aceito só se for http(s).
 *
 * Ele vira o `href` de um botão na tela de todas as alunas. Um
 * "javascript:..." ali rodaria código no navegador de cada uma que clicasse —
 * então qualquer outra coisa é recusada, não "consertada".
 */
export function linkSeguro(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string') return undefined;
  const texto = v.trim();
  if (!texto) return null;
  try {
    const url = new URL(texto);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Um encontro como as telas recebem da API. */
export interface Encontro {
  id: string;
  titulo: string;
  descricao: string | null;
  inicio: string;
  duracao_minutos: number;
  link: string | null;
}

/** O próximo encontro que ainda não terminou, ou null. */
export function proximoEncontro<T extends { inicio: string; duracao_minutos: number }>(
  encontros: readonly T[],
  agora: Date = new Date(),
): T | null {
  return (
    [...encontros]
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .find((e) => momentoDoEncontro(e.inicio, e.duracao_minutos, agora) !== 'passou') ?? null
  );
}
