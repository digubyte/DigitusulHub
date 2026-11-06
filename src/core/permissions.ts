/**
 * Catálogo de permissões e papéis padrão.
 * Fonte única usada pelo seed (banco) e pelos testes. Em execução, as permissões
 * efetivas de cada papel são SEMPRE lidas do banco (RolePermission), permitindo
 * ajustes granulares sem alterar código.
 */
export const PERMISSIONS = {
  // Núcleo
  "hub.access": { module: "core", description: "Acessar a plataforma" },
  "users.manage": { module: "core", description: "Gerenciar usuários e perfis" },
  "modules.manage": { module: "core", description: "Configurar módulos e menu" },
  "integrations.manage": { module: "core", description: "Consultar e configurar integrações" },
  "audit.view": { module: "core", description: "Consultar histórico de atividades de todos" },
  "brandkit.manage": { module: "core", description: "Gerenciar o Brand Kit" },
  "metrics.team": { module: "core", description: "Ver indicadores da equipe" },
  // Estúdio de Flyers
  "flyers.access": { module: "flyers", description: "Acessar o Estúdio de Flyers" },
  "flyers.create": { module: "flyers", description: "Criar flyers" },
  "flyers.edit.own": { module: "flyers", description: "Editar os próprios flyers" },
  "flyers.edit.any": { module: "flyers", description: "Editar flyers de qualquer usuário" },
  "flyers.view.all": { module: "flyers", description: "Ver flyers de toda a equipe" },
  "flyers.delete.own": { module: "flyers", description: "Excluir os próprios flyers" },
  "flyers.delete.any": { module: "flyers", description: "Excluir flyers de qualquer usuário" },
  "flyers.templates.manage": { module: "flyers", description: "Publicar/remover templates salvos" },
  "flyers.ai.use": { module: "flyers", description: "Usar o assistente Criar com IA" },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as PermissionKey[];

export type RoleKey = "ADMIN" | "GESTOR" | "COLABORADOR";

export const DEFAULT_ROLES: Record<RoleKey, { name: string; description: string; permissions: PermissionKey[] }> = {
  ADMIN: {
    name: "Administrador",
    description: "Controle total da plataforma, usuários, módulos, Brand Kit e integrações.",
    permissions: ALL_PERMISSIONS,
  },
  GESTOR: {
    name: "Gestor",
    description: "Acesso aos módulos autorizados, projetos e indicadores da equipe.",
    permissions: [
      "hub.access", "metrics.team", "audit.view",
      "flyers.access", "flyers.create", "flyers.edit.own", "flyers.view.all",
      "flyers.delete.own", "flyers.templates.manage", "flyers.ai.use",
    ],
  },
  COLABORADOR: {
    name: "Colaborador",
    description: "Acesso somente às funcionalidades liberadas.",
    permissions: ["hub.access", "flyers.access", "flyers.create", "flyers.edit.own", "flyers.delete.own", "flyers.ai.use"],
  },
};

/** Regras de propriedade de recursos (aplicadas no backend). */
export function canViewFlyer(perms: ReadonlySet<string>, userId: string, ownerId: string, isTemplate = false) {
  if (!perms.has("flyers.access")) return false;
  return isTemplate || ownerId === userId || perms.has("flyers.view.all") || perms.has("flyers.edit.any");
}
export function canEditFlyer(perms: ReadonlySet<string>, userId: string, ownerId: string) {
  if (perms.has("flyers.edit.any")) return true;
  return ownerId === userId && perms.has("flyers.edit.own");
}
export function canDeleteFlyer(perms: ReadonlySet<string>, userId: string, ownerId: string) {
  if (perms.has("flyers.delete.any")) return true;
  return ownerId === userId && perms.has("flyers.delete.own");
}
