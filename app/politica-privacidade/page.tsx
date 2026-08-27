import Link from 'next/link';
import { PRIVACY_POLICY_TEXT } from '@/lib/legal';
import PageShell from '@/components/shared/PageShell';

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <PageShell width="narrow">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {PRIVACY_POLICY_TEXT}
        </div>
      </PageShell>
    </div>
  );
}
