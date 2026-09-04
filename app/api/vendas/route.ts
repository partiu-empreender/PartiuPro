// app/api/vendas/route.ts
// ============================================
// API CORRIGIDA PARA REGISTRAR VENDAS
// ============================================
// Mudanças principais:
// 1. Cria uma única venda por CLIENTE (vendas_diarias)
// 2. Cria múltiplos itens (venda_itens) para cada PRODUTO
// 3. Calcula corretamente: 1 venda = 1 cliente, múltiplos produtos
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { calcularMetricasVendas } from '@/lib/metrics';
import {
  hojeBrasil,
  motivoDataDeVendaInvalida,
  primeiroDiaDoMesBrasil,
  recorteDoMes,
} from '@/lib/datas';
import { normalizarTelefone } from '@/lib/telefone';
import {
  ehEntrega,
  ehPagamento,
  type Entrega,
  type Pagamento,
} from '@/lib/situacao-venda';
import type { SupabaseClient } from '@supabase/supabase-js';

type TipoItem = 'produto' | 'adicional';

interface VendaItem {
  produto_id?: string; // preenchido quando o item veio do catálogo de produtos
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  tipo?: TipoItem; // só usado quando o item é avulso, sem produto_id
}

interface RegistrarVendaRequest {
  cliente_nome: string;
  /** Data da venda (AAAA-MM-DD). Ausente = hoje. */
  data?: string;
  customer_id?: string;
  cliente_telefone?: string;
  bairro?: string;
  items: VendaItem[]; // Array de produtos
  shipping_cost?: number;
  notes?: string;
  delivery_date?: string;
  delivery_period?: string;
  /** Ocasião da compra: aniversário, Namorados, corporativo. */
  tag_ids?: string[];
  /** Pagamento e entrega. Ausentes = o default do banco (pago / a entregar). */
  status?: Pagamento;
  entrega?: Entrega;
}

/**
 * Descobre — ou cria — a cliente do CRM correspondente a esta venda.
 *
 * A Tania pediu que registrar a venda já fosse alimentando a base de clientes,
 * sem ela precisar cadastrar antes. O risco óbvio disso é encher o CRM de
 * duplicatas, então a busca vai do sinal mais forte pro mais fraco:
 *
 *   1. customer_id — ela escolheu a cliente na lista de sugestões. Confiável.
 *   2. telefone — chave única no banco, é o identificador de verdade.
 *   3. nome idêntico — rede de segurança pra quem não tem o telefone à mão.
 *      Menos seguro (duas Marias diferentes viram uma), mas a tela mostra as
 *      clientes existentes enquanto ela digita, então o caminho normal é ela
 *      reconhecer e escolher em vez de cair aqui.
 *
 * Nunca lança: se algo falhar, a venda é registrada sem vínculo. Perder o
 * vínculo é um aborrecimento; perder a venda é perder faturamento.
 */
async function resolverCliente(
  supabase: SupabaseClient,
  workspaceId: string,
  body: RegistrarVendaRequest,
): Promise<string | null> {
  try {
    if (body.customer_id) return body.customer_id;

    const nome = body.cliente_nome.trim();
    const telefone = normalizarTelefone(body.cliente_telefone);

    if (telefone) {
      const { data: porTelefone } = await supabase
        .from('customers')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('phone', telefone)
        .maybeSingle();
      if (porTelefone) return porTelefone.id;
    } else {
      const { data: porNome } = await supabase
        .from('customers')
        .select('id')
        .eq('workspace_id', workspaceId)
        .ilike('name', nome)
        .limit(1);
      if (porNome?.[0]) return porNome[0].id;
    }

    const { data: nova } = await supabase
      .from('customers')
      .insert({ workspace_id: workspaceId, name: nome, phone: telefone })
      .select('id')
      .single();

    return nova?.id ?? null;
  } catch (error) {
    console.error('Não foi possível vincular a cliente à venda:', error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    // Validação de autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    // Parse do request
    const body: RegistrarVendaRequest = await request.json();

    // Validações básicas
    if (!body.cliente_nome || !body.items || body.items.length === 0) {
      return NextResponse.json(
        {
          error: 'Cliente e itens são obrigatórios',
        },
        { status: 400 }
      );
    }

    if (body.items.some((item) => !item.produto_nome?.trim())) {
      return NextResponse.json(
        { error: 'Todo item precisa de um nome' },
        { status: 400 }
      );
    }

    // Data da venda: o padrão continua sendo hoje, e lançar mês passado é uma
    // escolha explícita. A validação roda no servidor mesmo a tela já
    // validando — o navegador é o único lugar onde a regra pode ser burlada.
    const dataDaVenda = body.data?.trim() || hojeBrasil();
    const dataInvalida = motivoDataDeVendaInvalida(dataDaVenda);
    if (dataInvalida) {
      return NextResponse.json({ error: dataInvalida }, { status: 400 });
    }

    // ============================================
    // CÁLCULO DO FATURAMENTO TOTAL
    // ============================================
    // Faturamento = soma de (quantidade * preço) de todos os itens
    const faturamento_total = body.items.reduce((sum, item) => {
      return sum + item.quantidade * item.preco_unitario;
    }, 0);

    const total_com_frete = faturamento_total + (body.shipping_cost || 0);

    // ============================================
    // 1. CRIAR VENDA DIÁRIA (1 registro por cliente/transação)
    // ============================================

    const customerId = await resolverCliente(supabase, user.id, body);

    const { data: vendaDiaria, error: vendaError } = await supabase
      .from('vendas_diarias')
      .insert({
        workspace_id: user.id,
        customer_id: customerId,
        data: dataDaVenda, // hoje por padrão; retroativa quando ela informa
        cliente_nome: body.cliente_nome,
        bairro: body.bairro || null,
        faturamento_total: total_com_frete,
        shipping_cost: body.shipping_cost || 0,
        // O default é 'pago': o caminho comum é vender e receber na hora.
        // Quem vendeu fiado marca na tela; validado aqui porque o navegador é
        // o único lugar onde a regra pode ser burlada.
        status: ehPagamento(body.status) ? body.status : 'pago',
        entrega: ehEntrega(body.entrega) ? body.entrega : 'pendente',
        delivery_date: body.delivery_date || null,
        delivery_period: body.delivery_period || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (vendaError || !vendaDiaria) {
      return NextResponse.json(
        {
          error: 'Erro ao criar venda',
          details: vendaError?.message,
        },
        { status: 500 }
      );
    }

    // ============================================
    // 2. CRIAR ITENS DA VENDA (múltiplos registros, um por produto)
    // ============================================

    // O tipo do item vem do CATÁLOGO, não do navegador: quem veio de um
    // produto cadastrado herda o tipo de lá, consultado no banco com a RLS da
    // própria aluna. Assim o ranking por categoria não pode ser falsificado
    // por um cliente adulterado, e item avulso (digitado na hora, sem
    // produto_id) usa o que foi escolhido na tela, com 'produto' de default.
    const idsDoCatalogo = body.items
      .map((item) => item.produto_id)
      .filter((id): id is string => Boolean(id));

    const tipoPorProduto = new Map<string, TipoItem>();
    if (idsDoCatalogo.length > 0) {
      const { data: produtosDoCatalogo } = await supabase
        .from('products')
        .select('id, tipo')
        .in('id', idsDoCatalogo);

      for (const produto of produtosDoCatalogo || []) {
        tipoPorProduto.set(produto.id, produto.tipo === 'adicional' ? 'adicional' : 'produto');
      }
    }

    const itemsParaInserir = body.items.map((item) => ({
      venda_id: vendaDiaria.id,
      produto_id: item.produto_id || null,
      produto_nome: item.produto_nome.trim(),
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      subtotal: item.quantidade * item.preco_unitario,
      tipo:
        (item.produto_id && tipoPorProduto.get(item.produto_id)) ||
        (item.tipo === 'adicional' ? 'adicional' : 'produto'),
    }));

    const { data: vendaItens, error: itensError } = await supabase
      .from('venda_itens')
      .insert(itemsParaInserir)
      .select();

    if (itensError) {
      // Se falhar ao inserir itens, deleta a venda criada
      await supabase.from('vendas_diarias').delete().eq('id', vendaDiaria.id);

      return NextResponse.json(
        {
          error: 'Erro ao adicionar itens à venda',
          details: itensError.message,
        },
        { status: 500 }
      );
    }

    // ============================================
    // 3. ETIQUETAS DA VENDA (ocasião da compra)
    // ============================================
    // Não aborta a venda se falhar, pela mesma razão que o vínculo com a
    // cliente não aborta (ver resolverCliente): perder a etiqueta é
    // aborrecimento, perder a venda é perder faturamento. A RLS da migration
    // 010 é quem garante que só entra etiqueta da própria aluna.
    if (body.tag_ids?.length) {
      const { error: etiquetasError } = await supabase
        .from('venda_tag_links')
        .insert(body.tag_ids.map((tag_id) => ({ venda_id: vendaDiaria.id, tag_id })));

      if (etiquetasError) {
        console.error('Não foi possível etiquetar a venda:', etiquetasError);
      }
    }

    // ============================================
    // 4. ATUALIZAR MÉTRICAS DO CLIENTE
    // ============================================

    // Antes isto só rodava quando a tela enviava customer_id — o que ela nunca
    // fazia. Agora usa a cliente resolvida acima, então os totais do CRM
    // passam a ser alimentados de verdade a cada venda.
    if (customerId) {
      const { data: customer } = await supabase
        .from('customers')
        .select('total_orders, total_spent, last_order_at')
        .eq('id', customerId)
        .single();

      if (customer) {
        // `last_order_at` é a data DA VENDA, não do momento em que ela foi
        // digitada — e só avança, nunca retrocede.
        //
        // Com o lançamento retroativo isso deixou de ser detalhe: gravar
        // `new Date()` faria uma venda de julho digitada hoje marcar a cliente
        // como tendo comprado hoje. Quem lê esse campo é o filtro "Sem comprar
        // há 3/6/12 meses" (lib/filtros-clientes.ts) e a agenda de lembretes —
        // ou seja, cadastrar o histórico apagaria justamente a lista de quem
        // precisa de contato. E o "só avança" existe porque as vendas antigas
        // costumam ser digitadas fora de ordem: lançar março depois de abril
        // não pode fazer a cliente parecer mais fria do que é.
        const dataDaVendaISO = new Date(`${dataDaVenda}T12:00:00-03:00`).toISOString();
        const anterior = customer.last_order_at;
        const maisRecente =
          !anterior || dataDaVendaISO > anterior ? dataDaVendaISO : anterior;

        await supabase
          .from('customers')
          .update({
            total_orders: (customer.total_orders || 0) + 1,
            total_spent: (customer.total_spent || 0) + faturamento_total,
            last_order_at: maisRecente,
          })
          .eq('id', customerId);
      }
    }

    // ============================================
    // RESPOSTA DE SUCESSO
    // ============================================

    return NextResponse.json(
      {
        success: true,
        data: {
          venda_id: vendaDiaria.id,
          cliente_nome: vendaDiaria.cliente_nome,
          quantidade_itens: vendaItens?.length || 0,
          faturamento_total: vendaDiaria.faturamento_total,
          status: vendaDiaria.status,
          items: vendaItens,
        },
        message: `Venda registrada com sucesso! ${vendaItens?.length || 0} produto(s) adicionado(s)`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Erro na API de vendas:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Listar vendas do dia
// ============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Busca as vendas do mês (a lista exibida no dashboard filtra só as de hoje a partir daqui)
    const hoje = hojeBrasil();

    // Mês pedido pela tela. Sem parâmetro é o mês corrente, que é como a
    // rota sempre se comportou — nenhuma chamada existente muda.
    //
    // O seletor existe porque o Raio-X só olhava o mês corrente: a aluna que
    // lançava agosto em setembro via os números certos no banco e a tela em
    // branco, e concluía que o sistema não estava atualizando.
    const { searchParams } = new URL(request.url);
    const recorte = recorteDoMes(
      parseInt(searchParams.get('ano') || '', 10),
      parseInt(searchParams.get('mes') || '', 10),
    );

    const primeiroDiaDoMes = recorte ? recorte.inicio : primeiroDiaDoMesBrasil();
    const ultimoDiaDoMes = recorte ? recorte.fim : null;

    // `gte` sozinho bastava enquanto o recorte era sempre o mês corrente (não
    // existe venda futura). Pedindo um mês passado, sem o `lte` viriam também
    // todas as vendas dos meses seguintes.
    let consultaVendas = supabase
      .from('vendas_diarias')
      .select(
        `
          id,
          data,
          cliente_nome,
          faturamento_total,
          status,
          entrega,
          venda_itens (
            id,
            produto_id,
            produto_nome,
            quantidade,
            preco_unitario,
            subtotal,
            tipo
          )
        `
      )
      .eq('workspace_id', user.id)
      // Cancelada não é faturamento. O filtro fica na CONSULTA, e não em
      // lib/metrics.ts, porque quem chama aquelas funções são três lugares
      // diferentes: barrando na origem, nenhum caller novo pode esquecer e
      // somar dinheiro que não entrou.
      .neq('status', 'cancelada')
      .gte('data', primeiroDiaDoMes);

    let consultaAtendimentosDoMes = supabase
      .from('atendimentos_diarios')
      .select('pessoas_atendidas')
      .eq('workspace_id', user.id)
      .gte('data', primeiroDiaDoMes);

    if (ultimoDiaDoMes) {
      consultaVendas = consultaVendas.lte('data', ultimoDiaDoMes);
      consultaAtendimentosDoMes = consultaAtendimentosDoMes.lte('data', ultimoDiaDoMes);
    }

    const [
      { data: vendasDoMes, error: vendasError },
      { data: atendimentosDoDia, error: atendimentosError },
      { data: atendimentosDoMes, error: atendimentosMesError },
    ] = await Promise.all([
      consultaVendas.order('created_at', { ascending: false }),
      supabase
        .from('atendimentos_diarios')
        .select('pessoas_atendidas')
        .eq('workspace_id', user.id)
        .eq('data', hoje)
        .maybeSingle(),
      consultaAtendimentosDoMes,
    ]);

    if (vendasError) {
      return NextResponse.json(
        { error: 'Erro ao buscar vendas', details: vendasError.message },
        { status: 500 }
      );
    }
    if (atendimentosError || atendimentosMesError) {
      return NextResponse.json(
        {
          error: 'Erro ao buscar atendimentos',
          details: atendimentosError?.message || atendimentosMesError?.message,
        },
        { status: 500 }
      );
    }

    // `vendas` e `atendimentos_hoje` continuam sendo os de HOJE, mesmo quando
    // a tela pediu outro mês: quem os usa é a aba "Vendas do Dia", que tem
    // seletor próprio de data. Pedindo um mês passado eles vêm vazios, o que
    // está certo — hoje não pertence àquele mês.
    const vendas = (vendasDoMes || []).filter((venda) => venda.data === hoje);
    const atendimentos_hoje = atendimentosDoDia?.pessoas_atendidas ?? 0;
    const atendimentos_mes = (atendimentosDoMes || []).reduce(
      (sum, a) => sum + (a.pessoas_atendidas || 0),
      0,
    );
    const metricas = calcularMetricasVendas(vendas, vendasDoMes || [], atendimentos_hoje);

    return NextResponse.json({
      success: true,
      vendas,
      vendas_mes: vendasDoMes || [],
      atendimentos_mes,
      metricas,
    });
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 }
    );
  }
}

// ============================================
// DELETE - Excluir uma venda
// ============================================

/**
 * Recalcula os totais da cliente a partir das vendas que VALEM.
 *
 * Serve a dois caminhos: a venda excluída (some do banco) e a venda cancelada
 * (fica no banco, mas não conta). Nos dois casos a pergunta é a mesma — quais
 * compras dessa cliente ainda valem? — e a resposta se obtém do mesmo jeito.
 *
 * A tentação aqui é decrementar: tirar 1 de `total_orders` e o valor de
 * `total_spent`. Isso funciona pros dois primeiros campos, mas quebra no
 * terceiro — e é justamente o terceiro que importa.
 *
 * `last_order_at` é a data da venda mais recente, e o POST acima só a faz
 * AVANÇAR ("só avança, nunca retrocede", ver lá em cima). Não existe operação
 * inversa: excluída a venda mais recente, a data anterior não está guardada em
 * lugar nenhum — só dá pra descobrir olhando o que restou. Se ficasse a data
 * antiga, a cliente continuaria marcada como tendo comprado num dia em que já
 * não comprou, e sumiria do filtro "Sem comprar há 3/6/12 meses"
 * (lib/filtros-clientes.ts) e da agenda de lembretes: exatamente a lista de
 * quem precisa de contato.
 *
 * Então recalcula tudo do zero. São poucas vendas por cliente, e um número
 * certo vale mais que uma consulta economizada.
 *
 * Não lança: se o recálculo falhar, a venda já foi excluída — que é o que a
 * aluna pediu. Mesma disciplina de `resolverCliente`.
 */
async function recalcularTotaisDaCliente(
  supabase: SupabaseClient,
  workspaceId: string,
  customerId: string,
): Promise<void> {
  try {
    const { data: restantes, error } = await supabase
      .from('vendas_diarias')
      .select('data, faturamento_total, shipping_cost')
      .eq('workspace_id', workspaceId)
      .eq('customer_id', customerId)
      // Cancelada não entra no histórico da cliente: ela não comprou. Sem
      // isto, cancelar deixaria a pessoa marcada como compradora e ela sumiria
      // do filtro "Nunca compraram", que é a lista de prospecção.
      .neq('status', 'cancelada');

    if (error) throw error;

    const vendas = restantes || [];

    // `total_spent` acompanha o faturamento SEM frete: é assim que o POST
    // grava (soma `faturamento_total` dos itens, não `total_com_frete`).
    // Recalcular com o frete junto inflaria o histórico da cliente a cada
    // exclusão.
    const total_spent = vendas.reduce(
      (soma, v) => soma + (Number(v.faturamento_total) || 0) - (Number(v.shipping_cost) || 0),
      0,
    );

    const maisRecente = vendas.reduce<string | null>(
      (maior, v) => (!maior || v.data > maior ? v.data : maior),
      null,
    );

    await supabase
      .from('customers')
      .update({
        total_orders: vendas.length,
        total_spent,
        last_order_at: maisRecente
          ? new Date(`${maisRecente}T12:00:00-03:00`).toISOString()
          : null,
      })
      .eq('id', customerId);
  } catch (erro) {
    console.error('Não foi possível recalcular os totais da cliente:', erro);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Informe qual venda excluir.' }, { status: 400 });
    }

    // Busca antes de excluir por dois motivos: descobrir a cliente cujos
    // totais precisam ser refeitos, e distinguir "não existe" de "não é sua".
    // O `.eq('workspace_id')` é redundante com a RLS de propósito — a RLS é a
    // garantia, isto aqui é o que devolve 404 em vez de um sucesso silencioso.
    const { data: venda, error: buscaError } = await supabase
      .from('vendas_diarias')
      .select('id, customer_id, cliente_nome')
      .eq('id', id)
      .eq('workspace_id', user.id)
      .maybeSingle();

    if (buscaError) {
      return NextResponse.json(
        { error: 'Erro ao buscar a venda', details: buscaError.message },
        { status: 500 },
      );
    }
    if (!venda) {
      return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 });
    }

    // Itens e etiquetas somem junto: venda_itens (migration 001) e
    // venda_tag_links (migration 010) têm ON DELETE CASCADE.
    const { error: deleteError } = await supabase
      .from('vendas_diarias')
      .delete()
      .eq('id', id)
      .eq('workspace_id', user.id);

    if (deleteError) {
      return NextResponse.json(
        { error: 'Erro ao excluir a venda', details: deleteError.message },
        { status: 500 },
      );
    }

    if (venda.customer_id) {
      await recalcularTotaisDaCliente(supabase, user.id, venda.customer_id);
    }

    return NextResponse.json({
      success: true,
      message: `Venda de ${venda.cliente_nome} excluída.`,
    });
  } catch (error) {
    console.error('Erro ao excluir venda:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}

// ============================================
// PATCH - Situação da venda (pagamento e entrega)
// ============================================

/**
 * Muda o pagamento, a entrega, ou os dois.
 *
 * Aceita os campos separadamente e só mexe no que veio: marcar "entregue" não
 * pode mudar o pagamento por tabela. É o mesmo desenho do PATCH de cliente.
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Informe qual venda alterar.' }, { status: 400 });
    }

    const body: { status?: unknown; entrega?: unknown } = await request.json();

    const patch: { status?: Pagamento; entrega?: Entrega } = {};

    // Valida na rota em vez de deixar o CHECK do banco recusar: o erro do
    // Postgres não diz nada que a aluna possa entender, e o navegador é o
    // único lugar onde a regra da tela pode ser burlada.
    if (body.status !== undefined) {
      if (!ehPagamento(body.status)) {
        return NextResponse.json({ error: 'Situação de pagamento inválida.' }, { status: 400 });
      }
      patch.status = body.status;
    }

    if (body.entrega !== undefined) {
      if (!ehEntrega(body.entrega)) {
        return NextResponse.json({ error: 'Situação de entrega inválida.' }, { status: 400 });
      }
      patch.entrega = body.entrega;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: 'Nada para alterar.' }, { status: 400 });
    }

    // Busca antes pra distinguir "não existe" de "não é sua" (a RLS devolveria
    // sucesso silencioso), e pra saber se o cancelamento MUDOU — só então vale
    // refazer os totais da cliente.
    const { data: antes, error: buscaError } = await supabase
      .from('vendas_diarias')
      .select('id, customer_id, status')
      .eq('id', id)
      .eq('workspace_id', user.id)
      .maybeSingle();

    if (buscaError) {
      return NextResponse.json(
        { error: 'Erro ao buscar a venda', details: buscaError.message },
        { status: 500 },
      );
    }
    if (!antes) {
      return NextResponse.json({ error: 'Venda não encontrada.' }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('vendas_diarias')
      .update(patch)
      .eq('id', id)
      .eq('workspace_id', user.id);

    if (updateError) {
      return NextResponse.json(
        { error: 'Erro ao alterar a venda', details: updateError.message },
        { status: 500 },
      );
    }

    // Cancelar (ou descancelar) muda o histórico da cliente tanto quanto
    // excluir a venda: ela deixa de ter comprado, ou volta a ter. Sem este
    // recálculo, uma venda cancelada continuaria contando em `total_spent` e a
    // cliente ficaria fora do filtro "Nunca compraram" sem ter comprado nada.
    //
    // Só roda quando o cancelamento realmente mudou de estado — marcar
    // "entregue" numa venda paga não mexe em total nenhum.
    const cancelamentoMudou =
      patch.status !== undefined &&
      (antes.status === 'cancelada') !== (patch.status === 'cancelada');

    if (cancelamentoMudou && antes.customer_id) {
      await recalcularTotaisDaCliente(supabase, user.id, antes.customer_id);
    }

    return NextResponse.json({ success: true, message: 'Situação atualizada.' });
  } catch (error) {
    console.error('Erro ao alterar situação da venda:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}
