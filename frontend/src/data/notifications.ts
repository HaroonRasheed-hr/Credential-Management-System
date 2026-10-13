import {
  KeyRound,
  FileLock,
  ShieldCheck,
  Users,
  UserPlus,
  FolderKanban,
} from "lucide-react";

export type NotificationModule =
  | "Project"
  | "Env Variables"
  | "License Keys"
  | "Admin Credentials"
  | "App Users"
  | "Team";

export const MODULE_CONFIG: Record<
  NotificationModule,
  {
    icon: React.ComponentType<{ size?: number; className?: string }>;
    bg: string;
  }
> = {
  Project: { icon: FolderKanban, bg: "linear-gradient(135deg, #57C8E7 0%, #3E5FAA 100%)" },
  "Env Variables": { icon: KeyRound, bg: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)" },
  "License Keys": { icon: FileLock, bg: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)" },
  "Admin Credentials": { icon: ShieldCheck, bg: "linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)" },
  "App Users": { icon: Users, bg: "linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)" },
  Team: { icon: UserPlus, bg: "linear-gradient(135deg, #ec4899 0%, #be185d 100%)" },
};
