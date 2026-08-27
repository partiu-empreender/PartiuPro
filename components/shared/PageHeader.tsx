interface PageHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

// Cabeçalho padrão de página: empilha no celular, fica lado a lado no
// desktop. Substitui as variações copiadas e coladas que existiam em cada tela.
export default function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-muted-foreground sm:text-base">{description}</p>}
      </div>
      {action && <div className="sm:shrink-0">{action}</div>}
    </div>
  );
}
