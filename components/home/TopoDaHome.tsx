'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarHeart,
  Camera,
  CheckCircle2,
  Plus,
  Truck,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usarConta } from '@/components/shared/AppShell';
import { usarLembretes } from '@/lib/usar-lembretes';
import { hojeBrasil, montarData, partesDaData } from '@/lib/datas';
import {
  horaBrasil,
  proximaDataComercial,
  resumoDoMes,
  saudacao,
  type ResumoDoMes,
  type VendaParaResumo,
} from '@/lib/home';
import type { SituacaoDasVendas } from '@/lib/notificacoes';
import { cn } from '@/lib/utils';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const formatadorDia = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** "quarta-feira, 28 de outubro" → "Quarta-feira, 28 de outubro". */
const primeiraMaiuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** O mesmo limite da rota de upload, checado antes pra não esperar o envio falhar. */
const TAMANHO_MAX_FOTO = 2 * 1024 * 1024;

interface TopoDaHomeProps {
  aoRegistrarVenda: () => void;
  /** Leva até a lista "Falta resolver", que fica na aba Vendas do Período. */
  aoVerPendencias: () => void;
  /** Muda quando uma venda é criada, editada ou excluída: refaz as contas. */
  versao: number;
}

/**
 * O topo do Dashboard: a primeira coisa que a aluna vê ao entrar.
 *
 * A regra que organiza a tela: o primeiro número é sempre QUANTO ELA VENDEU,
 * nunca um "0% concluído". Logo depois, o que fazer hoje — e o botão de
 * registrar venda, que é o gesto mais repetido do sistema.
 *
 * O resto do Dashboard (Raio-X do mês, vendas do período, precificação)
 * continua logo abaixo, igual ao que era.
 */
export default function TopoDaHome({ aoRegistrarVenda, aoVerPendencias, versao }: TopoDaHomeProps) {
  const conta = usarConta();
  const hoje = hojeBrasil();
  const [hora, setHora] = useState(() => horaBrasil());

  // Quem deixa a aba aberta da manhã pra tarde vê a saudação acompanhar.
  useEffect(() => {
    const intervalo = window.setInterval(() => setHora(horaBrasil()), 60 * 1000);
    return () => window.clearInterval(intervalo);
  }, []);

  const primeiroNome = conta?.primeiroNome ?? '';

  return (
    <section aria-label="Resumo de hoje" className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">
            {primeiraMaiuscula(formatadorDia.format(new Date()))}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {saudacao(hora)}
            {primeiroNome && (
              <>
                , <span className="text-primary">{primeiroNome}</span>
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

      <div className="grid gap-4 lg:grid-cols-12">
        <CartaoFoto className="lg:col-span-3" />
        <CartaoVendido className="lg:col-span-5" hoje={hoje} versao={versao} />
        <CartaoHoje
          className="lg:col-span-4"
          hoje={hoje}
          versao={versao}
          aoVerPendencias={aoVerPendencias}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function CartaoFoto({ className }: { className?: string }) {
  const conta = usarConta();
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  const nome = conta?.nome ?? '';
  const inicial = nome.trim().charAt(0).toUpperCase() || '?';

  const enviar = async (arquivo: File) => {
    setErro('');
    if (arquivo.size > TAMANHO_MAX_FOTO) {
      setErro('A foto precisa ter no máximo 2 MB.');
      return;
    }

    setEnviando(true);
    try {
      const dados = new FormData();
      dados.append('avatar', arquivo);
      const res = await fetch('/api/perfil/avatar', { method: 'POST', body: dados });
      const resultado = await res.json();
      if (!res.ok) throw new Error(resultado.error || 'Erro ao enviar a foto');
      // O layout relê o perfil e a foto nova aparece aqui e no topo.
      router.refresh();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao enviar a foto');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className={cn(
        'relative isolate flex min-h-[14rem] overflow-hidden rounded-3xl bg-gradient-to-br from-violet-200 via-primary/30 to-fuchsia-200 shadow-soft lg:min-h-[19rem]',
        className,
      )}
    >
      {conta?.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={conta.avatarUrl}
          alt={`Foto de ${nome}`}
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="absolute inset-0 -z-10 flex items-center justify-center pb-12 text-7xl font-bold text-white/80"
        >
          {inicial}
        </span>
      )}

      {/* Degradê só embaixo, pra o nome ler sobre qualquer foto. */}
      <div className="mt-auto w-full bg-gradient-to-t from-black/60 via-black/25 to-transparent p-4 pt-16">
        <p className="truncate text-lg font-semibold text-white">{nome}</p>
        <button
          type="button"
          onClick={() => entrada.current?.click()}
          disabled={enviando}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md transition-colors hover:bg-white/30 disabled:opacity-60"
        >
          <Camera className="h-3.5 w-3.5" />
          {enviando ? 'Enviando...' : conta?.avatarUrl ? 'Trocar foto' : 'Adicionar foto'}
        </button>
        {erro && (
          <p role="alert" className="mt-2 rounded-lg bg-red-600/80 px-2 py-1 text-xs text-white">
            {erro}
          </p>
        )}
      </div>

      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          // Limpa já: escolher a MESMA foto de novo depois de um erro tem que
          // disparar o onChange outra vez.
          evento.target.value = '';
          if (arquivo) enviar(arquivo);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function CartaoVendido({
  className,
  hoje,
  versao,
}: {
  className?: string;
  hoje: string;
  versao: number;
}) {
  const [resumo, setResumo] = useState<ResumoDoMes | null>(null);
  const [meta, setMeta] = useState(0);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let vivo = true;
    const { ano, mes } = partesDaData(hoje);
    const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 };
    // Um pedido só: do dia 1º do mês passado até hoje. A conta separa os dois
    // meses (ver resumoDoMes).
    const de = montarData(anterior.ano, anterior.mes, 1);

    Promise.all([
      fetch(`/api/vendas?de=${de}&ate=${hoje}`).then((r) => (r.ok ? r.json() : Promise.reject())),
      fetch(`/api/metas?ano=${ano}`).then((r) => (r.ok ? r.json() : { data: [] })),
    ])
      .then(([vendas, metas]) => {
        if (!vivo) return;
        setResumo(resumoDoMes((vendas.vendas_periodo || []) as VendaParaResumo[], hoje));
        const doMes = (metas.data || []).find((m: { mes: number }) => m.mes === mes);
        setMeta(Number(doMes?.meta_mensal) || 0);
        setErro(false);
      })
      .catch(() => vivo && setErro(true));

    return () => {
      vivo = false;
    };
  }, [hoje, versao]);

  const maiorDia = resumo ? Math.max(...resumo.porDia, 0) : 0;
  const percentualMeta = resumo && meta > 0 ? (resumo.vendido / meta) * 100 : null;

  return (
    <div className={cn('vidro flex flex-col rounded-3xl p-5 sm:p-6', className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">
          Vendido em {resumo?.mes.toLowerCase() ?? 'este mês'}
        </p>
        <Link
          href="/dashboard/historico"
          aria-label="Ver o histórico de meses"
          className="flex h-8 w-8 items-center justify-center rounded-full border bg-white/70 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      </div>

      {erro ? (
        <p className="mt-4 text-sm text-muted-foreground">
          Não deu pra carregar agora. Tente atualizar a página.
        </p>
      ) : !resumo ? (
        <div className="mt-3 h-12 w-48 animate-pulse rounded-xl bg-muted" />
      ) : (
        <>
          <p className="mt-2 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {brl(resumo.vendido)}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <Comparacao resumo={resumo} />
            <span className="text-muted-foreground">
              {resumo.quantidade} {resumo.quantidade === 1 ? 'venda' : 'vendas'}
            </span>
          </div>

          {/* Uma barra por dia do mês. Sem eixo nem números: o valor exato de
              cada dia aparece ao passar o mouse, e o desenho só precisa dizer
              "quais dias renderam". */}
          <div className="mt-5 flex h-24 items-end gap-[3px]" aria-hidden>
            {resumo.porDia.map((valor, indice) => (
              <div
                key={indice}
                title={`Dia ${indice + 1}: ${brl(valor)}`}
                className={cn(
                  'min-w-[3px] flex-1 rounded-full',
                  valor > 0 ? 'bg-primary/80' : 'bg-primary/10',
                  indice === resumo.porDia.length - 1 && valor > 0 && 'bg-primary',
                )}
                style={{ height: maiorDia > 0 ? `${Math.max(8, (valor / maiorDia) * 100)}%` : '8%' }}
              />
            ))}
          </div>

          {percentualMeta !== null && (
            <div className="mt-5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Meta do mês: {brl(meta)}</span>
                <span className="font-semibold text-foreground">
                  {Math.round(percentualMeta)}%
                </span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-primary/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500"
                  style={{ width: `${Math.min(100, percentualMeta)}%` }}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Comparacao({ resumo }: { resumo: ResumoDoMes }) {
  const base = `que no mesmo período de ${resumo.mesAnterior.toLowerCase()}`;

  if (resumo.variacao === null) {
    return (
      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
        Primeiro mês de comparação
      </span>
    );
  }

  const subiu = resumo.variacao >= 0;
  const Seta = subiu ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      title={`Mesmo período de ${resumo.mesAnterior.toLowerCase()}: ${brl(resumo.vendidoAntes)}`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',
        subiu ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800',
      )}
    >
      <Seta className="h-3.5 w-3.5" />
      {Math.abs(Math.round(resumo.variacao))}% {subiu ? 'a mais' : 'a menos'} {base}
    </span>
  );
}

/* ------------------------------------------------------------------------ */

interface ItemDeHoje {
  chave: string;
  icone: typeof BellRing;
  texto: string;
  detalhe?: string;
  /** Link pra outra tela, ou — sem ele — leva às pendências desta. */
  href?: string;
  alerta?: boolean;
}

function CartaoHoje({
  className,
  hoje,
  versao,
  aoVerPendencias,
}: {
  className?: string;
  hoje: string;
  versao: number;
  aoVerPendencias: () => void;
}) {
  const { resumo } = usarLembretes({ ate: hoje });
  const [vendas, setVendas] = useState<SituacaoDasVendas | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch('/api/notificacoes')
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => vivo && dados && setVendas(dados.vendas ?? null))
      .catch(() => undefined);
    return () => {
      vivo = false;
    };
  }, [versao]);

  const data = proximaDataComercial(hoje);
  const contatos = (resumo?.paraHoje ?? 0) + (resumo?.atrasados ?? 0);
  const entregas = (vendas?.entregasHoje ?? 0) + (vendas?.entregasAtrasadas ?? 0);

  const itens: ItemDeHoje[] = [];

  if (contatos > 0) {
    itens.push({
      chave: 'contatos',
      icone: BellRing,
      texto: `${contatos} ${contatos === 1 ? 'cliente pra chamar' : 'clientes pra chamar'}`,
      detalhe: resumo?.atrasados ? `${resumo.atrasados} atrasado${resumo.atrasados > 1 ? 's' : ''}` : undefined,
      href: '/dashboard/lembretes',
      alerta: Boolean(resumo?.atrasados),
    });
  }
  if (entregas > 0) {
    itens.push({
      chave: 'entregas',
      icone: Truck,
      texto: `${entregas} ${entregas === 1 ? 'entrega' : 'entregas'}`,
      detalhe: vendas?.entregasAtrasadas
        ? `${vendas.entregasAtrasadas} atrasada${vendas.entregasAtrasadas > 1 ? 's' : ''}`
        : 'pra hoje',
      alerta: Boolean(vendas?.entregasAtrasadas),
    });
  }
  if (vendas && vendas.aReceber > 0) {
    itens.push({
      chave: 'receber',
      icone: Wallet,
      texto: `${brl(vendas.valorAReceber)} a receber`,
      detalhe: `${vendas.aReceber} ${vendas.aReceber === 1 ? 'venda' : 'vendas'}`,
    });
  }
  if (data) {
    itens.push({
      chave: 'data',
      icone: CalendarHeart,
      texto: data.dias === 0 ? `Hoje é ${data.nome}!` : `${data.nome} em ${data.dias} ${data.dias === 1 ? 'dia' : 'dias'}`,
      detalhe: data.dias > 15 ? 'hora de planejar' : 'abra as encomendas',
      href: '/dashboard/clientes',
    });
  }

  return (
    <div
      className={cn(
        'flex flex-col rounded-3xl bg-sidebar p-5 text-sidebar-foreground shadow-lift sm:p-6',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-lg font-semibold">Pra hoje</p>
        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-sidebar-muted">
          {itens.length} {itens.length === 1 ? 'item' : 'itens'}
        </span>
      </div>

      {itens.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-sidebar-accent" />
          <p className="text-sm text-sidebar-muted">
            Tudo em dia! Bom momento pra chamar uma cliente que não compra há um tempo.
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {itens.map((item) => {
            const Icone = item.icone;
            const conteudo = (
              <>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sidebar">
                  <Icone className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{item.texto}</span>
                  {item.detalhe && (
                    <span
                      className={cn(
                        'block text-xs',
                        item.alerta ? 'text-red-300' : 'text-sidebar-muted',
                      )}
                    >
                      {item.detalhe}
                    </span>
                  )}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-sidebar-muted transition-transform group-hover:translate-x-0.5" />
              </>
            );
            const classes =
              'group flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors hover:bg-white/10';
            return (
              <li key={item.chave}>
                {item.href ? (
                  <Link href={item.href} className={classes}>
                    {conteudo}
                  </Link>
                ) : (
                  <button type="button" onClick={aoVerPendencias} className={classes}>
                    {conteudo}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
