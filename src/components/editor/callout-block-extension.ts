import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import CalloutBlockNodeView from "./callout-block-node-view";

/**
 * TipTap block node for highlighted callout/notice sections.
 * Stored as:
 *   {
 *     type: "calloutBlock",
 *     attrs: { variant: "info" | "warning" | "critical" | "success" },
 *     content: [/* block nodes *\/]
 *   }
 */
export const CalloutBlockNode = Node.create({
  name: "calloutBlock",

  group: "block",

  content: "block+",

  draggable: true,

  /**
   * isolating: true prevents ProseMirror from merging adjacent content
   * (e.g. an empty paragraph) into this block when Backspace/Delete is pressed
   * at the block boundary. Without this, deleting an empty paragraph just
   * outside the callout could pull subsequent content inside it.
   */
  isolating: true,

  addAttributes() {
    return {
      variant: {
        default: "info",
        parseHTML: (element) => element.getAttribute("data-variant") ?? "info",
        renderHTML: (attributes) => ({ "data-variant": attributes.variant as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-callout]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-callout": "" }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutBlockNodeView);
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Enter at the end of the last child → insert a paragraph after the callout.
       * Without this, pressing Enter at the end keeps the cursor inside the block
       * with no way to escape without using the mouse.
       */
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty) return false;

        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name !== this.name) continue;
          // Must be a direct child of this custom node
          if ($from.depth !== d + 1) break;
          // Must be the last child
          if ($from.index(d) !== node.childCount - 1) break;
          // Must be at the end of that child's content
          if ($from.parentOffset !== $from.parent.content.size) break;

          const afterPos = $from.after(d);
          return editor
            .chain()
            .insertContentAt(afterPos, { type: "paragraph" })
            .setTextSelection(afterPos + 1)
            .run();
        }
        return false;
      },

      /**
       * Backspace at the start of the first (empty) child → remove the whole block
       * and replace it with an empty paragraph. Prevents the user from getting
       * "stuck" inside an empty callout with no escape.
       */
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty) return false;
        if ($from.parentOffset !== 0) return false;

        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name !== this.name) continue;
          if ($from.depth !== d + 1) break;
          if ($from.index(d) !== 0) break;
          // Only lift out if the current child is empty
          if ($from.parent.content.size !== 0) break;

          const nodePos = $from.before(d);
          return editor
            .chain()
            .deleteRange({ from: nodePos, to: nodePos + node.nodeSize })
            .insertContentAt(nodePos, { type: "paragraph" })
            .setTextSelection(nodePos + 1)
            .run();
        }
        return false;
      },
    };
  },
});
