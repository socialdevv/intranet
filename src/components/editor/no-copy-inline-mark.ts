import { Mark, mergeAttributes } from "@tiptap/core";

export const NoCopyInlineMark = Mark.create({
  name: "noCopyInline",

  inclusive: false,

  parseHTML() {
    return [{ tag: 'span[data-no-copy="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-no-copy": "true",
        class: "no-copy-inline",
      }),
      0,
    ];
  },
});
