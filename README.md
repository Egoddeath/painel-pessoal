# Minhas Pendências

Painel privado de pendências com login Supabase, cartões coloridos, busca instantânea e exclusão definitiva de tarefas concluídas (sem tabela de histórico).

## Estado

- GitHub: arquivos do site publicados neste repositório
- Supabase: banco `xnvznmskrkjpebmqbuca`, tabelas `mp_patients` e `mp_tasks`, políticas RLS ativas
- **Ainda é necessário habilitar o GitHub Pages e criar seu usuário em Authentication > Users.**
- Antes de usar dados reais de pacientes: realizar testes e análise institucional de LGPD.

## Publicação

1. Se seu plano GitHub for Free, torne este repositório **público** em Settings > General > Danger Zone > Change repository visibility. O código e a chave publicável podem ser públicos; não existem pendências no repositório.
2. Vá a Settings > Pages > Build and deployment. Source: Deploy from a branch. Branch: `main`; folder `/ (root)`; Save.
3. O endereço padrão é `https://egoddeath.github.io/painel-pessoal/`. Verifique a confirmação do GitHub antes de considerar que está publicado.
4. No Supabase, em Authentication > Users, crie o seu usuário com e-mail e senha forte. Desabilite inscrições públicas em Authentication > Providers / Sign In / Email, conforme o painel. Não compartilhe senhas.
5. Entre no site e teste **com pacientes fictícios** o cadastro, a busca, a edição e a exclusão. Recarregue em outro computador para confirmar sincronização.

## Segurança

O código do GitHub não contém nomes de pacientes. O banco exige autenticação e RLS por dono dos registros; `anon` não tem acesso às tabelas. Apenas chave publicável aparece no navegador; **nunca inclua uma chave secret/service_role**.
Uma pendência concluída é excluída por `mp_complete_task`, que também exclui o paciente quando não resta pendência. Não se criam registros históricos na aplicação. Backups e logs do provedor podem ter retenção própria.

Há outras tabelas já existentes nesse Supabase, que não foram alteradas.