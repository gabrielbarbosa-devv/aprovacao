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
});
