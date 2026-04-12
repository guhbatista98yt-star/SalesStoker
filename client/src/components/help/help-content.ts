/**
 * CONECTUBOS — Conteúdo de ajuda contextual
 *
 * Centraliza todo o texto de ajuda por módulo.
 * Linguagem simples, direta e voltada para usuários leigos.
 */

export interface HelpStep {
  title: string;
  description: string;
}

export interface HelpFAQ {
  question: string;
  answer: string;
}

export interface HelpSection {
  icon: string;
  title: string;
  content: string;
}

export interface HelpContent {
  title: string;
  subtitle: string;
  sections: HelpSection[];
  steps: HelpStep[];
  faqs: HelpFAQ[];
  warning?: string;
  tip?: string;
}

export const HELP_CONTENT: Record<string, HelpContent> = {

  // ── Dashboard ────────────────────────────────────────────────────────────
  dashboard: {
    title: "Dashboard",
    subtitle: "Visão geral das vendas em tempo real",
    sections: [
      {
        icon: "📊",
        title: "O que é",
        content: "O Dashboard é a tela principal da aplicação. Ele mostra um resumo completo das vendas, com os dados mais importantes em um só lugar: total de vendas da semana, mês, pedidos a faturar, ranking de vendedores e evolução das vendas.",
      },
      {
        icon: "🎯",
        title: "Para que serve",
        content: "Serve para acompanhar o desempenho geral da loja ou de todas as empresas de forma rápida. Você vê em segundos quem está vendendo mais, como está o mês comparado ao ano anterior e quantos pedidos ainda estão pendentes.",
      },
      {
        icon: "🏢",
        title: "Seletor de empresa",
        content: "No topo da tela existe um seletor de empresa. Escolha uma empresa específica para ver os dados daquela unidade, ou selecione 'Todas as empresas' para ver o consolidado.",
      },
      {
        icon: "📅",
        title: "Período",
        content: "Você pode filtrar os dados por diferentes períodos: semana atual, mês atual, ou um intervalo personalizado. O período padrão é a semana atual.",
      },
      {
        icon: "🔄",
        title: "Atualizar dados",
        content: "O botão de atualizar (ícone de seta circulando) busca os dados mais recentes do banco. Use quando quiser garantir que está vendo as informações mais atualizadas.",
      },
    ],
    steps: [
      { title: "Selecione a empresa", description: "Escolha a empresa que deseja analisar no seletor do topo, ou deixe em 'Todas as empresas'." },
      { title: "Defina o período", description: "Use os botões de período (Semana Atual, Mês Atual) ou clique em 'Personalizado' para escolher datas específicas." },
      { title: "Analise os indicadores", description: "Os cards no topo mostram Vendas da Semana, Vendas do Mês e A Faturar Total. O crescimento em relação ao período anterior aparece em verde (positivo) ou vermelho (negativo)." },
      { title: "Veja o ranking", description: "A tabela de ranking mostra os vendedores ordenados por desempenho. Você pode mudar o critério de ordenação clicando nos filtros." },
      { title: "Reorganize os cards", description: "Arraste os cards usando o ícone de grade para organizar o dashboard do jeito que preferir." },
    ],
    faqs: [
      { question: "Por que os dados estão diferentes do sistema ERP?", answer: "Os dados são sincronizados periodicamente do ERP. Pode haver uma diferença de alguns minutos ou horas entre o ERP e o dashboard. Use o botão de atualizar para buscar os dados mais recentes." },
      { question: "O que significa 'A Faturar'?", answer: "São pedidos já registrados no sistema que ainda não foram faturados (não viraram nota fiscal). Representam vendas potenciais que devem entrar no mês." },
      { question: "Posso filtrar por vendedor específico?", answer: "No dashboard geral não é possível filtrar por vendedor individual. Para ver o desempenho de um vendedor específico, use a tela 'Vendedores'." },
    ],
    tip: "Use a tela em modo tela cheia (F11 no computador) para acompanhar o dashboard em TVs ou monitores na loja.",
  },

  // ── Vendedores ───────────────────────────────────────────────────────────
  vendedores: {
    title: "Vendedores",
    subtitle: "Análise individual de desempenho",
    sections: [
      {
        icon: "👤",
        title: "O que é",
        content: "A tela de Vendedores mostra o desempenho detalhado de cada vendedor individualmente. Você pode ver as vendas, metas, evolução e comparativos de um vendedor específico.",
      },
      {
        icon: "🎯",
        title: "Para que serve",
        content: "Use essa tela para fazer análises individuais: ver se um vendedor específico atingiu a meta, como foi a evolução das vendas semana a semana, e comparar com períodos anteriores.",
      },
      {
        icon: "🏢",
        title: "Filtros disponíveis",
        content: "Você pode filtrar por empresa e por período. Os dados mostrados são específicos do vendedor e da empresa selecionada.",
      },
    ],
    steps: [
      { title: "Selecione a empresa", description: "Escolha a empresa no seletor do topo." },
      { title: "Escolha o vendedor", description: "Selecione o vendedor que deseja analisar na lista disponível." },
      { title: "Defina o período", description: "Escolha o mês e ano que deseja visualizar." },
      { title: "Analise os indicadores", description: "Veja o total de vendas, comparativo com meta, evolução semanal e histórico mensal." },
    ],
    faqs: [
      { question: "O vendedor não aparece na lista — por quê?", answer: "O vendedor precisa ter pelo menos uma venda registrada no período. Se não aparecer, verifique se o período está correto ou se o vendedor realmente realizou vendas." },
    ],
    tip: "Supervisores veem apenas os vendedores da sua equipe. Administradores veem todos.",
  },

  // ── Metas ────────────────────────────────────────────────────────────────
  metas: {
    title: "Metas",
    subtitle: "Acompanhamento de metas de vendas",
    sections: [
      {
        icon: "🎯",
        title: "O que é",
        content: "A tela de Metas mostra o progresso de cada vendedor em relação às metas definidas para o mês. Você vê de forma visual quem está no caminho certo e quem precisa de atenção.",
      },
      {
        icon: "📋",
        title: "Como as metas são definidas",
        content: "As metas são cadastradas na tela de Configurações (aba 'Metas de Venda'). Você define uma meta mensal em reais para cada vendedor, e o sistema calcula automaticamente as metas semanais proporcionais.",
      },
      {
        icon: "🚦",
        title: "Cores de status",
        content: "Verde = meta atingida ou bem encaminhada. Amarelo = progresso abaixo do esperado para o período. Vermelho = vendedor em situação crítica. Cinza = sem meta cadastrada.",
      },
      {
        icon: "📊",
        title: "Progresso semanal",
        content: "Além da meta mensal, você pode ver as semanas individualmente. Cada semana tem sua própria barra de progresso, ajudando a identificar semanas fracas ou fortes.",
      },
    ],
    steps: [
      { title: "Selecione empresa e mês", description: "Use os filtros no topo para escolher a empresa e o mês que deseja acompanhar." },
      { title: "Analise o progresso geral", description: "Os cards coloridos no topo mostram quantos vendedores estão atingindo a meta, no caminho, em atenção ou em situação crítica." },
      { title: "Veja o detalhe de cada vendedor", description: "Cada linha mostra o nome do vendedor, o valor atual de vendas, a meta e o percentual de atingimento." },
      { title: "Configure metas", description: "Para definir ou alterar metas, vá em Configurações → Metas de Venda." },
    ],
    faqs: [
      { question: "O vendedor não tem meta — o que aparece?", answer: "Vendedores sem meta cadastrada aparecem com barra de progresso cinza e o texto 'Sem meta'. Para definir uma meta, vá em Configurações → Metas de Venda." },
      { question: "Como é calculada a meta semanal?", answer: "A meta semanal é calculada proporcionalmente à meta mensal, dividida pelo número de semanas úteis do mês." },
      { question: "A meta pode ser por quantidade?", answer: "Atualmente as metas são por valor (R$). Metas por quantidade ou mix estão disponíveis dentro das Campanhas." },
    ],
    warning: "As metas precisam ser cadastradas antes do início do mês para que o acompanhamento seja preciso desde o primeiro dia.",
  },

  // ── Alertas ──────────────────────────────────────────────────────────────
  alertas: {
    title: "Alertas",
    subtitle: "Avisos automáticos de desempenho",
    sections: [
      {
        icon: "🔔",
        title: "O que é",
        content: "O módulo de Alertas envia avisos automáticos quando algo relevante acontece nas vendas — como uma queda expressiva em relação ao mês anterior ou quando as metas estão muito abaixo do esperado.",
      },
      {
        icon: "⚙️",
        title: "Como configurar",
        content: "Cada alerta pode ser ativado ou desativado individualmente. Você também pode ajustar o limite (threshold) que dispara o alerta — por exemplo, alertar apenas quando a queda for superior a 20%.",
      },
      {
        icon: "🚨",
        title: "Tipos de alerta",
        content: "Queda de vendas ano a ano (YoY): avisa quando as vendas do mês atual estão abaixo das do mesmo mês do ano passado. Outros alertas podem incluir metas críticas, sem pedidos no dia, entre outros.",
      },
    ],
    steps: [
      { title: "Acesse os alertas", description: "Na tela de Alertas, você verá os avisos ativos no painel superior." },
      { title: "Configure os limites", description: "Clique em 'Configurar' para ajustar quais alertas estão ativos e qual é o percentual que dispara cada aviso." },
      { title: "Leia e descarte", description: "Alertas podem ser marcados como lidos ou descartados individualmente." },
    ],
    faqs: [
      { question: "Com que frequência os alertas são verificados?", answer: "O sistema verifica automaticamente a cada 10 minutos se as condições de alerta foram atingidas." },
      { question: "Posso criar alertas personalizados?", answer: "Por enquanto os tipos de alerta são predefinidos. A configuração possível é ativar/desativar e ajustar o percentual de limite de cada tipo." },
    ],
    tip: "Configure os alertas por empresa para receber avisos específicos de cada filial.",
  },

  // ── Visão Semanal ────────────────────────────────────────────────────────
  semanal: {
    title: "Visão Semanal",
    subtitle: "Análise detalhada semana a semana",
    sections: [
      {
        icon: "📅",
        title: "O que é",
        content: "A Visão Semanal mostra o desempenho de todos os vendedores organizados por semana. Você vê quem bateu a meta semanal, o total de cada vendedor na semana e a comparação com a semana anterior.",
      },
      {
        icon: "🎯",
        title: "Para que serve",
        content: "Use para identificar rapidamente quais vendedores tiveram semanas fortes ou fracas. É ideal para conversas semanais de gestão e acompanhamento de curto prazo.",
      },
    ],
    steps: [
      { title: "Selecione empresa e período", description: "Escolha a empresa e o mês que deseja analisar." },
      { title: "Navegue pelas semanas", description: "Cada coluna representa uma semana do mês. Você pode ver todos os vendedores lado a lado." },
      { title: "Analise os destaques", description: "Células verdes indicam meta semanal atingida. Vermelhas indicam meta não atingida." },
    ],
    faqs: [
      { question: "Como são definidas as semanas?", answer: "As semanas seguem o calendário de segunda a domingo, sempre dentro do mês selecionado. A primeira semana começa no dia 1 e a última termina no último dia do mês." },
    ],
    tip: "Use essa tela em reuniões semanais com a equipe para acompanhar o desempenho em tempo real.",
  },

  // ── Visão Mensal ─────────────────────────────────────────────────────────
  mensal: {
    title: "Visão Mensal",
    subtitle: "Análise comparativa mês a mês",
    sections: [
      {
        icon: "📆",
        title: "O que é",
        content: "A Visão Mensal mostra o desempenho de vendas mês a mês, com comparativos em relação ao mesmo período do ano anterior. Você vê a evolução histórica de cada vendedor ou da empresa.",
      },
      {
        icon: "📈",
        title: "Para que serve",
        content: "Ideal para análises de tendência, planejamento e revisões mensais. Ajuda a identificar sazonalidades e variações relevantes no histórico de vendas.",
      },
    ],
    steps: [
      { title: "Selecione empresa e ano", description: "Escolha a empresa e o ano de referência para a análise." },
      { title: "Analise a evolução mensal", description: "Cada linha representa um vendedor com seus valores mês a mês." },
      { title: "Compare com o ano anterior", description: "Os valores de crescimento (%) mostram a variação em relação ao mesmo mês do ano passado." },
    ],
    faqs: [
      { question: "Posso exportar os dados?", answer: "No momento não há exportação direta. Você pode capturar a tela ou solicitar um relatório ao administrador do sistema." },
    ],
  },

  // ── Visão em Loja ────────────────────────────────────────────────────────
  visaoLoja: {
    title: "Visão em Loja",
    subtitle: "Painel para exibição em TV ou monitor na loja",
    sections: [
      {
        icon: "📺",
        title: "O que é",
        content: "A Visão em Loja é uma tela simplificada, em formato de placar, projetada para ser exibida em TVs ou monitores dentro da loja. Ela mostra o ranking dos vendedores de forma clara e visível à distância.",
      },
      {
        icon: "🏆",
        title: "O que aparece",
        content: "Aparece o ranking dos vendedores com o total de vendas do período, a meta e o percentual de atingimento. O visual é grande e de fácil leitura.",
      },
    ],
    steps: [
      { title: "Abra a tela", description: "Acesse Visão em Loja pelo menu lateral." },
      { title: "Conecte a uma TV", description: "Use um cabo HDMI ou espelhamento de tela para exibir em um monitor grande." },
      { title: "Configure o período", description: "Selecione a empresa e o período que deseja exibir." },
    ],
    faqs: [
      { question: "A tela atualiza automaticamente?", answer: "Sim, a tela é atualizada automaticamente a cada poucos minutos sem necessidade de recarregar manualmente." },
    ],
    tip: "Coloque a tela em modo tela cheia (F11) para maximizar a exibição.",
  },

  // ── Campanhas ────────────────────────────────────────────────────────────
  campanhas: {
    title: "Campanhas",
    subtitle: "Campanhas de incentivo para vendedores",
    sections: [
      {
        icon: "🏆",
        title: "O que é",
        content: "O módulo de Campanhas permite criar e gerenciar campanhas de incentivo para a equipe de vendas. Uma campanha pode premiar vendedores por atingir metas de volume, mix de produtos, vendas de fornecedores específicos, entre outros critérios.",
      },
      {
        icon: "🎯",
        title: "Para que serve",
        content: "Use campanhas para motivar a equipe, aumentar a venda de produtos específicos, criar concursos internos ou campanhas patrocinadas por fornecedores.",
      },
      {
        icon: "📋",
        title: "Status das campanhas",
        content: "Rascunho: em criação, ainda não ativa. Ativa: em andamento, sendo monitorada. Pausada: temporariamente suspensa. Encerrada: período concluído. Cancelada: descontinuada antes do término.",
      },
      {
        icon: "🔢",
        title: "Tipos de campanha",
        content: "Por atingimento: premia quem atingiu uma meta. Por ranking: premia os melhores colocados. Mix: premia quem vendeu mais variedade de produtos. Fornecedor: premia venda de produtos de um fabricante específico.",
      },
    ],
    steps: [
      { title: "Crie uma campanha", description: "Clique em 'Nova Campanha'. Defina o nome, tipo, período de início e fim." },
      { title: "Configure os participantes", description: "Defina quem pode participar: todos os vendedores, vendedores de uma empresa específica ou um grupo selecionado." },
      { title: "Configure as regras", description: "Defina o gatilho (condição mínima para participar) e a premiação (valor fixo, percentual ou ranking)." },
      { title: "Revise e ative", description: "Antes de ativar, revise todas as configurações. Após ativar, a campanha começa a ser monitorada automaticamente." },
      { title: "Acompanhe os resultados", description: "Clique em 'Ver Campanha' para acompanhar o progresso em tempo real e ver o relatório de apuração." },
    ],
    faqs: [
      { question: "Posso editar uma campanha ativa?", answer: "Sim, mas com limitações. Algumas configurações críticas não podem ser alteradas enquanto a campanha está ativa para garantir a integridade dos resultados." },
      { question: "O que é um 'gatilho'?", answer: "Gatilho é a condição mínima que o vendedor precisa atingir para ser elegível ao prêmio. Por exemplo: vender pelo menos R$ 5.000 em produtos do fornecedor X." },
      { question: "Posso ter várias campanhas ativas ao mesmo tempo?", answer: "Sim. Você pode ter múltiplas campanhas rodando ao mesmo tempo, desde que as regras não sejam excludentes entre si." },
    ],
    warning: "Revise cuidadosamente as regras antes de ativar. Uma campanha ativa é visível para os vendedores e altera as expectativas de premiação.",
    tip: "Use o simulador dentro da campanha para testar como as regras se comportam com dados reais antes de ativar.",
  },

  // ── Formulário de Campanha ───────────────────────────────────────────────
  campanhasForm: {
    title: "Criar / Editar Campanha",
    subtitle: "Configure todos os detalhes da campanha",
    sections: [
      {
        icon: "📝",
        title: "Informações básicas",
        content: "Nome, descrição e objetivo são as informações principais da campanha. O nome aparecerá para os vendedores, então seja claro e objetivo. A descrição é interna.",
      },
      {
        icon: "📅",
        title: "Período",
        content: "Define quando a campanha começa e termina. Certifique-se de que o período está correto antes de ativar — ele não pode ser alterado depois.",
      },
      {
        icon: "👥",
        title: "Participantes",
        content: "Defina quem pode participar da campanha. Você pode incluir todos os vendedores de uma empresa ou selecionar vendedores específicos.",
      },
      {
        icon: "🏷️",
        title: "Base de produtos",
        content: "Se a campanha é por produto ou fornecedor, defina aqui quais produtos contam para a campanha. Você pode filtrar por fornecedor, categoria ou selecionar produtos individualmente.",
      },
      {
        icon: "🎁",
        title: "Premiação",
        content: "Configure como os vendedores serão premiados: valor fixo, percentual sobre as vendas, por pontuação ou por colocação no ranking.",
      },
    ],
    steps: [
      { title: "Preencha o nome e descrição", description: "O nome é obrigatório e deve ser claro. A descrição é opcional mas recomendada." },
      { title: "Defina o tipo de campanha", description: "Escolha entre atingimento, ranking, mix de produtos ou campanha de fornecedor." },
      { title: "Configure o período", description: "Defina a data de início e fim. Atenção: o período define quais movimentos serão contabilizados." },
      { title: "Configure a base de cálculo", description: "Defina quais produtos ou fornecedores entram na campanha." },
      { title: "Configure o gatilho", description: "Defina a condição mínima para o vendedor participar da premiação." },
      { title: "Configure a premiação", description: "Defina como e quanto os vendedores serão premiados." },
      { title: "Salve como rascunho", description: "Salve a campanha como rascunho primeiro. Revise tudo com calma antes de ativar." },
    ],
    faqs: [
      { question: "O que é 'modo de apuração'?", answer: "Define como o resultado é calculado: por atingimento (quem chegou na meta) ou por ranking (melhores colocados ganham)." },
      { question: "O que é 'base de cálculo'?", answer: "É o conjunto de produtos ou vendas que serão considerados para a campanha. Pode ser todos os produtos, apenas de um fornecedor específico, ou um conjunto selecionado." },
    ],
    warning: "Após ativar a campanha, algumas configurações não podem ser alteradas. Revise tudo com cuidado antes de ativar.",
  },

  // ── Comissões ────────────────────────────────────────────────────────────
  comissoes: {
    title: "Comissões",
    subtitle: "Cálculo e acompanhamento de comissões",
    sections: [
      {
        icon: "💰",
        title: "O que é",
        content: "O módulo de Comissões calcula automaticamente quanto cada vendedor ganhou de comissão no mês, com base nas regras configuradas pelo gestor.",
      },
      {
        icon: "📊",
        title: "Como funciona o cálculo",
        content: "O sistema aplica as regras de comissão sobre as vendas de cada vendedor: percentual base conforme atingimento da meta, bônus por semanas batidas, acelerador para quem superar a meta, e possíveis redutores.",
      },
      {
        icon: "🔢",
        title: "Componentes da comissão",
        content: "Comissão Base: percentual sobre vendas conforme faixa de meta atingida. Bônus Semanal: adicional para cada semana com meta batida. Bônus Todas Semanas: extra quando bate todas as semanas. Acelerador: percentual maior para quem supera a meta. Redutor: desconto aplicado em situações específicas.",
      },
    ],
    steps: [
      { title: "Selecione mês e vendedor", description: "Escolha o mês de referência e, se quiser, filtre por um vendedor específico." },
      { title: "Veja o resumo", description: "O sistema mostra o total de comissão calculado com o detalhamento de cada componente." },
      { title: "Analise o detalhamento", description: "Clique em um vendedor para ver exatamente como a comissão foi calculada, semana a semana." },
      { title: "Ajuste as regras se necessário", description: "Se as regras precisarem de ajuste, acesse Comissões → Configurar Regras." },
    ],
    faqs: [
      { question: "A comissão é calculada em tempo real?", answer: "Sim, o sistema recalcula a comissão com base nos dados de vendas disponíveis. O valor vai sendo atualizado ao longo do mês." },
      { question: "O que é 'meta de atingimento'?", answer: "É o percentual de cumprimento da meta mensal. Por exemplo, se a meta é R$ 100.000 e o vendedor vendeu R$ 95.000, o atingimento é de 95%." },
    ],
    tip: "Supervisores veem apenas os vendedores de sua equipe. Administradores veem todos.",
  },

  // ── Configurar Regras de Comissão ────────────────────────────────────────
  comissoesConfigurar: {
    title: "Regras de Comissão",
    subtitle: "Configure como as comissões são calculadas",
    sections: [
      {
        icon: "⚙️",
        title: "O que é",
        content: "Aqui você configura as regras que definem quanto cada vendedor ganha de comissão. As regras são aplicadas automaticamente pelo sistema no cálculo mensal.",
      },
      {
        icon: "📋",
        title: "Tipos de regra",
        content: "Base Mensal: percentual por faixa de atingimento de meta. Bônus Semanal: adicional por semana batida. Bônus Todas as Semanas: extra para quem bate todas as semanas. Acelerador: percentual extra para quem supera a meta. Estratégico: valor ou percentual extra por condição específica. Redutor: desconto por situação específica.",
      },
      {
        icon: "📊",
        title: "Faixas de comissão",
        content: "Na regra Base Mensal, você define faixas: por exemplo, quem atingir de 85% a 94.9% da meta recebe 0.35%, quem atingir 95% a 99.9% recebe 0.60%, e assim por diante. O sistema aplica automaticamente a faixa correta para cada vendedor.",
      },
    ],
    steps: [
      { title: "Revise as regras existentes", description: "Veja as regras já cadastradas e se estão ativas ou não." },
      { title: "Crie uma nova regra", description: "Clique em 'Nova Regra', escolha o tipo e preencha as configurações." },
      { title: "Defina as faixas (se aplicável)", description: "Para regras do tipo 'Base Mensal', defina as faixas de atingimento e o percentual de cada faixa." },
      { title: "Ative ou desative", description: "Use o toggle para ativar ou desativar cada regra sem precisar excluí-la." },
    ],
    faqs: [
      { question: "Posso ter várias regras ativas ao mesmo tempo?", answer: "Sim. O sistema aplica todas as regras ativas de forma acumulativa. A ordem de prioridade pode ser configurada." },
      { question: "O que acontece se não houver meta cadastrada para um vendedor?", answer: "Sem meta cadastrada, regras baseadas em atingimento de meta não se aplicam. O vendedor pode ainda receber outros tipos de comissão, se houver regras independentes de meta." },
    ],
    warning: "Alterações nas regras afetam os cálculos do mês corrente imediatamente. Faça alterações com cuidado e, de preferência, no início do mês.",
  },

  // ── Configurações ────────────────────────────────────────────────────────
  configuracoes: {
    title: "Configurações",
    subtitle: "Central de configuração do sistema",
    sections: [
      {
        icon: "⚙️",
        title: "O que é",
        content: "A tela de Configurações é onde você gerencia todos os aspectos administrativos do sistema: usuários, equipes, metas, permissões de módulos e configurações da plataforma.",
      },
      {
        icon: "👥",
        title: "Gerenciar Usuários",
        content: "Crie e gerencie os usuários que têm acesso ao sistema. Cada usuário tem um perfil (Administrador, Supervisor ou Vendedor) que define o que ele pode ver e fazer.",
      },
      {
        icon: "🏢",
        title: "Gerenciar Equipes",
        content: "Crie grupos de vendedores para que supervisores possam ver apenas a sua equipe. Um supervisor só vê os dados dos vendedores do seu grupo.",
      },
      {
        icon: "🎯",
        title: "Metas de Venda",
        content: "Defina as metas mensais de cada vendedor por empresa. O sistema calcula automaticamente as metas semanais com base no valor mensal informado.",
      },
      {
        icon: "🔐",
        title: "Permissões de Módulos",
        content: "Controle quais módulos cada perfil de usuário pode acessar. Útil para limitar o acesso de supervisores a módulos administrativos.",
      },
    ],
    steps: [
      { title: "Crie os usuários", description: "Vá na aba de usuários e cadastre todos que precisam de acesso ao sistema. Defina o perfil correto (Admin, Supervisor ou Vendedor)." },
      { title: "Configure as equipes", description: "Se tiver supervisores, crie grupos com os vendedores de cada supervisor." },
      { title: "Defina as metas", description: "Na aba de Metas, defina o valor mensal de meta para cada vendedor em cada empresa." },
      { title: "Configure as permissões", description: "Ajuste quais módulos cada tipo de usuário pode acessar." },
    ],
    faqs: [
      { question: "Qual a diferença entre Admin, Supervisor e Vendedor?", answer: "Admin: acesso completo a tudo. Supervisor: vê apenas sua equipe, sem acesso a configurações. Vendedor: vê apenas seus próprios dados." },
      { question: "Posso ter mais de um administrador?", answer: "Sim. Você pode ter múltiplos usuários com perfil de administrador." },
      { question: "Como faço para redefinir a senha de um usuário?", answer: "No cadastro do usuário, existe a opção de alterar a senha. O usuário também pode alterar a própria senha pelo menu no canto superior direito." },
    ],
    warning: "Apenas administradores têm acesso à tela de Configurações. Tome cuidado ao alterar perfis ou excluir usuários.",
  },
};

// ── Tooltips de campo ──────────────────────────────────────────────────────────

export const FIELD_TOOLTIPS: Record<string, string> = {
  // Dashboard
  "kpi-semana":        "Total de vendas realizadas nas semanas selecionadas no período atual.",
  "kpi-mes":           "Total acumulado de vendas no mês atual até a data de hoje.",
  "kpi-afaturar":      "Pedidos já registrados que ainda não viraram nota fiscal. São vendas potenciais para o mês.",
  "periodo":           "Filtra os dados exibidos para o período selecionado. Semana atual usa as datas de segunda a domingo da semana em curso.",
  "empresa":           "Selecione uma empresa específica ou 'Todas as empresas' para ver o consolidado.",

  // Metas
  "meta-mensal":       "Valor em reais que o vendedor precisa atingir no mês inteiro para bater a meta.",
  "meta-semanal":      "Valor calculado automaticamente dividindo a meta mensal pelas semanas do mês.",
  "meta-atingimento":  "Percentual de quanto da meta já foi cumprida até agora.",

  // Campanhas
  "campanha-gatilho":  "Condição mínima para o vendedor ser elegível ao prêmio. Ex: vender R$ 5.000 do fornecedor X.",
  "campanha-base":     "Conjunto de produtos ou fornecedores considerados para calcular o resultado da campanha.",
  "campanha-modo":     "Define se o prêmio é por atingimento individual ou por colocação no ranking.",
  "campanha-premio":   "O que o vendedor ganha ao cumprir a condição: valor fixo, percentual sobre as vendas ou prêmio por posição.",
  "campanha-periodo":  "Datas de início e fim da campanha. Apenas vendas neste período são contabilizadas.",

  // Comissões
  "comissao-faixa":    "Percentual de comissão aplicado conforme o atingimento da meta. Quanto maior o atingimento, maior o percentual.",
  "comissao-acelerador": "Percentual extra aplicado sobre as vendas que excederem a meta. Incentiva quem já bateu a meta a continuar vendendo.",
  "comissao-redutor":  "Desconto aplicado à comissão em situações específicas configuradas pelo gestor.",
  "comissao-bonus-semanal": "Adicional sobre as vendas líquidas para cada semana em que a meta semanal foi atingida.",

  // Configurações
  "config-perfil-admin":       "Acesso completo: vê todos os vendedores, todas as empresas e todas as configurações.",
  "config-perfil-supervisor":  "Acesso restrito à sua equipe. Não acessa configurações nem dados de outros supervisores.",
  "config-perfil-vendedor":    "Acesso apenas aos próprios dados de venda e comissão.",
  "config-equipe":             "Grupo de vendedores associados a um supervisor específico.",
};
