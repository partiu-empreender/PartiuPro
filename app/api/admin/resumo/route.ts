import { NextResponse } from 'next/server';
import { isCurrentUserAdmin, supabaseAdmin } from '@/lib/supabase-server';
import { diasAtrasBrasil } from '@/lib/datas';
import {
  diasDesde,
  passoDoFunil,
  resumirFunil,
  type PassoDoFunil,
} from '@/lib/ativacao';

interface AlunaResumo {
  id: string;
  full_name: string;
  email: string;
  vendas_30d: number;
  faturamento_30d: number;
  ultima_venda_em: string | null;
  /** auth.users.last_sign_in_at. null = nunca entrou (ou o auth não respondeu). */
  ultimo_login: string | null;
  dias_sem_entrar: number | null;
  passo: PassoDoFunil;
}

/**
 * O último login de cada conta, vindo do schema `auth`.
 *
 * É a única fonte de `last_sign_in_at` — ela não existe em public.users, e é
 * justamente ela que separa "nunca abriu o sistema" de "abriu e travou", as
 * duas situações que o painel antes mostrava como uma coisa só.
 *
 * NUNCA LANÇA, de propósito. Se a API do auth falhar, o painel continua
 * mostrando vendas: perder o dado de login é um aborrecimento, perder a tela
 * inteira é ficar sem acompanhamento nenhum. Mesma disciplina de
 * `resolverCliente` em app/api/vendas/route.ts.
 */
async function carregarUltimoLogin(): Promise<Map<string, string>> {
  const porUsuario = new Map<string, string>();

  try {
    // Paginado: o padrão é 50 por página. 200 resolve a turma atual numa
    // requisição só, e o laço continua valendo quando ela crescer.
    const porPagina = 200;
    for (let pagina = 1; pagina <= 25; pagina++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        page: pagina,
        perPage: porPagina,
      });
      if (error) throw error;

      const usuarios = data?.users ?? [];
      for (const u of usuarios) {
        if (u.last_sign_in_at) porUsuario.set(u.id, u.last_sign_in_at);
      }
      // Página incompleta = acabou. Evita rodar as 25 voltas à toa.
      if (usuarios.length < porPagina) break;
    }
  } catch (error) {
    console.error('Não foi possível ler o último login das alunas:', error);
  }

  return porUsuario;
}

/** Os workspace_id que aparecem numa tabela — "esta aluna mexeu aqui". */
async function idsComRegistro(tabela: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabaseAdmin.from(tabela).select('workspace_id');
    if (error) throw error;
    return new Set((data || []).map((linha) => linha.workspace_id as string));
  } catch (error) {
    console.error(`Não foi possível ler os sinais de uso de ${tabela}:`, error);
    return new Set();
  }
}

async function carregarResumoAlunas(): Promise<AlunaResumo[]> {
  const trintaDiasAtras = diasAtrasBrasil(30);

  const [
    { data: usuarios },
    { data: vendas },
    ultimoLoginPorId,
    comProduto,
    comCliente,
    comMeta,
    comAtendimento,
    comVendaAlgumDia,
  ] = await Promise.all([
    supabaseAdmin.from('users').select('id, full_name, email, is_admin, created_at'),
    supabaseAdmin
      .from('vendas_diarias')
      .select('workspace_id, faturamento_total, data, created_at')
      .neq('status', 'cancelada')
      .gte('data', trintaDiasAtras),
    carregarUltimoLogin(),
    // Os sinais de configuração. Sem recorte de data de propósito: cadastrar o
    // catálogo em agosto continua valendo como "já configurou" em setembro —
    // é marco de onboarding, não atividade recente.
    idsComRegistro('products'),
    idsComRegistro('customers'),
    idsComRegistro('metas'),
    idsComRegistro('atendimentos_diarios'),
    idsComRegistro('vendas_diarias'),
  ]);

  return (usuarios || [])
    .filter((u) => !u.is_admin)
    .map((u) => {
      const vendasDaAluna = (vendas || []).filter((v) => v.workspace_id === u.id);
      const ultimaVenda = vendasDaAluna
        .map((v) => v.created_at as string)
        .sort()
        .at(-1);

      const ultimo_login = ultimoLoginPorId.get(u.id) ?? null;

      return {
        id: u.id,
        full_name: u.full_name,
        email: u.email,
        vendas_30d: vendasDaAluna.length,
        faturamento_30d: vendasDaAluna.reduce((sum, v) => sum + (v.faturamento_total || 0), 0),
        ultima_venda_em: ultimaVenda || null,
        ultimo_login,
        dias_sem_entrar: diasDesde(ultimo_login),
        // "Já vendeu" olha a vida inteira, não os 30 dias: quem vendeu em
        // julho e parou não é a mesma pessoa que nunca vendeu, e a mentora
        // trata as duas de forma diferente.
        passo: passoDoFunil(ultimo_login, {
          temProduto: comProduto.has(u.id),
          temCliente: comCliente.has(u.id),
          temMeta: comMeta.has(u.id),
          temAtendimento: comAtendimento.has(u.id),
          temVenda: comVendaAlgumDia.has(u.id),
        }),
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
    const funil = resumirFunil(alunas);
    return NextResponse.json({ success: true, data: alunas, funil });
  } catch (error) {
    console.error('Erro na API de resumo admin:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
