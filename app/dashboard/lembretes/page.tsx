'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BellRing, Plus } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import ItemLembrete from '@/components/shared/ItemLembrete';
import DetalheLembreteDialog from '@/components/shared/DetalheLembreteDialog';
import NovoLembreteDialog from '@/components/shared/NovoLembreteDialog';
import { usarLembretes } from '@/lib/usar-lembretes';
import { hojeBrasil, somarDias } from '@/lib/datas';
import {
  DIAS_DE_ATRASO_VISIVEL,
  DIAS_PARA_RETOMAR,
  type Lembrete,
} from '@/lib/lembretes';
import {
  filtrarPorSituacao,
  type ClienteFiltravel,
  type SituacaoCliente,
} from '@/lib/filtros-clientes';
import { cn } from '@/lib/utils';

interface ClienteDaBase extends ClienteFiltravel {
  id: string;
  name: string;
}

/**
 * Os recortes que a agenda NÃO transforma em lembrete, e por quê.
 *
 * O lembrete de retomada dispara no dia exato em que a cliente completa três
 * meses sem comprar. Quem já estava parada há oito meses quando a agenda
 * entrou no ar nunca teve esse dia dentro da janela — então a base importada
 * nasceria com a agenda quase vazia, justo na hora em que a Tania vai mostrar
 * a funcionalidade pras alunas.
 *
 * A saída não é gerar vinte lembretes de uma vez (isso entulharia a agenda e
 * quebraria a regra de que agenda é o que tem data, e varredura de base é
 * filtro). É apontar pro filtro: aqui vai o número, e o clique leva pra lista
 * já recortada.
 */
const RECORTES_DA_BASE: { situacao: SituacaoCliente; rotulo: string }[] = [
  { situacao: 'sem-comprar-3', rotulo: 'sem comprar há 3 meses' },
  { situacao: 'aniversariantes-mes', rotulo: 'fazem aniversário este mês' },
  { situacao: 'so-uma-compra', rotulo: 'compraram só uma vez' },
  { situacao: 'nunca-compraram', rotulo: 'nunca compraram' },
];

/**
 * A agenda de contato.
 *
 * Os blocos não são um enfeite de layout: "atrasado" e "hoje" são as duas
 * únicas seções que exigem ação agora, e ficam no topo porque a tela precisa
 * responder "o que eu faço hoje?" antes de qualquer outra coisa. O resto é
 * previsão — serve pra ela se preparar, não pra agir.
 */
export default function LembretesPage() {
  const [incluirConcluidos, setIncluirConcluidos] = useState(false);
  const { lembretes, resumo, carregando, concluir, adiar, criar, remover } = usarLembretes({
    incluirConcluidos,
  });

  const [criandoLembrete, setCriandoLembrete] = useState(false);
  // Lembrete solto nao tem ficha pra onde ir, entao o clique abre o detalhe.
  const [lembreteAberto, setLembreteAberto] = useState<Lembrete | null>(null);
  const [clientes, setClientes] = useState<ClienteDaBase[]>([]);

  // A base inteira, buscada uma vez: serve pro seletor do diálogo e pra contar
  // os recortes lá embaixo. Não entra no caminho de carregamento da agenda.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/clientes');
        const dados = await res.json();
        if (res.ok) setClientes(dados.data || []);
      } catch (error) {
        console.error('Erro ao carregar clientes:', error);
      }
    })();
  }, []);

  const hoje = resumo?.hoje ?? hojeBrasil();

  const contagens = useMemo(
    () =>
      RECORTES_DA_BASE.map((recorte) => ({
        ...recorte,
        quantas: filtrarPorSituacao(clientes, recorte.situacao, hoje).length,
      })).filter((recorte) => recorte.quantas > 0),
    [clientes, hoje],
  );

  const blocos = useMemo(() => {
    const fimDaSemana = somarDias(hoje, 7);
    const grupo = (teste: (l: Lembrete) => boolean) =>
      lembretes.filter((l) => !l.concluido && teste(l));

    return [
      { titulo: 'Atrasados', itens: grupo((l) => l.data < hoje), tom: 'atencao' as const },
      { titulo: 'Hoje', itens: grupo((l) => l.data === hoje), tom: 'hoje' as const },
      {
        titulo: 'Próximos 7 dias',
        itens: grupo((l) => l.data > hoje && l.data <= fimDaSemana),
        tom: 'normal' as const,
      },
      {
        titulo: 'Mais pra frente',
        itens: grupo((l) => l.data > fimDaSemana),
        tom: 'normal' as const,
      },
      {
        titulo: 'Já resolvidos',
        itens: lembretes.filter((l) => l.concluido),
        tom: 'normal' as const,
      },
    ].filter((bloco) => bloco.itens.length > 0);
  }, [lembretes, hoje]);

  return (
    <PageShell>
      <PageHeader
        title="Lembretes"
        description="A sua lista de quem falar hoje — a maior parte dela o sistema monta sozinho."
        action={
          <Button onClick={() => setCriandoLembrete(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" /> Novo lembrete
          </Button>
        }
      />

      {resumo && (resumo.atrasados > 0 || resumo.paraHoje > 0) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4 text-sm">
            <BellRing className="h-5 w-5 shrink-0 text-primary" />
            <p>
              {resumo.paraHoje > 0 && (
                <>
                  <strong>{resumo.paraHoje}</strong> pra hoje
                </>
              )}
              {resumo.paraHoje > 0 && resumo.atrasados > 0 && ' · '}
              {resumo.atrasados > 0 && (
                <>
                  <strong>{resumo.atrasados}</strong> atrasado
                  {resumo.atrasados > 1 ? 's' : ''}
                </>
              )}
              .
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {[
          { valor: false, rotulo: 'Pendentes' },
          { valor: true, rotulo: 'Incluir os já resolvidos' },
        ].map((opcao) => (
          <button
            key={String(opcao.valor)}
            type="button"
            aria-pressed={incluirConcluidos === opcao.valor}
            onClick={() => setIncluirConcluidos(opcao.valor)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              incluirConcluidos === opcao.valor
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-white/60 text-muted-foreground backdrop-blur-md hover:bg-accent',
            )}
          >
            {opcao.rotulo}
          </button>
        ))}
      </div>

      {carregando ? (
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      ) : blocos.length === 0 ? (
        <Card className="mx-auto max-w-lg">
          <CardContent className="space-y-4 px-8 py-10 text-center">
            <BellRing className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nada na agenda por enquanto. Ela se enche sozinha conforme você preenche o aniversário
              das suas clientes e registra as vendas — aí aparecem aqui os aniversários, o tempo de
              casa e quem completou {DIAS_PARA_RETOMAR} dias sem comprar.
            </p>
            <Button variant="outline" onClick={() => setCriandoLembrete(true)}>
              <Plus className="mr-2 h-4 w-4" /> Criar um lembrete à mão
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {blocos.map((bloco) => (
            <div key={bloco.titulo} className="space-y-2">
              <h2
                className={cn(
                  'text-xs font-semibold uppercase tracking-wide',
                  bloco.tom === 'atencao'
                    ? 'text-red-700'
                    : bloco.tom === 'hoje'
                      ? 'text-amber-700'
                      : 'text-muted-foreground',
                )}
              >
                {bloco.titulo} ({bloco.itens.length})
              </h2>
              <div className="space-y-2">
                {bloco.itens.map((lembrete) => (
                  <ItemLembrete
                    key={lembrete.id}
                    lembrete={lembrete}
                    hoje={hoje}
                    onConcluir={concluir}
                    onAdiar={adiar}
                    onAbrir={lembrete.customer_id ? undefined : setLembreteAberto}
                    onRemover={remover}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Os recortes da base. Não são lembretes: são a ponte pro filtro, e
          existem porque uma base recém-importada não gera lembrete de
          retomada nenhum — o gatilho é o dia em que a cliente COMPLETA três
          meses, e quem já estava parada passou desse dia faz tempo. */}
      {contagens.length > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4 sm:p-6">
            <h2 className="font-semibold">Na sua base, agora</h2>
            <p className="text-sm text-muted-foreground">
              Não viram lembrete porque não têm data marcada — são listas pra você varrer quando
              quiser.
            </p>
            <div className="flex flex-col gap-1">
              {contagens.map((recorte) => (
                <Link
                  key={recorte.situacao}
                  href={`/dashboard/clientes?situacao=${recorte.situacao}`}
                  className="group flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm transition-colors hover:bg-accent"
                >
                  <span>
                    <strong>{recorte.quantas}</strong> {recorte.rotulo}
                  </span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Aniversários, tempo de casa e “sem comprar há 3 meses” aparecem sozinhos, e somem quando
        deixam de valer — não precisa apagar nada. Marcar como feito é só pra você saber que já
        resolveu. Lembretes com mais de {DIAS_DE_ATRASO_VISIVEL} dias de atraso saem da lista: um
        aniversário atrasado esse tanto não se resolve mais, e a agenda ficaria impossível de ler.
      </p>

      <DetalheLembreteDialog
        lembrete={lembreteAberto}
        hoje={hoje}
        onOpenChange={(aberto) => !aberto && setLembreteAberto(null)}
        onConcluir={concluir}
        onAdiar={adiar}
        onRemover={remover}
      />

      <NovoLembreteDialog
        aberto={criandoLembrete}
        onOpenChange={setCriandoLembrete}
        onCriar={criar}
        clientes={clientes}
      />
    </PageShell>
  );
}
