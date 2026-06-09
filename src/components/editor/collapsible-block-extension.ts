import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import CollapsibleBlockNodeView from "./collapsible-block-node-view";

/**
 * TipTap block node for collapsible/expandable content sections (FAQ-style).
 * Stored as:
 *   {
 *     type: "collapsibleBlock",
 *     attrs: { title: string },
 *     content: [/* block nodes *\/]
 *   }
 */
export const CollapsibleBlockNode = Node.create({
  name: "collapsibleBlock",

  group: "block",

  content: "block+",

  draggable: true,

  /**
   * isolating: true prevents ProseMirror from merging adjacent content
   * (e.g. an empty paragraph) into this block when Backspace/Delete is pressed
   * at the block boundary. Without this, deleting an empty paragraph just
   * outside the collapsible could pull subsequent content inside it.
   */
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-title") ?? "",
        renderHTML: (attributes) => ({ "data-title": attributes.title as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "details[data-collapsible]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "details",
      mergeAttributes(HTMLAttributes, { "data-collapsible": "" }),
      ["summary", {}, (HTMLAttributes["data-title"] as string) ?? ""],
      ["div", { "data-collapsible-content": "" }, 0],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CollapsibleBlockNodeView);
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Enter at the end of the last child → insert a paragraph after the block.
       */
      Enter: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty) return false;

        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          if (node.type.name !== this.name) continue;
          if ($from.depth !== d + 1) break;
          if ($from.index(d) !== node.childCount - 1) break;
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
       * Backspace at the start of the first (empty) child → remove the whole block.
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
