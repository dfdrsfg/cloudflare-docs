import type { Props } from "@astrojs/starlight/props";
import { parse } from "node-html-parser";
import he from "he";
import { remark } from "remark";
import strip from "strip-markdown";
import { rehypeExternalLinksOptions } from "~/plugins/rehype/external-links";
import { getImage } from "astro:assets";
import { getEntry, type CollectionEntry } from "astro:content";

type TableOfContentsItems = NonNullable<Props["toc"]>["items"];

export async function generateTableOfContents(
	html: string,
): Promise<TableOfContentsItems> {
	const items: TableOfContentsItems = [
		{
			text: "Overview",
			slug: "_top",
			depth: 1,
			children: [],
		},
	];

	const dom = parse(html);
	const headers = dom.querySelectorAll("h2[id],h3[id]");

	if (headers) {
		function headerDepth(header: any) {
			return Number(header.rawTagName.slice(1));
		}

		for (const header of headers) {
			if (header.id === "footnote-label") continue;

			const depth = headerDepth(header);

			const title = he.decode(header.innerText);

			if (depth === 2) {
				items.push({
					text: title,
					slug: header.id,
					depth,
					children: [],
				});

				continue;
			}

			items.at(-1)?.children.push({
				text: title,
				slug: header.id,
				depth,
				children: [],
			});
		}
	}

	return items;
}

/**
 * Generates a plain-text description for use in the `description` and `og:description` meta tags.
 *
 * 1. If there is a `description` property in the frontmatter, strip any Markdown tokens and return.
 * 2. If there is a `<p>...</p>` element in the HTML, decode any HTML entities and return that.
 * 3. Return `undefined` to signal to consumers there is no suitable description.
 */
export async function generateDescription({
	html,
	markdown,
}: {
	html?: string;
	markdown?: string;
}) {
	let description = undefined;

	if (markdown) {
		const file = await remark().use(strip).process(markdown);

		description = file.toString();
	} else if (html) {
		const dom = parse(html);
		const paragraph = dom.querySelector(":root > p");

		if (paragraph) description = he.decode(paragraph.innerText);
	}

	return description
		?.replaceAll(rehypeExternalLinksOptions.content.value, "")
		.trim();
}

const DEFAULT_OG_IMAGE = "/cf-twitter-card.png";

const CHANGELOG_OG_IMAGE = "/changelog-preview.png";

const PRODUCT_AREA_OG_IMAGES: Record<string, string> = {
	"cloudflare essentials": "/core-services-preview.png",
	"cloudflare one": "/zt-preview.png",
	"developer platform": "/dev-products-preview.png",
	"network security": "/core-services-preview.png",
	"application performance": "/core-services-preview.png",
	"application security": "/core-services-preview.png",
};

export async function getOgImage(entry: CollectionEntry<"docs" | "changelog">) {
	if (entry.data.cover) {
		if (!entry.data.cover.src) {
			throw new Error(
				`${entry.id} has a cover property in frontmatter that is not a valid image path`,
			);
		}

		const image = await getImage({
			src: entry.data.cover,
			format: "png",
		});

		return image.src;
	}

	if (entry.collection === "changelog") {
		return CHANGELOG_OG_IMAGE;
	}

	const section = entry.id.split("/").filter(Boolean).at(0);

	if (!section) {
		return DEFAULT_OG_IMAGE;
	}

	const product = await getEntry("products", section);

	if (product && product.data.product.group) {
		const image =
			PRODUCT_AREA_OG_IMAGES[product.data.product.group.toLowerCase()];

		if (image) {
			return image;
		}
	}

	return DEFAULT_OG_IMAGE;
}
