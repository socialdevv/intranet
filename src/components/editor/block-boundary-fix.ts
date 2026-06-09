import { Extension } from "@tiptap/core";

/**
 * Fixes Backspace/Delete behavior around isolating custom block nodes
 * (calloutBlock, collapsibleBlock, and any future isolating nodes).
 *
 * Problem: When `isolating: true` is set on a custom node, ProseMirror's
 * `joinBackward` command is correctly blocked — but its fallback command
 * `selectNodeBackward` then fires, selecting the entire adjacent block.
 * The user sees the whole block highlight instead of the empty paragraph
 * disappearing, which feels broken.
 *
 * Fix: Intercept Backspace/Delete when the cursor is in an empty paragraph
 * directly adjacent to an isolating block, and simply delete that paragraph
 * before `selectNodeBackward` gets a chance to run.
 */
export const BlockBoundaryFix = Extension.create({
  name: "blockBoundaryFix",

  // Higher priority means this extension's keyboard shortcuts run before
  // the node extensions (calloutBlock etc.) and StarterKit defaults.
  priority: 200,

  addKeyboardShortcuts() {
    return {
      /**
       * Backspace on an empty paragraph whose previous sibling is an
       * isolating block → delete only the empty paragraph.
       */
      Backspace: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty) return false;
        // Must be in a paragraph
        if ($from.parent.type.name !== "paragraph") return false;
        // Paragraph must be empty
        if ($from.parent.content.size !== 0) return false;

        const depth = $from.depth; // depth of the paragraph node
        const parentDepth = depth - 1;
        const parentNode = $from.node(parentDepth);
        // Index of the paragraph in its parent
        const idx = $from.index(parentDepth);

        // Need a previous sibling
        if (idx === 0) return false;
        const prevSibling = parentNode.child(idx - 1);
        // Only act when that sibling is isolating (our custom blocks)
        if (!prevSibling.type.spec.isolating) return false;

        // Delete just the empty paragraph; cursor ends up at gap before the
        // isolating block (handled by ProseMirror's gapcursor).
        return editor
          .chain()
          .deleteRange({ from: $from.before(depth), to: $from.after(depth) })
          .run();
      },

      /**
       * Delete (forward) on an empty paragraph whose next sibling is an
       * isolating block → delete only the empty paragraph.
       */
      Delete: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty) return false;
        if ($from.parent.type.name !== "paragraph") return false;
        if ($from.parent.content.size !== 0) return false;

        const depth = $from.depth;
        const parentDepth = depth - 1;
        const parentNode = $from.node(parentDepth);
        const idx = $from.index(parentDepth);

        // Need a next sibling
        if (idx >= parentNode.childCount - 1) return false;
        const nextSibling = parentNode.child(idx + 1);
        if (!nextSibling.type.spec.isolating) return false;

        return editor
          .chain()
          .deleteRange({ from: $from.before(depth), to: $from.after(depth) })
          .run();
      },
    };
  },
});
