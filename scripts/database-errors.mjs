/** Actionable errors without printing provider messages, URLs or credentials. */
export function databaseError(error) {
    const messages = {
        '28P01': 'Senha do banco incorreta. Confira DATABASE_URL e codifique caracteres especiais da senha.',
        '28000': 'Usuário ou projeto incorreto. Copie a URI completa de Connect no Supabase.',
        '3D000': 'Banco não encontrado. Use o nome de banco indicado na conexão do projeto.',
        '42P01': 'Tabelas ausentes. Execute supabase/setup.sql inteiro ou npm run db:migrate:postgres.',
        '42501': 'Permissão insuficiente. A conexão do servidor precisa ser a proprietária das tabelas ou ter BYPASSRLS.',
        '42P07': 'Há tabelas sem registro de migration. Não apague dados: confira o histórico antes de importar o esquema.',
        ENOTFOUND: 'Host não encontrado. Copie o host da URI em Connect; não use a URL https da API.',
        EAI_AGAIN: 'Falha temporária de DNS. Confira a rede e tente novamente.',
        ENETUNREACH: 'Rede inacessível. Use o pooler Session (5432) ou Transaction (6543), compatível com IPv4.',
        ECONNREFUSED: 'Conexão recusada. Confira se o projeto está ativo e a porta pertence ao pooler selecionado.',
        CONNECT_TIMEOUT: 'Tempo de conexão excedido. Confira o projeto, host, porta e restrições de rede.',
        DATABASE_TIMEOUT: 'A operação no banco excedeu o prazo. Confira os logs database_operation_failed e o estado do projeto Supabase.',
        '57014': 'O PostgreSQL cancelou uma consulta por timeout. Confira consultas bloqueadas e statement_timeout no Supabase.',
        CONNECTION_CLOSED: 'Conexão encerrada. Confira o estado do projeto e tente novamente.',
        '53300': 'Limite de conexões atingido. Use o Transaction pooler em DATABASE_URL.',
        SELF_SIGNED_CERT_IN_CHAIN: 'Configure DATABASE_CA_CERT com o certificado CA do projeto. A verificação TLS continua obrigatória.',
        DEPTH_ZERO_SELF_SIGNED_CERT: 'Configure DATABASE_CA_CERT com o certificado CA do projeto.',
        UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'Cadeia TLS incompleta. Configure DATABASE_CA_CERT com a CA do Supabase.',
    };
    return messages[error?.code] ?? 'Não foi possível concluir a conexão PostgreSQL. Confira as variáveis conforme docs/supabase.md.';
}
