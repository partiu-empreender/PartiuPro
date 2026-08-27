import { NextResponse } from 'next/server';
import { isCurrentUserAdmin, supabaseAdmin } from '@/lib/supabase-server';
import { diasAtrasBrasil } from '@/lib/datas';

interface AlunaResumo {
  id: string;
  full_name: string;
  email: string;
  vendas_30d: number;
  faturamento_30d: number;
  ultima_venda_em: string | null;
}

async function carregarResumoAlunas(): Promise<AlunaResumo[]> {
  const trintaDiasAtras = diasAtrasBrasil(30);

  const [{ data: usuarios }, { data: vendas }] = await Promise.all([
    supabaseAdmin.from('users').select('id, full_name, email, is_admin'),
    supabaseAdmin
      .from('vendas_diarias')
      .select('workspace_id, faturamento_total, data, created_at')
      .gte('data', trintaDiasAtras),
  ]);

  return (usuarios || [])
    .filter((u) => !u.is_admin)
    .map((u) => {
      const vendasDaAluna = (vendas || []).filter((v) => v.workspace_id === u.id);
      const ultimaVenda = vendasDaAluna
        .map((v) => v.created_at as string)
        .sort()
        .at(-1);

      return {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        vendas_30d: vendasDaAluna.length,
        faturamento_30d: vendasDaAluna.reduce((sum, v) => sum + (v.faturamento_total || 0), 0),
        ultima_venda_em: ultimaVenda || null,
      };
    })
    .sort((a, b) => b.faturamento_30d - a.faturamento_30d);
}

export async function GET() {
  const isAdmin = await isCurrentUserAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  try {
    const alunas = await carregarResumoAlunas();
    return NextResponse.json({ success: true, data: alunas });
  } catch (error) {
    console.error('Erro na API de resumo admin:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
