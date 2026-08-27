import { NextResponse } from 'next/server';
import { getRouteHandlerSupabaseClient } from '@/lib/supabase-server';

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

    const [{ data: termos }, { data: consentimento }] = await Promise.all([
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
    ]);

    return NextResponse.json({
      success: true,
      data: {
        termos_aceitos: termos ?? null,
        consentimento_divulgacao: consentimento ?? { granted: false },
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
