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
  });

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
});
