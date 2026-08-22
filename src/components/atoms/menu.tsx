"use client";

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

// Panel width matches the `w-48` class below (12rem = 192px at the default
// root font size) — kept in sync manually since the portal's position is
// computed in JS, outside Tailwind's control.
const PANEL_WIDTH_PX = 192;

// Ref: dropdown pattern originally built for the topbar's avatar menu
// (src/app/[lang]/(staff)/topbar.tsx) — lifted here so any trigger + list of
// actions (row kebab menus, etc.) can reuse the same open/close/click-outside
// behavior instead of re-implementing it per component.
//
// The panel renders through a portal into document.body, positioned via the
// trigger's bounding rect, so it isn't clipped by an ancestor's
// `overflow-hidden` (e.g. a rounded table container). The trigger element
// itself gets the open/close handler cloned directly onto it — rather than
// wrapping it in a click-catching container — so a `disabled` trigger stays
// genuinely inert instead of a disabled-look-alike that still opens the menu
// (disabled buttons apply `pointer-events: none`, which would otherwise let
// the click fall through to a wrapping element's own handler).
export type MenuProps = {
  trigger: ReactElement<{ onClick?: (event: ReactMouseEvent<HTMLElement>) => void }>;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
  // false for a multi-select checklist panel (filter dropdowns), where a
  // single click should toggle one checkbox without dismissing the rest of
  // the selection. Defaults true so every existing one-shot-action consumer
  // (topbar avatar menu, PR row kebab menu) keeps today's close-on-click.
  closeOnContentClick?: boolean;
  // Controlled open state — for a consumer that needs to close the panel on
  // its own schedule (e.g. the date filter: immediately after picking a
  // preset, but only after both custom-range fields are filled), which
  // `closeOnContentClick`'s single all-or-nothing flag can't express. Omit
  // both to keep the existing fully-uncontrolled behavior.
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function Menu({
  trigger,
  children,
  align = "right",
  className = "",
  closeOnContentClick = true,
  open: controlledOpen,
  onOpenChange,
}: MenuProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const value = typeof next === "function" ? next(open) : next;
      if (!isControlled) setInternalOpen(value);
      onOpenChange?.(value);
    },
    [isControlled, open, onOpenChange],
  );
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + window.scrollY + 8,
      left:
        align === "right"
          ? rect.right + window.scrollX - PANEL_WIDTH_PX
          : rect.left + window.scrollX,
    });
  }, [open, align]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open, setOpen]);

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        // Forward the native event to the consumer's own onClick (not just
        // invoke it) — a consumer nesting <Menu> inside another clickable
        // element (a row kebab menu inside a clickable <tr>) needs the real
        // event to call stopPropagation() on. Calling it with no argument
        // silently breaks that: the consumer's handler throws trying to read
        // a property off `undefined`, which stops setOpen() from running
        // below without actually stopping the event's bubble.
        onClick: (event: ReactMouseEvent<HTMLElement>) => {
          trigger.props.onClick?.(event);
          setOpen((value) => !value);
        },
      })
    : trigger;

  return (
    <>
      <span ref={anchorRef} className={`inline-flex ${className}`}>
        {triggerElement}
      </span>

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              style={{ position: "absolute", top: position.top, left: position.left }}
              className="z-20 w-48 rounded-md border border-line bg-paper py-1.5 shadow-(--shadow-e2)"
              onClick={(event) => {
                // Stop here, not just close the menu: this panel is portaled
                // into document.body, but React bubbles synthetic events
                // through the *React* tree, not the DOM tree — since a
                // consumer can (and does, for row action menus) nest <Menu>
                // inside another element with its own onClick (e.g. a
                // clickable <tr>), an un-stopped click would also fire that
                // ancestor's handler right after the menu item's own.
                event.stopPropagation();
                if (closeOnContentClick) setOpen(false);
              }}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

export type MenuItemProps = {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  className?: string;
};

export function MenuItem({
  children,
  onClick,
  tone = "default",
  disabled = false,
  className = "",
}: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`block w-full px-3.5 py-2 text-left text-[13px] hover:bg-mist disabled:pointer-events-none disabled:opacity-40 ${
        tone === "danger" ? "text-rust" : "text-ink"
      } ${className}`}
    >
      {children}
    </button>
  );
}
