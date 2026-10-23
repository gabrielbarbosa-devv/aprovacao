import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";

const userA = "11111111-1111-4111-8111-111111111111";
const userB = "22222222-2222-4222-8222-222222222222";
const db = new PGlite();

async function rows<T extends Record<string, unknown>>(sql: string): Promise<T[]> {
  return (await db.query<T>(sql)).rows;
}

async function expectSqlFailure(sql: string): Promise<void> {
  await expect(db.exec(sql)).rejects.toThrow();
}

describe("To-Do additive schema and RLS", () => {
  beforeAll(async () => {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
      insert into auth.users values ('${userA}'), ('${userB}');
    `);
    const migration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022164746_add_todo_module_backend.sql"), "utf8");
    await db.exec(migration);
    const transferMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022193448_todo_list_atomic_transfer.sql"), "utf8");
    await db.exec(transferMigration);
    const workspaceDeleteMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022200431_delete_todo_workspace_with_task_policy.sql"), "utf8");
    await db.exec(workspaceDeleteMigration);
    const taskBundleMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022201502_save_todo_task_bundle.sql"), "utf8");
    await db.exec(taskBundleMigration);
    const detailsBundleMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022202836_todo_task_details_bundle.sql"), "utf8");
    await db.exec(detailsBundleMigration);
    const manualOrderMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022215335_todo_task_manual_order.sql"), "utf8");
    await db.exec(manualOrderMigration);
    const optimisticLockMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022221254_todo_task_details_optimistic_lock.sql"), "utf8");
    await db.exec(optimisticLockMigration);
    const lifecycleMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022225011_todo_task_lifecycle.sql"), "utf8");
    await db.exec(lifecycleMigration);
    const lifecycleSaveFixMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022225400_fix_todo_task_details_lifecycle_save.sql"), "utf8");
    await db.exec(lifecycleSaveFixMigration);
    const recurrenceMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261022233028_todo_recurrence_system.sql"), "utf8");
    await db.exec(recurrenceMigration);
    const recurrenceCalendarFix = await readFile(resolve(process.cwd(), "supabase/migrations/20261022233727_fix_todo_recurrence_completion_calendar.sql"), "utf8");
    await db.exec(recurrenceCalendarFix);
    const weeklyReviewMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261023000852_todo_weekly_review.sql"), "utf8");
    await db.exec(weeklyReviewMigration);
    const weeklyReviewReservationsMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261023002009_todo_weekly_review_reservations.sql"), "utf8");
    await db.exec(weeklyReviewReservationsMigration);
    const weeklyReviewDraftsMigration = await readFile(resolve(process.cwd(), "supabase/migrations/20261023003238_todo_weekly_review_drafts.sql"), "utf8");
    await db.exec(weeklyReviewDraftsMigration);
    await db.exec("create table public.user_settings(user_id uuid primary key, timezone text); grant select on public.user_settings to authenticated;");
  }, 30000);

  afterAll(async () => { await db.close(); });

  it("bootstraps safely and isolates every relationship across two users", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated; select * from public.initialize_todo_lists(); select * from public.initialize_todo_lists();`);
    const listsA = await rows<{ slug: string }>(`select slug from public.todo_lists where user_id='${userA}' order by slug`);
    expect(listsA.map((item) => item.slug)).toEqual(["pessoal", "trabalho"]);

    await db.exec(`insert into public.todo_workspaces(user_id,name) values ('${userA}','Projeto A');`);
    const listA = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    const workspaceA = (await rows<{ id: string }>(`select id from public.todo_workspaces where user_id='${userA}'`))[0].id;
    await db.exec(`
      insert into public.todo_tasks(user_id,list_id,workspace_id,title,priority,due_on)
      values ('${userA}','${listA}','${workspaceA}','Tarefa A','high',current_date+2);
      insert into public.todo_subtasks(user_id,task_id,title)
      select '${userA}',id,'Primeira etapa' from public.todo_tasks where user_id='${userA}';
      insert into public.todo_labels(user_id,name,color) values ('${userA}','Urgente','rose');
      insert into public.todo_task_labels(user_id,task_id,label_id)
      select '${userA}',t.id,l.id from public.todo_tasks t cross join public.todo_labels l where t.user_id='${userA}' and l.user_id='${userA}';
      update public.todo_tasks set status='done',completed_at=now() where user_id='${userA}';
      update public.todo_tasks set status='todo',completed_at=null,due_on=current_date+3 where user_id='${userA}';
      reset role;
    `);
    const taskA = (await rows<{ id: string }>(`select id from public.todo_tasks where user_id='${userA}'`))[0].id;
    const labelA = (await rows<{ id: string }>(`select id from public.todo_labels where user_id='${userA}'`))[0].id;

    await db.exec(`set request.jwt.claim.sub='${userB}'; set role authenticated; select * from public.initialize_todo_lists(); insert into public.todo_workspaces(user_id,name) values ('${userB}','Projeto B'); insert into public.todo_labels(user_id,name) values ('${userB}','Pessoal B');`);
    const listB = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userB}' and slug='pessoal'`))[0].id;
    const workspaceB = (await rows<{ id: string }>(`select id from public.todo_workspaces where user_id='${userB}'`))[0].id;
    await db.exec(`insert into public.todo_tasks(user_id,list_id,workspace_id,title) values ('${userB}','${listB}','${workspaceB}','Tarefa B'); reset role;`);
    const taskB = (await rows<{ id: string }>(`select id from public.todo_tasks where user_id='${userB}'`))[0].id;
    const labelB = (await rows<{ id: string }>(`select id from public.todo_labels where user_id='${userB}'`))[0]?.id;

    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    expect(await rows<{ id: string }>(`select id from public.todo_tasks`)).toEqual([{ id: taskA }]);
    expect(await rows<{ id: string }>(`select id from public.todo_subtasks`)).toHaveLength(1);
    expect(await rows<{ task_id: string }>(`select task_id from public.todo_task_labels`)).toHaveLength(1);
    const actions = await rows<{ action: string }>(`select action from public.todo_activity_logs where task_id='${taskA}'`);
    expect(actions).toHaveLength(3);
    expect(actions.map((item) => item.action)).toEqual(expect.arrayContaining(["created", "completed", "reopened"]));
    expect(await rows<{ id: string }>(`update public.todo_tasks set title='Tentativa de A' where id='${taskB}' returning id`)).toHaveLength(0);
    expect(await rows<{ id: string }>(`delete from public.todo_tasks where id='${taskB}' returning id`)).toHaveLength(0);
    await expectSqlFailure(`insert into public.todo_tasks(user_id,list_id,workspace_id,title) values ('${userA}','${listB}','${workspaceB}','Referência cruzada')`);
    await expectSqlFailure(`insert into public.todo_subtasks(user_id,task_id,title) values ('${userA}','${taskB}','Referência cruzada')`);
    await expectSqlFailure(`insert into public.todo_task_labels(user_id,task_id,label_id) values ('${userA}','${taskA}','${labelB ?? labelA}')`);
    await db.exec("reset role");

    await db.exec("set role anon");
    await expectSqlFailure("select * from public.todo_tasks");
    await db.exec("reset role");

    const persisted = await rows<{ priority: string; due_on: string; status: string }>(`select priority,due_on,status from public.todo_tasks where id='${taskA}'`);
    expect(persisted[0]).toMatchObject({ priority: "high", status: "todo" });
    expect(persisted[0].due_on).not.toBeNull();
    expect((await rows<{ id: string }>(`select id from public.todo_tasks where user_id='${userB}'`))).toHaveLength(1);

    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated; update public.todo_tasks set status='done', completed_at=now() where id='${taskA}'; reset role;`);
    const completedAgain = (await rows<{ status: string; completed_at: string | null }>(`select status,completed_at from public.todo_tasks where id='${taskA}'`))[0];
    expect(completedAgain).toMatchObject({ status: "done" });
    expect(completedAgain.completed_at).not.toBeNull();
    const completionHistory = await rows<{ action: string }>(`select action from public.todo_activity_logs where task_id='${taskA}' and action in ('completed','reopened') order by created_at, action`);
    expect(completionHistory.filter((item) => item.action === "completed")).toHaveLength(2);
    expect(completionHistory.filter((item) => item.action === "reopened")).toHaveLength(1);
  });

  it("transfers active and soft-deleted tasks atomically before deleting a list", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const source = (await rows<{ id: string }>(`insert into public.todo_lists(user_id,name,slug) values ('${userA}','Temporária','temporaria') returning id`))[0].id;
    const target = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='trabalho'`))[0].id;
    const foreignTarget = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userB}' and slug='pessoal'`))[0]?.id;
    await db.exec(`insert into public.todo_tasks(user_id,list_id,title) values ('${userA}','${source}','Ativa'),('${userA}','${source}','Removida'); update public.todo_tasks set deleted_at=now() where user_id='${userA}' and title='Removida';`);

    await expectSqlFailure(`select public.delete_todo_list_with_transfer('${source}', null)`);
    expect(await rows<{ id: string }>(`select id from public.todo_lists where id='${source}'`)).toHaveLength(1);
    expect(await rows<{ list_id: string }>(`select list_id from public.todo_tasks where list_id='${source}'`)).toHaveLength(2);
    if (foreignTarget) await expectSqlFailure(`select public.delete_todo_list_with_transfer('${source}', '${foreignTarget}')`);

    const moved = await rows<{ delete_todo_list_with_transfer: number }>(`select public.delete_todo_list_with_transfer('${source}', '${target}')`);
    expect(moved[0].delete_todo_list_with_transfer).toBe(2);
    expect(await rows<{ id: string }>(`select id from public.todo_lists where id='${source}'`)).toHaveLength(0);
    expect(await rows<{ list_id: string; deleted_at: string | null }>(`select list_id,deleted_at from public.todo_tasks where user_id='${userA}' and title in ('Ativa','Removida')`)).toEqual(expect.arrayContaining([
      expect.objectContaining({ list_id: target, deleted_at: null }),
      expect.objectContaining({ list_id: target }),
    ]));
    await db.exec("reset role");
  });

  it("requires an owned workspace and an explicit task policy when deleting it", async () => {
    const listA = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated; insert into public.todo_workspaces(user_id,name) values ('${userA}','Manter tarefas');`);
    const keepWorkspace = (await rows<{ id: string }>(`select id from public.todo_workspaces where user_id='${userA}' and name='Manter tarefas'`))[0].id;
    await db.exec(`insert into public.todo_tasks(user_id,list_id,workspace_id,title) values ('${userA}','${listA}','${keepWorkspace}','Ativa para manter'),('${userA}','${listA}','${keepWorkspace}','Histórico removido'); update public.todo_tasks set deleted_at=now() where title='Histórico removido';`);
    const keepCount = await rows<{ delete_todo_workspace_with_task_policy: number }>(`select public.delete_todo_workspace_with_task_policy('${keepWorkspace}','keep_tasks')`);
    expect(keepCount[0].delete_todo_workspace_with_task_policy).toBe(2);
    const keptTasks = await rows<{ title: string; workspace_id: string | null; deleted_at: string | null }>(`select title,workspace_id,deleted_at from public.todo_tasks where title in ('Ativa para manter','Histórico removido') order by title`);
    expect(keptTasks).toHaveLength(2);
    expect(keptTasks[0]).toMatchObject({ title: "Ativa para manter", workspace_id: null, deleted_at: null });
    expect(keptTasks[1]).toMatchObject({ title: "Histórico removido", workspace_id: null });
    expect(keptTasks[1].deleted_at).not.toBeNull();
    expect(await rows<{ id: string }>(`select id from public.todo_workspaces where id='${keepWorkspace}'`)).toHaveLength(0);
    await db.exec("reset role");

    await db.exec(`set request.jwt.claim.sub='${userB}'; set role authenticated; insert into public.todo_tasks(user_id,list_id,workspace_id,title) values ('${userB}','${(await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userB}' and slug='pessoal'`))[0].id}','${(await rows<{ id: string }>(`select id from public.todo_workspaces where user_id='${userB}'`))[0].id}','Excluir teste');`);
    const workspaceB = (await rows<{ id: string }>(`select id from public.todo_workspaces where user_id='${userB}'`))[0].id;
    await expectSqlFailure(`select public.delete_todo_workspace_with_task_policy('${workspaceB}','invalid')`);
    await db.exec(`select public.delete_todo_workspace_with_task_policy('${workspaceB}','soft_delete_tasks')`);
    const deletedTasks = await rows<{ workspace_id: string | null; deleted_at: string | null }>(`select workspace_id,deleted_at from public.todo_tasks where user_id='${userB}' and title='Excluir teste'`);
    expect(deletedTasks).toHaveLength(1);
    expect(deletedTasks[0].workspace_id).toBeNull();
    expect(deletedTasks[0].deleted_at).not.toBeNull();
    await expectSqlFailure(`select public.delete_todo_workspace_with_task_policy('${keepWorkspace}','keep_tasks')`);
    await db.exec("reset role");
  });

  it("saves a task with labels and ordered subtasks atomically and rejects cross-user relations", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    const workspaceId = (await rows<{ id: string }>(`insert into public.todo_workspaces(user_id,name) values ('${userA}','Bundle') returning id`))[0].id;
    const existingLabelId = (await rows<{ id: string }>(`insert into public.todo_labels(user_id,name) values ('${userA}','Existente') returning id`))[0].id;
    const newTaskId = (await rows<{ save_todo_task_bundle: string }>(`select public.save_todo_task_bundle(null,'${listId}','${workspaceId}','Tarefa bundle','Descrição','high',current_date,current_date+1,null,array['${existingLabelId}'::uuid],array['Nova etiqueta'],'[{"title":"Etapa um","is_completed":true},{"title":"Etapa dois","is_completed":false}]'::jsonb)`))[0].save_todo_task_bundle;
    expect(await rows<{ title: string; priority: string; workspace_id: string }>(`select title,priority,workspace_id from public.todo_tasks where id='${newTaskId}'`)).toEqual([{ title: "Tarefa bundle", priority: "high", workspace_id: workspaceId }]);
    expect(await rows<{ title: string; is_completed: boolean; position: number }>(`select title,is_completed,position from public.todo_subtasks where task_id='${newTaskId}' order by position`)).toEqual([
      { title: "Etapa um", is_completed: true, position: 0 },
      { title: "Etapa dois", is_completed: false, position: 1 },
    ]);
    expect(await rows<{ name: string }>(`select l.name from public.todo_labels l join public.todo_task_labels tl on tl.label_id=l.id where tl.task_id='${newTaskId}' order by l.name`)).toEqual([{ name: "Existente" }, { name: "Nova etiqueta" }]);

    await expectSqlFailure(`select public.save_todo_task_bundle(null,'${listId}',null,'Não deve persistir',null,'low',current_date,null,null,array[]::uuid[],array[]::text[],'[{"title":""}]'::jsonb)`);
    expect(await rows<{ id: string }>(`select id from public.todo_tasks where user_id='${userA}' and title='Não deve persistir'`)).toHaveLength(0);

    const updatedSubtaskId = (await rows<{ id: string }>(`select id from public.todo_subtasks where task_id='${newTaskId}' and title='Etapa um'`))[0].id;
    await db.exec(`select public.save_todo_task_bundle('${newTaskId}','${listId}','${workspaceId}','Tarefa editada',null,'medium',current_date,current_date+2,null,array[]::uuid[],array[]::text[],'[{"id":"${updatedSubtaskId}","title":"Etapa renomeada","is_completed":false}]'::jsonb);`);
    expect(await rows<{ title: string }>(`select title from public.todo_subtasks where task_id='${newTaskId}'`)).toEqual([{ title: "Etapa renomeada" }]);
    expect(await rows<{ task_id: string }>(`select task_id from public.todo_task_labels where task_id='${newTaskId}'`)).toHaveLength(0);

    await db.exec(`set request.jwt.claim.sub='${userB}';`);
    await expectSqlFailure(`select public.save_todo_task_bundle('${newTaskId}','${listId}',null,'Tentativa cruzada',null,'low',current_date,null,null,array[]::uuid[],array[]::text[],'[]'::jsonb)`);
    await db.exec("reset role");
    expect(await rows<{ title: string }>(`select title from public.todo_tasks where id='${newTaskId}'`)).toEqual([{ title: "Tarefa editada" }]);
  });

  it("saves task details and status atomically and records real subtask additions", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    const taskId = (await rows<{ id: string }>(`insert into public.todo_tasks(user_id,list_id,title) values ('${userA}','${listId}','Detalhes atômicos') returning id`))[0].id;
    const completedId = (await rows<{ save_todo_task_details_bundle: string }>(`select public.save_todo_task_details_bundle('${taskId}','${listId}',null,'Detalhes atualizados','Anotações','high',current_date,current_date+1,null,array[]::uuid[],array[]::text[],'[{"title":"Subtarefa real","is_completed":false}]'::jsonb,'done')`))[0].save_todo_task_details_bundle;
    expect(completedId).toBe(taskId);
    expect(await rows<{ title: string; status: string; completed_at: string | null }>(`select title,status,completed_at from public.todo_tasks where id='${taskId}'`)).toMatchObject([{ title: "Detalhes atualizados", status: "done" }]);
    expect((await rows<{ completed_at: string | null }>(`select completed_at from public.todo_tasks where id='${taskId}'`))[0].completed_at).not.toBeNull();
    expect(await rows<{ action: string; metadata: { entity?: string; change?: string } }>(`select action,metadata from public.todo_activity_logs where task_id='${taskId}' and metadata->>'entity'='subtask'`)).toEqual([{ action: "updated", metadata: { entity: "subtask", change: "added", title: "Subtarefa real" } }]);
    await expectSqlFailure(`select public.save_todo_task_details_bundle('${taskId}','${listId}',null,'Não salvar',null,'low',current_date,null,null,array[]::uuid[],array[]::text[],'[{"title":""}]'::jsonb,'todo')`);
    expect(await rows<{ title: string; status: string }>(`select title,status from public.todo_tasks where id='${taskId}'`)).toEqual([{ title: "Detalhes atualizados", status: "done" }]);
    await db.exec(`select public.save_todo_task_details_bundle('${taskId}','${listId}',null,'Detalhes atualizados','Anotações','high',current_date,current_date+1,null,array[]::uuid[],array[]::text[],'[{"id":"${(await rows<{ id: string }>(`select id from public.todo_subtasks where task_id='${taskId}'`))[0].id}","title":"Subtarefa real","is_completed":true}]'::jsonb,'todo'); reset role;`);
    expect(await rows<{ status: string; completed_at: string | null }>(`select status,completed_at from public.todo_tasks where id='${taskId}'`)).toEqual([{ status: "todo", completed_at: null }]);
  });

  it("reorders tasks atomically within their list and keeps pending tasks before completed ones", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`insert into public.todo_lists(user_id,name,slug) values ('${userA}','Ordenação','ordenacao') returning id`))[0].id;
    await db.exec(`insert into public.todo_tasks(user_id,list_id,title,position) values
      ('${userA}','${listId}','A',0),('${userA}','${listId}','B',1),('${userA}','${listId}','C',2),('${userA}','${listId}','D',3),('${userA}','${listId}','E',4),('${userA}','${listId}','Concluída',5);
      update public.todo_tasks set status='done',completed_at=now() where list_id='${listId}' and title='Concluída';`);
    const taskIds = await rows<{ id: string; title: string }>(`select id,title from public.todo_tasks where list_id='${listId}' and title <> 'Concluída' order by title`);
    const byTitle = Object.fromEntries(taskIds.map((item) => [item.title, item.id]));
    await db.exec(`select * from public.reorder_todo_task_positions('${listId}','pending',array['${byTitle.E}','${byTitle.A}','${byTitle.B}','${byTitle.C}','${byTitle.D}']::uuid[]);`);
    expect(await rows<{ title: string; status: string; position: number }>(`select title,status,position from public.todo_tasks where list_id='${listId}' order by position`)).toEqual([
      { title: "E", status: "todo", position: 0 }, { title: "A", status: "todo", position: 1 }, { title: "B", status: "todo", position: 2 }, { title: "C", status: "todo", position: 3 }, { title: "D", status: "todo", position: 4 }, { title: "Concluída", status: "done", position: 5 },
    ]);
    await db.exec(`select * from public.reorder_todo_task_positions('${listId}','pending',array['${byTitle.E}','${byTitle.B}','${byTitle.A}','${byTitle.C}','${byTitle.D}']::uuid[]);`);
    expect((await rows<{ title: string }>(`select title from public.todo_tasks where list_id='${listId}' and deleted_at is null order by position`)).map((item) => item.title)).toEqual(["E", "B", "A", "C", "D", "Concluída"]);
    await expectSqlFailure(`select * from public.reorder_todo_task_positions('${listId}','pending',array['${byTitle.E}','${byTitle.B}','${byTitle.A}','${byTitle.C}','${byTitle.D}','${(await rows<{ id: string }>(`select id from public.todo_tasks where list_id='${listId}' and title='Concluída'`))[0].id}]::uuid[]);`);
    await db.exec(`set request.jwt.claim.sub='${userB}';`);
    await expectSqlFailure(`select * from public.reorder_todo_task_positions('${listId}','pending',array['${byTitle.E}','${byTitle.B}','${byTitle.A}','${byTitle.C}','${byTitle.D}']::uuid[]);`);
    await db.exec("reset role");
  });

  it("rejects stale task detail saves and accepts the current task version", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    const taskId = (await rows<{ id: string; updated_at: string }>(`insert into public.todo_tasks(user_id,list_id,title) values ('${userA}','${listId}','Edição concorrente') returning id,updated_at`))[0];
    await db.exec(`update public.todo_tasks set updated_at=updated_at + interval '1 second' where id='${taskId.id}';`);
    const call = (expectedUpdatedAt: string | Date, newTitle: string) => `select public.save_todo_task_details_if_unchanged('${taskId.id}','${listId}',null,'${newTitle}',null,'medium',current_date,null,null,array[]::uuid[],array[]::text[],'[]'::jsonb,'todo','${new Date(expectedUpdatedAt).toISOString()}'::timestamptz);`;
    await expectSqlFailure(call(taskId.updated_at, "Rascunho desatualizado"));
    expect(await rows<{ title: string }>(`select title from public.todo_tasks where id='${taskId.id}'`)).toEqual([{ title: "Edição concorrente" }]);
    const currentUpdatedAt = (await rows<{ updated_at: string }>(`select updated_at from public.todo_tasks where id='${taskId.id}'`))[0].updated_at;
    await db.exec(call(currentUpdatedAt, "Versão atualizada"));
    expect(await rows<{ title: string }>(`select title from public.todo_tasks where id='${taskId.id}'`)).toEqual([{ title: "Versão atualizada" }]);
    const labelId = (await rows<{ id: string }>(`insert into public.todo_labels(user_id,name) values ('${userA}','Persistida') returning id`))[0].id;
    const latestUpdatedAt = (await rows<{ updated_at: string }>(`select updated_at from public.todo_tasks where id='${taskId.id}'`))[0].updated_at;
    await db.exec(`select public.save_todo_task_details_if_unchanged('${taskId.id}','${listId}',null,'Com etiqueta',null,'medium',current_date,null,null,array['${labelId}']::uuid[],array[]::text[],'[]'::jsonb,'todo','${new Date(latestUpdatedAt).toISOString()}'::timestamptz);`);
    expect(await rows<{ label_id: string }>(`select label_id from public.todo_task_labels where task_id='${taskId.id}'`)).toEqual([{ label_id: labelId }]);
    await db.exec("reset role");
  });

  it("archives, restores, trashes, restores again, and permanently removes owned task relations", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    const taskId = (await rows<{ id: string }>(`insert into public.todo_tasks(user_id,list_id,title) values ('${userA}','${listId}','Ciclo de vida') returning id`))[0].id;
    await db.exec(`insert into public.todo_subtasks(user_id,task_id,title) values ('${userA}','${taskId}','Subtarefa relacionada');
      insert into public.todo_labels(user_id,name) values ('${userA}','Ciclo');
      insert into public.todo_task_labels(user_id,task_id,label_id) select '${userA}','${taskId}',id from public.todo_labels where user_id='${userA}' and name='Ciclo';
      update public.todo_tasks set archived_at=now() where id='${taskId}' and user_id='${userA}';`);
    expect(await rows<{ count: number }>(`select count(*)::int as count from public.todo_tasks where id='${taskId}' and deleted_at is null and archived_at is null`)).toEqual([{ count: 0 }]);
    expect(await rows<{ action: string }>(`select action from public.todo_activity_logs where task_id='${taskId}' order by created_at desc limit 1`)).toEqual([{ action: "archived" }]);

    await db.exec(`update public.todo_tasks set archived_at=null where id='${taskId}' and user_id='${userA}'; update public.todo_tasks set deleted_at=now() where id='${taskId}' and user_id='${userA}';`);
    expect(await rows<{ count: number }>(`select count(*)::int as count from public.todo_tasks where id='${taskId}' and deleted_at is not null`)).toEqual([{ count: 1 }]);
    await db.exec(`set request.jwt.claim.sub='${userB}';`);
    expect(await rows<{ count: number }>(`select count(*)::int as count from public.todo_tasks where id='${taskId}'`)).toEqual([{ count: 0 }]);
    await db.exec(`update public.todo_tasks set deleted_at=null where id='${taskId}';`);
    expect(await rows<{ deleted_at: string | null }>(`select deleted_at from public.todo_tasks where id='${taskId}'`)).toEqual([]);
    await db.exec(`delete from public.todo_tasks where id='${taskId}';`);

    await db.exec(`set request.jwt.claim.sub='${userA}'; update public.todo_tasks set deleted_at=null,archived_at=null where id='${taskId}' and user_id='${userA}'; update public.todo_tasks set deleted_at=now() where id='${taskId}' and user_id='${userA}';`);
    await db.exec(`delete from public.todo_tasks where id='${taskId}' and user_id='${userA}' and deleted_at is not null`);
    expect(await rows<{ subtasks: number; links: number; activity: number; tasks: number }>(`select (select count(*)::int from public.todo_subtasks where task_id='${taskId}') as subtasks, (select count(*)::int from public.todo_task_labels where task_id='${taskId}') as links, (select count(*)::int from public.todo_activity_logs where task_id='${taskId}') as activity, (select count(*)::int from public.todo_tasks where id='${taskId}') as tasks`)).toEqual([{ subtasks: 0, links: 0, activity: 0, tasks: 0 }]);
    await db.exec("reset role");
  });

  it("materializes planned recurrence idempotently and creates a fresh subtask copy", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    const taskId = (await rows<{ save_todo_task_with_recurrence: string }>(`select public.save_todo_task_with_recurrence(null,'${listId}',null,'Beber água',null,'low',(now() at time zone 'UTC')::date,(now() at time zone 'UTC')::date,null,array[]::uuid[],array[]::text[],'[{"title":"Encher a garrafa","is_completed":true}]'::jsonb,jsonb_build_object('frequency','daily','interval',1,'weekdays','[]'::jsonb,'monthlyMode','day','monthDay',22,'monthWeek','first','monthWeekday',1,'annualMonth',1,'annualDay',1,'customUnit','week','startsOn',((now() at time zone 'UTC')::date)::text,'timeOfDay','09:00','endsOn',null,'maxOccurrences',null,'timezone','UTC','scheduleBasis','planned'))`))[0].save_todo_task_with_recurrence;
    await db.exec(`select public.ensure_todo_recurrence_occurrences(10); select public.ensure_todo_recurrence_occurrences(10);`);
    expect(await rows<{ count: number }>(`select count(*)::int as count from public.todo_tasks where recurrence_rule_id=(select recurrence_rule_id from public.todo_tasks where id='${taskId}')`)).toEqual([{ count: 11 }]);
    expect(await rows<{ count: number }>(`select count(*)::int as count from public.todo_subtasks s join public.todo_tasks t on t.id=s.task_id where t.recurrence_rule_id=(select recurrence_rule_id from public.todo_tasks where id='${taskId}') and s.title='Encher a garrafa' and s.is_completed=false`)).toEqual([{ count: 10 }]);
    const ruleId = (await rows<{ recurrence_rule_id: string }>(`select recurrence_rule_id from public.todo_tasks where id='${taskId}'`))[0].recurrence_rule_id;
    await db.exec(`set request.jwt.claim.sub='${userB}';`);
    expect(await rows<{ id: string }>(`select id from public.todo_recurrence_rules where id='${ruleId}'`)).toHaveLength(0);
    await expectSqlFailure(`select public.set_todo_recurrence_state('${ruleId}','paused')`);
    await db.exec("reset role");
  });

  it("advances completion-based schedules only after an occurrence is completed", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='trabalho'`))[0].id;
    const taskId = (await rows<{ save_todo_task_with_recurrence: string }>(`select public.save_todo_task_with_recurrence(null,'${listId}',null,'Organizar semana',null,'medium',current_date,current_date,null,array[]::uuid[],array[]::text[],'[]'::jsonb,jsonb_build_object('frequency','weekly','interval',2,'weekdays','[]'::jsonb,'monthlyMode','day','monthDay',1,'monthWeek','first','monthWeekday',1,'annualMonth',1,'annualDay',1,'customUnit','week','startsOn',current_date::text,'timeOfDay',null,'endsOn',null,'maxOccurrences',5,'timezone','UTC','scheduleBasis','completion'))`))[0].save_todo_task_with_recurrence;
    const ruleId = (await rows<{ recurrence_rule_id: string }>(`select recurrence_rule_id from public.todo_tasks where id='${taskId}'`))[0].recurrence_rule_id;
    expect((await rows<{ next_occurrence_on: string | null }>(`select next_occurrence_on from public.todo_recurrence_rules where id='${ruleId}'`))[0].next_occurrence_on).toBeNull();
    await db.exec(`update public.todo_tasks set status='done',completed_at=now() where id='${taskId}';`);
    expect((await rows<{ next_occurrence_on: string | null }>(`select next_occurrence_on from public.todo_recurrence_rules where id='${ruleId}'`))[0].next_occurrence_on).not.toBeNull();
    await db.exec("reset role");
  });

  it("skips invalid completion-based month and leap-day dates instead of clamping them", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    const monthlyTaskId = (await rows<{ id: string }>(`select public.save_todo_task_with_recurrence(null,'${listId}',null,'Dia 31',null,'medium',date '2026-01-31',date '2026-01-31',null,array[]::uuid[],array[]::text[],'[]'::jsonb,jsonb_build_object('frequency','monthly','interval',1,'weekdays','[]'::jsonb,'monthlyMode','day','monthDay',31,'monthWeek','first','monthWeekday',1,'annualMonth',1,'annualDay',1,'customUnit','week','startsOn','2026-01-31','timeOfDay',null,'endsOn',null,'maxOccurrences',null,'timezone','UTC','scheduleBasis','completion')) as id`))[0].id;
    const monthlyRule = (await rows<{ recurrence_rule_id: string }>(`select recurrence_rule_id from public.todo_tasks where id='${monthlyTaskId}'`))[0].recurrence_rule_id;
    await db.exec(`update public.todo_tasks set status='done',completed_at='2026-01-31T12:00:00Z' where id='${monthlyTaskId}';`);
    expect(new Date((await rows<{ next_occurrence_on: string }>(`select next_occurrence_on from public.todo_recurrence_rules where id='${monthlyRule}'`))[0].next_occurrence_on).toISOString().slice(0, 10)).toBe("2026-03-31");

    const annualTaskId = (await rows<{ id: string }>(`select public.save_todo_task_with_recurrence(null,'${listId}',null,'Dia bissexto',null,'medium',date '2025-03-15',date '2025-03-15',null,array[]::uuid[],array[]::text[],'[]'::jsonb,jsonb_build_object('frequency','yearly','interval',1,'weekdays','[]'::jsonb,'monthlyMode','day','monthDay',1,'monthWeek','first','monthWeekday',1,'annualMonth',2,'annualDay',29,'customUnit','week','startsOn','2025-03-15','timeOfDay',null,'endsOn',null,'maxOccurrences',null,'timezone','UTC','scheduleBasis','completion')) as id`))[0].id;
    const annualRule = (await rows<{ recurrence_rule_id: string }>(`select recurrence_rule_id from public.todo_tasks where id='${annualTaskId}'`))[0].recurrence_rule_id;
    await db.exec(`update public.todo_tasks set status='done',completed_at='2025-03-15T12:00:00Z' where id='${annualTaskId}';`);
    expect(new Date((await rows<{ next_occurrence_on: string }>(`select next_occurrence_on from public.todo_recurrence_rules where id='${annualRule}'`))[0].next_occurrence_on).toISOString().slice(0, 10)).toBe("2028-02-29");
    await db.exec("reset role");
  });

  it("keeps occurrence edits isolated and refreshes future snapshots for a series edit", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    const config = (frequency: string) => `jsonb_build_object('frequency','${frequency}','interval',1,'weekdays','[]'::jsonb,'monthlyMode','day','monthDay',10,'monthWeek','first','monthWeekday',1,'annualMonth',3,'annualDay',15,'customUnit','week','startsOn',((now() at time zone 'UTC')::date)::text,'timeOfDay',null,'endsOn',null,'maxOccurrences',null,'timezone','UTC','scheduleBasis','planned')`;
    const utcToday = "(now() at time zone 'UTC')::date";
    const taskId = (await rows<{ id: string }>(`select public.save_todo_task_with_recurrence(null,'${listId}',null,'Regra editável',null,'medium',${utcToday},${utcToday},null,array[]::uuid[],array[]::text[],'[]'::jsonb,${config("daily")}) as id`))[0].id;
    await db.exec(`select public.ensure_todo_recurrence_occurrences(4);`);
    const ruleId = (await rows<{ recurrence_rule_id: string }>(`select recurrence_rule_id from public.todo_tasks where id='${taskId}'`))[0].recurrence_rule_id;
    await db.exec(`select public.save_todo_task_details_with_recurrence_if_unchanged('${taskId}','${listId}',null,'Só esta ocorrência',null,'high',${utcToday},${utcToday},null,array[]::uuid[],array[]::text[],'[]'::jsonb,'todo',(select updated_at from public.todo_tasks where id='${taskId}'),${config("weekly")},'occurrence');`);
    expect((await rows<{ frequency: string }>(`select frequency from public.todo_recurrence_rules where id='${ruleId}'`))[0].frequency).toBe("daily");
    await db.exec(`select public.save_todo_task_details_with_recurrence_if_unchanged('${taskId}','${listId}',null,'Toda a série',null,'high',${utcToday},${utcToday},null,array[]::uuid[],array[]::text[],'[]'::jsonb,'todo',(select updated_at from public.todo_tasks where id='${taskId}'),${config("weekly")},'series');`);
    expect((await rows<{ frequency: string }>(`select frequency from public.todo_recurrence_rules where id='${ruleId}'`))[0].frequency).toBe("weekly");
    expect(await rows<{ count: number }>(`select count(*)::int as count from public.todo_tasks where user_id='${userA}' and title='Regra editável' and archived_at is not null`)).toEqual([{ count: 4 }]);
    await db.exec("reset role");
  });

  it("persists a weekly review, converts captures idempotently, and scopes data by owner", async () => {
    await db.exec(`set request.jwt.claim.sub='${userA}'; set role authenticated;`);
    await db.exec(`select * from public.initialize_todo_lists();`);
    const listId = (await rows<{ id: string }>(`select id from public.todo_lists where user_id='${userA}' and slug='pessoal'`))[0].id;
    await db.exec(`select public.save_todo_weekly_capture_draft(date '2099-10-19','Ligar para o dentista','Agendar horário');`);
    expect(await rows<{ capture_draft_title: string; capture_draft_notes: string }>(`select capture_draft_title,capture_draft_notes from public.todo_weekly_reviews where user_id='${userA}' and week_start=date '2099-10-19'`)).toEqual([{ capture_draft_title: "Ligar para o dentista", capture_draft_notes: "Agendar horário" }]);
    const captureId = (await rows<{ id: string }>(`select public.create_todo_weekly_capture(date '2099-10-19','Ligar para o dentista','Agendar horário') as id`))[0].id;
    expect(await rows<{ capture_draft_title: string }>(`select capture_draft_title from public.todo_weekly_reviews where user_id='${userA}' and week_start=date '2099-10-19'`)).toEqual([{ capture_draft_title: "" }]);
    const taskId = (await rows<{ convert_todo_weekly_capture_to_task: string }>(`select public.convert_todo_weekly_capture_to_task('${captureId}','${listId}',date '2099-10-26')`))[0].convert_todo_weekly_capture_to_task;
    const repeatedTaskId = (await rows<{ convert_todo_weekly_capture_to_task: string }>(`select public.convert_todo_weekly_capture_to_task('${captureId}','${listId}',date '2099-10-26')`))[0].convert_todo_weekly_capture_to_task;
    expect(repeatedTaskId).toBe(taskId);
    expect(await rows<{ count: number }>(`select count(*)::int as count from public.todo_tasks where id='${taskId}'`)).toEqual([{ count: 1 }]);

    await db.exec(`select public.save_todo_weekly_review(date '2099-10-19',4::smallint,'Foco em descanso e entregas',jsonb_build_array(jsonb_build_object('taskId','${taskId}','position',1,'whyImportant','Saúde','plannedOn','2099-10-27','plannedTime','09:30')));`);
    expect(await rows<{ week_start: string; current_step: number; notes: string }>(`select week_start::text,current_step,notes from public.todo_weekly_reviews where user_id='${userA}' and week_start=date '2099-10-19'`)).toEqual([{ week_start: "2099-10-19", current_step: 4, notes: "Foco em descanso e entregas" }]);
    expect(await rows<{ position: number; planned_on: string; why_important: string }>(`select position,planned_on::text,why_important from public.todo_weekly_review_priorities where task_id='${taskId}'`)).toEqual([{ position: 1, planned_on: "2099-10-27", why_important: "Saúde" }]);
    expect(await rows<{ due_on: string; due_at: string | null }>(`select due_on::text,due_at::text from public.todo_tasks where id='${taskId}'`)).toMatchObject([{ due_on: "2099-10-27", due_at: expect.any(String) }]);
    await db.exec(`select public.set_todo_weekly_review_reservation(date '2099-10-19',date '2099-10-28',true);`);
    expect(await rows<{ planned_on: string }>(`select planned_on::text from public.todo_weekly_review_reservations where review_id=(select id from public.todo_weekly_reviews where user_id='${userA}' and week_start=date '2099-10-19')`)).toEqual([{ planned_on: "2099-10-28" }]);

    await db.exec(`set request.jwt.claim.sub='${userB}';`);
    expect(await rows<{ id: string }>(`select id from public.todo_weekly_reviews where week_start=date '2099-10-19'`)).toHaveLength(0);
    expect(await rows<{ id: string }>(`select id from public.todo_weekly_review_captures where id='${captureId}'`)).toHaveLength(0);
    expect(await rows<{ planned_on: string }>(`select planned_on::text from public.todo_weekly_review_reservations`)).toHaveLength(0);
    await expectSqlFailure(`select public.convert_todo_weekly_capture_to_task('${captureId}','${listId}',null)`);
    await db.exec("reset role");
  });
});
