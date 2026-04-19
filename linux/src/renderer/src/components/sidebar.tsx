import { cn } from "@renderer/lib/utils";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { GamepadIcon, SettingsIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "./ui/tooltip";

export function Sidebar({ className }: { className?: string }) {
  const navi = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
  };

  const iconSize = "size-7";
  const pathname = location.pathname;
  const isModPage = pathname.startsWith("/mod");
  const isSettingPage = pathname.startsWith("/setting");
  const getNavButtonClassName = (isActive: boolean) =>
    cn("relative overflow-visible", isActive && "text-accent hover:text-accent");

  return (
    <div className={`flex w-13 flex-col border-r ${className}`}>
      <div className="w-full flex flex-col h-full select-none">
        <div className="flex flex-col overflow-y-auto overflow-x-hidden dragselect-start-allowed p-2 space-y-2">
          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className={getNavButtonClassName(isModPage)}
                aria-current={isModPage ? "page" : undefined}
                onPointerDown={handlePointerDown}
                onClick={() => navi({ to: "/mod" })}
              >
                <GamepadIcon className={cn(iconSize)} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" hideWhenDetached>
              {t("page.mod.title")}
            </TooltipContent>
          </Tooltip>

          <Separator orientation="horizontal" />

          <Tooltip disableHoverableContent>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-lg"
                className={getNavButtonClassName(isSettingPage)}
                aria-current={isSettingPage ? "page" : undefined}
                onPointerDown={handlePointerDown}
                onClick={() => navi({ to: "/setting/gen" })}
              >
                <SettingsIcon className={cn(iconSize)} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" hideWhenDetached>
              {t("page.setting.title")}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
