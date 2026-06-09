import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import SectionLinkNodeView from "./section-link-node-view";

/**
 * TipTap block node for embedded section-level link blocks.
 * Supports target types: external URL, internal article/category/subcategory,
 * komunikat, and template.
 * Stored as:
 *   {
 *     type: "sectionLink",
 *     attrs: {
 *       linkType: "url" | "article" | "category" | "subcategory" | "komunikat" | "template",
 *       label: string,
 *       url: string | null,          // for type=url
 *       articleId: string | null,    // for type=article
 *       articleSlug: string | null,
 *       articleCategorySlug: string | null,
 *       articleSectionId: string | null,
 *       articleSectionTitle: string | null,
 *       categoryId: string | null,   // for type=category|subcategory
 *       categorySlug: string | null,
 *       komunikatId: string | null,  // for type=komunikat
 *       templateId: string | null,   // for type=template
 *       templateChannel: string | null, // for type=template
 *     }
 *   }
 */
export const SectionLinkNode = Node.create({
  name: "sectionLink",

  group: "block",

  atom: true,

  draggable: true,

  addAttributes() {
    return {
      linkType:            { default: "url" },
      label:               { default: "" },
      url:                 { default: null },
      articleId:           { default: null },
      articleSlug:         { default: null },
      articleCategorySlug: { default: null },
      articleSectionId:    { default: null },
      articleSectionTitle: { default: null },
      categoryId:          { default: null },
      categorySlug:        { default: null },
      komunikatId:         { default: null },
      templateId:          { default: null },
      templateChannel:     { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-section-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-section-link": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionLinkNodeView);
  },
});
