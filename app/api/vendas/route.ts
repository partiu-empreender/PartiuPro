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
import { supabase } from '@/lib/supabase';

interface VendaItem {
  produto_id: string;
  quantidade: number;
  preco_unitario: number;
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
        data: new Date().toISOString().split('T')[0], // Data de hoje
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

    const itemsParaInserir = body.items.map((item) => ({
      venda_id: vendaDiaria.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      subtotal: item.quantidade * item.preco_unitario,
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
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    // Busca as vendas do dia
    const hoje = new Date().toISOString().split('T')[0];

    const { data: vendas, error: vendasError } = await supabase
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
          quantidade,
          preco_unitario,
          subtotal
        )
      `
      )
      .eq('workspace_id', user.id)
      .eq('data', hoje)
      .order('created_at', { ascending: false });

    if (vendasError) {
      return NextResponse.json(
        { error: 'Erro ao buscar vendas', details: vendasError.message },
        { status: 500 }
      );
    }

    // ============================================
    // CÁLCULO DE MÉTRICAS
    // ============================================

    const atendimentos = vendas?.length || 0;
    const vendas_count = vendas?.length || 0;

    const totalItens = vendas?.reduce((sum, venda) => {
      return sum + (venda.venda_itens?.reduce((itemSum, item) => itemSum + item.quantidade, 0) || 0);
    }, 0) || 0;

    const pa = vendas_count > 0 ? totalItens / vendas_count : 0;
    const faturamento_total = vendas?.reduce((sum, venda) => sum + venda.faturamento_total, 0) || 0;
    const ticket_medio = vendas_count > 0 ? faturamento_total / vendas_count : 0;

    return NextResponse.json({
      success: true,
      vendas: vendas || [],
      metricas: {
        atendimentos,
        vendas: vendas_count,
        pa: parseFloat(pa.toFixed(2)),
        faturamento_total,
        ticket_medio: parseFloat(ticket_medio.toFixed(2)),
        total_itens: totalItens,
      },
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
