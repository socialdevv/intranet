import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import VideoBlockNodeView from "@/components/editor/video-block-node-view";

/**
 * TipTap block node for embedded videos.
 * Attrs: src (required), width ("25%" | "50%" | "75%" | "100%"), align ("left"|"center"|"right")
 */
const VideoBlockNode = Node.create({
  name: "videoBlock",
  group: "block",
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: "" },
      width: { default: "100%" },
      align: { default: "center" },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-type='video-block']" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", { "data-type": "video-block", ...HTMLAttributes }];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoBlockNodeView);
  },
});

export default VideoBlockNode;
