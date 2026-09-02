import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { hojeBrasil } from '@/lib/datas';
import { acharDataComemorativa, janelaDaUltimaOcorrencia } from '@/lib/datas-comemorativas';

/**
 * Quem comprou numa janela de datas.
 *
 * Existe por causa do filtro "comprou no Dia das Mães". Essa resposta não cabe
 * em `customers` — a tabela guarda a ÚLTIMA compra, e a pergunta é sobre uma
 * semana específica lá atrás. Só o histórico de vendas responde.
 *
 * Devolve ids e não clientes inteiras: a lista já está carregada na tela, e
 * mandar de volta os mesmos 40 cadastros só pra dizer quais valem seria
 * repetir tudo à toa. A tela cruza os ids com o que já tem.
 *
 * DUAS FONTES, somadas (`?tag=` opcional):
 *
 *  1. a DATA da venda, contra o calendário de datas comemorativas — o sistema
 *     sabe sozinho quem comprou na semana do Dia das Mães, sem ninguém marcar
 *     nada;
 *  2. a ETIQUETA de ocasião da venda (migration 010) — o que a data não
 *     alcança: a encomenda de Natal fechada em outubro, o aniversário do
 *     Rodrigo que não coincide com feriado nenhum.
 *
 * Somar em vez de escolher uma é o ponto. Só a data perderia a compra
 * antecipada; só a etiqueta perderia todo o histórico já registrado — inclusive
 * o que a aluna acabou de lançar retroativamente, que nunca foi etiquetado.
 */
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

    const { searchParams } = new URL(request.url);
    const idDaData = searchParams.get('data');
    const idDaEtiqueta = searchParams.get('tag');

    let inicio = searchParams.get('inicio');
    let fim = searchParams.get('fim');
    let rotulo: string | null = null;

    // O caminho normal é a tela mandar só o id do evento e o servidor calcular
    // a janela — assim a regra de "qual foi a última vez que esse dia
    // aconteceu" mora num lugar só.
    if (idDaData) {
      const evento = acharDataComemorativa(idDaData);
      if (!evento) {
        return NextResponse.json({ error: 'Data comemorativa desconhecida' }, { status: 400 });
      }
      const janela = janelaDaUltimaOcorrencia(evento, hojeBrasil());
      inicio = janela.inicio;
      fim = janela.fim;
      rotulo = `${evento.nome} de ${janela.ano}`;
    }

    // Uma das duas fontes basta: dá pra filtrar só pela etiqueta, sem janela
    // de data nenhuma.
    if (!inicio && !fim && !idDaEtiqueta) {
      return NextResponse.json(
        { error: 'Informe a data comemorativa, a janela ou a etiqueta' },
        { status: 400 },
      );
    }

    // Fonte 1: quem comprou na janela da data.
    const porData = inicio && fim
      ? await supabase
          .from('vendas_diarias')
          .select('customer_id')
          .eq('workspace_id', user.id)
          .gte('data', inicio)
          .lte('data', fim)
          .not('customer_id', 'is', null)
      : null;

    // Fonte 2: quem tem venda marcada com a etiqueta. O !inner é proposital
    // aqui (ao contrário do select de clientes): só interessa a venda que
    // TEM a etiqueta pedida.
    const porEtiqueta = idDaEtiqueta
      ? await supabase
          .from('vendas_diarias')
          .select('customer_id, venda_tag_links!inner(tag_id)')
          .eq('workspace_id', user.id)
          .eq('venda_tag_links.tag_id', idDaEtiqueta)
          .not('customer_id', 'is', null)
      : null;

    const erro = porData?.error || porEtiqueta?.error;
    if (erro) {
      return NextResponse.json(
        { error: 'Erro ao consultar as vendas', details: erro.message },
        { status: 500 },
      );
    }

    // Uma cliente que comprou três vezes na semana do Natal — ou que aparece
    // pelas duas fontes — entra uma vez só.
    const ids = [
      ...new Set(
        [...(porData?.data || []), ...(porEtiqueta?.data || [])].map(
          (v) => v.customer_id as string,
        ),
      ),
    ];

    return NextResponse.json({
      success: true,
      data: {
        ids,
        inicio,
        fim,
        rotulo,
        // Quantas vieram de cada fonte: a tela mostra isso pra aluna entender
        // por que uma cliente que ela não etiquetou aparece na lista.
        porData: porData?.data?.length ?? 0,
        porEtiqueta: porEtiqueta?.data?.length ?? 0,
      },
    });
  } catch (error) {
    console.error('Erro na API de clientes:', error);
    return NextResponse.json(
      {
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Desconhecido',
      },
      { status: 500 },
    );
  }
}
