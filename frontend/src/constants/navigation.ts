import type { Page } from "../types";
import type { IconName } from "../components/common/Icon";

export const menuItems: { label: Page; icon: IconName }[] = [
  { label: "Dashboard", icon: "home" },
  { label: "Knowledge Base", icon: "database" },
  { label: "Classroom", icon: "classroom" },
  { label: "Chat", icon: "chat" },
  { label: "Quiz", icon: "quiz" },
  { label: "Settings", icon: "settings" },
];