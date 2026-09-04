'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PricingCalculator from '@/components/PricingCalculator';
import { calcularRelatorioMensal, type RelatorioMensal } from '@/lib/metrics';
import PageShell from '@/components/shared/PageShell';
import PageHeader from '@/components/shared/PageHeader';
import CartaoIndicador from '@/components/shared/CartaoIndicador';
import LembretesDoDia from '@/components/shared/LembretesDoDia';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { gravarMemoria, lerMemoria } from '@/lib/cache-memoria';
import { hojeBrasil, motivoDataDeVendaInvalida, partesHojeBrasil } from '@/lib/datas';
import { aplicarMascaraTelefone, formatarTelefone } from '@/lib/telefone';
import { EtiquetaToggle, type Etiqueta } from '@/components/shared/EtiquetaBadge';
import { ETIQUETAS_DE_VENDA_SUGERIDAS } from '@/lib/etiquetas';
import {
  ShoppingBag,
  Package,
  Plus,
  DollarSign,
  Trash2,
  TrendingUp,
  Users,
  Target,
  Lightbulb,
  Rocket,
  UserPlus,
  Check,
} from 'lucide-react';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Uma cor por faixa de preço, do mais barato ao mais caro. Como as faixas
// agora são fixas (lib/metrics.ts), a cor de cada uma é estável entre os
// meses — dá pra bater o olho no gráfico de dois meses e comparar.
const CORES_FAIXA = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#7c3aed'];

// Curva ABC: A é o que sustenta o faturamento, C é a cauda.
const CORES_CLASSE: Record<'A' | 'B' | 'C', string> = {
  A: 'bg-emerald-100 text-emerald-800',
  B: 'bg-amber-100 text-amber-800',
  C: 'bg-muted text-muted-foreground',
};

interface VendaItemView {
  id: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface VendaDiaria {
  id: string;
  data: string;
  cliente_nome: string;
  faturamento_total: number;
  status: string;
  venda_itens: VendaItemView[];
}

type TipoProduto = 'produto' | 'adicional';

interface ProdutoCatalogo {
  id: string;
  name: string;
  price: number;
  tipo: TipoProduto;
}

interface ClienteSugestao {
  id: string;
  name: string;
  phone: string | null;
  total_orders: number | null;
}

interface NovoItemForm {
  produto_id?: string;
  produto_nome: string;
  quantidade: string;
  preco_unitario: string;
}

const itemVazio = (): NovoItemForm => ({ produto_nome: '', quantidade: '1', preco_unitario: '' });

const itemEstaVazio = (item: NovoItemForm) =>
  !item.produto_nome.trim() && !item.preco_unitario.trim();

export default function DashboardPage() {
  const emCache = lerMemoria<{
    vendas: VendaDiaria[];
    vendasDoMes?: VendaDiaria[];
    relatorio: RelatorioMensal | null;
    catalogo: ProdutoCatalogo[];
  }>('dashboard');
  const [vendas, setVendas] = useState<VendaDiaria[]>(emCache?.vendas ?? []);
  // O mês inteiro fica na memória pra aba "Vendas do Dia" poder voltar em
  // qualquer data sem nova ida ao servidor — a API já manda tudo, e com 3 a 40
  // vendas por mês filtrar aqui custa nada.
  const [vendasDoMes, setVendasDoMes] = useState<VendaDiaria[]>(emCache?.vendasDoMes ?? []);
  const [diaEscolhido, setDiaEscolhido] = useState(hojeBrasil());
  const [relatorio, setRelatorio] = useState<RelatorioMensal | null>(emCache?.relatorio ?? null);
  const [catalogo, setCatalogo] = useState<ProdutoCatalogo[]>(emCache?.catalogo ?? []);
  const [loading, setLoading] = useState(emCache === undefined);
  const [activeTab, setActiveTab] = useState('relatorio');
  const [showRegistroVendaModal, setShowRegistroVendaModal] = useState(false);
  // Só a primeira carga mostra "Carregando..." — as atualizações de 30 em 30s
  // acontecem em silêncio, senão a tela inteira pisca a cada polling.
  const jaCarregou = useRef(false);

  // Form de registro de venda
  const [clienteNome, setClienteNome] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  // Toda venda fica ligada a uma cliente: ou ela escolhe uma já cadastrada,
  // ou cadastra na hora. Sem isso o histórico da cliente nunca se forma, que
  // é justamente o que o CRM existe pra montar.
  const [clienteId, setClienteId] = useState<string | undefined>(undefined);
  const [sugestoesCliente, setSugestoesCliente] = useState<ClienteSugestao[]>([]);
  const [buscandoCliente, setBuscandoCliente] = useState(false);
  const [criandoCliente, setCriandoCliente] = useState(false);
  // Etiquetas na hora do cadastro: se a aluna tiver que voltar em Clientes pra
  // marcar "Cliente VIP" depois, ela não volta — e a etiqueta só serve se a
  // base inteira estiver etiquetada na hora de filtrar.
  const [etiquetas, setEtiquetas] = useState<Etiqueta[]>([]);
  const [etiquetasDaNova, setEtiquetasDaNova] = useState<string[]>([]);
  // Data da venda. Começa em hoje — o caminho normal continua sendo não mexer
  // aqui; lançar mês passado é uma escolha explícita dela.
  const [dataVenda, setDataVenda] = useState(hojeBrasil());
  // Ocasião DESTA venda (aniversário, Namorados). Não confundir com
  // `etiquetasDaNova`, que marca o que a CLIENTE é pra sempre: a mesma pessoa
  // compra pro aniversário em junho e pro Natal em dezembro.
  const [etiquetasVenda, setEtiquetasVenda] = useState<Etiqueta[]>([]);
  const [ocasioesDaVenda, setOcasioesDaVenda] = useState<string[]>([]);
  const [criandoOcasiao, setCriandoOcasiao] = useState('');
  const [itens, setItens] = useState<NovoItemForm[]>([itemVazio()]);
  const [salvando, setSalvando] = useState(false);
  const [formError, setFormError] = useState('');
  // Confirmação de venda retroativa. A aba "Vendas Registradas" só lista as de
  // HOJE: sem este aviso, lançar julho salvaria certo e sumiria da tela, e a
  // aluna concluiria que falhou — lançando tudo de novo e duplicando a venda.
  const [avisoRetroativo, setAvisoRetroativo] = useState('');
  // Registro de atendimento direto do cartão do Raio-X, sem ir até a aba
  // Atendimentos. É o numero que sustenta conversão e PA: enquanto ficar em
  // zero, os dois indicadores aparecem como "—" e o relatório do mês fica
  // manco justamente na parte que a Tania mais usa.
  const [atendimentoAberto, setAtendimentoAberto] = useState(false);
  const [atendimentoData, setAtendimentoData] = useState(hojeBrasil());
  const [atendimentoQtd, setAtendimentoQtd] = useState('');
  const [atendimentoErro, setAtendimentoErro] = useState('');
  const [salvandoAtendimento, setSalvandoAtendimento] = useState(false);
  // Venda escolhida pra excluir. Guarda a venda inteira, e não só o id, porque
  // o diálogo mostra cliente, data e valor: ela precisa reconhecer o que vai
  // apagar antes de confirmar, principalmente quando a mesma cliente comprou
  // duas vezes no mesmo dia.
  const [vendaParaExcluir, setVendaParaExcluir] = useState<VendaDiaria | null>(null);
  const [excluindoVenda, setExcluindoVenda] = useState(false);
  const [erroExclusao, setErroExclusao] = useState('');

  const carregarMetricas = async () => {
    try {
      // Fuso do Brasil, e nao o do computador: `new Date().getMonth()` no dia
      // 1o de manha, num navegador configurado com fuso a leste, ainda devolve
      // o mes anterior — e a meta do mes some do painel.
      const { ano: anoAtual, mes: mesAtual } = partesHojeBrasil();

      const [resVendas, resMetas, resProdutos] = await Promise.all([
        fetch('/api/vendas'),
        fetch(`/api/metas?ano=${anoAtual}`),
        fetch('/api/produtos'),
      ]);
      const result = await resVendas.json();
      const metasResult = await resMetas.json();
      const produtosResult = await resProdutos.json();

      if (!resVendas.ok) throw new Error(result.error || 'Erro ao carregar vendas');

      setVendas(result.vendas || []);
      setVendasDoMes(result.vendas_mes || []);
      setCatalogo(resProdutos.ok ? produtosResult.data || [] : []);

      // Number() porque coluna NUMERIC pode chegar como texto — e aí a
      // comparacao com zero e as contas do relatorio passam a ser de string.
      const metaDoMes: number =
        Number(
          (metasResult.data || []).find(
            (m: { mes: number; meta_mensal: number | string }) => m.mes === mesAtual,
          )?.meta_mensal,
        ) || 0;

      const relatorioDoMes = calcularRelatorioMensal(
        result.vendas_mes || [],
        result.atendimentos_mes || 0,
        metaDoMes,
      );
      setRelatorio(relatorioDoMes);

      gravarMemoria('dashboard', {
        vendas: result.vendas || [],
        vendasDoMes: result.vendas_mes || [],
        relatorio: relatorioDoMes,
        catalogo: resProdutos.ok ? produtosResult.data || [] : [],
      });
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
    } finally {
      if (!jaCarregou.current) {
        jaCarregou.current = true;
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    carregarMetricas();
    const interval = setInterval(carregarMetricas, 30000);
    return () => clearInterval(interval);
  }, []);

  // Abre o diálogo já com o número que existe hoje.
  //
  // A API faz UPSERT por data: o que for salvo SUBSTITUI o valor do dia, não
  // soma. Abrir em branco faria ela digitar "5" achando que somava aos 12 que
  // já estavam lá — e perderia sete atendimentos sem aviso nenhum.
  const abrirAtendimento = async () => {
    setAtendimentoData(hojeBrasil());
    setAtendimentoQtd('');
    setAtendimentoErro('');
    setAtendimentoAberto(true);
    try {
      const res = await fetch('/api/atendimentos');
      const result = await res.json();
      if (res.ok) {
        const doDia = (result.data || []).find(
          (a: { data: string }) => a.data === hojeBrasil(),
        );
        if (doDia) setAtendimentoQtd(String(doDia.pessoas_atendidas ?? ''));
      }
    } catch {
      // Sem o valor atual ela ainda consegue registrar — só começa em branco.
    }
  };

  const salvarAtendimento = async (e: React.FormEvent) => {
    e.preventDefault();
    setAtendimentoErro('');

    const qtd = Number(atendimentoQtd);
    if (!Number.isInteger(qtd) || qtd < 0) {
      setAtendimentoErro('Informe um número inteiro de pessoas atendidas.');
      return;
    }
    // Mesma regra da venda: atendimento futuro não existe.
    if (atendimentoData > hojeBrasil()) {
      setAtendimentoErro('Não dá pra registrar atendimento com data futura.');
      return;
    }

    setSalvandoAtendimento(true);
    try {
      const res = await fetch('/api/atendimentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pessoas_atendidas: qtd, data: atendimentoData }),
      });
      const result = await res.json();
      if (!res.ok) {
        setAtendimentoErro(result.error || 'Erro ao registrar atendimento.');
        return;
      }
      setAtendimentoAberto(false);
      // Recarrega: conversão e PA dependem deste número e mudam na hora.
      await carregarMetricas();
    } catch {
      setAtendimentoErro('Erro ao registrar atendimento. Tente novamente.');
    } finally {
      setSalvandoAtendimento(false);
    }
  };

  // Exclui de vez — não é rascunho nem lixeira. As alunas pediram porque hoje
  // uma venda digitada errada (data trocada, valor errado) fica no faturamento
  // pra sempre, e elas não têm como corrigir sozinhas.
  const excluirVenda = async () => {
    if (!vendaParaExcluir) return;
    setErroExclusao('');
    setExcluindoVenda(true);
    try {
      const res = await fetch(`/api/vendas?id=${vendaParaExcluir.id}`, { method: 'DELETE' });
      const result = await res.json();
      if (!res.ok) {
        setErroExclusao(result.error || 'Não foi possível excluir a venda.');
        return;
      }
      setVendaParaExcluir(null);
      // Recarrega em vez de tirar da lista na mão: faturamento, ticket médio,
      // conversão e ranking mudam todos com a venda que saiu.
      await carregarMetricas();
    } catch {
      setErroExclusao('Não foi possível excluir a venda. Tente novamente.');
    } finally {
      setExcluindoVenda(false);
    }
  };

  const abrirModal = () => {
    setClienteNome('');
    setClienteTelefone('');
    setClienteId(undefined);
    setEtiquetasDaNova([]);
    setSugestoesCliente([]);
    setBuscandoCliente(false);
    setItens([itemVazio()]);
    setDataVenda(hojeBrasil());
    setOcasioesDaVenda([]);
    setFormError('');
    setAvisoRetroativo('');
    setShowRegistroVendaModal(true);
  };

  // As etiquetas só são buscadas quando o modal abre, e uma vez só: elas não
  // aparecem em nenhum outro lugar do painel, então carregá-las junto com as
  // métricas seria uma requisição à toa em toda visita ao dashboard.
  useEffect(() => {
    if (!showRegistroVendaModal || etiquetas.length > 0 || etiquetasVenda.length > 0) return;
    let ativo = true;
    (async () => {
      try {
        // As duas listas de uma vez: a da cliente e a de ocasião da venda.
        const [resCliente, resVenda] = await Promise.all([
          fetch('/api/etiquetas'),
          fetch('/api/etiquetas-venda'),
        ]);
        const [dadosCliente, dadosVenda] = await Promise.all([
          resCliente.json(),
          resVenda.json(),
        ]);
        if (!ativo) return;
        if (resCliente.ok) setEtiquetas(dadosCliente.data || []);
        if (resVenda.ok) setEtiquetasVenda(dadosVenda.data || []);
      } catch {
        // Sem etiquetas a venda continua funcionando — o bloco some, só isso.
      }
    })();
    return () => {
      ativo = false;
    };
  }, [showRegistroVendaModal, etiquetas.length, etiquetasVenda.length]);

  // Busca clientes já cadastradas enquanto ela digita o nome. É o que evita
  // duplicata: o caminho normal passa a ser reconhecer e escolher, em vez de
  // digitar de novo alguém que já está na base.
  useEffect(() => {
    const termo = clienteNome.trim();
    if (!showRegistroVendaModal || clienteId || termo.length < 2) {
      setSugestoesCliente([]);
      setBuscandoCliente(false);
      return;
    }
    // Marca "buscando" já na digitação, antes do debounce. Sem isso, a opção
    // de cadastrar nova piscaria na tela no intervalo entre digitar e a busca
    // responder — parecendo que a cliente não existe quando ela existe.
    setBuscandoCliente(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/clientes?busca=${encodeURIComponent(termo)}`);
        const result = await res.json();
        setSugestoesCliente(res.ok ? (result.data || []).slice(0, 5) : []);
      } catch {
        setSugestoesCliente([]);
      } finally {
        setBuscandoCliente(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [clienteNome, clienteId, showRegistroVendaModal]);

  const escolherCliente = (cliente: ClienteSugestao) => {
    setClienteId(cliente.id);
    setClienteNome(cliente.name);
    setClienteTelefone(cliente.phone ? formatarTelefone(cliente.phone) : '');
    setFormError('');
  };

  // Cadastra a cliente antes da venda, em vez de deixar o servidor adivinhar
  // pelo nome. Assim ela já sai daqui com id e a venda nasce vinculada.
  const cadastrarClienteNova = async () => {
    const nome = clienteNome.trim();
    if (!nome) {
      setFormError('Digite o nome da cliente.');
      return;
    }

    // O telefone e a chave que impede a mesma cliente de entrar duas vezes na
    // base — e o caminho pro WhatsApp. Sem ele o cadastro nasce manco.
    if (!clienteTelefone.trim()) {
      setFormError('Informe o telefone da cliente.');
      return;
    }

    setCriandoCliente(true);
    setFormError('');
    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nome,
          phone: clienteTelefone.trim() || undefined,
          tag_ids: etiquetasDaNova.length ? etiquetasDaNova : undefined,
        }),
      });
      const result = await res.json();

      if (!res.ok || !result.data?.id) {
        setFormError(result.error || 'Não foi possível cadastrar a cliente.');
        return;
      }

      setClienteId(result.data.id);
    } catch {
      setFormError('Não foi possível cadastrar a cliente.');
    } finally {
      setCriandoCliente(false);
    }
  };

  const limparClienteEscolhida = () => {
    setClienteId(undefined);
    setClienteNome('');
    setClienteTelefone('');
    setEtiquetasDaNova([]);
  };

  // Cria a etiqueta de ocasião sem sair do modal, e já marca na venda.
  //
  // Sem isto a lista nasce vazia e o bloco inteiro fica invisível pra quem
  // ainda não criou etiqueta nenhuma — ou seja, pra todo mundo no primeiro
  // uso. Mandar a aluna em Clientes pra criar "Aniversário" no meio de uma
  // venda é o tipo de desvio que faz o recurso não ser usado.
  const criarOcasiao = async (nome: string, cor: string) => {
    if (criandoOcasiao) return;
    setCriandoOcasiao(nome);
    try {
      const res = await fetch('/api/etiquetas-venda', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, cor }),
      });
      const result = await res.json();
      if (res.ok && result.data?.id) {
        setEtiquetasVenda((atual) => [...atual, result.data]);
        setOcasioesDaVenda((atual) => [...atual, result.data.id]);
      }
    } catch {
      // Silencioso de propósito: a venda é o que importa aqui, e a etiqueta
      // pode ser criada depois em qualquer outra venda.
    } finally {
      setCriandoOcasiao('');
    }
  };

  const alternarOcasiaoDaVenda = (id: string) => {
    setOcasioesDaVenda((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  };

  const alternarEtiquetaDaNova = (id: string) => {
    setEtiquetasDaNova((atual) =>
      atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id],
    );
  };

  const atualizarItem = (index: number, campo: keyof NovoItemForm, valor: string) => {
    setItens((atual) =>
      atual.map((item, i) => {
        if (i !== index) return item;
        // Editar nome ou preço à mão desfaz o vínculo com o produto do catálogo.
        const desvincula = campo === 'produto_nome' || campo === 'preco_unitario';
        return { ...item, [campo]: valor, ...(desvincula ? { produto_id: undefined } : {}) };
      }),
    );
  };

  const adicionarItem = () => setItens((atual) => [...atual, itemVazio()]);
  const removerItem = (index: number) => setItens((atual) => atual.filter((_, i) => i !== index));

  // Atalho do catálogo: preenche a última linha se ela estiver em branco,
  // senão adiciona uma nova — evita deixar linha vazia sobrando.
  const aplicarProduto = (produto: ProdutoCatalogo) => {
    const novoItem: NovoItemForm = {
      produto_id: produto.id,
      produto_nome: produto.name,
      quantidade: '1',
      preco_unitario: String(produto.price),
    };
    setItens((atual) => {
      const ultimo = atual[atual.length - 1];
      if (ultimo && itemEstaVazio(ultimo)) {
        return [...atual.slice(0, -1), novoItem];
      }
      return [...atual, novoItem];
    });
  };

  // As vendas do dia que ela escolheu no seletor. Cai de volta em `vendas`
  // (hoje, vindo da API) enquanto o mês ainda não carregou.
  const vendasDoDiaEscolhido =
    vendasDoMes.length > 0
      ? vendasDoMes.filter((v) => v.data === diaEscolhido)
      : diaEscolhido === hojeBrasil()
        ? vendas
        : [];

  // Sugestões de ocasião que ela ainda não criou.
  const ocasioesSugeridas = ETIQUETAS_DE_VENDA_SUGERIDAS.filter(
    (s) => !etiquetasVenda.some((e) => e.nome.toLowerCase() === s.nome.toLowerCase()),
  );

  const totalVenda = itens.reduce((sum, item) => {
    const qtd = parseFloat(item.quantidade) || 0;
    const preco = parseFloat(item.preco_unitario) || 0;
    return sum + qtd * preco;
  }, 0);

  const registrarVenda = async () => {
    setFormError('');

    if (!clienteId) {
      setFormError('Escolha uma cliente da sua base ou cadastre uma nova antes de registrar a venda.');
      return;
    }

    const itensValidos = itens.filter((item) => item.produto_nome.trim());
    if (itensValidos.length === 0) {
      setFormError('Adicione pelo menos um item');
      return;
    }

    // Mesma função que a rota usa, pra tela e servidor não discordarem.
    const dataInvalida = motivoDataDeVendaInvalida(dataVenda);
    if (dataInvalida) {
      setFormError(dataInvalida);
      return;
    }

    setSalvando(true);
    try {
      const res = await fetch('/api/vendas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_nome: clienteNome.trim(),
          customer_id: clienteId,
          data: dataVenda,
          tag_ids: ocasioesDaVenda.length ? ocasioesDaVenda : undefined,
          cliente_telefone: clienteTelefone.trim() || undefined,
          items: itensValidos.map((item) => ({
            produto_id: item.produto_id,
            produto_nome: item.produto_nome.trim(),
            quantidade: parseFloat(item.quantidade) || 1,
            preco_unitario: parseFloat(item.preco_unitario) || 0,
          })),
        }),
      });
      const result = await res.json();

      if (!res.ok) {
        setFormError(result.error || 'Erro ao registrar venda');
        return;
      }

      setShowRegistroVendaModal(false);
      if (dataVenda !== hojeBrasil()) {
        const [ano, mes, dia] = dataVenda.split('-');
        setAvisoRetroativo(
          `Venda de ${dia}/${mes}/${ano} registrada — já entrou no faturamento e nas metas daquele mês.`,
        );
        // Leva o seletor pro dia da venda: em vez de avisar que ela nao
        // aparece na lista, a lista passa a mostrá-la.
        setDiaEscolhido(dataVenda);
      }
      // Recarrega e regrava o cache: sem isto, sair e voltar pro dashboard
      // mostraria o faturamento de antes da venda.
      await carregarMetricas();
    } catch {
      setFormError('Erro ao registrar venda. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <PageShell>
        <PageHeader
          title="Dashboard de Vendas"
          description="Visão geral do seu negócio em tempo real"
          action={
            <Button onClick={abrirModal} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Registrar Venda
            </Button>
          }
        />

        {/* A agenda encontra a aluna aqui. Esta é a tela que ela abre todo dia
            pra registrar venda; um lembrete que só existe em outra página
            depende de alguém lembrar de ir olhar. */}
        <LembretesDoDia />

        {avisoRetroativo && (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
            <p className="text-sm text-emerald-900">{avisoRetroativo}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 text-emerald-900"
              onClick={() => setAvisoRetroativo('')}
            >
              Ok
            </Button>
          </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="relatorio">Relatório do Mês</TabsTrigger>
            <TabsTrigger value="hoje">Vendas do Dia</TabsTrigger>
            <TabsTrigger value="precificacao">Precificação</TabsTrigger>
          </TabsList>

          <TabsContent value="relatorio" className="space-y-6 mt-4">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Carregando...</p>
            ) : !relatorio || relatorio.vendas_realizadas === 0 ? (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  Registre sua primeira venda do mês pra ver o relatório completo.
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  {[
                    { title: 'Faturamento bruto', value: brl(relatorio.faturamento_mes), icon: DollarSign, color: 'text-blue-600' },
                    { title: 'Produtos vendidos', value: String(relatorio.produtos_vendidos), icon: ShoppingBag, color: 'text-green-600' },
                    { title: 'Ticket médio', value: brl(relatorio.ticket_medio_mes), icon: Package, color: 'text-purple-600' },
                    {
                      title: 'Atendimentos realizados',
                      value: String(relatorio.atendimentos_mes),
                      icon: Users,
                      color: 'text-orange-600',
                      // O único cartão clicável: é o único número que ela
                      // alimenta à mão. Os outros cinco saem das vendas.
                      onClick: abrirAtendimento,
                      chamada: relatorio.atendimentos_mes > 0 ? 'Atualizar' : 'Registrar',
                    },
                    { title: 'Vendas realizadas', value: String(relatorio.vendas_realizadas), icon: TrendingUp, color: 'text-emerald-600' },
                    {
                      title: 'Conversão geral',
                      value: relatorio.atendimentos_mes > 0 ? `${relatorio.conversao_mes.toFixed(1)}%` : '—',
                      icon: Target,
                      color: 'text-pink-600',
                    },
                  ].map((c) => (
                    <CartaoIndicador
                      key={c.title}
                      titulo={c.title}
                      valor={c.value}
                      icone={c.icon}
                      cor={c.color}
                      onClick={'onClick' in c ? c.onClick : undefined}
                      chamada={'chamada' in c ? c.chamada : undefined}
                    />
                  ))}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Distância da meta</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-center">
                    {relatorio.meta_mensal > 0 ? (
                      <>
                        <div className="grid gap-4 sm:grid-cols-3">
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Meta do mês</p>
                            <p className="text-xl font-bold">{brl(relatorio.meta_mensal)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Resultado atual</p>
                            <p className="text-xl font-bold">{brl(relatorio.faturamento_mes)}</p>
                          </div>
                          <div>
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Falta para a meta</p>
                            <p className="text-xl font-bold text-primary">
                              {relatorio.falta_para_meta === 0 ? 'Meta batida! 🎉' : brl(relatorio.falta_para_meta)}
                            </p>
                          </div>
                        </div>
                        <div className="relative mx-auto h-32 w-32">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Atingido', value: Math.min(relatorio.faturamento_mes, relatorio.meta_mensal) },
                                  { name: 'Falta', value: relatorio.falta_para_meta },
                                ]}
                                dataKey="value"
                                innerRadius={40}
                                outerRadius={60}
                                startAngle={90}
                                endAngle={-270}
                                isAnimationActive={false}
                              >
                                <Cell fill="#7c3aed" />
                                <Cell fill="#e5e7eb" />
                              </Pie>
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xl font-bold">
                            {relatorio.percentual_meta.toFixed(0)}%
                          </div>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Defina uma meta mensal na aba{' '}
                        <a href="/dashboard/metas" className="text-primary hover:underline">Metas</a> pra acompanhar sua
                        distância até ela.
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>O que mais vendeu</CardTitle>
                    <CardDescription>
                      Ranking por faturamento no mês. A classe mostra o peso de cada item dentro da sua
                      categoria: <strong>A</strong> é o que sustenta o faturamento, <strong>C</strong> é a
                      cauda.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    <div className="grid gap-4 sm:grid-cols-2">
                      {[relatorio.ranking_produtos, relatorio.ranking_adicionais].map((cat) => (
                        <div key={cat.tipo} className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">
                            {cat.tipo === 'produto' ? 'Produtos' : 'Adicionais'}
                          </p>
                          <p className="text-2xl font-bold">{brl(cat.faturamento)}</p>
                          <p className="text-sm text-muted-foreground">
                            {cat.percentualFaturamento.toFixed(0)}% do faturamento ·{' '}
                            {cat.quantidade} item(ns)
                          </p>
                        </div>
                      ))}
                    </div>

                    {[relatorio.ranking_produtos, relatorio.ranking_adicionais].map((cat) => (
                      <div key={cat.tipo} className="space-y-3">
                        <h3 className="font-semibold">
                          {cat.tipo === 'produto' ? 'Produtos' : 'Adicionais'}
                        </h3>
                        {cat.itens.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {cat.tipo === 'produto'
                              ? 'Nenhum produto registrado no mês.'
                              : 'Nenhum adicional vendido este mês — é ticket médio deixado na mesa.'}
                          </p>
                        ) : (
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[520px] text-sm">
                              <thead>
                                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                                  <th className="px-2 py-2">#</th>
                                  <th className="px-2 py-2">Item</th>
                                  <th className="px-2 py-2">Qtd</th>
                                  <th className="px-2 py-2">Faturamento</th>
                                  <th className="px-2 py-2">% do mês</th>
                                  <th className="px-2 py-2">Classe</th>
                                </tr>
                              </thead>
                              <tbody>
                                {cat.itens.map((item) => (
                                  <tr key={`${cat.tipo}-${item.posicao}`} className="border-b last:border-0">
                                    <td className="px-2 py-2 text-muted-foreground">{item.posicao}</td>
                                    <td className="px-2 py-2 font-medium">{item.nome}</td>
                                    <td className="px-2 py-2">{item.quantidade}</td>
                                    <td className="px-2 py-2">{brl(item.faturamento)}</td>
                                    <td className="px-2 py-2">{item.percentualFaturamento.toFixed(1)}%</td>
                                    <td className="px-2 py-2">
                                      <span className={`rounded px-2 py-0.5 text-xs font-bold ${CORES_CLASSE[item.classe]}`}>
                                        {item.classe}
                                      </span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <div className="grid gap-6 lg:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Vendas por faixa de preço do produto</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Em que preço seu catálogo mais gira. Conta produtos
                        vendidos, não atendimentos.
                      </p>
                    </CardHeader>
                    <CardContent className="overflow-x-auto">
                      <table className="w-full min-w-[440px] text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-2 py-2">Faixa de preço</th>
                            <th className="px-2 py-2">Produtos</th>
                            <th className="px-2 py-2">% dos produtos</th>
                            <th className="px-2 py-2">Faturamento</th>
                            <th className="px-2 py-2">% faturamento</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatorio.faixas.map((f, i) => (
                            <tr key={f.rotulo} className="border-b last:border-0">
                              <td
                                className="px-2 py-2 font-medium"
                                style={{ color: CORES_FAIXA[i % CORES_FAIXA.length] }}
                              >
                                {f.rotulo}
                              </td>
                              <td className="px-2 py-2">{f.quantidade}</td>
                              <td className="px-2 py-2">{f.percentualVendas.toFixed(0)}%</td>
                              <td className="px-2 py-2">{brl(f.faturamento)}</td>
                              <td className="px-2 py-2">{f.percentualFaturamento.toFixed(0)}%</td>
                            </tr>
                          ))}
                          <tr className="bg-muted font-bold">
                            <td className="px-2 py-2">Total</td>
                            <td className="px-2 py-2">
                              {relatorio.faixas.reduce((s, f) => s + f.quantidade, 0)}
                            </td>
                            <td className="px-2 py-2">100%</td>
                            <td className="px-2 py-2">
                              {brl(relatorio.faixas.reduce((s, f) => s + f.faturamento, 0))}
                            </td>
                            <td className="px-2 py-2">100%</td>
                          </tr>
                        </tbody>
                      </table>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Faturamento por faixa de preço</CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={relatorio.faixas.map((f) => ({ name: f.rotulo, value: f.faturamento }))}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={50}
                            outerRadius={80}
                            isAnimationActive={false}
                            label={(d) => `${((d.percent ?? 0) * 100).toFixed(0)}%`}
                          >
                            {relatorio.faixas.map((f, i) => (
                              <Cell key={f.rotulo} fill={CORES_FAIXA[i % CORES_FAIXA.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v) => brl(Number(v))} />
                        </PieChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                </div>

                {relatorio.insights.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Lightbulb className="h-5 w-5 text-amber-500" /> Análise e insights
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm">
                        {relatorio.insights.map((texto, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary">•</span> {texto}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {(relatorio.projecao_ticket_atual || relatorio.projecao_ticket_referencia) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Rocket className="h-5 w-5 text-primary" /> Projeção pra bater a meta
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                      {relatorio.projecao_ticket_atual && (
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">
                            Mantendo o ticket médio atual ({brl(relatorio.ticket_medio_mes)})
                          </p>
                          <p className="mt-2 text-sm">
                            Você precisa vender aproximadamente{' '}
                            <strong className="text-lg text-primary">
                              {relatorio.projecao_ticket_atual.cestasNecessarias} cestas
                            </strong>
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Faltam cerca de <strong>{relatorio.projecao_ticket_atual.faltam} pedido(s)</strong> pra bater a
                            meta.
                          </p>
                        </div>
                      )}
                      {relatorio.projecao_ticket_referencia && (
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">
                            Aumentando o ticket médio pra{' '}
                            {brl(relatorio.projecao_ticket_referencia.valorReferencia)} (referência da faixa mais alta)
                          </p>
                          <p className="mt-2 text-sm">
                            Você precisaria vender{' '}
                            <strong className="text-lg text-emerald-600">
                              {relatorio.projecao_ticket_referencia.cestasNecessarias} cestas
                            </strong>
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Reduz a necessidade pra apenas{' '}
                            <strong>{relatorio.projecao_ticket_referencia.faltam} pedido(s)</strong>.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="hoje" className="space-y-4 mt-4">
            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-1.5">
                  <CardTitle>Vendas Registradas</CardTitle>
                  <CardDescription>
                    {diaEscolhido === hojeBrasil()
                      ? 'Todas as transações de hoje'
                      : `Transações de ${diaEscolhido.split('-').reverse().join('/')}`}
                  </CardDescription>
                </div>
                {/* Seletor de dia. Filtra em memória: a API já manda o mês
                    inteiro, então voltar a um dia anterior não custa requisição
                    nenhuma. Sem isto, uma venda lançada com data retroativa
                    nunca podia ser conferida na tela. */}
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    aria-label="Ver vendas de outro dia"
                    value={diaEscolhido}
                    max={hojeBrasil()}
                    onChange={(e) => setDiaEscolhido(e.target.value || hojeBrasil())}
                    className="h-9 w-auto"
                  />
                  {diaEscolhido !== hojeBrasil() && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDiaEscolhido(hojeBrasil())}
                    >
                      Hoje
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {loading ? (
                    <p className="text-center py-8 text-muted-foreground">Carregando...</p>
                  ) : vendasDoDiaEscolhido.length > 0 ? (
                    vendasDoDiaEscolhido.map((venda) => (
                      <div
                        key={venda.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-white/60 bg-white/50 p-4 transition-colors hover:bg-accent"
                      >
                        <div className="flex-1">
                          <h4 className="font-semibold">{venda.cliente_nome}</h4>
                          <p className="text-sm text-muted-foreground">
                            {(venda.venda_itens || []).map((item) => item.produto_nome).join(', ') || 'Sem itens'}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-lg">R$ {venda.faturamento_total.toFixed(2)}</p>
                          <button
                            type="button"
                            aria-label={`Excluir a venda de ${venda.cliente_nome}`}
                            onClick={() => {
                              setErroExclusao('');
                              setVendaParaExcluir(venda);
                            }}
                            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      {diaEscolhido === hojeBrasil()
                        ? 'Nenhuma venda registrada hoje'
                        : `Nenhuma venda em ${diaEscolhido.split('-').reverse().join('/')}`}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="precificacao" className="mt-4">
            <PricingCalculator />
          </TabsContent>
        </Tabs>
      </PageShell>

      <Dialog open={showRegistroVendaModal} onOpenChange={setShowRegistroVendaModal}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Registrar Venda</DialogTitle>
            <DialogDescription>Adicione o cliente e os itens vendidos</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
              {formError && (
                <div className="p-3 bg-destructive/10 border border-destructive text-destructive rounded-lg text-sm">
                  {formError}
                </div>
              )}

              {/* Cliente é obrigatória: ou escolhe uma da base, ou cadastra aqui
                  mesmo. A lista aparece embutida, e não num menu que some ao
                  clicar fora — a Tania vai fazer isso ao vivo na frente das
                  alunas, então o caminho tem que estar à vista. */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Cliente <span className="text-destructive">*</span>
                </label>

                {clienteId ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                        <Check className="h-4 w-4" strokeWidth={3} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-emerald-900">
                          {clienteNome}
                        </p>
                        {clienteTelefone && (
                          <p className="truncate text-xs text-emerald-700">{clienteTelefone}</p>
                        )}
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={limparClienteEscolhida}>
                      Trocar
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3 rounded-2xl border border-primary/30 bg-primary/5 p-3">
                    <Input
                      placeholder="Digite o nome da cliente"
                      value={clienteNome}
                      autoComplete="off"
                      onChange={(e) => setClienteNome(e.target.value)}
                    />

                    {sugestoesCliente.length > 0 && (
                      <div className="space-y-1">
                        <p className="px-1 text-xs font-medium text-muted-foreground">
                          Já na sua base — toque pra usar nesta venda:
                        </p>
                        {sugestoesCliente.map((cliente) => (
                          <button
                            key={cliente.id}
                            type="button"
                            onClick={() => escolherCliente(cliente)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/60 bg-white px-3 py-2.5 text-left text-sm transition-colors hover:border-primary hover:bg-accent"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{cliente.name}</span>
                              {cliente.phone && (
                                <span className="block truncate text-xs text-muted-foreground">
                                  {formatarTelefone(cliente.phone)}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {cliente.total_orders || 0} compra(s)
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Bloco de cadastro da cliente nova.

                        Aparece a partir da PRIMEIRA letra e não some enquanto
                        a busca roda. Antes exigia 2+ letras E a busca já
                        terminada, então telefone e etiquetas ficavam
                        invisíveis na maior parte da digitação — a Tania pediu
                        "poder etiquetar no cadastro" justamente porque nunca
                        viu esta parte, que já existia. Recurso que só aparece
                        depois de um passo que ninguém sabe que precisa dar é
                        recurso que não existe. */}
                    {clienteNome.trim().length >= 1 && (
                      <div className="space-y-2 rounded-xl border border-dashed border-primary/40 bg-white/60 p-3">
                        <p className="text-xs text-muted-foreground">
                          {buscandoCliente
                            ? 'Procurando na sua base...'
                            : sugestoesCliente.length > 0
                              ? 'Não é nenhuma dessas? Cadastre uma nova:'
                              : 'Nenhuma cliente com esse nome ainda.'}
                        </p>
                        <Input
                          inputMode="tel"
                          placeholder="(21) 99999-8888"
                          value={clienteTelefone}
                          onChange={(e) =>
                            setClienteTelefone(aplicarMascaraTelefone(e.target.value))
                          }
                        />
                        {etiquetas.length > 0 && (
                          <div className="space-y-1.5">
                            {/* "Sobre a cliente" vs. "Ocasião da compra" (mais
                                abaixo): a tela agora tem os dois tipos de
                                etiqueta e precisa não confundi-los. Aqui é o
                                que a pessoa É pra sempre; lá é o que esta
                                compra FOI. */}
                            <p className="text-xs font-medium text-muted-foreground">
                              Sobre a cliente (opcional) — vale pra sempre
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {etiquetas.map((etiqueta) => (
                                <EtiquetaToggle
                                  key={etiqueta.id}
                                  etiqueta={etiqueta}
                                  ativa={etiquetasDaNova.includes(etiqueta.id)}
                                  onClick={() => alternarEtiquetaDaNova(etiqueta.id)}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                        <Button
                          type="button"
                          className="w-full"
                          onClick={cadastrarClienteNova}
                          disabled={criandoCliente}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          {criandoCliente
                            ? 'Cadastrando...'
                            : 'Cadastrar "' + clienteNome.trim() + '"'}
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          O telefone é o que impede a mesma cliente de entrar duas vezes na base — e
                          é por ele que você abre a conversa no WhatsApp depois.
                        </p>
                      </div>
                    )}

                    {clienteNome.trim().length < 2 && (
                      <p className="px-1 text-xs text-muted-foreground">
                        Toda venda fica ligada a uma cliente — é assim que o histórico de compras
                        dela se forma.
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Data da venda.

                  Vem preenchida com hoje e fica logo abaixo da cliente, não
                  escondida atrás de "opções avançadas": a Tania pediu
                  justamente pra poder alimentar os meses anteriores, e um
                  campo que ela não encontra é o mesmo que campo nenhum.

                  O `max` impede escolher dia futuro já no seletor do
                  navegador — venda futura é encomenda, que tem campo próprio. */}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="data-venda">
                  Data da venda
                </label>
                <Input
                  id="data-venda"
                  type="date"
                  value={dataVenda}
                  max={hojeBrasil()}
                  onChange={(e) => setDataVenda(e.target.value)}
                />
                {dataVenda !== hojeBrasil() && (
                  <p className="text-xs text-muted-foreground">
                    Lançamento retroativo: esta venda entra no faturamento do mês
                    em que aconteceu, não no de hoje.
                  </p>
                )}
              </div>

              {/* Ocasião DESTA venda.

                  Fica junto da data e separado do bloco da cliente de
                  propósito: são duas perguntas diferentes que a tela precisa
                  não confundir. Ali em cima é o que a pessoa É ("Cliente
                  VIP", vale sempre); aqui é o que a compra FOI ("Aniversário",
                  vale pra esta venda e só).

                  Era o que faltava pra Tania marcar "a venda do Rodrigo foi de
                  aniversário" — informação que nenhuma data do sistema revela,
                  porque o aniversário dele não cai em feriado nenhum. */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Ocasião da compra (opcional)</label>

                {etiquetasVenda.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {etiquetasVenda.map((etiqueta) => (
                      <EtiquetaToggle
                        key={etiqueta.id}
                        etiqueta={etiqueta}
                        ativa={ocasioesDaVenda.includes(etiqueta.id)}
                        onClick={() => alternarOcasiaoDaVenda(etiqueta.id)}
                      />
                    ))}
                  </div>
                )}

                {/* Sugestões que ela ainda não tem: um toque cria e já marca.
                    É o que impede o bloco de nascer vazio no primeiro uso. */}
                {ocasioesSugeridas.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {etiquetasVenda.length === 0 && (
                      <span className="text-xs text-muted-foreground">Toque pra criar:</span>
                    )}
                    {ocasioesSugeridas.map((sugestao) => (
                      <button
                        key={sugestao.nome}
                        type="button"
                        disabled={criandoOcasiao === sugestao.nome}
                        onClick={() => criarOcasiao(sugestao.nome, sugestao.cor)}
                        className="rounded-full border border-dashed border-muted-foreground/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
                      >
                        + {sugestao.nome}
                      </button>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Depois dá pra filtrar em Clientes quem comprou em cada ocasião.
                </p>
              </div>

              {catalogo.length > 0 ? (
                <div className="space-y-4">
                  {(
                    [
                      { tipo: 'produto' as const, rotulo: 'Produtos' },
                      { tipo: 'adicional' as const, rotulo: 'Adicionais' },
                    ]
                  ).map(({ tipo, rotulo }) => {
                    const itens = catalogo.filter((p) => (p.tipo ?? 'produto') === tipo);
                    if (itens.length === 0) return null;
                    return (
                      <div key={tipo} className="space-y-2">
                        <label className="text-sm font-medium">{rotulo}</label>
                        <div className="flex flex-wrap gap-2">
                          {itens.map((produto) => (
                            <Button
                              key={produto.id}
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => aplicarProduto(produto)}
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              {produto.name} · {brl(produto.price)}
                            </Button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <p className="text-xs text-muted-foreground">
                    Clique pra adicionar já preenchido, ou digite um item avulso abaixo.
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Dica: cadastre seus produtos em{' '}
                  <Link href="/dashboard/produtos" className="text-primary hover:underline">
                    Meus produtos
                  </Link>{' '}
                  pra adicioná-los aqui com um clique.
                </p>
              )}

              <div className="space-y-3">
                <label className="text-sm font-medium">Itens</label>
                {itens.map((item, index) => (
                  <div key={index} className="flex gap-2 items-start">
                    <Input
                      placeholder="Item (ex: Caneca personalizada)"
                      value={item.produto_nome}
                      onChange={(e) => atualizarItem(index, 'produto_nome', e.target.value)}
                      className="flex-[2]"
                    />
                    <Input
                      type="number"
                      min="1"
                      placeholder="Qtd"
                      value={item.quantidade}
                      onChange={(e) => atualizarItem(index, 'quantidade', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Preço"
                      value={item.preco_unitario}
                      onChange={(e) => atualizarItem(index, 'preco_unitario', e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removerItem(index)}
                      disabled={itens.length === 1}
                      className="px-3"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" onClick={adicionarItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar item
                </Button>
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-xl font-bold">R$ {totalVenda.toFixed(2)}</span>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRegistroVendaModal(false)}
                  disabled={salvando}
                >
                  Cancelar
                </Button>
                <Button className="flex-1" onClick={registrarVenda} disabled={salvando}>
                  {salvando ? 'Salvando...' : 'Registrar'}
                </Button>
              </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Registro de atendimento, aberto pelo cartão do Raio-X.

          A aba Atendimentos continua existindo; isto é o atalho pra quem está
          olhando o relatório e vê o zero. Sem ele, "conversão" e "PA" ficam em
          "—" e a aluna precisa sair da tela pra destravar dois indicadores. */}
      <Dialog open={atendimentoAberto} onOpenChange={setAtendimentoAberto}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Atendimentos do dia</DialogTitle>
            <DialogDescription>
              Quantas pessoas você atendeu — inclusive quem não comprou. É esse número
              que revela sua taxa de conversão.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={salvarAtendimento} className="space-y-4">
            {atendimentoErro && (
              <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
                {atendimentoErro}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="atendimento-data">
                Dia
              </label>
              <Input
                id="atendimento-data"
                type="date"
                value={atendimentoData}
                max={hojeBrasil()}
                onChange={(e) => setAtendimentoData(e.target.value || hojeBrasil())}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="atendimento-qtd">
                Pessoas atendidas
              </label>
              <Input
                id="atendimento-qtd"
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="0"
                value={atendimentoQtd}
                onChange={(e) => setAtendimentoQtd(e.target.value)}
              />
              {/* O upsert SUBSTITUI o valor do dia. Dizer isso evita que ela
                  digite 5 achando que soma aos 12 que ja estavam la. */}
              <p className="text-xs text-muted-foreground">
                Este é o total do dia — o valor digitado substitui o que já estava
                registrado, não soma.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setAtendimentoAberto(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={salvandoAtendimento}>
                {salvandoAtendimento ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão. Mostra cliente, data e valor porque a lista
          pode ter duas vendas parecidas da mesma pessoa — e isto não tem
          desfazer. */}
      <Dialog
        open={vendaParaExcluir !== null}
        onOpenChange={(aberto) => !aberto && setVendaParaExcluir(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir esta venda?</DialogTitle>
          </DialogHeader>

          {vendaParaExcluir && (
            <div className="rounded-2xl border bg-muted/40 p-4">
              <p className="font-semibold">{vendaParaExcluir.cliente_nome}</p>
              <p className="text-sm text-muted-foreground">
                {vendaParaExcluir.data.split('-').reverse().join('/')} ·{' '}
                {brl(vendaParaExcluir.faturamento_total)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(vendaParaExcluir.venda_itens || [])
                  .map((item) => item.produto_nome)
                  .join(', ') || 'Sem itens'}
              </p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            A venda sai do seu faturamento do mês e não dá pra desfazer. O histórico da
            cliente é recalculado.
          </p>

          {erroExclusao && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3 text-sm text-destructive">
              {erroExclusao}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVendaParaExcluir(null)}
              disabled={excluindoVenda}
            >
              Cancelar
            </Button>
            <Button
              variant="outline"
              className="text-destructive hover:bg-destructive/10"
              onClick={excluirVenda}
              disabled={excluindoVenda}
            >
              {excluindoVenda ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
