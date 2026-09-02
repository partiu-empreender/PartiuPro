'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Cake,
  CheckSquare,
  Download,
  HelpCircle,
  LayoutGrid,
  List,
  Plus,
  Search,
  Upload,
  Users,
} from 'lucide-react';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import EtiquetaBadge, {
  EtiquetaToggle,
  CORES_ETIQUETA,
  type CorEtiqueta,
  type Etiqueta,
} from '@/components/shared/EtiquetaBadge';
import BarraDeFiltros, { ResumoDasEtiquetas } from '@/components/shared/BarraDeFiltros';
import IconeWhatsApp from '@/components/shared/IconeWhatsApp';
import AcoesEmMassa from '@/components/shared/AcoesEmMassa';
import { Checkbox } from '@/components/ui/checkbox';
import { ETIQUETAS_SUGERIDAS, NOME_DA_COR } from '@/lib/etiquetas';
import { aplicarMascaraTelefone, formatarTelefone, linkWhatsAppCom, saudacao } from '@/lib/telefone';
import { hojeBrasil } from '@/lib/datas';
import { CABECALHOS_CLIENTES, LINHAS_EXEMPLO_CLIENTES, gerarCSV, lerCSV } from '@/lib/csv';
import { cn } from '@/lib/utils';
import { gravarMemoria, lerMemoria } from '@/lib/cache-memoria';
import {
  FILTROS_PADRAO,
  SITUACOES,
  aplicarFiltros,
  contarFiltrosAtivos,
  descreverAniversario,
  type FiltrosClientes,
  type SituacaoCliente,
} from '@/lib/filtros-clientes';

interface Cliente {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  // Aniversário e data de cadastro não aparecem no cartão, mas sustentam os
  // filtros de data e os lembretes automáticos — por isso vêm na listagem.
  date_of_birth: string | null;
  created_at: string | null;
  total_orders: number | null;
  total_spent: number | null;
  last_order_at: string | null;
  etiquetas: Etiqueta[];
}

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/**
 * O atalho que faltava entre a lista e a conversa.
 *
 * A tela sabia produzir "as 20 clientes sem comprar há seis meses" e parava
 * aí: pra falar com cada uma era abrir a ficha, voltar, abrir a próxima. Aqui
 * o telefone que já está na tela vira um clique, com a saudação preenchida.
 *
 * `stopPropagation` porque na visão de lista a linha inteira leva pra ficha, e
 * na de cartões existe um link cobrindo o cartão por baixo do conteúdo.
 */
function BotaoWhatsApp({ nome, telefone }: { nome: string; telefone: string | null }) {
  const link = linkWhatsAppCom(telefone, saudacao(nome));
  if (!link) return null;

  return (
    <a
      href={link}
      target="_blank"
      rel="noopener noreferrer"
      title={`Falar com ${nome.split(' ')[0]} no WhatsApp`}
      onClick={(e) => e.stopPropagation()}
      className="relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 sm:h-9 sm:w-9"
    >
      <IconeWhatsApp className="h-4 w-4" />
      <span className="sr-only">Falar com {nome} no WhatsApp</span>
    </a>
  );
}

// "há 3 meses" diz mais do que uma data pra decidir quem chamar hoje — que é
// pra isso que a Tania vai olhar esta coluna.
function desdeAUltimaCompra(iso: string | null | undefined): string {
  if (!iso) return 'Nunca comprou';

  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dias <= 0) return 'Hoje';
  if (dias === 1) return 'Ontem';
  if (dias < 30) return `Há ${dias} dias`;

  const meses = Math.floor(dias / 30);
  return meses === 1 ? 'Há 1 mês' : `Há ${meses} meses`;
}

interface ResultadoImportacao {
  criadas: number;
  atualizadas: number;
  ignoradas: { linha: number; nome: string; motivo: string }[];
  colunasIgnoradas: string[];
  etiquetasCriadas: string[];
}

const formVazio = { name: '', phone: '', email: '', notes: '', date_of_birth: '' };

export default function ClientesPage() {
  const router = useRouter();
  const emCache = lerMemoria<{ clientes: Cliente[]; etiquetas: Etiqueta[] }>('clientes');
  const [clientes, setClientes] = useState<Cliente[]>(emCache?.clientes ?? []);
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>(emCache?.etiquetas ?? []);
  // Etiquetas de OCASIÃO (marcadas na venda, migration 010). Alimentam o
  // seletor "Comprou em" junto das datas comemorativas — são fontes
  // diferentes pra mesma pergunta.
  const [etiquetasVenda, setEtiquetasVenda] = useState<Etiqueta[]>([]);
  const [loading, setLoading] = useState(emCache === undefined);
  const [busca, setBusca] = useState('');

  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [form, setForm] = useState(formVazio);
  const [etiquetasDoForm, setEtiquetasDoForm] = useState<string[]>([]);
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);

  const [importando, setImportando] = useState(false);
  const [previa, setPrevia] = useState<{ csv: string; nomes: string[]; ignoradas: string[] } | null>(null);
  const [resultadoImport, setResultadoImport] = useState<ResultadoImportacao | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [gerenciandoEtiquetas, setGerenciandoEtiquetas] = useState(false);
  const [novaEtiqueta, setNovaEtiqueta] = useState('');
  const [novaCor, setNovaCor] = useState<CorEtiqueta>('slate');
  const [criandoEtiquetas, setCriandoEtiquetas] = useState(false);
  const [mostrandoAjudaCSV, setMostrandoAjudaCSV] = useState(false);

  // Todo o recorte acontece aqui no navegador; só a busca por texto continua
  // no banco, porque é a única que precisa varrer o cadastro inteiro.
  //
  // Os filtros e a visão escolhida sobrevivem à navegação porque ficam no
  // mesmo cache de sessão das telas: abrir a ficha de uma cliente e voltar não
  // desfaz o recorte que ela acabou de montar — que seria o jeito mais rápido
  // de fazer alguém desistir de usar filtro.
  const [filtros, setFiltrosEstado] = useState<FiltrosClientes>(
    () => lerMemoria<FiltrosClientes>('filtros-clientes') ?? FILTROS_PADRAO,
  );
  const [visao, setVisao] = useState<'cartoes' | 'lista'>(
    () => lerMemoria<'cartoes' | 'lista'>('visao-clientes') ?? 'cartoes',
  );

  // Só o "estou consultando" fica aqui. O evento escolhido, o rótulo e os ids
  // moram todos dentro de `filtros`, que é o objeto guardado entre navegações
  // — antes o seletor e a lista sabiam coisas diferentes ao voltar pra tela.
  const [carregandoComemorativa, setCarregandoComemorativa] = useState(false);

  // Seleção em massa. Fica desligada por padrão: as caixinhas em toda linha
  // pesariam a tela no uso normal, que é olhar e ligar, não administrar.
  const [modoSelecao, setModoSelecao] = useState(false);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  // Aceita um valor ou uma função, como o setState de sempre. A forma de
  // função importa no filtro de data comemorativa, que grava o resultado
  // DEPOIS de uma ida ao servidor: sem ela, um clique em qualquer outro filtro
  // durante a espera seria desfeito pela resposta que chega atrasada.
  const setFiltros = (
    novos: FiltrosClientes | ((atual: FiltrosClientes) => FiltrosClientes),
  ) => {
    setFiltrosEstado((atual) => {
      const resultado = typeof novos === 'function' ? novos(atual) : novos;
      gravarMemoria('filtros-clientes', resultado);
      return resultado;
    });
  };

  const trocarVisao = (nova: 'cartoes' | 'lista') => {
    setVisao(nova);
    gravarMemoria('visao-clientes', nova);
  };

  /**
   * "Quem comprou no Dia das Mães" não está em `customers` — a tabela guarda a
   * última compra, e a pergunta é sobre uma semana específica lá atrás. Só o
   * histórico de vendas responde, então esse é o único filtro que vai ao
   * servidor. Vai uma vez por escolha, não a cada clique.
   */
  const escolherComemorativa = async (id: string) => {
    if (!id) {
      setFiltros((atual) => ({
        ...atual,
        comemorativa: '',
        rotuloComemorativa: null,
        idsComemorativa: null,
      }));
      return;
    }

    setFiltros((atual) => ({ ...atual, comemorativa: id }));
    setCarregandoComemorativa(true);
    try {
      // O valor carrega a fonte no prefixo: "tag:<uuid>" é etiqueta de ocasião
      // marcada na venda, qualquer outra coisa é id de data comemorativa. Um
      // seletor só, porque pra aluna a pergunta é a mesma — "quem comprou no
      // Dia dos Namorados?" — e ela não deveria precisar saber se a resposta
      // vem da data da venda ou de uma etiqueta que ela marcou.
      const parametro = id.startsWith('tag:')
        ? `tag=${encodeURIComponent(id.slice(4))}`
        : `data=${encodeURIComponent(id)}`;
      const res = await fetch(`/api/clientes/compraram?${parametro}`);
      const dados = await res.json();
      if (!res.ok) throw new Error(dados.error);
      setFiltros((atual) =>
        // Trocar de Natal pra Páscoa dispara duas consultas, e a primeira pode
        // voltar depois da segunda. Sem esta conferência, o rótulo diria
        // "Páscoa" e a lista seria a do Natal.
        atual.comemorativa === id
          ? {
              ...atual,
              // A API rotula a data comemorativa (com o ano da última
              // ocorrência); pra etiqueta o nome está aqui mesmo.
              rotuloComemorativa:
                dados.data.rotulo ??
                etiquetasVenda.find((e) => `tag:${e.id}` === id)?.nome ??
                'Ocasião marcada',
              idsComemorativa: dados.data.ids,
            }
          : atual,
      );
    } catch (error) {
      console.error('Erro ao consultar as vendas da data:', error);
      // Só desliga se a escolha que falhou ainda for a que está na tela.
      // Sem resposta, o filtro fica desligado por inteiro em vez de mostrar
      // uma lista vazia que a aluna leria como "nenhuma cliente comprou no
      // Natal" — e o seletor volta junto, senão diria o contrário da lista.
      setFiltros((atual) =>
        atual.comemorativa === id
          ? { ...atual, comemorativa: '', rotuloComemorativa: null, idsComemorativa: null }
          : atual,
      );
    } finally {
      setCarregandoComemorativa(false);
    }
  };

  /**
   * Um recorte pedido pela URL: `/dashboard/clientes?situacao=sem-comprar-3`.
   *
   * É por aqui que a tela de Lembretes manda a aluna pra cá — "18 clientes sem
   * comprar há 3 meses →" só funciona se o destino já chegar filtrado.
   *
   * Lido de `window.location` e não do `useSearchParams` porque este é o único
   * lugar do app que precisa disso, e o hook do Next obrigaria a embrulhar a
   * tela inteira num Suspense pra resolver um detalhe de navegação.
   */
  useEffect(() => {
    const pedida = new URLSearchParams(window.location.search).get('situacao');
    if (!pedida || !SITUACOES.some((s) => s.valor === pedida)) return;

    // Zera o resto do recorte: a agenda mostrou "18 sem comprar há 3 meses"
    // contando a base inteira. Se a tela mantivesse a etiqueta que estava
    // marcada da última visita, o destino mostraria 4 e o número da origem
    // pareceria errado.
    setFiltros({ ...FILTROS_PADRAO, situacao: pedida as SituacaoCliente });
    // Limpa o endereço pra que um F5 depois não reimponha o filtro que ela já
    // pode ter trocado na mão.
    window.history.replaceState(null, '', window.location.pathname);
    // Só na montagem: é um pedido de navegação, não um estado sincronizado.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jaCarregou = useRef(false);

  const carregar = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (busca.trim()) params.set('busca', busca.trim());

      const [resClientes, resEtiquetas, resEtiquetasVenda] = await Promise.all([
        fetch(`/api/clientes?${params.toString()}`),
        fetch('/api/etiquetas'),
        fetch('/api/etiquetas-venda'),
      ]);
      const [dadosClientes, dadosEtiquetas, dadosEtiquetasVenda] = await Promise.all([
        resClientes.json(),
        resEtiquetas.json(),
        resEtiquetasVenda.json(),
      ]);

      if (resClientes.ok) setClientes(dadosClientes.data || []);
      if (resEtiquetas.ok) setEtiquetas(dadosEtiquetas.data || []);
      if (resEtiquetasVenda.ok) setEtiquetasVenda(dadosEtiquetasVenda.data || []);

      // Só guarda a lista sem filtro: guardar o resultado de uma busca faria
      // a tela reabrir mostrando o filtro anterior como se fosse tudo.
      if (resClientes.ok && resEtiquetas.ok && !busca.trim()) {
        gravarMemoria('clientes', {
          clientes: dadosClientes.data || [],
          etiquetas: dadosEtiquetas.data || [],
        });
      }
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
    } finally {
      // Só o primeiro carregamento mostra "Carregando...". Buscas seguintes
      // atualizam a lista no lugar, sem a tela piscar a cada tecla digitada.
      if (!jaCarregou.current) {
        jaCarregou.current = true;
        setLoading(false);
      }
    }
  }, [busca]);

  // Espera a digitação parar antes de consultar o servidor.
  useEffect(() => {
    const timer = setTimeout(carregar, busca ? 300 : 0);
    return () => clearTimeout(timer);
  }, [carregar, busca]);

  const abrirNovo = () => {
    setEditando(null);
    setForm(formVazio);
    setEtiquetasDoForm([]);
    setErro('');
    setAberto(true);
  };

  const abrirEdicao = (c: Cliente) => {
    setEditando(c);
    setForm({
      name: c.name,
      phone: c.phone ? formatarTelefone(c.phone) : '',
      email: c.email || '',
      notes: c.notes || '',
      // Vinha vazio, e como o PATCH grava tudo o que recebe, salvar uma edição
      // apagava o aniversário da cliente — justo o campo de que dependem o
      // filtro de aniversariantes e o lembrete automático.
      date_of_birth: c.date_of_birth || '',
    });
    setEtiquetasDoForm(c.etiquetas.map((e) => e.id));
    setErro('');
    setAberto(true);
  };

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!form.name.trim()) {
      setErro('Informe o nome da cliente.');
      return;
    }

    // O telefone é a chave que impede a mesma cliente de entrar duas vezes na
    // base, e é por ele que a venda reencontra quem já está cadastrada.
    if (!form.phone.trim()) {
      setErro('Informe o telefone da cliente.');
      return;
    }

    setSalvando(true);
    try {
      const url = editando ? `/api/clientes/${editando.id}` : '/api/clientes';
      const res = await fetch(url, {
        method: editando ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tag_ids: etiquetasDoForm }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao salvar cliente');
      setAberto(false);
      await carregar();
    } catch (error) {
      setErro(error instanceof Error ? error.message : 'Erro ao salvar cliente');
    } finally {
      setSalvando(false);
    }
  };

  // Monta o modelo aqui no navegador em vez de pedir ao servidor: e o mesmo
  // conteudo sempre, entao uma ida ate la seria so espera. E funciona igual
  // com a internet oscilando, que e o cenario da aula.
  const baixarModelo = () => {
    const csv = gerarCSV(CABECALHOS_CLIENTES, LINHAS_EXEMPLO_CLIENTES);
    const endereco = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));

    const link = document.createElement('a');
    link.href = endereco;
    link.download = 'modelo-clientes-partiu-pro.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();

    // Alguns navegadores ainda estao lendo o Blob quando o clique retorna;
    // liberar na hora cancelaria o download.
    setTimeout(() => URL.revokeObjectURL(endereco), 1000);
  };

  const criarEtiqueta = async (nome: string, cor: CorEtiqueta) => {
    if (!nome.trim()) return;
    await fetch('/api/etiquetas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome: nome.trim(), cor }),
    });
    setNovaEtiqueta('');
    await carregar();
  };

  // Adicionar as dez sugestões uma a uma seria dez cliques e dez recargas.
  // Aqui vai tudo em série e a lista recarrega uma vez só, no fim.
  const criarTodasAsSugestoes = async () => {
    if (criandoEtiquetas) return;
    setCriandoEtiquetas(true);
    try {
      for (const sugestao of sugestoesRestantes) {
        await fetch('/api/etiquetas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sugestao),
        });
      }
      await carregar();
    } finally {
      setCriandoEtiquetas(false);
    }
  };

  const removerEtiqueta = async (id: string) => {
    await fetch(`/api/etiquetas/${id}`, { method: 'DELETE' });
    if (filtros.etiquetas.includes(id)) {
      setFiltros({ ...filtros, etiquetas: filtros.etiquetas.filter((x) => x !== id) });
    }
    await carregar();
  };

  const alternarSelecao = (id: string) =>
    setSelecionadas((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );

  const sairDaSelecao = () => {
    setModoSelecao(false);
    setSelecionadas([]);
  };

  const aplicarEtiquetaEmMassa = async (tagId: string, acao: 'aplicar' | 'remover') => {
    const res = await fetch('/api/etiquetas/aplicar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer_ids: selecionadas, tag_id: tagId, acao }),
    });
    const resultado = await res.json();
    if (!res.ok) throw new Error(resultado.error || 'Erro ao etiquetar');
    // A seleção continua de pé: quase sempre ela vai querer aplicar uma
    // segunda etiqueta no mesmo grupo, e refazer a seleção seria o dobro do
    // trabalho pelo qual ela veio aqui.
    await carregar();
  };

  const alternarEtiquetaNoForm = (id: string) =>
    setEtiquetasDoForm((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );

  // Lê o arquivo no navegador e mostra o que será importado ANTES de gravar.
  // A Tania vai fazer isso ao vivo na frente das alunas: importar às cegas e
  // descobrir o erro depois seria o pior momento possível.
  const escolherArquivo = async (arquivo: File) => {
    const texto = await arquivo.text();
    const { linhas, colunasIgnoradas, temColunaNome } = lerCSV(texto);

    if (!temColunaNome) {
      setResultadoImport(null);
      setPrevia({ csv: '', nomes: [], ignoradas: ['A planilha precisa ter uma coluna de nome.'] });
      return;
    }

    setResultadoImport(null);
    setPrevia({
      csv: texto,
      nomes: linhas.map((l) => l.nome || '').filter(Boolean),
      ignoradas: colunasIgnoradas,
    });
  };

  const confirmarImportacao = async () => {
    if (!previa?.csv) return;
    setImportando(true);
    try {
      const res = await fetch('/api/clientes/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: previa.csv }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Erro ao importar');
      setResultadoImport(result.data);
      setPrevia(null);
      await carregar();
    } catch (error) {
      setPrevia((p) =>
        p ? { ...p, ignoradas: [error instanceof Error ? error.message : 'Erro ao importar'] } : p,
      );
    } finally {
      setImportando(false);
    }
  };

  // Um "hoje" só por render. Com duas chamadas a `hojeBrasil()` — uma no
  // filtro, outra na coluna de aniversário — um render que atravessasse a
  // meia-noite podia listar por um dia e escrever "é hoje" por outro.
  const hoje = hojeBrasil();

  const clientesVisiveis = aplicarFiltros(clientes, filtros, hoje);
  const filtrosAtivos = contarFiltrosAtivos(filtros);

  // Quem está selecionada mas saiu do recorte atual. Acontece o tempo todo:
  // filtrar "Sem etiqueta", selecionar todas e aplicar uma etiqueta faz as 18
  // sumirem da lista — e a barra continuava anunciando "18 selecionadas" em
  // cima de uma tela vazia, sem nada explicando.
  const idsVisiveis = new Set(clientesVisiveis.map((c) => c.id));
  const selecionadasForaDaLista = selecionadas.filter((id) => !idsVisiveis.has(id)).length;

  // A coluna de aniversário aparece só quando é disso que a lista trata. Fixa,
  // roubaria espaço das colunas que ela usa no dia a dia; ausente no filtro de
  // aniversariantes, deixava a lista sem a informação que motivou o filtro.
  const aniversarioDe = (cliente: Cliente) => descreverAniversario(cliente, hoje);
  const mostrarAniversario =
    filtros.situacao === 'aniversariantes-semana' ||
    filtros.situacao === 'aniversariantes-mes' ||
    filtros.ordem === 'aniversario';

  const sugestoesRestantes = ETIQUETAS_SUGERIDAS.filter(
    (s) => !etiquetas.some((e) => e.nome.toLowerCase() === s.nome.toLowerCase()),
  );

  return (
    <PageShell>
      <PageHeader
        title="Minhas clientes"
        description="Sua base de contatos — quem comprou, o quê, e quando falar de novo."
        action={
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputArquivo}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) escolherArquivo(arquivo);
                // Zera pra permitir escolher o MESMO arquivo de novo depois de
                // corrigi-lo — senao o onChange nao dispara na segunda vez.
                e.target.value = '';
              }}
            />
            <Button variant="outline" onClick={() => inputArquivo.current?.click()}>
              <Download className="mr-2 h-4 w-4" /> Importar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Como preparar a planilha"
              title="Como preparar a planilha"
              onClick={() => setMostrandoAjudaCSV(true)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
            <a href="/api/clientes/exportar">
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" /> Exportar
              </Button>
            </a>
            <Button onClick={abrirNovo} className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> Nova cliente
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por nome ou telefone..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <BarraDeFiltros
          filtros={filtros}
          onChange={setFiltros}
          etiquetas={etiquetas}
          onGerenciarEtiquetas={() => setGerenciandoEtiquetas(true)}
          onComemorativa={escolherComemorativa}
          etiquetasVenda={etiquetasVenda}
          carregandoComemorativa={carregandoComemorativa}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>
              <strong className="text-foreground">{clientesVisiveis.length}</strong>
              {filtrosAtivos > 0 || busca ? ` de ${clientes.length}` : ''} cliente
              {clientesVisiveis.length === 1 ? '' : 's'}
            </span>
            <ResumoDasEtiquetas filtros={filtros} etiquetas={etiquetas} />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={modoSelecao ? 'secondary' : 'ghost'}
              size="sm"
              aria-pressed={modoSelecao}
              onClick={() => (modoSelecao ? sairDaSelecao() : setModoSelecao(true))}
            >
              <CheckSquare className="mr-2 h-3.5 w-3.5" />
              {modoSelecao ? 'Sair da seleção' : 'Selecionar'}
            </Button>

            <div className="flex items-center gap-1 rounded-full border border-input bg-white/60 p-1 backdrop-blur-md">
              {(
                [
                  { valor: 'cartoes' as const, Icone: LayoutGrid, rotulo: 'Cartões' },
                  { valor: 'lista' as const, Icone: List, rotulo: 'Lista' },
                ]
              ).map(({ valor, Icone, rotulo }) => (
                <button
                  key={valor}
                  type="button"
                  aria-pressed={visao === valor}
                  title={rotulo}
                  onClick={() => trocarVisao(valor)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors',
                    visao === valor
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-accent',
                  )}
                >
                  <Icone className="h-3.5 w-3.5" />
                  {rotulo}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-muted-foreground">Carregando...</p>
      ) : clientes.length === 0 ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-5 px-8 py-10 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {busca
                ? 'Nenhuma cliente encontrada com esse nome ou telefone.'
                : 'Sua base de clientes é o seu maior ativo. Cadastre a primeira — ou registre uma venda com o nome e o telefone, que ela entra aqui sozinha.'}
            </p>
            {!busca && (
              <div className="space-y-2">
                <Button onClick={abrirNovo} className="w-full">
                  <Plus className="mr-2 h-4 w-4" /> Cadastrar minha primeira cliente
                </Button>
                <Button variant="outline" className="w-full" onClick={() => setMostrandoAjudaCSV(true)}>
                  <Download className="mr-2 h-4 w-4" /> Já tenho uma lista pra importar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : clientesVisiveis.length === 0 ? (
        <Card className="mx-auto max-w-md">
          <CardContent className="space-y-4 px-8 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Nenhuma cliente nesse recorte agora. Dependendo do filtro, isso é uma boa notícia —
              ninguém sumido, ninguém sem comprar.
            </p>
            <Button
              variant="outline"
              onClick={() =>
                setFiltros((atual) => ({
                  ...atual,
                  situacao: 'todas',
                  etiquetas: [],
                  semEtiqueta: false,
                  comemorativa: '',
                  rotuloComemorativa: null,
                  idsComemorativa: null,
                }))
              }
            >
              Ver todas as clientes
            </Button>
          </CardContent>
        </Card>
      ) : visao === 'lista' ? (
        <div className="space-y-2">
          {/* A tabela rola na horizontal no celular em vez de espremer as
              colunas — nome e telefone, que é o que ela usa pra ligar, ficam
              nas duas primeiras e sempre à vista. */}
          <div className="vidro overflow-x-auto rounded-2xl">
            <table className="w-full min-w-[46rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  {modoSelecao && <th className="w-10 px-4 py-3" />}
                  <th className="px-4 py-3 font-semibold">Cliente</th>
                  <th className="px-4 py-3 font-semibold">Telefone</th>
                  {mostrarAniversario && (
                    <th className="px-4 py-3 font-semibold">Aniversário</th>
                  )}
                  <th className="px-4 py-3 font-semibold">Etiquetas</th>
                  <th className="px-4 py-3 font-semibold">Última compra</th>
                  <th className="px-4 py-3 text-right font-semibold">Compras</th>
                  <th className="px-4 py-3 text-right font-semibold">Total gasto</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y">
                {clientesVisiveis.map((cliente) => (
                  <tr
                    key={cliente.id}
                    // Em modo de seleção a linha inteira marca e desmarca, em
                    // vez de abrir a ficha: quem entrou aqui veio classificar,
                    // e mirar na caixinha a cada linha seria trabalho à toa.
                    onClick={() =>
                      modoSelecao
                        ? alternarSelecao(cliente.id)
                        : router.push(`/dashboard/clientes/${cliente.id}`)
                    }
                    className={cn(
                      'cursor-pointer transition-colors hover:bg-accent/60',
                      modoSelecao && selecionadas.includes(cliente.id) && 'bg-primary/10',
                    )}
                  >
                    {modoSelecao && (
                      /* O clique na caixinha PARA aqui. Sem isto ele também
                         subia pra linha, que alterna a seleção: o item era
                         marcado e desmarcado no mesmo clique, e a caixinha
                         parecia quebrada. */
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selecionadas.includes(cliente.id)}
                          onCheckedChange={() => alternarSelecao(cliente.id)}
                          aria-label={`Selecionar ${cliente.name}`}
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {modoSelecao ? (
                        <span className="font-medium">{cliente.name}</span>
                      ) : (
                        <Link
                          href={`/dashboard/clientes/${cliente.id}`}
                          className="font-medium hover:underline"
                        >
                          {cliente.name}
                        </Link>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {cliente.phone ? formatarTelefone(cliente.phone) : '—'}
                    </td>
                    {mostrarAniversario && (
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {aniversarioDe(cliente) ?? '—'}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      {cliente.etiquetas.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {cliente.etiquetas.map((etiqueta) => (
                            <EtiquetaBadge key={etiqueta.id} etiqueta={etiqueta} />
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {desdeAUltimaCompra(cliente.last_order_at)}
                    </td>
                    <td className="px-4 py-3 text-right">{cliente.total_orders || 0}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {brl(cliente.total_spent || 0)}
                    </td>
                    <td className="px-4 py-3">
                      {/* Escondidas durante a seleção, como nos cartões: ali a
                          linha inteira é um alvo de marcar, e um botão que faz
                          outra coisa no meio dela só gera clique errado. */}
                      {!modoSelecao && (
                        <div className="flex items-center justify-end gap-1">
                          <BotaoWhatsApp nome={cliente.name} telefone={cliente.phone} />
                          {/* Sem o stopPropagation o clique subiria pra linha e
                              abriria a ficha em vez do formulário de edição. */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirEdicao(cliente);
                            }}
                          >
                            Editar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clientesVisiveis.map((cliente) => (
              <Card
                key={cliente.id}
                onClick={modoSelecao ? () => alternarSelecao(cliente.id) : undefined}
                className={cn(
                  'group relative transition-colors hover:bg-white/90',
                  modoSelecao && 'cursor-pointer',
                  modoSelecao && selecionadas.includes(cliente.id) && 'ring-2 ring-primary',
                )}
              >
                {/* O cartão inteiro abre a ficha. O link cobre o cartão por
                    baixo do conteúdo em vez de envolvê-lo, porque um <a> não
                    pode conter um <button> — assim o "Editar" continua sendo
                    um botão de verdade, e não um link disfarçado.
                    Em modo de seleção ele sai de cena: o cartão passa a marcar
                    e desmarcar, e um link por baixo levaria embora da tela no
                    meio da classificação. */}
                {!modoSelecao && (
                  <Link
                    href={`/dashboard/clientes/${cliente.id}`}
                    aria-label={`Abrir a ficha de ${cliente.name}`}
                    className="absolute inset-0 z-0 rounded-[inherit] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                )}
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-start justify-between gap-2">
                    {modoSelecao && (
                      /* Mesmo motivo da visão de lista: o cartão inteiro
                         alterna a seleção, então o clique na caixinha não pode
                         subir — senão ele desfaz o que acabou de fazer. */
                      <span onClick={(e) => e.stopPropagation()} className="relative z-10 mt-1">
                        <Checkbox
                          checked={selecionadas.includes(cliente.id)}
                          onCheckedChange={() => alternarSelecao(cliente.id)}
                          aria-label={`Selecionar ${cliente.name}`}
                        />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          'truncate font-semibold',
                          !modoSelecao && 'group-hover:underline',
                        )}
                      >
                        {cliente.name}
                      </p>
                      {cliente.phone && (
                        <p className="text-sm text-muted-foreground">{formatarTelefone(cliente.phone)}</p>
                      )}
                    </div>
                    {!modoSelecao && (
                      <div className="flex shrink-0 items-center gap-1">
                        <BotaoWhatsApp nome={cliente.name} telefone={cliente.phone} />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="relative z-10"
                          onClick={() => abrirEdicao(cliente)}
                        >
                          Editar
                        </Button>
                      </div>
                    )}
                  </div>

                  {mostrarAniversario && aniversarioDe(cliente) && (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Cake className="h-3.5 w-3.5" />
                      {aniversarioDe(cliente)}
                    </p>
                  )}

                  {cliente.etiquetas.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {cliente.etiquetas.map((etiqueta) => (
                        <EtiquetaBadge key={etiqueta.id} etiqueta={etiqueta} />
                      ))}
                    </div>
                  )}

                  {cliente.notes && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{cliente.notes}</p>
                  )}

                  <div className="flex justify-between border-t pt-2 text-sm">
                    <span className="text-muted-foreground">
                      {cliente.total_orders || 0} compra{(cliente.total_orders || 0) === 1 ? '' : 's'}
                    </span>
                    <span className="font-semibold">{brl(cliente.total_spent || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* A barra fixa cobriria a última cliente da lista sem esta folga. */}
      {modoSelecao && selecionadas.length > 0 && <div className="h-32" />}

      {modoSelecao && selecionadas.length > 0 && (
        <AcoesEmMassa
          selecionadas={selecionadas.length}
          foraDaLista={selecionadasForaDaLista}
          totalVisivel={clientesVisiveis.length}
          etiquetas={etiquetas}
          onSelecionarTodas={() => setSelecionadas(clientesVisiveis.map((c) => c.id))}
          onLimpar={() => setSelecionadas([])}
          onSair={sairDaSelecao}
          onAplicar={aplicarEtiquetaEmMassa}
          onGerenciarEtiquetas={() => setGerenciandoEtiquetas(true)}
        />
      )}

      {/* Entrou no modo de seleção e ainda não marcou ninguém: sem isto a tela
          muda (caixinhas aparecem) e nada explica o que fazer com elas. */}
      {modoSelecao && selecionadas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Marque as clientes que você quer etiquetar de uma vez — ou filtre primeiro e depois
          selecione todas.
        </p>
      )}

      {/* Cadastro / edição */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? 'Editar cliente' : 'Nova cliente'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={salvar} className="space-y-4">
            {erro && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {erro}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="cliente-nome">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cliente-nome"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cliente-telefone">
                Telefone <span className="text-destructive">*</span>
              </Label>
                <Input
                  id="cliente-telefone"
                  inputMode="tel"
                  placeholder="(21) 99999-8888"
                  value={form.phone}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, phone: aplicarMascaraTelefone(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cliente-nascimento">Aniversário</Label>
                <Input
                  id="cliente-nascimento"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => setForm((f) => ({ ...f, date_of_birth: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cliente-contexto">Contexto</Label>
              <textarea
                id="cliente-contexto"
                rows={3}
                className="flex w-full rounded-xl border border-input bg-white/70 px-4 py-2 text-sm backdrop-blur-md transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                placeholder="Prefere receber à tarde. Comprou cesta de café da manhã pro aniversário da mãe."
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Preferências de entrega, o que ela já comprou, datas que importam — o que ajuda a
                vender melhor na próxima.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Etiquetas</Label>
              {etiquetas.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {etiquetas.map((etiqueta) => (
                    <EtiquetaToggle
                      key={etiqueta.id}
                      etiqueta={etiqueta}
                      ativa={etiquetasDoForm.includes(etiqueta.id)}
                      onClick={() => alternarEtiquetaNoForm(etiqueta.id)}
                    />
                  ))}
                </div>
              ) : (
                /* Antes o bloco inteiro sumia quando ainda não havia etiqueta
                   nenhuma — e quem está cadastrando a primeira cliente nunca
                   descobria que etiqueta existe. */
                <p className="text-xs text-muted-foreground">
                  Você ainda não criou etiquetas.{' '}
                  <button
                    type="button"
                    onClick={() => setGerenciandoEtiquetas(true)}
                    className="font-medium text-primary underline underline-offset-2"
                  >
                    Criar agora
                  </button>{' '}
                  — são elas que depois filtram a lista de quem chamar.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Gerenciar etiquetas */}
      <Dialog open={gerenciandoEtiquetas} onOpenChange={setGerenciandoEtiquetas}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Etiquetas</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            {etiquetas.length > 0 && (
              <div className="space-y-2">
                {etiquetas.map((etiqueta) => (
                  <div key={etiqueta.id} className="flex items-center justify-between gap-2">
                    <EtiquetaBadge etiqueta={etiqueta} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      onClick={() => removerEtiqueta(etiqueta.id)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  Remover a etiqueta não apaga nenhuma cliente — elas só deixam de tê-la.
                </p>
              </div>
            )}

            {sugestoesRestantes.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Sugestões</Label>
                  {sugestoesRestantes.length > 1 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={criarTodasAsSugestoes}
                      disabled={criandoEtiquetas}
                    >
                      {criandoEtiquetas
                        ? 'Adicionando...'
                        : `Adicionar todas (${sugestoesRestantes.length})`}
                    </Button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sugestoesRestantes.map((s) => (
                    <Button
                      key={s.nome}
                      variant="outline"
                      size="sm"
                      onClick={() => criarEtiqueta(s.nome, s.cor)}
                    >
                      <Plus className="mr-1 h-3 w-3" /> {s.nome}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="nova-etiqueta">Criar a minha</Label>
              <div className="flex gap-2">
                <Input
                  id="nova-etiqueta"
                  value={novaEtiqueta}
                  placeholder="Ex.: Sem comprar há 6 meses"
                  onChange={(e) => setNovaEtiqueta(e.target.value)}
                />
                <Button type="button" onClick={() => criarEtiqueta(novaEtiqueta, novaCor)}>
                  Criar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {CORES_ETIQUETA.map((cor) => (
                  <EtiquetaToggle
                    key={cor}
                    etiqueta={{ id: cor, nome: NOME_DA_COR[cor], cor }}
                    ativa={novaCor === cor}
                    onClick={() => setNovaCor(cor)}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Prévia antes de gravar */}
      <Dialog open={previa !== null} onOpenChange={(aberto) => !aberto && setPrevia(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Conferir antes de importar</DialogTitle>
          </DialogHeader>
          {previa && previa.nomes.length === 0 ? (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {previa.ignoradas[0] || 'Não encontrei nenhuma cliente nessa planilha.'}
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">
                <strong>{previa?.nomes.length}</strong> cliente(s) encontrada(s) na planilha.
              </p>
              {previa && previa.ignoradas.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  Estas colunas não foram reconhecidas e serão ignoradas:{' '}
                  <strong>{previa.ignoradas.join(', ')}</strong>. O resto será importado normalmente.
                </div>
              )}
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <ul className="divide-y text-sm">
                  {previa?.nomes.slice(0, 50).map((nome, i) => (
                    <li key={i} className="px-3 py-1.5">{nome}</li>
                  ))}
                </ul>
              </div>
              {previa && previa.nomes.length > 50 && (
                <p className="text-xs text-muted-foreground">
                  Mostrando as 50 primeiras — todas serão importadas.
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Quem já estiver na sua base (mesmo telefone) será atualizada, não duplicada. Campos
                que você já preencheu à mão não são sobrescritos.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPrevia(null)}>
              Cancelar
            </Button>
            {previa && previa.nomes.length > 0 && (
              <Button onClick={confirmarImportacao} disabled={importando}>
                {importando ? 'Importando...' : `Importar ${previa.nomes.length}`}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resultado */}
      <Dialog
        open={resultadoImport !== null}
        onOpenChange={(aberto) => !aberto && setResultadoImport(null)}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Importação concluída</DialogTitle>
          </DialogHeader>
          {resultadoImport && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Novas</p>
                  <p className="text-2xl font-bold">{resultadoImport.criadas}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-muted-foreground">Atualizadas</p>
                  <p className="text-2xl font-bold">{resultadoImport.atualizadas}</p>
                </div>
              </div>
              {resultadoImport.etiquetasCriadas.length > 0 && (
                <p className="text-muted-foreground">
                  Etiquetas criadas: {resultadoImport.etiquetasCriadas.join(', ')}
                </p>
              )}
              {resultadoImport.ignoradas.length > 0 && (
                <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-900">
                  <p className="font-medium">
                    {resultadoImport.ignoradas.length} linha(s) não entraram:
                  </p>
                  <ul className="list-inside list-disc">
                    {resultadoImport.ignoradas.map((item, i) => (
                      <li key={i}>
                        Linha {item.linha} ({item.nome || 'sem nome'}): {item.motivo}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setResultadoImport(null)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Como preparar a planilha. A Tania vai ensinar isso ao vivo, entao a
          instrucao mora dentro do produto e nao num documento a parte. */}
      <Dialog open={mostrandoAjudaCSV} onOpenChange={setMostrandoAjudaCSV}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Como preparar a planilha</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 text-sm">
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/5 p-4">
              <p className="font-semibold">Comece pelo modelo</p>
              <p className="text-muted-foreground">
                Baixe o arquivo pronto, abra no Excel ou no Google Sheets, preencha e importe de
                volta. Ele já vem com as colunas certas e duas linhas de exemplo —{' '}
                <strong>apague as duas antes de importar</strong>, senão elas entram como clientes.
              </p>
              <Button onClick={baixarModelo} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" /> Baixar modelo (.csv)
              </Button>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">1. Salve como CSV</p>
              <p className="text-muted-foreground">
                No Excel: <strong>Arquivo → Salvar como → CSV</strong>. No Google Sheets:{' '}
                <strong>Arquivo → Fazer download → CSV</strong>. Vírgula ou ponto e vírgula, tanto
                faz — o sistema descobre sozinho.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">2. Use estes nomes de coluna</p>
              <p className="text-muted-foreground">
                A ordem não importa, e maiúscula e acento também não. Só o <strong>nome</strong> é
                obrigatório.
              </p>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/60 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Coluna</th>
                      <th className="px-3 py-2 font-semibold">Também aceita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[
                      ['nome *', 'cliente, nome completo, name'],
                      ['telefone', 'celular, whatsapp, fone, tel, contato, número'],
                      ['email', 'mail'],
                      ['aniversário', 'nascimento, data de nascimento'],
                      ['etiquetas', 'etiqueta, tags, marcadores, categoria'],
                      ['contexto', 'observações, obs, notas, anotações, histórico'],
                    ].map(([coluna, sinonimos]) => (
                      <tr key={coluna}>
                        <td className="px-3 py-2 font-medium">{coluna}</td>
                        <td className="px-3 py-2 text-muted-foreground">{sinonimos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Coluna que o sistema não reconhecer não é descartada em silêncio: ela aparece
                avisada na tela de conferência, antes de gravar.
              </p>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">3. Como preencher</p>
              <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                <li>
                  <strong>Aniversário:</strong> 25/12/1990 ou 1990-12-25.
                </li>
                <li>
                  <strong>Telefone:</strong> pode vir formatado, com ou sem DDD e +55. O sistema
                  guarda só os números.
                </li>
                <li>
                  <strong>Mais de uma etiqueta na mesma célula:</strong> separe por ponto e vírgula
                  — <em>Cliente VIP; Dia das Mães</em>. Etiqueta que ainda não existe é criada.
                </li>
                <li>Linha sem nome é pulada e reportada com o número dela, o resto entra normal.</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="font-semibold">4. O que acontece com quem já está aqui</p>
              <p className="text-muted-foreground">
                Quem já existe é encontrada pelo <strong>telefone</strong> e{' '}
                <strong>atualizada, não duplicada</strong> — e só os campos vazios são preenchidos.
                O que você escreveu à mão nunca é sobrescrito, então reimportar a mesma planilha é
                seguro.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              <strong>Exportar</strong> gera um arquivo no mesmo formato, mas com as suas clientes
              de verdade — serve pra fazer backup ou editar tudo de uma vez na planilha e trazer de
              volta.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setMostrandoAjudaCSV(false)}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageShell>
  );
}
