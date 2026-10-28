'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarHeart, ChevronLeft, ChevronRight, Clock, Settings2, Video } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import ProximoEncontro from '@/components/agenda/ProximoEncontro';
import { usarConta } from '@/components/shared/AppShell';
import { hojeBrasil, montarData, nomeDoMes, partesDaData, recorteDoMes } from '@/lib/datas';
import {
  ROTULO_DA_FASE,
  datasComerciaisDoMes,
  horaCurta,
  momentoDoEncontro,
  partesEmBrasilia,
  proximasDatasComerciais,
  proximoEncontro,
  semanasDoMes,
  type Encontro,
  type FaseDaData,
} from '@/lib/agenda';
import { cn } from '@/lib/utils';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const COR_DA_FASE: Record<FaseDaData, string> = {
  planejar: 'bg-violet-100 text-violet-800',
  divulgar: 'bg-amber-100 text-amber-800',
  encomendas: 'bg-emerald-100 text-emerald-800',
  hoje: 'bg-fuchsia-100 text-fuchsia-800',
};

const formatadorDataLonga = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/**
 * Agenda (Marco 1, item 1.8): o calendário do mês com os encontros da
 * mentoria e as datas comerciais, mais o próximo encontro em destaque e as
 * próximas datas com a fase de preparação de cada uma.
 *
 * Os contatos com clientes continuam em Lembretes — aqui é a agenda da
 * MENTORIA e do calendário comercial, não a da aluna com as clientes dela.
 */
export default function AgendaPage() {
  const conta = usarConta();
  const hoje = hojeBrasil();
  const [mes, setMes] = useState(() => {
    const { ano, mes } = partesDaData(hoje);
    return { ano, mes };
  });
  const [encontros, setEncontros] = useState<Encontro[]>([]);
  const [proximo, setProximo] = useState<Encontro | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState<Encontro | null>(null);

  // Os encontros do mês na tela.
  useEffect(() => {
    let vivo = true;
    const recorte = recorteDoMes(mes.ano, mes.mes);
    if (!recorte) return;
    setCarregando(true);
    fetch(`/api/encontros?de=${recorte.inicio}&ate=${recorte.fim}`)
      .then((r) => r.json().then((dados) => ({ ok: r.ok, dados })))
      .then(({ ok, dados }) => {
        if (!vivo) return;
        if (!ok) throw new Error(dados.error);
        setEncontros(dados.data || []);
        setErro('');
      })
      .catch(() => vivo && setErro('Não deu pra carregar os encontros. Tente de novo em instantes.'))
      .finally(() => vivo && setCarregando(false));
    return () => {
      vivo = false;
    };
  }, [mes]);

  // O próximo encontro, que pode estar em outro mês do que o da tela.
  useEffect(() => {
    fetch('/api/encontros')
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((dados) => setProximo(proximoEncontro<Encontro>(dados.data || [])))
      .catch(() => undefined);
  }, []);

  const semanas = useMemo(() => semanasDoMes(mes.ano, mes.mes), [mes]);
  const datasDoMes = useMemo(() => datasComerciaisDoMes(mes.ano, mes.mes), [mes]);
  const proximasDatas = useMemo(() => proximasDatasComerciais(hoje).slice(0, 5), [hoje]);

  const encontrosPorDia = useMemo(() => {
    const mapa = new Map<string, Encontro[]>();
    for (const e of encontros) {
      const { data } = partesEmBrasilia(e.inicio);
      mapa.set(data, [...(mapa.get(data) ?? []), e]);
    }
    return mapa;
  }, [encontros]);

  const ehMesAtual = mes.ano === partesDaData(hoje).ano && mes.mes === partesDaData(hoje).mes;
  const andar = (passo: number) =>
    setMes(({ ano, mes }) => {
      const total = ano * 12 + (mes - 1) + passo;
      return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
    });

  return (
    <PageShell>
      <PageHeader
        title="Agenda"
        description="Os encontros da mentoria e as datas que movem as vendas."
        action={
          conta?.isAdmin ? (
            <Link href="/admin/encontros" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
              <Settings2 className="h-4 w-4" /> Gerenciar encontros
            </Link>
          ) : undefined
        }
      />

      <ProximoEncontro encontro={proximo} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* O calendário do mês. */}
        <section className="vidro rounded-[1.75rem] p-4 sm:p-5 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <Button variant="ghost" size="icon" aria-label="Mês anterior" onClick={() => andar(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="text-center">
              <h2 className="text-lg font-semibold">
                {nomeDoMes(mes.mes)} {mes.ano}
              </h2>
              {!ehMesAtual && (
                <button
                  type="button"
                  onClick={() => setMes({ ano: partesDaData(hoje).ano, mes: partesDaData(hoje).mes })}
                  className="text-xs text-primary hover:underline"
                >
                  Voltar para o mês atual
                </button>
              )}
            </div>
            <Button variant="ghost" size="icon" aria-label="Próximo mês" onClick={() => andar(1)}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>

          {erro && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {DIAS.map((d) => (
              <span key={d}>{d}</span>
            ))}
          </div>

          <div className={cn('mt-1 grid gap-1', carregando && 'opacity-60')}>
            {semanas.map((semana) => (
              <div key={semana[0]?.data} className="grid grid-cols-7 gap-1">
                {semana.map((dia) => {
                  const doDia = encontrosPorDia.get(dia.data) ?? [];
                  const datas = datasDoMes.filter((d) => d.data === dia.data);
                  const ehHoje = dia.data === hoje;
                  return (
                    <div
                      key={dia.data}
                      className={cn(
                        'flex min-h-[4.5rem] min-w-0 flex-col gap-1 rounded-xl border p-1 sm:min-h-[6rem] sm:p-1.5',
                        dia.doMes ? 'border-border/70 bg-white/60' : 'border-transparent bg-transparent opacity-40',
                        ehHoje && 'border-primary/50 bg-primary/5',
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs',
                          ehHoje ? 'bg-primary font-semibold text-primary-foreground' : 'text-foreground',
                        )}
                      >
                        {dia.dia}
                      </span>
                      {dia.doMes &&
                        datas.map((d) => (
                          <span
                            key={d.id}
                            title={d.nome}
                            className="flex items-center gap-1 truncate rounded-md bg-fuchsia-100 px-1 py-0.5 text-[10px] font-medium text-fuchsia-900 sm:text-[11px]"
                          >
                            <CalendarHeart className="hidden h-3 w-3 shrink-0 sm:block" />
                            <span className="truncate">{d.nome}</span>
                          </span>
                        ))}
                      {doDia.map((e) => (
                        <button
                          key={e.id}
                          type="button"
                          onClick={() => setAberto(e)}
                          title={e.titulo}
                          className="truncate rounded-md bg-primary px-1 py-0.5 text-left text-[10px] font-medium text-primary-foreground transition-opacity hover:opacity-90 sm:text-[11px]"
                        >
                          <span className="hidden sm:inline">{horaCurta(e.inicio)} · </span>
                          {e.titulo}
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-primary" /> Encontros da mentoria
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-fuchsia-300" /> Datas comerciais
            </span>
          </div>
        </section>

        <div className="space-y-4">
          {/* Datas comerciais com a fase de preparação. */}
          <section className="vidro rounded-[1.75rem] p-5">
            <h2 className="text-lg font-semibold">Próximas datas comerciais</h2>
            <p className="text-sm text-muted-foreground">O aviso começa 60 dias antes.</p>
            <ul className="mt-4 space-y-3">
              {proximasDatas.map((d) => {
                const fase = d.dias <= 60 ? d.fase : null;
                return (
                  <li key={d.id} className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-white text-xs leading-tight shadow-soft">
                      <span className="text-sm font-bold text-foreground">{Number(d.data.slice(8, 10))}</span>
                      <span className="text-muted-foreground">{nomeDoMes(Number(d.data.slice(5, 7))).slice(0, 3)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{d.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.dias === 0 ? 'hoje' : d.dias === 1 ? 'amanhã' : `em ${d.dias} dias`}
                      </p>
                    </div>
                    {fase && (
                      <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium', COR_DA_FASE[fase])}>
                        {ROTULO_DA_FASE[fase]}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Os encontros do mês, em lista. */}
          <section className="vidro rounded-[1.75rem] p-5">
            <h2 className="text-lg font-semibold">Encontros de {nomeDoMes(mes.mes).toLowerCase()}</h2>
            {encontros.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                {carregando ? 'Carregando...' : 'Nenhum encontro marcado neste mês.'}
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {encontros.map((e) => {
                  const passou = momentoDoEncontro(e.inicio, e.duracao_minutos) === 'passou';
                  const { data } = partesEmBrasilia(e.inicio);
                  return (
                    <li key={e.id}>
                      <button
                        type="button"
                        onClick={() => setAberto(e)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-2xl p-2 text-left transition-colors hover:bg-white/70',
                          passou && 'opacity-60',
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Video className="h-[18px] w-[18px]" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{e.titulo}</span>
                          <span className="block text-xs text-muted-foreground">
                            {data.split('-').reverse().slice(0, 2).join('/')} às {horaCurta(e.inicio)}
                            {passou && ' · já aconteceu'}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      {/* Detalhe do encontro. */}
      <Dialog open={aberto !== null} onOpenChange={(abrir) => !abrir && setAberto(null)}>
        <DialogContent>
          {aberto && (
            <>
              <DialogHeader>
                <DialogTitle>{aberto.titulo}</DialogTitle>
                <DialogDescription className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {(() => {
                    const texto = formatadorDataLonga.format(new Date(aberto.inicio));
                    return texto.charAt(0).toUpperCase() + texto.slice(1);
                  })()}
                  , às {horaCurta(aberto.inicio)} · {aberto.duracao_minutos} min
                </DialogDescription>
              </DialogHeader>
              {aberto.descricao && (
                <p className="whitespace-pre-line text-sm text-muted-foreground">{aberto.descricao}</p>
              )}
              {aberto.link && momentoDoEncontro(aberto.inicio, aberto.duracao_minutos) === 'agora' && (
                <a
                  href={aberto.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(buttonVariants(), 'mt-2 gap-2')}
                >
                  <Video className="h-4 w-4" /> Entrar na sala
                </a>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
