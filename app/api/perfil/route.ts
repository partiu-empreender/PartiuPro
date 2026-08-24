import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

interface AtualizarPerfilRequest {
  full_name: string;
}

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

    const { data: perfil, error } = await supabase
      .from('users')
      .select('id, full_name, email, is_admin')
      .eq('id', user.id)
      .single();

    if (error || !perfil) {
      return NextResponse.json(
        { error: 'Erro ao buscar perfil', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: perfil });
  } catch (error) {
    console.error('Erro na API de perfil:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}

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

    const body: AtualizarPerfilRequest = await request.json();

    if (!body.full_name?.trim()) {
      return NextResponse.json({ error: 'Informe o nome' }, { status: 400 });
    }

    const { data: perfil, error } = await supabase
      .from('users')
      .update({ full_name: body.full_name.trim() })
      .eq('id', user.id)
      .select('id, full_name, email, is_admin')
      .single();

    if (error || !perfil) {
      return NextResponse.json(
        { error: 'Erro ao atualizar perfil', details: error?.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, data: perfil, message: 'Perfil atualizado' });
  } catch (error) {
    console.error('Erro na API de perfil:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
