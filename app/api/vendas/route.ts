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
import { hojeBrasil, primeiroDiaDoMesBrasil } from '@/lib/datas';

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
  customer_id?: string;
  bairro?: string;
  items: VendaItem[]; // Array de produtos
  shipping_cost?: number;
  notes?: string;
  delivery_date?: string;
  delivery_period?: string;
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

    const { data: vendaDiaria, error: vendaError } = await supabase
      .from('vendas_diarias')
      .insert({
        workspace_id: user.id,
        customer_id: body.customer_id || null,
        data: hojeBrasil(), // Data de hoje no fuso do Brasil, não em UTC
        cliente_nome: body.cliente_nome,
        bairro: body.bairro || null,
        faturamento_total: total_com_frete,
        shipping_cost: body.shipping_cost || 0,
        status: 'draft',
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
    // 3. ATUALIZAR MÉTRICAS DO CLIENTE
    // ============================================

    if (body.customer_id) {
      const { data: customer } = await supabase
        .from('customers')
        .select('total_orders, total_spent')
        .eq('id', body.customer_id)
        .single();

      if (customer) {
        await supabase
          .from('customers')
          .update({
            total_orders: (customer.total_orders || 0) + 1,
            total_spent: (customer.total_spent || 0) + faturamento_total,
            last_order_at: new Date().toISOString(),
          })
          .eq('id', body.customer_id);
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
    const primeiroDiaDoMes = primeiroDiaDoMesBrasil();

    const [
      { data: vendasDoMes, error: vendasError },
      { data: atendimentosDoDia, error: atendimentosError },
      { data: atendimentosDoMes, error: atendimentosMesError },
    ] = await Promise.all([
      supabase
        .from('vendas_diarias')
        .select(
          `
          id,
          data,
          cliente_nome,
          faturamento_total,
          status,
          venda_itens (
            id,
            produto_nome,
            quantidade,
            preco_unitario,
            subtotal,
            tipo
          )
        `
        )
        .eq('workspace_id', user.id)
        .gte('data', primeiroDiaDoMes)
        .order('created_at', { ascending: false }),
      supabase
        .from('atendimentos_diarios')
        .select('pessoas_atendidas')
        .eq('workspace_id', user.id)
        .eq('data', hoje)
        .maybeSingle(),
      supabase
        .from('atendimentos_diarios')
        .select('pessoas_atendidas')
        .eq('workspace_id', user.id)
        .gte('data', primeiroDiaDoMes),
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
