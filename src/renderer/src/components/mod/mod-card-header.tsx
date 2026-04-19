import { Button } from "@renderer/components/ui/button";
import { useConfirmTrash } from "@renderer/hooks/use-confirm-trash";
import type { ModInfo } from "@renderer/types/mod";
import { useRouteContext } from "@tanstack/react-router";
import { FolderIcon, TerminalSquareIcon, TrashIcon } from "lucide-react";
import { memo, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";

interface ModCardHeaderProps {
  mod: ModInfo;
  selectedGroupPath?: string;
}

export const ModCardHeader = memo(function ModCardHeader({
  mod,
  selectedGroupPath,
}: ModCardHeaderProps) {
  const { t } = useTranslation();
  const { queryClient } = useRouteContext({ from: "__root__" });
  const { confirmTrash, confirmTrashDialog } = useConfirmTrash();

  const handleDelete = (e: MouseEvent) => {
    e.stopPropagation();
    confirmTrash({
      path: mod.path,
      title: t("page.mod.dialog.delete-mod.title"),
      description: t("page.mod.dialog.delete-mod.description"),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["modGroup", selectedGroupPath] });
      },
      contentProps: {
        onClick: (event) => event.stopPropagation(),
      },
    });
  };

  return (
    <div className="flex items-center justify-between pb-1 relative z-10">
      <span className="text-sm truncate font-semibold">
        {mod.name.replace(/disabled/gi, "").trim()}
      </span>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 hover:bg-accent/20"
          onClick={(e) => {
            e.stopPropagation();
            window.api.invoke("util:openCmd", mod.path);
          }}
        >
          <TerminalSquareIcon />
        </Button>

        <Button variant="ghost" size="icon" className="size-7 hover:bg-accent/20" onClick={handleDelete}>
          <TrashIcon />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="size-7 hover:bg-accent/20"
          onClick={(e) => {
            e.stopPropagation();
            window.api.invoke("util:openPath", mod.path);
          }}
        >
          <FolderIcon />
        </Button>
      </div>
      {confirmTrashDialog}
    </div>
  );
});
