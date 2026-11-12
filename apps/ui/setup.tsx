import React, { useEffect, useRef } from "react";
import screens from "./generated/screens.json";
import type { Persona, Template } from "../../packages/domain/model";
type Props = {
  page: "new-project" | "new-room";
  projectId: string;
  invoke: (method: string, input?: unknown) => Promise<any>;
  onProject: (id: string) => void;
  onRoom: (id: string) => void;
  back: () => void;
};
/** Bind real controls to the original FigCraft source without re-laying out the screen. */
export function Setup({
  page,
  projectId,
  invoke,
  onProject,
  onRoom,
  back,
}: Props) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = root.current!;
    let name = "",
      folder = "",
      goal = "",
      constraints = "";
    let template: Template = "build_review";
    let builder: Persona = "sonnet";
    let reviewers: Persona[] = ["claude"];
    const input = (
      node: Element | null,
      label: string,
      change: (value: string) => void,
      multiline = false,
    ) => {
      if (!node) return;
      const control = document.createElement(multiline ? "textarea" : "input");
      control.className = node.className;
      control.setAttribute("style", node.getAttribute("style") || "");
      control.style.width = "100%";
      control.setAttribute("aria-label", label);
      control.addEventListener("input", () => change(control.value));
      node.replaceWith(control);
    };
    if (page === "new-project") {
      input(el.querySelector(".card.s15"), "Project name", (v) => (name = v));
      input(
        el.querySelector(".card.s14"),
        "Project goal",
        (v) => (goal = v),
        true,
      );
      const folderNode = el.querySelector(".mono.s13");
      if (folderNode) folderNode.textContent = "Choose a folder";
      for (const n of el.querySelectorAll(".row.g6.s12"))
        if (n.textContent?.includes("Git repository"))
          n.textContent = "Folder validation runs when you continue";
      const constraintsNode = [...el.querySelectorAll(".s13.dim")].find(
        (n) => n.textContent === "Constraints",
      )?.nextElementSibling;
      if (constraintsNode) {
        constraintsNode.innerHTML = "";
        const control = document.createElement("input");
        control.className = "chip";
        control.style.width = "100%";
        control.setAttribute("aria-label", "Constraints");
        control.placeholder = "Add constraint";
        control.oninput = () => (constraints = control.value);
        constraintsNode.append(control);
      }
      el.querySelectorAll(".btn").forEach((node) =>
        node.addEventListener("click", async () => {
          const label = node.textContent || "";
          if (label.includes("Choose")) {
            const selected = await window.walt.folder();
            if (selected) {
              folder = selected;
              if (folderNode) folderNode.textContent = folder;
            }
          } else if (label.includes("Continue")) {
            const p = await invoke("project", {
              name,
              root: folder,
              goal,
              constraints,
            });
            if (p) onProject(p.id);
          } else if (label.includes("Back")) back();
        }),
      );
    } else {
      const labels: Record<string, Template> = {
        "Build & Review": "build_review",
        Triad: "triad",
        Roundtable: "roundtable",
      };
      const cards = [
        ...el.querySelectorAll<HTMLElement>(".row.g12 > .card.f1"),
      ].filter((n) =>
        Object.keys(labels).some((k) => n.textContent?.includes(k)),
      );
      for (const card of cards) {
        const title = Object.keys(labels).find((k) =>
          card.textContent?.includes(k),
        )!;
        card.style.cursor = "pointer";
        card.style.borderColor =
          title === "Build & Review" ? "#30C759" : "#323234";
        card.style.background =
          title === "Build & Review" ? "#1E2A22" : "#232325";
        card.onclick = () => {
          template = labels[title];
          for (const c of cards) {
            c.style.borderColor = c === card ? "#30C759" : "#323234";
            c.style.background = c === card ? "#1E2A22" : "#232325";
          }
        };
      }
      const rows = [...el.querySelectorAll<HTMLElement>(".row")].filter(
        (n) =>
          n.style.padding === "9px 16px" && n.querySelector("span.row.g10"),
      );
      const personas: Persona[] = ["codex", "claude", "sonnet", "gemini"];
      rows.forEach((row, index) => {
        const cell = row.children[1];
        if (!cell) return;
        const select = document.createElement("select");
        select.style.cssText = "font-size:13px;padding:4px 9px;width:150px";
        for (const value of ["Builder", "Reviewer", "Free"]) {
          const option = document.createElement("option");
          option.textContent = value;
          option.selected =
            personas[index] === builder
              ? value === "Builder"
              : reviewers.includes(personas[index])
                ? value === "Reviewer"
                : value === "Free";
          select.append(option);
        }
        cell.replaceChildren(select);
        select.onchange = () => {
          const selections = rows.map(
            (r) =>
              (r.children[1]?.querySelector("select") as HTMLSelectElement)
                ?.value,
          );
          const i = selections.indexOf("Builder");
          if (i >= 0) builder = personas[i];
          reviewers = personas.filter((_, i) => selections[i] === "Reviewer");
        };
        const model = row.children[2];
        if (model)
          model.textContent =
            personas[index] === "claude"
              ? "opus"
              : personas[index] === "sonnet"
                ? "sonnet"
                : "Default";
      });
      for (const n of el.querySelectorAll("span"))
        if (n.textContent === "Engine") n.textContent = "Role";
      el.querySelectorAll(".btn").forEach((node) =>
        node.addEventListener("click", async () => {
          if (node.textContent?.includes("Create room")) {
            const r = await invoke("room", {
              projectId,
              title: "Main",
              template,
              builder,
              reviewers,
            });
            if (r) onRoom(r.id);
          } else if (node.textContent?.includes("Back")) back();
        }),
      );
    }
    el.querySelectorAll(".wctl span").forEach((node, i) =>
      node.addEventListener("click", () =>
        window.walt.window(["minimize", "maximize", "close"][i]),
      ),
    );
  }, [page, projectId]);
  return (
    <div
      ref={root}
      style={{ height: "100%" }}
      dangerouslySetInnerHTML={{
        __html: (screens as Record<string, { html: string }>)[
          page === "new-project" ? "w03-project" : "w04-team"
        ].html,
      }}
    />
  );
}
