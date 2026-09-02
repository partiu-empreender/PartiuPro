import { describe, expect, it } from 'vitest';
import {
  FILTROS_PADRAO,
  aplicarFiltros,
  contarFiltrosAtivos,
  descreverAniversario,
  filtrarPorEtiquetas,
  filtrarPorSituacao,
  ordenarClientes,
  type ClienteFiltravel,
} from '@/lib/filtros-clientes';
import { gerarLembretesAutomaticos, juntarLembretes } from '@/lib/lembretes';
import { DATAS_COMEMORATIVAS, janelaDaUltimaOcorrencia } from '@/lib/datas-comemorativas';
import { diasEntre, somarDias } from '@/lib/datas';

/**
 * Uma data fixa em todos os testes.
 *
 * Nada aqui usa "hoje" de verdade: um teste de filtro de aniversário que
 * passasse hoje e quebrasse em 5 de setembro seria pior do que não existir.
 * Todas as funções recebem `hoje` por parâmetro justamente pra isso.
 */
const HOJE = '2026-08-31';

const clientes: ClienteFiltravel[] = [
  {
    id: 'ana',
    name: 'Ana Paula',
    date_of_birth: '1990-09-05',
    created_at: '2024-09-10T12:00:00Z',
    // 02/06 + 90 dias = 31/08, exatamente HOJE.
    last_order_at: '2026-06-02T14:00:00Z',
    total_orders: 3,
    total_spent: 900,
    etiquetas: [{ id: 'corporativo' }],
  },
  {
    id: 'bruna',
    name: 'Bruna',
    date_of_birth: '1985-12-30',
    created_at: '2026-08-20T12:00:00Z',
    last_order_at: null,
    total_orders: 0,
    total_spent: 0,
    etiquetas: [],
  },
  {
    id: 'carla',
    name: 'Carla',
    date_of_birth: '1992-09-01',
    created_at: '2025-08-31T12:00:00Z',
    last_order_at: '2026-08-25T10:00:00Z',
    total_orders: 1,
    total_spent: 120,
    etiquetas: [{ id: 'corporativo' }, { id: 'natal' }],
  },
];

const nomes = (lista: ClienteFiltravel[]) => lista.map((c) => c.name);

describe('filtros de situação', () => {
  it('separa quem esfriou de quem nunca comprou', () => {
    expect(nomes(filtrarPorSituacao(clientes, 'sem-comprar-3', HOJE))).toEqual(['Ana Paula']);
    expect(nomes(filtrarPorSituacao(clientes, 'nunca-compraram', HOJE))).toEqual(['Bruna']);
  });

  it('conta a inatividade em dias inteiros, incluindo o dia em que ela fecha', () => {
    // A véspera não pode listar ninguém: a Ana fecha 90 dias exatamente hoje.
    expect(filtrarPorSituacao(clientes, 'sem-comprar-3', '2026-08-30')).toHaveLength(0);
    expect(filtrarPorSituacao(clientes, 'sem-comprar-3', HOJE)).toHaveLength(1);
  });

  it('"compraram nos últimos 30 dias" é o avesso de "sem comprar"', () => {
    expect(nomes(filtrarPorSituacao(clientes, 'compraram-30', HOJE))).toEqual(['Carla']);
  });

  it('separa quem comprou uma vez de quem voltou', () => {
    expect(nomes(filtrarPorSituacao(clientes, 'so-uma-compra', HOJE))).toEqual(['Carla']);
    expect(nomes(filtrarPorSituacao(clientes, 'recorrentes', HOJE))).toEqual(['Ana Paula']);
  });

  it('acha os aniversariantes da semana e do mês sem confundir os meses', () => {
    expect(nomes(filtrarPorSituacao(clientes, 'aniversariantes-semana', HOJE))).toEqual([
      'Ana Paula',
      'Carla',
    ]);
    // Em 31/08 ninguém faz aniversário no mês corrente: as duas são de setembro.
    expect(filtrarPorSituacao(clientes, 'aniversariantes-mes', HOJE)).toHaveLength(0);
    expect(nomes(filtrarPorSituacao(clientes, 'aniversariantes-mes', '2026-09-15'))).toEqual([
      'Ana Paula',
      'Carla',
    ]);
  });

  it('atravessa a virada do ano na janela de aniversário', () => {
    // Em 28/12 a janela de 7 dias vai até 04/01 — um intervalo que "termina
    // antes de começar" quando se compara só mês e dia.
    expect(nomes(filtrarPorSituacao(clientes, 'aniversariantes-semana', '2026-12-28'))).toEqual([
      'Bruna',
    ]);
  });

  it('acha quem entrou na base no último mês', () => {
    expect(nomes(filtrarPorSituacao(clientes, 'novas', HOJE))).toEqual(['Bruna']);
  });
});

describe('melhores clientes', () => {
  /** Base sintética: n pessoas com gasto crescente. */
  const base = (n: number): ClienteFiltravel[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `c${i}`,
      name: `C${i}`,
      total_spent: (i + 1) * 100,
      total_orders: 1,
      etiquetas: [],
    }));

  it('devolve 20% arredondado pra cima, sem piso inventado', () => {
    // O piso de 3 que existia aqui devolvia 3 de 4 pessoas sob o rótulo
    // "as 20% que mais gastaram".
    expect(filtrarPorSituacao(base(4), 'melhores', HOJE)).toHaveLength(1);
    expect(filtrarPorSituacao(base(10), 'melhores', HOJE)).toHaveLength(2);
    expect(filtrarPorSituacao(base(30), 'melhores', HOJE)).toHaveLength(6);
  });

  it('escolhe quem mais gastou — e devolve na ordem da lista, não do ranking', () => {
    // `filtrarPorSituacao` responde QUEM entra no recorte; a ordem é decisão
    // de `ordenarClientes`, que roda depois. Por isso a comparação é de
    // conjunto: esperar ['C9','C8'] aqui seria testar a ordem errada.
    const escolhidas = nomes(filtrarPorSituacao(base(10), 'melhores', HOJE));
    expect(new Set(escolhidas)).toEqual(new Set(['C9', 'C8']));
    expect(escolhidas).toEqual(['C8', 'C9']);
  });

  it('ordenado por maior valor, o topo do ranking vem na frente', () => {
    const melhores = filtrarPorSituacao(base(10), 'melhores', HOJE);
    expect(nomes(ordenarClientes(melhores, 'maior-valor'))).toEqual(['C9', 'C8']);
  });

  it('ignora quem nunca gastou nada', () => {
    expect(filtrarPorSituacao(clientes, 'melhores', HOJE).map((c) => c.id)).not.toContain('bruna');
  });
});

describe('filtro por etiqueta', () => {
  it('"qualquer uma" soma os grupos e "todas juntas" cruza', () => {
    const marcadas = ['corporativo', 'natal'];
    expect(nomes(filtrarPorEtiquetas(clientes, marcadas, 'qualquer', false))).toEqual([
      'Ana Paula',
      'Carla',
    ]);
    expect(nomes(filtrarPorEtiquetas(clientes, marcadas, 'todas', false))).toEqual(['Carla']);
  });

  it('"sem etiqueta" ignora as etiquetas marcadas em vez de devolver lista vazia', () => {
    expect(nomes(filtrarPorEtiquetas(clientes, ['corporativo'], 'qualquer', true))).toEqual([
      'Bruna',
    ]);
  });
});

describe('filtros combinados', () => {
  it('cruza data comemorativa, etiqueta e situação', () => {
    const resultado = aplicarFiltros(
      clientes,
      {
        ...FILTROS_PADRAO,
        idsComemorativa: ['ana', 'carla'],
        etiquetas: ['corporativo'],
        situacao: 'so-uma-compra',
      },
      HOJE,
    );
    expect(nomes(resultado)).toEqual(['Carla']);
  });

  it('conta os filtros ligados pro botão de limpar', () => {
    expect(contarFiltrosAtivos(FILTROS_PADRAO)).toBe(0);
    expect(
      contarFiltrosAtivos({
        ...FILTROS_PADRAO,
        situacao: 'melhores',
        etiquetas: ['corporativo'],
        idsComemorativa: ['ana'],
      }),
    ).toBe(3);
  });

  it('conta "sem etiqueta" como um filtro só', () => {
    expect(contarFiltrosAtivos({ ...FILTROS_PADRAO, semEtiqueta: true })).toBe(1);
  });
});

describe('ordenação', () => {
  it('põe o aniversário mais próximo na frente e quem não tem data no fim', () => {
    const semData = [...clientes, { id: 'x', name: 'Sem data', etiquetas: [] }];
    expect(nomes(ordenarClientes(semData, 'aniversario', HOJE))).toEqual([
      'Carla',
      'Ana Paula',
      'Bruna',
      'Sem data',
    ]);
  });

  it('manda quem nunca comprou pro fim da ordem por última compra', () => {
    expect(nomes(ordenarClientes(clientes, 'ultima-compra', HOJE))).toEqual([
      'Carla',
      'Ana Paula',
      'Bruna',
    ]);
  });

  it('ordena nome com acento junto do sem acento', () => {
    const lista = [
      { id: '1', name: 'Zilda', etiquetas: [] },
      { id: '2', name: 'Álvaro', etiquetas: [] },
      { id: '3', name: 'Alvaro', etiquetas: [] },
    ];
    expect(nomes(ordenarClientes(lista, 'nome'))).toEqual(['Alvaro', 'Álvaro', 'Zilda']);
  });
});

describe('descrição do aniversário na lista', () => {
  it('fala em proximidade quando está perto e em data quando está longe', () => {
    expect(descreverAniversario(clientes[1]!, HOJE)).toBe('30/12');
    expect(descreverAniversario(clientes[2]!, HOJE)).toBe('01/09 · amanhã');
    expect(descreverAniversario(clientes[0]!, HOJE)).toBe('05/09 · em 5 dias');
    expect(descreverAniversario(clientes[2]!, '2026-09-01')).toBe('01/09 · é hoje');
  });

  it('devolve nulo quando não há data de nascimento', () => {
    expect(descreverAniversario({ id: 'x', name: 'X' }, HOJE)).toBeNull();
  });
});

describe('a agenda e o filtro não podem divergir', () => {
  it('o lembrete de retomada cai no mesmo dia em que o filtro passa a listar', () => {
    const automaticos = gerarLembretesAutomaticos(
      clientes.map((c) => ({ ...c, name: c.name })),
      '2026-08-01',
      '2026-10-30',
    );

    const naAgenda = automaticos
      .filter((l) => l.origem === 'retomar-contato' && l.data === HOJE)
      .map((l) => l.cliente_nome);

    expect(naAgenda).toEqual(nomes(filtrarPorSituacao(clientes, 'sem-comprar-3', HOJE)));
  });
});

describe('geração e junção de lembretes', () => {
  const janela = { desde: '2026-08-01', ate: '2026-10-30' };
  const paraLembrete = clientes.map((c) => ({ ...c, name: c.name }));

  it('gera aniversário, tempo de casa e retomada nas datas certas', () => {
    const gerados = gerarLembretesAutomaticos(paraLembrete, janela.desde, janela.ate);
    const porOrigem = (origem: string) =>
      gerados.filter((l) => l.origem === origem).map((l) => `${l.data} ${l.cliente_nome}`);

    expect(porOrigem('aniversario')).toEqual(['2026-09-05 Ana Paula', '2026-09-01 Carla']);
    expect(porOrigem('retomar-contato')).toEqual(['2026-08-31 Ana Paula']);
    // A Bruna entrou na base há dez dias: ainda não completou um ano.
    expect(porOrigem('cliente-ha-um-ano')).toEqual([
      '2026-09-10 Ana Paula',
      '2026-08-31 Carla',
    ]);
  });

  it('cada lembrete automático tem chave estável', () => {
    const gerados = gerarLembretesAutomaticos(paraLembrete, janela.desde, janela.ate);
    const chaves = gerados.map((l) => l.chave);
    expect(new Set(chaves).size).toBe(chaves.length);
    expect(chaves).toContain('aniversario:ana:2026');
    // A chave carrega a data da última compra: uma compra nova gera outro
    // lembrete lá na frente em vez de reabrir este.
    expect(chaves).toContain('retomar-contato:ana:2026-06-02');
  });

  it('a linha gravada vence o candidato de mesma chave', () => {
    const automaticos = gerarLembretesAutomaticos(paraLembrete, janela.desde, janela.ate);
    const juntos = juntarLembretes(
      [
        {
          id: 'uuid-1',
          customer_id: 'ana',
          data: '2026-09-05',
          titulo: 'Aniversário de Ana Paula',
          observacao: null,
          origem: 'aniversario',
          chave: 'aniversario:ana:2026',
          concluido_em: '2026-09-05T10:00:00Z',
        },
      ],
      automaticos,
      paraLembrete,
    );

    const aniversariosDaAna = juntos.filter((l) => l.chave === 'aniversario:ana:2026');
    expect(aniversariosDaAna).toHaveLength(1);
    expect(aniversariosDaAna[0]!.concluido).toBe(true);
    expect(aniversariosDaAna[0]!.gravado).toBe(true);
  });

  it('põe pendente antes de concluído e o mais atrasado no topo', () => {
    const automaticos = gerarLembretesAutomaticos(paraLembrete, janela.desde, janela.ate);
    const juntos = juntarLembretes([], automaticos, paraLembrete);
    const datas = juntos.map((l) => l.data);
    expect([...datas]).toEqual([...datas].sort());
  });

  it('não gera retomada pra quem nunca comprou', () => {
    const gerados = gerarLembretesAutomaticos(
      [{ id: 'bruna', name: 'Bruna', last_order_at: null }],
      janela.desde,
      janela.ate,
    );
    expect(gerados).toHaveLength(0);
  });
});

describe('datas comemorativas', () => {
  it('calcula o segundo domingo de maio e de agosto', () => {
    const maes = DATAS_COMEMORATIVAS.find((d) => d.id === 'maes')!;
    const pais = DATAS_COMEMORATIVAS.find((d) => d.id === 'pais')!;
    expect(maes.quando(2026)).toBe('2026-05-10');
    expect(maes.quando(2025)).toBe('2025-05-11');
    expect(pais.quando(2026)).toBe('2026-08-09');
  });

  it('calcula a Páscoa', () => {
    const pascoa = DATAS_COMEMORATIVAS.find((d) => d.id === 'pascoa')!;
    expect(pascoa.quando(2025)).toBe('2025-04-20');
    expect(pascoa.quando(2026)).toBe('2026-04-05');
    expect(pascoa.quando(2027)).toBe('2027-03-28');
  });

  it('usa a última vez que a data aconteceu, não o ano passado fixo', () => {
    const maes = DATAS_COMEMORATIVAS.find((d) => d.id === 'maes')!;
    const natal = DATAS_COMEMORATIVAS.find((d) => d.id === 'natal')!;

    // Em agosto, o Dia das Mães que interessa é o de maio DESTE ano.
    expect(janelaDaUltimaOcorrencia(maes, HOJE).ano).toBe(2026);
    // O Natal deste ano ainda não chegou, então vale o do ano passado.
    expect(janelaDaUltimaOcorrencia(natal, HOJE).ano).toBe(2025);
  });

  it('abre a janela antes da data e fecha um dia depois', () => {
    const natal = DATAS_COMEMORATIVAS.find((d) => d.id === 'natal')!;
    const janela = janelaDaUltimaOcorrencia(natal, HOJE);
    expect(janela.inicio).toBe('2025-12-04');
    expect(janela.fim).toBe('2025-12-26');
  });
});

describe('aritmética de data-calendário', () => {
  it('soma e subtrai dias atravessando a virada do ano', () => {
    expect(somarDias('2026-01-15', -30)).toBe('2025-12-16');
    expect(somarDias('2026-12-28', 7)).toBe('2027-01-04');
  });

  it('normaliza 29 de fevereiro em ano comum', () => {
    expect(somarDias('2027-02-29', 0)).toBe('2027-03-01');
  });

  it('conta a distância entre datas nos dois sentidos', () => {
    expect(diasEntre('2026-08-31', '2026-09-05')).toBe(5);
    expect(diasEntre('2026-09-05', '2026-08-31')).toBe(-5);
  });
});
