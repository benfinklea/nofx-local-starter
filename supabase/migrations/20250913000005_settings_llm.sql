alter table nofx.settings add column if not exists llm jsonb not null default '{}'::jsonb;
update nofx.settings set llm = '{
  "order": {
    "codegen": ["openai","anthropic","gemini"],
    "reasoning": ["anthropic","openai","gemini"],
    "docs": ["gemini","anthropic","openai"]
  }
}'::jsonb
where id='default' and (llm = '{}'::jsonb or llm is null);
