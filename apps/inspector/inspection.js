function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function changeValue(label, value, side) {
  const field = document.createElement("div");
  const content = value === undefined ? "Absent" : JSON.stringify(value, null, 2);
  const block = textElement("pre", content, value === undefined ? "change-absent" : undefined);
  block.dataset.changeSide = side;
  field.append(textElement("span", label, "change-value-label"), block);
  return field;
}

function renderChanges(changes, step) {
  if (changes.length === 0) {
    return textElement("p", step === 0 ? "Initial state" : "No state changes", "empty");
  }

  const list = document.createElement("ol");
  list.className = "changes";
  for (const change of changes) {
    const row = document.createElement("li");
    row.dataset.changePath = change.path;
    row.dataset.changeKind = change.kind;
    const heading = document.createElement("div");
    heading.className = "change-heading";
    heading.append(textElement("code", change.path), textElement("span", change.kind, "change-kind"));
    const values = document.createElement("div");
    values.className = "change-values";
    values.append(changeValue("Before", change.before, "before"), changeValue("After", change.after, "after"));
    row.append(heading, values);
    list.append(row);
  }
  return list;
}

export function attachInspection(replay, root) {
  const statePanel = root.querySelector("[data-state-panel]");
  const changesPanel = root.querySelector("[data-changes-panel]");
  const state = root.querySelector("[data-state-json]");
  const changes = root.querySelector("[data-change-list]");
  let frame;

  function updateState() {
    if (frame && statePanel.open) state.textContent = JSON.stringify(frame.state, null, 2);
  }

  function updateChanges() {
    if (frame && changesPanel.open) changes.replaceChildren(renderChanges(replay.changes, frame.step));
  }

  statePanel.addEventListener("toggle", updateState);
  changesPanel.addEventListener("toggle", updateChanges);
  return (nextFrame) => {
    frame = nextFrame;
    updateState();
    updateChanges();
  };
}
