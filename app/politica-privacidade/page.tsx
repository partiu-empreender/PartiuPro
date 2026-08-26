import Link from 'next/link';
import { PRIVACY_POLICY_TEXT } from '@/lib/legal';

export default function PoliticaPrivacidadePage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-3xl p-6">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
        <div className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
          {PRIVACY_POLICY_TEXT}
        </div>
      </div>
    </div>
  );
}
