'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Hammer, PartyPopper, Settings2 } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import { usarConta } from '@/components/shared/AppShell';
import { hojeBrasil } from '@/lib/datas';
import {
  ehDesafioNovo,
  prazoDoDesafio,
  progressoDoDesafio,
  situacaoDoDesafio,
  type Desafio,
} from '@/lib/desafios';
import { cn } from '@/lib/utils';

const dataBR = (iso: string) => iso.split('-').reverse().join('/');

/**
 * Mão na Massa (Marco 1, item 1.9): os desafios que a Tânia publica, com as
 * tarefas pra marcar.
 *
 * Os abertos vêm em cartões grandes, com a lista à mostra — é ali que a aluna
 * trabalha. Os encerrados ficam recolhidos embaixo, como histórico.
 */
export default function MaoNaMassaPage() {
  const conta = usarConta();
  const hoje = hojeBrasil();
  const [desafios, setDesafios] = useState<Desafio[]>([]);
  const [feitas, setFeitas] = useState<Set<string>>(new Set());
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [verEncerrados, setVerEncerrados] = useState(false);

  useEffect(() => {
    fetch('/api/desafios')
      .then((r) => r.json().then((dados) => ({ ok: r.ok, dados })))
      .then(({ ok, dados }) => {
        if (!ok) throw new Error(dados.error);
        setDesafios(dados.data || []);
        setFeitas(new Set(dados.feitas || []));
      })
      .catch(() => setErro('Não deu pra carregar os desafios. Tente de novo em instantes.'))
      .finally(() => setCarregando(false));
  }, []);

  const marcar = async (desafio: Desafio, tarefaId: string, feito: boolean) => {
    // Muda na hora e volta atrás se o servidor recusar: marcar é o gesto da
    // tela, e esperar a resposta a cada clique faz o check parecer travado.
    const alterar = (marcado: boolean) =>
      setFeitas((atual) => {
        const nova = new Set(atual);
        if (marcado) nova.add(tarefaId);
        else nova.delete(tarefaId);
        return nova;
      });

    alterar(feito);
    try {
      const res = await fetch('/api/desafios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tarefa_id: tarefaId, desafio_id: desafio.id, feito }),
      });
      if (!res.ok) throw new Error();
    } catch {
      alterar(!feito);
      setErro('Não deu pra salvar essa marcação. Confira a internet e tente de novo.');
    }
  };

  const abertos = desafios.filter((d) => situacaoDoDesafio(d, hoje) === 'aberto');
  const encerrados = desafios.filter((d) => situacaoDoDesafio(d, hoje) === 'encerrado');

  return (
    <PageShell>
      <PageHeader
        title="Mão na Massa"
        description="Os desafios da mentoria pra colocar o método em prática."
        action={
          conta?.isAdmin ? (
            <Link href="/admin/desafios" className={cn(buttonVariants({ variant: 'outline' }), 'gap-2')}>
              <Settings2 className="h-4 w-4" /> Gerenciar desafios
            </Link>
          ) : undefined
        }
      />

      {erro && <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{erro}</p>}

      {carregando ? (
        <div className="vidro h-64 animate-pulse rounded-[1.75rem]" />
      ) : abertos.length === 0 ? (
        <div className="vidro flex flex-col items-center gap-3 rounded-[1.75rem] px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Hammer className="h-7 w-7" />
          </span>
          <p className="text-lg font-semibold">Nenhum desafio aberto agora</p>
          <p className="max-w-md text-sm text-muted-foreground">
            Quando a Tânia lançar um desafio novo, ele aparece aqui, com as tarefas pra você marcar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {abertos.map((desafio) => (
            <CartaoDesafio
              key={desafio.id}
              desafio={desafio}
              feitas={feitas}
              hoje={hoje}
              aoMarcar={(tarefaId, feito) => marcar(desafio, tarefaId, feito)}
            />
          ))}
        </div>
      )}

      {encerrados.length > 0 && (
        <section className="vidro rounded-[1.75rem] p-5">
          <button
            type="button"
            onClick={() => setVerEncerrados((v) => !v)}
            aria-expanded={verEncerrados}
            className="flex w-full items-center justify-between gap-3 text-left"
          >
            <span className="text-lg font-semibold">Desafios encerrados ({encerrados.length})</span>
            <ChevronDown className={cn('h-5 w-5 transition-transform', verEncerrados && 'rotate-180')} />
          </button>
          {verEncerrados && (
            <ul className="mt-4 space-y-2">
              {encerrados.map((d) => {
                const p = progressoDoDesafio(d, feitas);
                return (
                  <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-white/60 p-3">
                    <span
                      className={cn(
                        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                        p.concluido ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {p.concluido ? <Check className="h-4 w-4" /> : <Hammer className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{d.titulo}</span>
                      <span className="block text-xs text-muted-foreground">
                        {d.fim ? `Encerrado em ${dataBR(d.fim)}` : 'Encerrado'}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-medium">
                      {p.concluido ? 'Concluído' : `${p.feitas} de ${p.total}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </PageShell>
  );
}

function CartaoDesafio({
  desafio,
  feitas,
  hoje,
  aoMarcar,
}: {
  desafio: Desafio;
  feitas: Set<string>;
  hoje: string;
  aoMarcar: (tarefaId: string, feito: boolean) => void;
}) {
  const progresso = progressoDoDesafio(desafio, feitas);
  const prazo = prazoDoDesafio(desafio.fim, hoje);
  const novo = ehDesafioNovo(desafio, hoje);

  return (
    <article className="vidro flex flex-col rounded-[1.75rem] p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        {novo && (
          <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">
            Novo
          </span>
        )}
        <span className="rounded-full bg-white px-2.5 py-1 text-xs text-muted-foreground shadow-soft">
          Desde {dataBR(desafio.inicio)}
          {prazo && ` · ${prazo}`}
        </span>
      </div>

      <h2 className="mt-3 text-xl font-semibold text-foreground">{desafio.titulo}</h2>
      {desafio.descricao && (
        <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{desafio.descricao}</p>
      )}

      <div className="mt-5">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {progresso.feitas} de {progresso.total} {progresso.total === 1 ? 'tarefa' : 'tarefas'}
          </span>
          <span className="font-semibold text-primary">{Math.round(progresso.percentual)}%</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-primary/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-fuchsia-500 transition-[width] duration-500"
            style={{ width: `${progresso.percentual}%` }}
          />
        </div>
      </div>

      {progresso.concluido && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <PartyPopper className="h-5 w-5 shrink-0" />
          Parabéns, desafio concluído!
        </div>
      )}

      <ul className="mt-4 space-y-2">
        {desafio.tarefas.map((tarefa) => {
          const feita = feitas.has(tarefa.id);
          return (
            <li key={tarefa.id}>
              <button
                type="button"
                onClick={() => aoMarcar(tarefa.id, !feita)}
                aria-pressed={feita}
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition-colors',
                  feita ? 'border-primary/20 bg-primary/5' : 'border-border/70 bg-white/70 hover:border-primary/40',
                )}
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                    feita ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                  )}
                >
                  {feita && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className={cn('text-sm', feita ? 'text-muted-foreground line-through' : 'text-foreground')}>
                  {tarefa.texto}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </article>
  );
}
