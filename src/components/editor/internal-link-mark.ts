import { Mark, mergeAttributes } from "@tiptap/core";

export type InternalLinkEntityType = "category" | "subcategory" | "article";

export type InternalLinkAttrs = {
  entityType: InternalLinkEntityType;
  entityId: string;
  sectionId?: string | null;
  sectionTitle?: string | null;
  hrefSnapshot?: string | null;
  labelSnapshot?: string | null;
};

export const InternalLinkMark = Mark.create({
  name: "internalLink",

  inclusive: false,

  addAttributes() {
    return {
      entityType: {
        default: "article",
      },
      entityId: {
        default: null,
      },
      sectionId: {
        default: null,
      },
      sectionTitle: {
        default: null,
      },
      hrefSnapshot: {
        default: null,
      },
      labelSnapshot: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "a[data-internal-link]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const attrs = HTMLAttributes as InternalLinkAttrs;
    return [
      "a",
      mergeAttributes(HTMLAttributes, {
        "data-internal-link": "1",
        "data-entity-type": attrs.entityType,
        "data-entity-id": attrs.entityId,
        "data-section-id": attrs.sectionId ?? null,
        href: attrs.hrefSnapshot ?? "#",
      }),
      0,
    ];
  },
});
