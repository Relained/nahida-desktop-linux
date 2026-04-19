import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@renderer/components/ui/alert-dialog";
import { Button } from "@renderer/components/ui/button";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@renderer/components/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@renderer/components/ui/dialog";
import { Input } from "@renderer/components/ui/input";
import { useConfirmTrash } from "@renderer/hooks/use-confirm-trash";
import { useModMutations } from "@renderer/hooks/use-mod-mutations";
import type { ModInfo } from "@renderer/types/mod";
import { useRouteContext } from "@tanstack/react-router";
import {
  ClipboardIcon,
  FolderIcon,
  ImageIcon,
  PencilIcon,
  TerminalSquareIcon,
  TrashIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { hasModPreviewFile } from "./paste-preview";

interface ModContextMenuProps {
  mod: ModInfo;
  selectedGroupPath?: string;
  onPaste?: () => void | Promise<void>;
  children: ReactNode;
}

const DISABLED_PREFIX_REGEX = /^disabled\s+/i;

const getRenameDefaultValue = (name: string) => name.replace(DISABLED_PREFIX_REGEX, "").trim();

export function ModContextMenu({
  mod,
  selectedGroupPath,
  onPaste,
  children,
}: ModContextMenuProps) {
  const { t } = useTranslation();
  const { queryClient } = useRouteContext({ from: "__root__" });
  const { renameModMutation } = useModMutations();
  const { confirmTrash, confirmTrashDialog } = useConfirmTrash();

  const [showPasteConfirmDialog, setShowPasteConfirmDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState(getRenameDefaultValue(mod.name));
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showRenameDialog) return;
    setRenameValue(getRenameDefaultValue(mod.name));
    queueMicrotask(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
  }, [mod.name, showRenameDialog]);

  const invalidateModGroup = async () => {
    await queryClient.invalidateQueries({ queryKey: ["modGroup", selectedGroupPath] });
  };

  const handleDelete = () => {
    confirmTrash({
      path: mod.path,
      title: t("page.mod.dialog.delete-mod.title"),
      description: t("page.mod.dialog.delete-mod.description"),
      onSuccess: async () => {
        await invalidateModGroup();
      },
    });
  };

  const handleDeletePreview = () => {
    if (!mod.preview) return;
    confirmTrash({
      path: mod.preview,
      title: t("page.mod.dialog.delete-preview.title"),
      description: t("page.mod.dialog.delete-preview.description", { name: mod.name }),
      onSuccess: async () => {
        await invalidateModGroup();
      },
    });
  };

  const handlePaste = () => {
    void onPaste?.();
  };

  const handlePasteClick = () => {
    if (!onPaste) return;

    if (hasModPreviewFile(mod.path, mod.preview)) {
      setShowPasteConfirmDialog(true);
      return;
    }

    handlePaste();
  };

  const handleRenameSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextName = renameValue.trim();

    if (!nextName) {
      toast.error(t("page.mod.hooks.use-mod-mutations.rename-mutation.2"));
      return;
    }

    try {
      await renameModMutation.mutateAsync({ mod, newName: nextName });
      setShowRenameDialog(false);
    } catch {
      return;
    }
  };

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          {(mod.preview?.match(/\.(jpeg|jpg|gif|png|webp|bmp|mp4|webm|ogg)$/i) || onPaste) && (
            <>
              {mod.preview?.match(/\.(jpeg|jpg|gif|png|webp|bmp|mp4|webm|ogg)$/i) && (
                <ContextMenuItem
                  onClick={() => {
                    if (!mod.preview) return;

                    window.api.invoke("util:openExternal", mod.preview).catch((error) => {
                      toast.error("Failed to open external", {
                        description: error.message,
                      });
                    });
                  }}
                >
                  <ImageIcon className="mr-2 size-4" />
                  {t("page.mod.context-menu.open-preview-viewer")}
                </ContextMenuItem>
              )}
              {onPaste && (
                <ContextMenuItem onClick={handlePasteClick}>
                  <ClipboardIcon className="mr-2 size-4" />
                  {t("page.mod.context-menu.paste-preview")}
                </ContextMenuItem>
              )}
              {mod.preview && (
                <ContextMenuItem variant="destructive" onClick={handleDeletePreview}>
                  <TrashIcon className="mr-2 size-4" />
                  {t("page.mod.context-menu.delete-preview")}
                </ContextMenuItem>
              )}
              <ContextMenuSeparator />
            </>
          )}
          <ContextMenuItem
            onClick={() => {
              window.api.invoke("util:openCmd", mod.path);
            }}
          >
            <TerminalSquareIcon className="mr-2 size-4" />
            {t("page.mod.context-menu.open-cmd")}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              window.api.invoke("util:openPath", mod.path);
            }}
          >
            <FolderIcon className="mr-2 size-4" />
            {t("page.mod.context-menu.open-folder")}
          </ContextMenuItem>
          <ContextMenuItem onClick={() => setShowRenameDialog(true)}>
            <PencilIcon className="mr-2 size-4" />
            {t("page.mod.context-menu.rename")}
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" onClick={handleDelete}>
            <TrashIcon className="mr-2 size-4" />
            {t("g.delete")}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <AlertDialog open={showPasteConfirmDialog} onOpenChange={setShowPasteConfirmDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("page.mod.dialog.overwrite-preview.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("page.mod.dialog.overwrite-preview.description", { name: mod.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("g.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handlePaste}>
              {t("page.mod.dialog.overwrite-preview.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent aria-describedby={undefined} onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>{t("page.mod.dialog.rename-mod.title")}</DialogTitle>
            <DialogDescription>{t("page.mod.dialog.rename-mod.description")}</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={handleRenameSubmit}>
            <Input
              ref={renameInputRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder={t("page.mod.dialog.rename-mod.name-placeholder")}
              maxLength={255}
              disabled={renameModMutation.isPending}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowRenameDialog(false)}
                disabled={renameModMutation.isPending}
              >
                {t("g.cancel")}
              </Button>
              <Button type="submit" disabled={renameModMutation.isPending}>
                {t("page.mod.dialog.rename-mod.confirm")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {confirmTrashDialog}
    </>
  );
}
