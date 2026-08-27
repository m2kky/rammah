export type CmsMediaKind = "image" | "video" | "animation_bundle";
export type CmsMediaCardinality = "single" | "multiple";

type CmsBaseFieldDefinition = {
  key: string;
  label: string;
  required?: boolean;
  helpText?: string;
};

export type CmsTextFieldDefinition = CmsBaseFieldDefinition & {
  type: "text" | "markdown";
};

export type CmsBooleanFieldDefinition = CmsBaseFieldDefinition & {
  type: "boolean";
  defaultValue: boolean;
};

export type CmsChoiceFieldDefinition = CmsBaseFieldDefinition & {
  type: "choice";
  options: ReadonlyArray<{ value: string; label: string }>;
};

export type CmsLinkFieldDefinition = CmsBaseFieldDefinition & {
  type: "link";
};

export type CmsMediaSlotDefinition = CmsBaseFieldDefinition & {
  type: "media";
  accepts: ReadonlyArray<CmsMediaKind>;
  cardinality: CmsMediaCardinality;
};

export type CmsSectionFieldDefinition =
  | CmsTextFieldDefinition
  | CmsBooleanFieldDefinition
  | CmsChoiceFieldDefinition
  | CmsLinkFieldDefinition
  | CmsMediaSlotDefinition;

export type CmsSectionDefinition = {
  key: string;
  label: string;
  description: string;
  fields: ReadonlyArray<CmsSectionFieldDefinition>;
};

const singleImage = (key: string, label: string, required = false): CmsMediaSlotDefinition => ({
  key,
  label,
  type: "media",
  accepts: ["image"],
  cardinality: "single",
  required,
});

const singleVideo = (key: string, label: string, required = false): CmsMediaSlotDefinition => ({
  key,
  label,
  type: "media",
  accepts: ["video"],
  cardinality: "single",
  required,
});

export const sectionDefinitions: ReadonlyArray<CmsSectionDefinition> = [
  {
    key: "hero",
    label: "Hero",
    description: "Large page introduction with responsive image or video media.",
    fields: [
      { key: "title", label: "Title", type: "text", required: true },
      { key: "body", label: "Body", type: "markdown" },
      { key: "primaryCta", label: "Primary action", type: "link" },
      { key: "secondaryCta", label: "Secondary action", type: "link" },
      singleImage("desktopImage", "Desktop image"),
      singleImage("mobileImage", "Mobile image"),
      singleVideo("desktopVideo", "Desktop video"),
      singleVideo("mobileVideo", "Mobile video"),
      singleImage("poster", "Video poster"),
    ],
  },
  {
    key: "rich_text",
    label: "Rich Text",
    description: "Heading and formatted body content without media.",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "body", label: "Body", type: "markdown", required: true },
    ],
  },
  {
    key: "image_with_text",
    label: "Image with Text",
    description: "Responsive image paired with copy and an optional action.",
    fields: [
      singleImage("image", "Image", true),
      { key: "heading", label: "Heading", type: "text" },
      { key: "body", label: "Body", type: "markdown", required: true },
      {
        key: "alignment",
        label: "Image alignment",
        type: "choice",
        options: [
          { value: "left", label: "Left" },
          { value: "right", label: "Right" },
        ],
      },
      { key: "cta", label: "Action", type: "link" },
    ],
  },
  {
    key: "standalone_image",
    label: "Standalone Image",
    description: "A responsive image with an optional caption and width treatment.",
    fields: [
      singleImage("image", "Image", true),
      { key: "caption", label: "Caption", type: "text" },
      {
        key: "width",
        label: "Width",
        type: "choice",
        options: [
          { value: "content", label: "Content width" },
          { value: "wide", label: "Wide" },
          { value: "full", label: "Full width" },
        ],
      },
    ],
  },
  {
    key: "video",
    label: "Video",
    description: "A video with a poster, caption, and playback controls.",
    fields: [
      singleVideo("video", "Video", true),
      singleImage("poster", "Poster", true),
      { key: "caption", label: "Caption", type: "text" },
      { key: "autoplay", label: "Autoplay", type: "boolean", defaultValue: false },
      { key: "loop", label: "Loop", type: "boolean", defaultValue: false },
      { key: "muted", label: "Muted", type: "boolean", defaultValue: true },
      { key: "controls", label: "Show controls", type: "boolean", defaultValue: true },
    ],
  },
  {
    key: "gallery",
    label: "Gallery",
    description: "An ordered set of images with usage-specific descriptions and captions.",
    fields: [
      {
        key: "galleryImages",
        label: "Gallery images",
        type: "media",
        accepts: ["image"],
        cardinality: "multiple",
        required: true,
      },
      { key: "heading", label: "Heading", type: "text" },
    ],
  },
  {
    key: "recognition",
    label: "Official Recognition",
    description: "Verified external profile with portrait, roles, source, and action.",
    fields: [
      { key: "title", label: "Section label", type: "text", required: true },
      { key: "name", label: "Name", type: "text", required: true },
      { key: "body", label: "Official statement", type: "text", required: true },
      { key: "roles", label: "Roles", type: "text", required: true },
      { key: "sourceLabel", label: "Source label", type: "text", required: true },
      { key: "profileBadge", label: "Portrait badge", type: "text" },
      { key: "cta", label: "Official profile action", type: "link", required: true },
      singleImage("portrait", "Portrait"),
    ],
  },
  {
    key: "cta",
    label: "Call to Action",
    description: "A focused action block with optional background media.",
    fields: [
      { key: "heading", label: "Heading", type: "text", required: true },
      { key: "body", label: "Body", type: "markdown" },
      { key: "button", label: "Button", type: "link", required: true },
      singleImage("backgroundImage", "Background image"),
    ],
  },
  {
    key: "divider_spacer",
    label: "Divider / Spacer",
    description: "Controlled visual separation without media.",
    fields: [
      {
        key: "size",
        label: "Spacing",
        type: "choice",
        options: [
          { value: "small", label: "Small" },
          { value: "medium", label: "Medium" },
          { value: "large", label: "Large" },
        ],
      },
      { key: "showDivider", label: "Show divider", type: "boolean", defaultValue: false },
    ],
  },
];

export type CmsGlobalMediaDefinition = {
  key: string;
  label: string;
  description: string;
  atomic: boolean;
  slots: ReadonlyArray<CmsMediaSlotDefinition>;
};

export const globalMediaDefinitions: ReadonlyArray<CmsGlobalMediaDefinition> = [
  {
    key: "loadingMatchCut",
    label: "Loading match-cut",
    description: "Loading video, poster, and matched homepage hero frame published as one version.",
    atomic: true,
    slots: [
      singleVideo("video", "Loading video", true),
      singleImage("poster", "Loading poster", true),
      singleImage("matchedHeroFrame", "Matched homepage hero frame", true),
    ],
  },
  {
    key: "navigation",
    label: "Navigation",
    description: "Responsive media used by the global site navigation.",
    atomic: false,
    slots: [
      singleVideo("desktopMenuVideo", "Desktop menu video"),
      singleVideo("mobileMenuVideo", "Mobile menu video"),
    ],
  },
  {
    key: "seo",
    label: "Search and social",
    description: "Default media used when a page has no specific social image.",
    atomic: false,
    slots: [singleImage("defaultOgImage", "Default Open Graph image", true)],
  },
  {
    key: "homepage",
    label: "Homepage",
    description: "Custom homepage media that is not owned by a generic page section.",
    atomic: false,
    slots: [
      singleImage("heroPortrait", "Hero portrait"),
      {
        key: "servicesAnimation",
        label: "Services animation",
        type: "media",
        accepts: ["animation_bundle"],
        cardinality: "single",
      },
    ],
  },
  {
    key: "about",
    label: "About page",
    description: "Custom media used by the current About page experience.",
    atomic: false,
    slots: [
      singleImage("heroImage", "Hero image"),
      singleVideo("desktopFastCutVideo", "Desktop fast-cut video"),
      singleVideo("mobileFastCutVideo", "Mobile fast-cut video"),
      singleImage("supportingImage", "Supporting image"),
    ],
  },
  {
    key: "corporateTraining",
    label: "Corporate Training",
    description: "Custom imagery used by the Corporate Training page.",
    atomic: false,
    slots: [
      singleImage("portrait", "Portrait"),
      singleImage("parallaxImage", "Parallax image"),
    ],
  },
  {
    key: "serviceDetail",
    label: "Service details",
    description: "Shared custom media used by service-detail pages.",
    atomic: false,
    slots: [singleImage("portrait", "Portrait")],
  },
];

const compatibilityMediaSlot: CmsMediaSlotDefinition = {
  key: "primaryMedia",
  label: "Legacy primary media",
  type: "media",
  accepts: ["image", "video", "animation_bundle"],
  cardinality: "single",
};

export const resolveSectionMediaSlot = (
  sectionType: string,
  slotKey: string,
): CmsMediaSlotDefinition | null => {
  const section = sectionDefinitions.find(({ key }) => key === sectionType);
  const field = section?.fields.find(({ key }) => key === slotKey);
  if (field?.type === "media") return field;
  const hasDefinedMedia = section?.fields.some(({ type }) => type === "media") ?? false;
  if (!hasDefinedMedia && slotKey === compatibilityMediaSlot.key) return compatibilityMediaSlot;
  return null;
};

export const resolveGlobalMediaSlot = (
  definitionKey: string,
  slotKey: string,
): CmsMediaSlotDefinition | null =>
  globalMediaDefinitions
    .find(({ key }) => key === definitionKey)
    ?.slots.find(({ key }) => key === slotKey) ?? null;

export const defaultLegacySlotForSection = (sectionType: string): string => {
  const definition = sectionDefinitions.find(({ key }) => key === sectionType);
  const firstMedia = definition?.fields.find(({ type }) => type === "media");
  return firstMedia?.key ?? compatibilityMediaSlot.key;
};
