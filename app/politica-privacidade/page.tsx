import Link from 'next/link';
import { PRIVACY_POLICY_TEXT } from '@/lib/legal';
import PageShell from '@/components/shared/PageShell';
import Fundo from '@/components/shared/Fundo';

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen">
      <Fundo />
      <PageShell width="narrow">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <div className="vidro rounded-3xl p-6 text-sm leading-relaxed text-foreground sm:p-8">
          <div className="whitespace-pre-wrap">{PRIVACY_POLICY_TEXT}</div>
        </div>
      </PageShell>
    </div>
  );
}
