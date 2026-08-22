"use client";

import {
  cloneElement,
  isValidElement,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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
  trigger: ReactElement<{ onClick?: () => void }>;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
};

export function Menu({ trigger, children, align = "right", className = "" }: MenuProps) {
  const [open, setOpen] = useState(false);
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
  }, [open]);

  const triggerElement = isValidElement(trigger)
    ? cloneElement(trigger, {
        onClick: () => {
          trigger.props.onClick?.();
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
                setOpen(false);
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
