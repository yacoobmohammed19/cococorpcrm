-- Coco AI: selectable personas/agents + persistent multi-conversation history.

-- Personas ("agents") — each is a named system prompt the user can switch between.
create table if not exists coco_agents (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  system_prompt text not null default '',
  is_default boolean not null default false,
  sort int not null default 0,
  created_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_coco_agents_org on coco_agents (org_id);

-- Conversations (threads), one active persona each, scoped to a user.
create table if not exists coco_conversations (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  agent_id bigint references coco_agents(id) on delete set null,
  title text not null default 'New chat',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);
create index if not exists idx_coco_conversations_org_user on coco_conversations (org_id, user_id, updated_at desc);

-- Messages within a conversation.
create table if not exists coco_messages (
  id bigserial primary key,
  org_id uuid not null references organizations(id) on delete cascade,
  conversation_id bigint not null references coco_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz default now()
);
create index if not exists idx_coco_messages_conv on coco_messages (conversation_id, created_at);

-- RLS (mirror fact_bank_transactions: read all roles, write member+)
do $$
declare t text;
begin
  foreach t in array array['coco_agents','coco_conversations','coco_messages'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %I_select on %I', t, t);
    execute format('drop policy if exists %I_insert on %I', t, t);
    execute format('drop policy if exists %I_update on %I', t, t);
    execute format('drop policy if exists %I_delete on %I', t, t);
    execute format($f$create policy %I_select on %I for select using (has_org_role(org_id, array['owner','admin','member','viewer']))$f$, t, t);
    execute format($f$create policy %I_insert on %I for insert with check (has_org_role(org_id, array['owner','admin','member']))$f$, t, t);
    execute format($f$create policy %I_update on %I for update using (has_org_role(org_id, array['owner','admin','member'])) with check (has_org_role(org_id, array['owner','admin','member']))$f$, t, t);
    execute format($f$create policy %I_delete on %I for delete using (has_org_role(org_id, array['owner','admin','member']))$f$, t, t);
  end loop;
end $$;

-- Seed default personas for existing orgs.
insert into coco_agents (org_id, name, description, system_prompt, is_default, sort)
select o.id, 'General Admin', 'All-round business assistant', '', true, 0
from organizations o
where not exists (select 1 from coco_agents a where a.org_id = o.id and a.name = 'General Admin');

insert into coco_agents (org_id, name, description, system_prompt, is_default, sort)
select o.id, 'SARS Expert',
  'South African tax & annual financial statements specialist',
  'You are Coco in SARS Expert mode — a South African tax and accounting specialist. Focus on IFRS-for-SMEs financial statements, the ITR14 company return, VAT, provisional tax, and SARS compliance. Explain the accounting treatment and cite the relevant SARS rule of thumb (e.g. Section 18A donations capped at 10% of taxable income, 27% company tax rate). Be precise about what belongs in the income statement vs balance sheet vs tax computation. When unsure, say so and recommend a registered tax practitioner.',
  false, 1
from organizations o
where not exists (select 1 from coco_agents a where a.org_id = o.id and a.name = 'SARS Expert');

-- Audit personas + conversations (messages are high-volume, left unaudited).
drop trigger if exists trg_audit_coco_agents on coco_agents;
create trigger trg_audit_coco_agents after insert or update or delete on coco_agents for each row execute function audit_trigger();
drop trigger if exists trg_audit_coco_conversations on coco_conversations;
create trigger trg_audit_coco_conversations after insert or update or delete on coco_conversations for each row execute function audit_trigger();
