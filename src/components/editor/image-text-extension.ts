import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ImageTextNodeView from "./image-text-node-view";

/**
 * TipTap block node for side-by-side image + text layout.
 * Stored as:
 *   {
 *     type: "imageSideBySide",
 *     attrs: { layout, src, alt, imageWidth },
 *     content: [/* block nodes (text side) *\/]
 *   }
 */
export const ImageTextNode = Node.create({
  name: "imageSideBySide",

  group: "block",

  content: "block+",

  draggable: true,

  /**
   * isolating: true prevents ProseMirror from merging adjacent paragraphs
   * into this block when Backspace/Delete is pressed at the boundary.
   */
  isolating: true,

  addAttributes() {
    return {
      layout: {
        default: "image-left",
        parseHTML: (el) => el.getAttribute("data-layout") ?? "image-left",
        renderHTML: (attrs) => ({ "data-layout": attrs.layout as string }),
      },
      src: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-src") ?? "",
        renderHTML: (attrs) => ({ "data-src": attrs.src as string }),
      },
      alt: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-alt") ?? "",
        renderHTML: (attrs) => ({ "data-alt": attrs.alt as string }),
      },
      imageWidth: {
        default: "50%",
        parseHTML: (el) => el.getAttribute("data-image-width") ?? "40%",
        renderHTML: (attrs) => ({ "data-image-width": attrs.imageWidth as string }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-image-side-by-side]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-image-side-by-side": "" }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageTextNodeView);
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
    };
  },
});
