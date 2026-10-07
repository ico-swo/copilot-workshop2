/**
 * Modal form engine. Builds a dialog from field descriptors, submits it, and
 * maps the server's `error.details` back onto the matching inputs. The server
 * is the only source of validation truth; this file never duplicates a rule.
 *
 * Every label, option and message is written with textContent. Nothing is
 * ever assigned to innerHTML.
 */

import { ApiError } from "/api-client.js";

const overlay = document.getElementById("modal-overlay");

export function element(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "dataset") Object.assign(node.dataset, value);
    else if (key.startsWith("on")) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key.includes("-")) node.setAttribute(key, value);
    else if (value !== undefined && value !== null && value !== false) node[key] = value;
  }
  for (const child of children) if (child) node.append(child);
  return node;
}

export function closeModal() {
  overlay.replaceChildren();
  overlay.hidden = true;
  document.body.classList.remove("modal-open");
}

function openModal(node) {
  overlay.replaceChildren(node);
  overlay.hidden = false;
  document.body.classList.add("modal-open");
  node.querySelector("input, select, textarea, button")?.focus();
}

overlay.addEventListener("click", (event) => {
  if (event.target === overlay) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !overlay.hidden) closeModal();
});

function buildField(field, value) {
  const id = `field-${field.name}`;
  const wrapper = element("div", { class: `field${field.wide ? " field-wide" : ""}` });
  wrapper.append(element("label", { htmlFor: id, text: field.label }));

  let input;
  switch (field.type) {
    case "select":
      input = element("select", { id, name: field.name });
      if (field.allowEmpty) input.append(element("option", { value: "", text: field.emptyLabel ?? "— none —" }));
      for (const option of field.options) input.append(element("option", { value: option.value, text: option.label }));
      input.value = value ?? "";
      break;
    case "textarea":
      input = element("textarea", { id, name: field.name, rows: field.rows ?? 3 });
      input.value = value ?? "";
      break;
    case "checkbox":
      input = element("input", { id, name: field.name, type: "checkbox" });
      input.checked = value ?? field.default ?? false;
      wrapper.classList.add("field-checkbox");
      break;
    case "number":
      input = element("input", { id, name: field.name, type: "number", step: "1" });
      if (field.min !== undefined) input.min = String(field.min);
      if (field.max !== undefined) input.max = String(field.max);
      input.value = value ?? "";
      break;
    default:
      input = element("input", { id, name: field.name, type: field.type ?? "text" });
      input.value = value ?? "";
  }

  if (field.readonly) {
    input.disabled = true;
    wrapper.classList.add("field-readonly");
  }
  if (field.placeholder) input.placeholder = field.placeholder;

  wrapper.append(input);
  if (field.hint) wrapper.append(element("p", { class: "field-hint", text: field.hint }));
  wrapper.append(element("p", { class: "field-error", dataset: { for: field.name } }));
  return wrapper;
}

function readValue(form, field) {
  const input = form.elements[field.name];
  if (!input) return undefined;
  if (field.type === "checkbox") return input.checked;

  const raw = input.value.trim();
  if (raw === "") return field.nullable ? null : undefined;
  if (field.type === "number") {
    const parsed = Number.parseInt(raw, 10);
    return Number.isNaN(parsed) ? raw : parsed;
  }
  return raw;
}

function clearErrors(form) {
  for (const node of form.querySelectorAll(".field-error")) node.textContent = "";
  for (const node of form.querySelectorAll(".field")) node.classList.remove("has-error");
  const banner = form.querySelector(".form-banner");
  banner.hidden = true;
  banner.textContent = "";
}

/** Places each server-reported problem next to its input; the rest go to the banner. */
function applyErrors(form, error) {
  const banner = form.querySelector(".form-banner");
  const unmatched = [];

  for (const [field, reason] of Object.entries(error.details ?? {})) {
    const target = form.querySelector(`.field-error[data-for="${CSS.escape(field)}"]`);
    if (target) {
      target.textContent = reason;
      target.closest(".field")?.classList.add("has-error");
    } else {
      unmatched.push(`${field} ${reason}`);
    }
  }

  const hint = error.status === 412 ? "Someone else changed this record. Close the form and open it again." : null;
  banner.textContent = [error.message, hint, ...unmatched].filter(Boolean).join(" · ");
  banner.hidden = false;
}

/** Opens a modal form. `onSubmit` receives the payload and may throw ApiError. */
export function openForm(spec) {
  const form = element("form", { class: "modal-form", noValidate: true });
  const submitLabel = spec.submitLabel ?? "Save";

  const header = element("header", { class: "modal-header" }, [
    element("h2", { text: spec.title }),
    element("button", { type: "button", class: "icon-button", text: "✕", title: "Close", onClick: closeModal }),
  ]);

  const grid = element("div", { class: "field-grid" });
  for (const field of spec.fields) grid.append(buildField(field, spec.values?.[field.name]));

  const submit = element("button", { type: "submit", class: "button primary", text: submitLabel });
  const body = element("div", { class: "modal-body" }, [element("p", { class: "form-banner", hidden: true })]);
  if (spec.extra) body.append(spec.extra(form));
  body.append(grid);

  form.append(
    header,
    body,
    element("footer", { class: "modal-footer" }, [
      element("button", { type: "button", class: "button", text: "Cancel", onClick: closeModal }),
      submit,
    ]),
  );

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearErrors(form);
    submit.disabled = true;
    submit.textContent = "Saving…";

    try {
      const payload = {};
      for (const field of spec.fields) {
        if (field.omit) continue;
        const value = readValue(form, field);
        if (value !== undefined) payload[field.name] = value;
      }
      const result = await spec.onSubmit(payload, form);
      closeModal();
      spec.onSuccess?.(result);
    } catch (error) {
      if (error instanceof ApiError) {
        applyErrors(form, error);
      } else {
        const banner = form.querySelector(".form-banner");
        banner.textContent = error.message;
        banner.hidden = false;
      }
    } finally {
      submit.disabled = false;
      submit.textContent = submitLabel;
    }
  });

  openModal(element("div", { class: "modal" }, [form]));
  return form;
}

export function confirmAction({ title, message, confirmLabel = "Confirm", danger = false, onConfirm }) {
  const banner = element("p", { class: "form-banner", hidden: true });
  const button = element("button", {
    type: "button",
    class: `button ${danger ? "danger" : "primary"}`,
    text: confirmLabel,
    onClick: async () => {
      button.disabled = true;
      button.textContent = "Working…";
      try {
        await onConfirm();
        closeModal();
      } catch (error) {
        const details = error instanceof ApiError ? Object.entries(error.details ?? {}).map(([k, v]) => `${k} ${v}`) : [];
        banner.textContent = [error.message, ...details].join(" · ");
        banner.hidden = false;
        button.disabled = false;
        button.textContent = confirmLabel;
      }
    },
  });

  openModal(
    element("div", { class: "modal modal-narrow" }, [
      element("header", { class: "modal-header" }, [
        element("h2", { text: title }),
        element("button", { type: "button", class: "icon-button", text: "✕", onClick: closeModal }),
      ]),
      element("div", { class: "modal-body" }, [banner, element("p", { class: "confirm-message", text: message })]),
      element("footer", { class: "modal-footer" }, [
        element("button", { type: "button", class: "button", text: "Cancel", onClick: closeModal }),
        button,
      ]),
    ]),
  );
}

export function openDrawer({ title, subtitle, sections, actions = [] }) {
  const body = element("div", { class: "modal-body" });
  for (const section of sections) if (section) body.append(section);

  const footer = element("footer", { class: "modal-footer modal-footer-spread" });
  for (const action of actions) {
    if (!action) continue;
    footer.append(
      element("button", {
        type: "button",
        class: `button ${action.variant ?? ""}`,
        text: action.label,
        onClick: action.onClick,
        disabled: action.disabled ?? false,
        title: action.title ?? "",
      }),
    );
  }

  openModal(
    element("div", { class: "modal modal-wide" }, [
      element("header", { class: "modal-header" }, [
        element("div", {}, [
          element("h2", { text: title }),
          subtitle ? element("p", { class: "modal-subtitle", text: subtitle }) : null,
        ]),
        element("button", { type: "button", class: "icon-button", text: "✕", onClick: closeModal }),
      ]),
      body,
      footer,
    ]),
  );
}

export function definitionList(entries) {
  const list = element("dl", { class: "definition-list" });
  for (const [term, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    list.append(element("dt", { text: term }), element("dd", { text: String(value) }));
  }
  return list;
}

export function sectionTitle(text) {
  return element("h3", { class: "section-title", text });
}
