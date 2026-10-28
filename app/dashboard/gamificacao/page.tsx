import { Flame, Medal, Star, Trophy } from 'lucide-react';
import PageShell from '@/components/shared/PageShell';

/**
 * Gamificação (Marco 1, item 1.10): a aba já existe, mas por enquanto só
 * anuncia o que vem.
 *
 * O fundo é um esboço do que a tela vai ter — pontos, ranking, sequência de
 * dias — desfocado e sem interação. Ele está ali só pra a mensagem não flutuar
 * no vazio; nenhum número dele é de verdade, e por isso fica fora do leitor de
 * tela (aria-hidden).
 */
export default function GamificacaoPage() {
  return (
    <PageShell>
      <div className="relative isolate min-h-[34rem] overflow-hidden rounded-[2rem]">
        <div aria-hidden className="pointer-events-none select-none space-y-4 p-2 blur-[6px] sm:p-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icone: Star, valor: '1.240', rotulo: 'pontos no mês' },
              { icone: Flame, valor: '12', rotulo: 'dias seguidos' },
              { icone: Medal, valor: '3º', rotulo: 'no seu nível' },
            ].map(({ icone: Icone, valor, rotulo }) => (
              <div key={rotulo} className="vidro flex items-center gap-4 rounded-[1.75rem] p-5">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Icone className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-3xl font-bold">{valor}</p>
                  <p className="text-sm text-muted-foreground">{rotulo}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="vidro space-y-3 rounded-[1.75rem] p-5 lg:col-span-2">
              <p className="text-lg font-semibold">Ranking do mês</p>
              {[92, 80, 71, 64, 52, 40].map((largura, i) => (
                <div key={largura} className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {i + 1}
                  </span>
                  <div className="h-3 flex-1 rounded-full bg-primary/10">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${largura}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-3 rounded-[1.75rem] bg-sidebar p-5 text-sidebar-foreground">
              <p className="text-lg font-semibold">Como ganhar pontos</p>
              {['Tarefa do dia', 'Venda lançada', 'Desafio concluído', 'Presença no encontro'].map((t) => (
                <div key={t} className="flex items-center gap-3 rounded-2xl bg-white/10 p-3 text-sm">
                  <Star className="h-4 w-4" /> {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* A mensagem, no centro. */}
        <div className="absolute inset-0 flex items-center justify-center bg-background/30 p-4">
          <div className="vidro-forte max-w-md rounded-[2rem] px-8 py-10 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lift">
              <Trophy className="h-8 w-8" />
            </span>
            <h1 className="mt-5 text-3xl font-bold tracking-tight text-foreground">Em breve</h1>
            <p className="mt-2 text-muted-foreground">
              A gamificação do Partiu PRO está chegando. Fique de olho!
            </p>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
