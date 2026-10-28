'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Receipt, ShoppingBag, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usarConta } from '@/components/shared/AppShell';
import { brlCurto } from '@/components/home/base';
import CartaoFoto from '@/components/home/CartaoFoto';
import CartaoTarefas from '@/components/home/CartaoTarefas';
import CartaoAgenda from '@/components/home/CartaoAgenda';
import { CartaoFaturamento, CartaoFormas, CartaoMeta, CartaoRecebido } from '@/components/home/Graficos';
import { CartaoMaisVendidos, CartaoUltimasVendas } from '@/components/home/Tabelas';
import { usarLembretes } from '@/lib/usar-lembretes';
import { hojeBrasil } from '@/lib/datas';
import { horaBrasil, saudacao } from '@/lib/home';
import { progressoDoMes, semanaDe, type EntregaDaHome, type PainelDaHome } from '@/lib/painel';
import { cn } from '@/lib/utils';

const formatadorDia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "quarta-feira, 28 de outubro" → "Quarta-feira, 28 de outubro". */
const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

interface TopoDaHomeProps {
  aoRegistrarVenda: () => void;
  /** Leva até a lista "Falta resolver", que fica na aba Vendas do Período. */
  aoVerPendencias: () => void;
  /** Leva até a aba Vendas do Período. */
  aoVerVendas: () => void;
  /** Uma entrega foi marcada aqui: o resto do Dashboard precisa saber. */
  aoAlterarVendas: () => void;
  /** Muda quando uma venda é criada, editada ou excluída: refaz as contas. */
  versao: number;
}

/**
 * O topo do Dashboard: a primeira coisa que a aluna vê ao entrar.
 *
 * O desenho segue a referência aprovada em out/2026: saudação grande, uma
 * fileira de indicadores em pílula, os números da base à direita e, embaixo,
 * uma grade de cartões — foto à esquerda, gráficos no meio e as tarefas num
 * cartão escuro e alto à direita.
 *
 * A regra que organiza a tela: o primeiro número é sempre QUANTO ELA VENDEU,
 * nunca um "0% concluído".
 *
 * O resto do Dashboard (Raio-X do mês, vendas do período, precificação)
 * continua logo abaixo, igual ao que era.
 */
export default function TopoDaHome({
  aoRegistrarVenda,
  aoVerPendencias,
  aoVerVendas,
  aoAlterarVendas,
  versao,
}: TopoDaHomeProps) {
  const conta = usarConta();
  const hoje = hojeBrasil();
  const semana = semanaDe(hoje);
  const fimDaSemana = semana[semana.length - 1]?.data ?? hoje;

  const [hora, setHora] = useState(() => horaBrasil());
  const [painel, setPainel] = useState<PainelDaHome | null>(null);
  const [erro, setErro] = useState(false);

  // Contatos da agenda até o fim da semana, incluindo os já feitos: as
  // tarefas mostram o que foi feito hoje riscado, e a agenda da semana
  // mostra os dias seguintes.
  const { lembretes, concluir } = usarLembretes({ ate: fimDaSemana, incluirConcluidos: true });

  // Quem deixa a aba aberta da manhã pra tarde vê a saudação acompanhar.
  useEffect(() => {
    const intervalo = window.setInterval(() => setHora(horaBrasil()), 60 * 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch('/api/home');
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error);
      setPainel(dados.data);
      setErro(false);
    } catch {
      setErro(true);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  const alternarEntrega = async (entrega: EntregaDaHome, entregue: boolean) => {
    // A tela muda antes da resposta: marcar é o gesto mais repetido do
    // cartão, e esperar a ida e volta faz o check parecer travado.
    setPainel((atual) =>
      atual && {
        ...atual,
        entregas: atual.entregas.map((e) => (e.id === entrega.id ? { ...e, entregue } : e)),
      },
    );
    try {
      await fetch(`/api/vendas?id=${encodeURIComponent(entrega.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entrega: entregue ? 'entregue' : 'pendente' }),
      });
    } finally {
      aoAlterarVendas();
    }
  };

  const primeiroNome = conta?.primeiroNome ?? '';
  const progresso = progressoDoMes(hoje);
  const resumo = painel?.resumo;
  const ticket = resumo && resumo.quantidade > 0 ? resumo.vendido / resumo.quantidade : 0;
  const percentualMeta = painel && painel.meta > 0 && resumo ? (resumo.vendido / painel.meta) * 100 : null;
  const conversao =
    painel && painel.atendimentos > 0 && resumo ? (resumo.quantidade / painel.atendimentos) * 100 : null;

  return (
    <section aria-label="Resumo de hoje" className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {primeiraMaiuscula(formatadorDia.format(new Date()))}
          </p>
          <h1 className="mt-1 text-4xl font-medium tracking-tight text-foreground sm:text-5xl">
            {saudacao(hora)}
            {primeiroNome && (
              <>
                , <span className="font-semibold text-primary">{primeiroNome}</span>
              </>
            )}
          </h1>
        </div>
        <Button
          onClick={aoRegistrarVenda}
          size="lg"
          className="h-12 w-full gap-2 rounded-full px-6 text-base sm:w-auto"
        >
          <Plus className="h-5 w-5" />
          Registrar venda
        </Button>
      </div>

      {/* Indicadores em pílula à esquerda; números da base à direita. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap items-end gap-x-3 gap-y-4">
          <Pilula rotulo="Meta" estilo="escuro" valor={percentualMeta} />
          <Pilula rotulo="Recebido" estilo="roxo" valor={painel?.recebimento.percentualPago ?? null} />
          <BarraDoMes
            rotulo={`Mês · dia ${progresso.dia} de ${progresso.diasNoMes}`}
            percentual={progresso.percentual}
          />
          <Pilula rotulo="Conversão" estilo="contorno" valor={conversao} />
        </div>

        <div className="grid grid-cols-3 gap-4 sm:flex sm:gap-8">
          <Numero icone={Users} valor={painel ? String(painel.clientes.total) : '–'} rotulo="Clientes" />
          <Numero icone={ShoppingBag} valor={resumo ? String(resumo.quantidade) : '–'} rotulo="Vendas no mês" />
          <Numero
            icone={Receipt}
            valor={resumo ? brlCurto(ticket) : '–'}
            rotulo="Ticket médio"
          />
        </div>
      </div>

      {erro && !painel && (
        <p className="rounded-2xl border bg-white/60 p-4 text-sm text-muted-foreground">
          Não deu pra carregar o resumo agora. Atualize a página em instantes.
        </p>
      )}

      {/* A grade. No computador são quatro colunas, como na referência:
          foto | faturamento | meta | (recebido + tarefas, descendo duas linhas)
          pagamentos | agenda da semana (duas colunas)
          mais vendidos (duas) | últimas vendas (duas)
          No tablet vira duas colunas; no celular, uma. */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CartaoFoto
          selo={resumo ? { valor: String(resumo.quantidade), legenda: resumo.quantidade === 1 ? 'venda no mês' : 'vendas no mês' } : undefined}
        />

        {painel ? (
          <CartaoFaturamento resumo={painel.resumo} meses={painel.meses} />
        ) : (
          <Esqueleto />
        )}

        {painel ? (
          <CartaoMeta
            vendido={painel.resumo.vendido}
            meta={painel.meta}
            diasRestantes={progresso.diasNoMes - progresso.dia}
          />
        ) : (
          <Esqueleto />
        )}

        <div className="flex flex-col gap-4 xl:col-start-4 xl:row-span-2 xl:row-start-1">
          {painel ? <CartaoRecebido recebimento={painel.recebimento} /> : <Esqueleto baixo />}
          <CartaoTarefas
            className="flex-1"
            hoje={hoje}
            lembretes={lembretes}
            entregas={painel?.entregas ?? []}
            aReceber={painel?.aReceber ?? { quantidade: 0, valor: 0 }}
            concluirLembrete={concluir}
            alternarEntrega={alternarEntrega}
            aoVerPendencias={aoVerPendencias}
          />
        </div>

        <CartaoAgenda
          className="md:col-span-2 xl:col-span-2 xl:col-start-2 xl:row-start-2"
          semana={semana}
          lembretes={lembretes.filter((l) => l.data >= (semana[0]?.data ?? hoje))}
          entregas={painel?.entregas ?? []}
          encontros={painel?.encontros ?? []}
        />

        {painel ? (
          <CartaoFormas className="xl:col-start-1 xl:row-start-2" formas={painel.formas} />
        ) : (
          <Esqueleto />
        )}

        {painel && (
          <>
            <CartaoMaisVendidos
              className="xl:col-span-2"
              produtos={painel.maisVendidos}
              mes={painel.resumo.mes}
            />
            <CartaoUltimasVendas
              className="md:col-span-2 xl:col-span-2"
              vendas={painel.ultimasVendas}
              aoVerTodas={aoVerVendas}
            />
          </>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

type EstiloDaPilula = 'escuro' | 'roxo' | 'contorno';

const CLASSES_DA_PILULA: Record<EstiloDaPilula, string> = {
  escuro: 'bg-sidebar text-sidebar-foreground',
  roxo: 'bg-primary/80 text-primary-foreground',
  contorno: 'border-2 border-foreground/15 bg-white/50 text-foreground',
};

/** Uma pílula com rótulo em cima, como "Interviews 18%" da referência. */
function Pilula({
  rotulo,
  valor,
  estilo,
}: {
  rotulo: string;
  valor: number | null;
  estilo: EstiloDaPilula;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <div
        className={cn(
          'flex h-11 min-w-[6.5rem] items-center rounded-full px-5 text-sm font-semibold',
          CLASSES_DA_PILULA[estilo],
        )}
      >
        {valor === null ? '—' : `${Math.round(valor)}%`}
      </div>
    </div>
  );
}

/** A barra listrada do mês, como "Project time" da referência. */
function BarraDoMes({ rotulo, percentual }: { rotulo: string; percentual: number }) {
  return (
    <div className="min-w-[14rem] flex-1 space-y-2">
      <p className="text-sm text-muted-foreground">{rotulo}</p>
      <div
        className="relative h-11 overflow-hidden rounded-full border border-foreground/10"
        style={{
          backgroundImage:
            'repeating-linear-gradient(135deg, hsl(var(--foreground) / 0.08) 0 2px, transparent 2px 9px)',
        }}
      >
        <div
          className="flex h-full items-center rounded-full bg-white px-5 text-sm font-semibold text-foreground shadow-soft"
          style={{ width: `${Math.max(18, percentual)}%` }}
        >
          {Math.round(percentual)}%
        </div>
      </div>
    </div>
  );
}

/** Os números grandes do canto, como "128 Employees" da referência. */
function Numero({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone: typeof Users;
  valor: string;
  rotulo: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <span className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary sm:flex">
          <Icone className="h-[18px] w-[18px]" />
        </span>
        <span className="truncate text-3xl font-light tracking-tight text-foreground sm:text-4xl">
          {valor}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground sm:pl-11">{rotulo}</p>
    </div>
  );
}

function Esqueleto({ baixo = false }: { baixo?: boolean }) {
  return (
    <div
      aria-hidden
      className={cn('vidro animate-pulse rounded-[1.75rem]', baixo ? 'h-36' : 'min-h-[20rem]')}
    />
  );
}
