-- Amigo Secreto — verificação de segurança ANTES de ativar o login anónimo.
-- Mostra as políticas de outras apps que dão acesso a qualquer utilizador autenticado
-- e os triggers em auth.users. Copia o resultado e envia-o.
select 'policy' as tipo, schemaname || '.' || tablename as onde, policyname as nome,
       array_to_string(roles, ',') as papeis, cmd, qual as usando, with_check
from pg_policies
where schemaname <> 'amigo_secreto'
  and roles && array['authenticated', 'public']::name[]
union all
select 'trigger auth.users', 'auth.users', tgname, null, null,
       pg_get_triggerdef(t.oid), null
from pg_trigger t
where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
order by 1, 2;
