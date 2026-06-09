import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import MatrixLinkNodeView from "./matrix-link-node-view";

/**
 * TipTap block node that embeds a reference to a MatrixDecision entry.
 * Stored in the doc JSON as:
 *   { type: "matrixLink", attrs: { entryId, entryTitle, entryCategory, entryDepartment, entrySla } }
 *
 * Display attrs (entryTitle etc.) are snapshotted at insertion time so the
 * renderer can display them without needing live data access.
 */
export const MatrixLinkNode = Node.create({
  name: "matrixLink",

  group: "block",

  atom: true, // treat as single indivisible unit

  draggable: true,

  addAttributes() {
    return {
      entryId:         { default: null },
      entryTitle:      { default: null },
      entryCategory:   { default: null },
      entryDepartment: { default: null },
      entrySla:        { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-matrix-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-matrix-link": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MatrixLinkNodeView);
  },
});
