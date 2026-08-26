import { NextRequest, NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';
import { MARKETING_CONSENT_VERSION } from '@/lib/legal';

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

    const [{ data: termos }, { data: consentimento }, { data: acessos }] = await Promise.all([
      supabase
        .from('terms_acceptances')
        .select('terms_version, accepted_at')
        .eq('user_id', user.id)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('marketing_consents')
        .select('version, granted, granted_at, revoked_at')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('admin_access_log')
        .select('id, reason, accessed_at')
        .eq('workspace_id', user.id)
        .order('accessed_at', { ascending: false })
        .limit(30),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        termos_aceitos: termos ?? null,
        consentimento_divulgacao: consentimento ?? { granted: false },
        historico_acessos: acessos ?? [],
      },
    });
  } catch (error) {
    console.error('Erro na API de privacidade:', error);
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

    const { marketing_consent } = await request.json();

    if (typeof marketing_consent !== 'boolean') {
      return NextResponse.json({ error: 'Informe marketing_consent (true/false)' }, { status: 400 });
    }

    const now = new Date().toISOString();

    const { data, error } = await supabase
      .from('marketing_consents')
      .upsert(
        {
          user_id: user.id,
          version: MARKETING_CONSENT_VERSION,
          granted: marketing_consent,
          granted_at: marketing_consent ? now : undefined,
          revoked_at: marketing_consent ? null : now,
        },
        { onConflict: 'user_id' },
      )
      .select('version, granted, granted_at, revoked_at')
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Erro ao atualizar autorização de divulgação', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: marketing_consent ? 'Autorização concedida' : 'Autorização revogada',
    });
  } catch (error) {
    console.error('Erro na API de privacidade:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor', details: error instanceof Error ? error.message : 'Desconhecido' },
      { status: 500 },
    );
  }
}
