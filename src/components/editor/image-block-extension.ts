import { Node, ReactNodeViewRenderer } from "@tiptap/react";
import ImageBlockNodeView from "@/components/editor/image-block-node-view";

/**
 * TipTap block node for embedded images.
 * Attrs: src (required), alt, width ("25%" | "50%" | "75%" | "100%"), align ("left"|"center"|"right")
 */
const ImageBlockNode = Node.create({
  name: "imageBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      alt: { default: "" },
      width: { default: "100%" },
      align: { default: "center" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='image-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "image-block", ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockNodeView);
  },
});

export default ImageBlockNode;
