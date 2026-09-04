import Fundo from '@/components/shared/Fundo';
import LogoPartiu from '@/components/shared/LogoPartiu';

// Login e cadastro compartilham o mesmo palco: o fundo com as manchas roxas,
// que é o que dá o que desfocar por trás do cartão de vidro.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Fundo />
      <div className="w-full max-w-md">
        {/* A logo acima do cartão. Esta é a primeira tela que alguém vê do
            sistema, e até agora ela não dizia de quem era — abria com um
            emoji de presente e o título "Entrar". */}
        <div className="mb-8 flex justify-center">
          <LogoPartiu className="w-56 text-primary" />
        </div>
        {children}
      </div>
    </div>
  );
}
