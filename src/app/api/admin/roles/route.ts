import { db } from "@/core/db";
import { apiRoute, jsonOk } from "@/core/http";

export const GET = apiRoute({ permission: "users.manage" }, async () => {
  const [roles, permissions] = await Promise.all([
    db.role.findMany({ include: { permissions: { include: { permission: true } }, _count: { select: { users: true } } }, orderBy: { name: "asc" } }),
    db.permission.findMany({ orderBy: [{ module: "asc" }, { key: "asc" }] }),
  ]);
  return jsonOk({
    roles: roles.map((r) => ({ id: r.id, key: r.key, name: r.name, description: r.description, users: r._count.users, permissions: r.permissions.map((p) => p.permission.key) })),
    permissions: permissions.map((p) => ({ key: p.key, module: p.module, description: p.description })),
  });
});
