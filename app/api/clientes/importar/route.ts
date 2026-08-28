import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { COR_PADRAO } from '@/lib/etiquetas';
import { normalizarTelefone } from '@/lib/telefone';
import { lerCSV, lerData, lerEtiquetas } from '@/lib/csv';

export interface ResultadoImportacao {
  criadas: number;
  atualizadas: number;
  ignoradas: { linha: number; nome: string; motivo: string }[];
  colunasIgnoradas: string[];
  etiquetasCriadas: string[];
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await getRouteHandlerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { csv } = (await request.json()) as { csv?: string };
    if (!csv?.trim()) {
      return NextResponse.json({ error: 'Envie o conteúdo da planilha' }, { status: 400 });
    }

    const { linhas, colunasIgnoradas, temColunaNome } = lerCSV(csv);

    if (!temColunaNome) {
      return NextResponse.json(
        { error: 'A planilha precisa ter uma coluna de nome. Baixe o modelo pra ver o formato.' },
        { status: 400 },
      );
    }
    if (linhas.length === 0) {
      return NextResponse.json({ error: 'Nenhuma cliente encontrada na planilha.' }, { status: 400 });
    }

    // Etiquetas existentes, pra reaproveitar em vez de duplicar. A chave é o
    // nome em minúsculas: "VIP" e "vip" na planilha são a mesma etiqueta.
    const { data: etiquetasExistentes } = await supabase
      .from('customer_tags')
      .select('id, nome')
      .eq('workspace_id', user.id);

    const mapaEtiquetas = new Map<string, string>();
    for (const etiqueta of etiquetasExistentes || []) {
      mapaEtiquetas.set(etiqueta.nome.toLowerCase(), etiqueta.id);
    }

    const resultado: ResultadoImportacao = {
      criadas: 0,
      atualizadas: 0,
      ignoradas: [],
      colunasIgnoradas,
      etiquetasCriadas: [],
    };

    for (const [indice, linha] of linhas.entries()) {
      // +2 porque a planilha tem cabeçalho e a contagem começa em 1 — assim o
      // número bate com o que a Tania vê no Excel.
      const numeroDaLinha = indice + 2;
      const nome = (linha.nome || '').trim();
      const telefone = normalizarTelefone(linha.telefone);

      try {
        // Procura pelo telefone, que é a chave única do banco. Sem telefone,
        // cai no nome exato — mesma regra do vínculo automático da venda.
        let clienteId: string | null = null;
        if (telefone) {
          const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('workspace_id', user.id)
            .eq('phone', telefone)
            .maybeSingle();
          clienteId = data?.id ?? null;
        } else {
          const { data } = await supabase
            .from('customers')
            .select('id')
            .eq('workspace_id', user.id)
            .ilike('name', nome)
            .limit(1);
          clienteId = data?.[0]?.id ?? null;
        }

        const campos = {
          name: nome,
          phone: telefone,
          email: linha.email?.trim() || null,
          notes: linha.contexto?.trim() || null,
          date_of_birth: lerData(linha.aniversario),
        };

        if (clienteId) {
          // Atualização conservadora: só preenche o que está vazio no cadastro.
          // Reimportar a planilha antiga não pode apagar o contexto que a
          // aluna escreveu à mão depois.
          const { data: atual } = await supabase
            .from('customers')
            .select('phone, email, notes, date_of_birth')
            .eq('id', clienteId)
            .single();

          const patch: Record<string, unknown> = { name: nome };
          if (!atual?.phone && campos.phone) patch.phone = campos.phone;
          if (!atual?.email && campos.email) patch.email = campos.email;
          if (!atual?.notes && campos.notes) patch.notes = campos.notes;
          if (!atual?.date_of_birth && campos.date_of_birth) {
            patch.date_of_birth = campos.date_of_birth;
          }

          await supabase.from('customers').update(patch).eq('id', clienteId);
          resultado.atualizadas++;
        } else {
          const { data: nova, error } = await supabase
            .from('customers')
            .insert({ workspace_id: user.id, ...campos })
            .select('id')
            .single();

          if (error || !nova) {
            resultado.ignoradas.push({
              linha: numeroDaLinha,
              nome,
              motivo: error?.code === '23505' ? 'Telefone repetido na planilha' : 'Erro ao cadastrar',
            });
            continue;
          }
          clienteId = nova.id;
          resultado.criadas++;
        }

        const nomesEtiquetas = lerEtiquetas(linha.etiquetas);
        for (const nomeEtiqueta of nomesEtiquetas) {
          let tagId: string | undefined = mapaEtiquetas.get(nomeEtiqueta.toLowerCase());
          if (!tagId) {
            const { data: nova } = await supabase
              .from('customer_tags')
              .insert({ workspace_id: user.id, nome: nomeEtiqueta, cor: COR_PADRAO })
              .select('id')
              .single();
            const novoId: string | undefined = nova?.id;
            if (!novoId) continue;
            tagId = novoId;
            mapaEtiquetas.set(nomeEtiqueta.toLowerCase(), novoId);
            resultado.etiquetasCriadas.push(nomeEtiqueta);
          }
          // Ignora conflito: a cliente já ter a etiqueta não é erro.
          if (!tagId || !clienteId) continue;
          await supabase
            .from('customer_tag_links')
            .upsert({ customer_id: clienteId, tag_id: tagId }, { onConflict: 'customer_id,tag_id' });
        }
      } catch (error) {
        // Uma linha problemática não pode derrubar a importação inteira: a
        // Tania prefere 48 clientes importadas e 2 avisadas do que zero.
        resultado.ignoradas.push({
          linha: numeroDaLinha,
          nome,
          motivo: error instanceof Error ? error.message : 'Erro inesperado',
        });
      }
    }

    return NextResponse.json({ success: true, data: resultado });
  } catch (error) {
    console.error('Erro ao importar clientes:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
