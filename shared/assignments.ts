import type { Project, User } from "./model.js";
export function defaultReviewer(
  ownerId: string,
  projectId: string | null,
  users: User[],
  projects: Project[],
) {
  const owner = users.find((u) => u.id === ownerId && u.active);
  if (!owner) return "";
  if (owner.roles.includes("leader")) return owner.id;
  const project = projects.find((p) => p.id === projectId);
  return project && project.managerId !== owner.id
    ? project.managerId
    : (users.find((u) => u.active && u.roles.includes("leader"))?.id ?? "");
}
