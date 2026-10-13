import type { Role } from "@/lib/auth";

// Re-exported from the backend API shape. The `id` field is a UUID string from
// the API, typed as `number` here for backward compatibility with components
// that were written before the API migration. String(project.id) is used when
// calling API endpoints.
export interface Project {
  id: number;
  name: string;
  description: string;
  status: "Active" | "Archived";
  envVariables: number;
  licenseKeys: number;
  adminCredentials: number;
  teamMembers: number;
  createdDate: string;
  createdBy: string;
  /** Account id of the user who created the project. */
  createdById?: string | number;
  /** Role of the user who created the project. */
  createdByRole?: Role;
  longDescription: string;
  password?: string;
}

// Empty — all data is loaded from the backend via ProjectsContext.
export const MOCK_PROJECTS: Project[] = [];
