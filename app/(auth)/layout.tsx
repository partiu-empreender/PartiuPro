import Fundo from '@/components/shared/Fundo';

// Login e cadastro compartilham o mesmo palco: o fundo com as manchas roxas,
// que é o que dá o que desfocar por trás do cartão de vidro.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Fundo />
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
