import * as React from "react";

import { XIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { Button } from "@/components/ui/button";
import { useOverlayPortalContainer } from "@/hooks/useOverlayPortalContainer";
import { cn } from "@/lib/utils";

const DialogModalContext = React.createContext(false);

function Dialog({
  modal = false,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return (
    <DialogModalContext.Provider value={modal}>
      <DialogPrimitive.Root data-slot="dialog" modal={modal} {...props} />
    </DialogModalContext.Provider>
  );
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  position = "fixed",
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay> & {
  /** `absolute` when the dialog is portaled inside a positioned panel (e.g. extension overlay). */
  position?: "fixed" | "absolute";
}) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(
        "inset-0 z-50 bg-black/50 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0",
        position === "absolute" ? "absolute" : "fixed",
        className,
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  container: containerProp,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /**
   * Portal target. When omitted, defaults to the extension overlay host when available
   * (see `useOverlayPortalContainer`); otherwise Radix portals to `document.body`.
   * When set, overlay + content use `absolute` positioning within that element.
   */
  container?: HTMLElement | null;
}) {
  const modal = React.useContext(DialogModalContext);
  const defaultOverlayContainer = useOverlayPortalContainer();
  const container =
    containerProp !== undefined ? containerProp : defaultOverlayContainer;
  const contained = Boolean(container);
  return (
    <DialogPortal container={container ?? undefined}>
      {modal ? (
        <DialogOverlay position={contained ? "absolute" : "fixed"} />
      ) : (
        <div
          data-slot="dialog-overlay"
          aria-hidden="true"
          className={cn(
            "inset-0 z-50 bg-black/50",
            contained ? "absolute" : "fixed",
          )}
        />
      )}
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(
          "z-50 grid w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 sm:max-w-lg",
          contained
            ? // Cap to the content area (panel minus the two w-10 tab columns minus a
              // 1rem margin) so dialogs centered over the content can't overflow the
              // panel's right edge on narrow viewports (where sm:max-w-lg is inactive).
              "absolute top-[50%] left-[50%] max-w-[calc(100%-var(--spacing)*10*2-2rem)]"
            : "fixed top-[50%] left-[50%] max-w-[calc(100%-2rem)]",
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            className="absolute top-4 right-4 opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center", className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex gap-2 flex-row justify-center", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Close</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
