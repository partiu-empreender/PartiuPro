import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t bg-muted/50 py-12">
      <div className="container">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🎁</span>
              <span className="font-bold">Raio-X</span>
            </Link>
            <p className="mt-4 text-sm text-muted-foreground">
              Sistema escalável de e-commerce para presentes
            </p>
          </div>

          <div>
            <h4 className="font-semibold">Produto</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/features" className="hover:text-foreground">
                  Funcionalidades
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-foreground">
                  Preços
                </Link>
              </li>
              <li>
                <Link href="/demo" className="hover:text-foreground">
                  Demo
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Recursos</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/docs" className="hover:text-foreground">
                  Documentação
                </Link>
              </li>
              <li>
                <Link href="/api" className="hover:text-foreground">
                  API
                </Link>
              </li>
              <li>
                <Link href="/blog" className="hover:text-foreground">
                  Blog
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold">Empresa</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li>
                <Link href="/about" className="hover:text-foreground">
                  Sobre
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-foreground">
                  Privacidade
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-foreground">
                  Termos
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center text-sm text-muted-foreground">
          <p>2024 Raio-X. Todos os direitos reservados.</p>
        </div>
      </div>
    </footer>
  );
}
