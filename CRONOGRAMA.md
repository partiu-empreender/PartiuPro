# Cronograma Partiu PRO — 28/10 a 23/12/2026

Plano de desenvolvimento da nova plataforma, combinado na reunião de 22/10 (João e Tânia).
Oito entregas, **uma por quarta-feira**, de 04/11 a 23/12. Cada entrega vai ao ar e é
apresentada à Tânia no mesmo dia.

Este arquivo é a referência para as sessões de desenvolvimento: ao começar uma semana,
leia o marco correspondente e as dependências da Tânia antes de escrever código.

## Ritmo da semana

| Dia | O que acontece |
|---|---|
| Quarta | Entrega no ar + demonstração para a Tânia (30 min) |
| Quinta e sexta | Tânia e equipe testam e mandam ajustes |
| Sexta | Prazo dos conteúdos do marco seguinte (perguntas, textos, vídeos, links) |
| Segunda e terça | Desenvolvimento, testes e ajustes |

Feriados no período: 02/11 (Finados), 20/11 (Consciência Negra). Black Friday: 27/11 — sem publicação nesse dia.

## Visão geral

| Marco | Data | Tema |
|---|---|---|
| 1 | qua 04/11 | Lançamento para as alunas |
| 2 | qua 11/11 | Abertura ao público e gamificação |
| 3 | qua 18/11 | Plano de 60 dias individualizado |
| 4 | qua 25/11 | Conteúdo e encontros |
| 5 | qua 02/12 | Relacionamento com clientes |
| 6 | qua 09/12 | Assistente de IA |
| 7 | qua 16/12 | Comunidade e aviso no celular |
| 8 | qua 23/12 | Versão completa |

---

## Marco 1 — 04/11 · Lançamento para as alunas
Semana 28/10 a 04/11 (7 dias, com o feriado de 02/11). É a semana mais pesada do cronograma.

**1.1 Entrada no sistema**
- Login com e-mail e senha, com recuperação
- Compra aprovada na Hotmart cria o acesso automaticamente (webhook)
- Bloqueio automático no vencimento ou cancelamento
- Selo de Aluna Fundadora, com identificação visual na interface

**1.2 Primeiro acesso obrigatório** — a aluna só usa o resto do sistema depois do diagnóstico
- Vídeo de boas-vindas (até 2 min) → diagnóstico → nível + plano de 60 dias → link do grupo de WhatsApp do nível → convite para preencher cidade, estado e Instagram

**1.3 Diagnóstico**
- 15 perguntas, uma por tela
- Faturamento em dois recortes: último ano e cada um dos últimos 3 meses (três campos)
- Texto de acolhimento antes do bloco de faturamento
- Não pode ser refeito livremente: só com liberação do administrador

**1.4 Níveis**
- Estado inicial (ainda não vendeu) + Nível 1 (até R$5.000), Nível 2 (R$5.001–10.000), Nível 3 (R$10.001–20.000), Nível 4 (acima de R$20.000)
- Sobe ao faturar a faixa 2 meses seguidos; do estado inicial, sobe no mês seguinte à primeira venda
- Toda subida gera aviso para a equipe aprovar

**1.5 Plano de ação de 60 dias**
- Espelho das respostas · foco dos 60 dias · tarefas dia a dia com check e barra de progresso
- Uma tarefa em destaque por dia na home
- Nesta entrega: estrutura completa com um plano-base por nível. Os cenários por combinação de respostas entram no Marco 3.

**1.6 Notificações** (dentro do sistema; aviso no celular entra no Marco 7)
- A notificação do dia é a tarefa do dia. Além dela, só: encontro começando, desafio novo, resultado publicado. Texto fixo.

**1.7 Home**
- Saudação e nível · tarefa de hoje · lançamento rápido de venda · quanto vendeu no mês e comparação · próximo encontro
- O primeiro número é sempre quanto ela vendeu. Sem barra de "0% concluído".

**1.8 Agenda**
- Calendário mensal navegável · encontros · datas comerciais do ano · aviso 45 a 60 dias antes de cada data

**1.9 Mão na Massa**
- Aba de desafios com o primeiro publicado: tema, período, tarefas, marcar como concluído

**1.10 Gamificação** — aba no ar com "em breve"

**1.11 Painel da Tutora**
- Lista das alunas do grupo: nome, nível, último acesso, diagnóstico, plano ativo, tarefas marcadas em 7 dias, último faturamento, data do último contato
- Ordenação que sinaliza quem precisa de atenção e quem merece reconhecimento
- Registro de contato (data, canal, assunto, comentário) com histórico na ficha

**Também nesta semana:** página de vendas no ar para a oferta de 04/11 (alunas) e 05/11 (público).

**Plano B, se faltar tempo:** o que a aluna vê (1.1 a 1.10) tem prioridade. O que é só da equipe
(Painel da Tutora e aprovação de níveis) pode entrar na sexta 06/11 sem que nenhuma aluna perceba.

**Depende da Tânia**
- Até 28/10: 15 perguntas, nomes finais dos níveis, matriz do plano
- Até 30/10: vídeo de boas-vindas, links dos 5 grupos de WhatsApp, calendário de encontros e datas comerciais, primeiro desafio, lista de tutoras e seus grupos, copy e imagens da página de vendas
- Até 30/10: acesso à Hotmart (token do webhook) e domínio de e-mail para o envio da recuperação de senha (ver `ACOES_FUTURAS.md`, SMTP)

---

## Marco 2 — 11/11 · Abertura ao público e gamificação
A oferta abre ao público em 05/11, então a primeira prioridade da semana é estabilidade.

- Ajustes da primeira semana de uso (erros e pedidos das alunas)
- Pontuação: tarefa do dia, venda lançada, desafio concluído, presença em encontro
- Ranking mensal por nível — cada aluna compete com quem está na mesma faixa; venda conta como ponto, nunca aparece em reais
- Sequência de dias seguidos (estilo Duolingo)
- Administração: fila de aprovação de subida de nível, liberar refazer diagnóstico, acompanhar novas assinaturas

**Depende da Tânia** — até 06/11: tabela de pontos e prêmios/sorteios

---

## Marco 3 — 18/11 · Plano de 60 dias individualizado
- Motor de cenários: a combinação das respostas do diagnóstico leva a um de até 20 cenários
- Cada cenário com cronograma, atividades, tarefas, checklists e quadro Kanban
- Editor na administração para a equipe criar e ajustar cenários sem programador
- Quem já fez o diagnóstico recebe o plano novo automaticamente

**Depende da Tânia** — até 13/11: regras de combinação e conteúdo dos cenários.
Se o conteúdo atrasar, o motor e o editor ficam prontos mesmo assim e a equipe carrega os cenários quando estiverem prontos.

---

## Marco 4 — 25/11 · Conteúdo e encontros
Semana curta (feriado em 20/11).

- Trilhas e microcursos com aulas curtas dentro do sistema (ex.: Café da Manhã), com progresso por aula
- Área de encontros: link da sala ao vivo, gravações e material de apoio
- Bônus da oferta de Black Friday liberados para quem comprou

**Depende da Tânia** — até 19/11: vídeos das aulas, lista de bônus da oferta, onde os vídeos ficam hospedados

---

## Marco 5 — 02/12 · Relacionamento com clientes
Semana da Black Friday (27/11): nada é publicado na sexta.

- Listas automáticas: aniversariantes do mês, clientes sem comprar há 30, 60 e 90 dias
- Mensagens prontas por tipo de lista: a aluna revisa e envia pelo WhatsApp dela com um toque (link do WhatsApp, sem integração não oficial, sem risco de bloqueio)
- Canal da venda (Instagram, WhatsApp, indicação…) no lançamento
- Resumo do mês: faturamento, ticket médio e canal que mais vende

**Depende da Tânia** — até 27/11: textos-modelo das mensagens

---

## Marco 6 — 09/12 · Assistente de IA
- Assistente dentro do sistema que conhece os números da aluna
- Avaliação por foto ou PDF: bio do Instagram, foto de produto, catálogo — devolve sugestões seguindo o método
- Apoio à precificação, junto da calculadora que já existe
- Limite de uso por aluna por dia, para controlar o custo

**Depende da Tânia** — até 04/12: critérios de avaliação (o que é bio boa, catálogo bom etc.) e crédito inicial de IA (US$100)

---

## Marco 7 — 16/12 · Comunidade e aviso no celular
- Diretório de alunas por cidade e estado, só para quem quiser aparecer: foto/logo, Instagram, filtros
- Sistema instalável no celular, com notificação da tarefa do dia
- Painel da Tutora com alertas automáticos (sumiu há X dias, subiu de nível, bateu meta)

**Depende da Tânia** — até 11/12: aprovar o texto de autorização para aparecer no diretório (LGPD)

---

## Marco 8 — 23/12 · Versão completa
- Leitura de nota fiscal por foto (primeira versão): foto → itens e valores editáveis → custo dos produtos
- Revisão de segurança e LGPD, backup e desempenho com o volume da Black Friday
- Decisão sobre o plano de infraestrutura (Supabase Pro)
- Guia rápido para tutoras e equipe
- Folga para absorver atrasos das semanas anteriores

---

## A partir de janeiro (fora deste cronograma, como combinado)
- WhatsApp pela API oficial da Meta
- Sistema de pedidos e estoque ("Cestinha"): pedido gera tarefas, baixa insumos, calcula margem e guarda histórico da cliente
- Comparação de preço de fornecedores — antes, pesquisar se existe API viável
- Servidor próprio (VPS), se o uso simultâneo exigir

## Riscos
- **Marco 1 em 7 dias**: só fecha se os conteúdos da Tânia chegarem até 30/10. Ver plano B acima.
- **E-mail de recuperação de senha**: hoje bloqueado pelo limite do Supabase. Sem domínio de e-mail configurado, alunas novas podem não conseguir recuperar a senha no dia do lançamento.
- **Conteúdo atrasado**: toda entrega depende de material da Tânia na sexta anterior. Quando atrasar, a estrutura vai ao ar e o conteúdo entra depois.
- **Custos variáveis**: IA e armazenamento crescem com o uso; limites por aluna desde o Marco 6.
