import { NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { hojeBrasil } from '@/lib/datas';
import { situacaoDasVendas } from '@/lib/notificacoes';

/**
 * Quanto das vendas pede ação, pro sininho do topo.
 *
 * Devolve só as contas, não a lista: o sininho roda em toda tela, e mandar as
 * vendas inteiras a cada página aberta seria pagar banda pra mostrar um
 * número. A lista de verdade continua nas pendências do Dashboard.
 */
export async function GET() {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const hoje = hojeBrasil();

    // Só o que pode virar aviso: a receber, ou entrega com data até hoje.
    // Venda antiga sem data de entrega fica de fora já na consulta.
    const { data, error } = await supabase
      .from('vendas_diarias')
      .select('status, entrega, delivery_date, faturamento_total')
      .eq('workspace_id', user.id)
      .neq('status', 'cancelada')
      .or(`status.eq.pendente,and(entrega.eq.pendente,delivery_date.lte.${hoje})`)
      .limit(1000);

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao buscar avisos', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, hoje, vendas: situacaoDasVendas(data || [], hoje) });
  } catch (error) {
    console.error('Erro ao buscar avisos:', error);
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
