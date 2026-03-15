import epub from "epub-gen-memory";
import { DateTime } from "luxon";

import { ExtractedArticle } from "@/lib/types";
import { slugify } from "@/lib/utils";

const TAIL_SPACE_HTML = Array.from({ length: 8 }, () => `<p class="tail-space">&#160;</p>`).join("");
const ARTICLE_BUFFER_HTML = Array.from(
  { length: 14 },
  () => `<p class="reader-buffer">&#160;</p>`
).join("");
const DAILY_NEWS_FILE = "daily-news.xhtml";

function stripVisualMedia(html: string): string {
  return html
    .replace(/<figure[\s\S]*?<\/figure>/gi, "")
    .replace(/<picture[\s\S]*?<\/picture>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<source[^>]*>/gi, "")
    .replace(/<video[\s\S]*?<\/video>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
}

const kindleStyles = `
  body { font-family: serif; line-height: 1.55; color: #16120d; }
  h1, h2, h3 { font-family: serif; line-height: 1.2; }
  h1 { font-size: 1.8em; margin-bottom: 0.3em; }
  h2 { font-size: 1.2em; margin-top: 1.4em; }
  p { margin: 0 0 1em; text-align: left; }
  .dek { color: #5d5147; margin-bottom: 1.2em; }
  .meta { font-size: 0.9em; color: #6c6257; margin-bottom: 1.4em; }
  .toc-list li { margin-bottom: 0.8em; }
  .source { font-size: 0.95em; color: #7a3d26; }
  .back-link { margin-top: 1.8em; font-weight: bold; }
  .article-end { margin-top: 0; }
  .summary-fallback { color: #6c6257; font-style: italic; }
  .tail-space { margin: 0 0 1.15em; color: transparent; }
  .reader-buffer { margin: 0 0 1.4em; color: transparent; }
  blockquote { margin-left: 1em; color: #4f463d; }
  img, figure, picture, svg, video, iframe { display: none !important; }
`;

export async function buildEpub(
  editionDate: string,
  stories: ExtractedArticle[]
): Promise<Buffer> {
  const prettyDate =
    DateTime.fromISO(editionDate).toFormat("dd LLLL yyyy") || editionDate;

  const storyFiles = stories.map((story, index) => ({
    story,
    filename: `article-${index + 1}-${slugify(story.title)}.xhtml`
  }));

  const content = [
    {
      title: "Cover",
      beforeToc: true,
      excludeFromToc: true,
      content: `<h1>Kindle News Daily Digest</h1><p class="dek">Edition for ${prettyDate}</p><p>One curated EPUB every morning.</p>${TAIL_SPACE_HTML}`
    },
    {
      title: "Daily news",
      filename: DAILY_NEWS_FILE,
      beforeToc: true,
      excludeFromToc: true,
      content: `
        <h1>Daily news</h1>
        <ol class="toc-list">
          ${stories
            .map((story, index) => {
              const file = storyFiles[index];
              return `<li><a href="${file.filename}">${story.title}</a><div class="source">${story.sourceName}</div></li>`;
            })
            .join("")}
        </ol>
        ${TAIL_SPACE_HTML}
      `
    },
    ...storyFiles.map(({ story, filename }) => ({
      title: story.title,
      filename,
      content: `
        <h1>${story.title}</h1>
        <p class="meta">${story.sourceName} · ${DateTime.fromISO(story.publishedAt).toFormat("dd LLL yyyy HH:mm")}${story.author ? ` · ${story.author}` : ""}</p>
        <p class="dek"><a href="${story.url}">Original source link</a></p>
        ${stripVisualMedia(story.contentHtml)}
        <div class="article-end">
          ${ARTICLE_BUFFER_HTML}
          <p class="back-link"><a href="${DAILY_NEWS_FILE}">Back to Daily news</a></p>
          ${ARTICLE_BUFFER_HTML}
        </div>
      `
    }))
  ];

  return epub(
    {
      title: `Kindle News Daily Digest - ${prettyDate}`,
      author: "Kindle News Daily Digest",
      publisher: "Kindle News Daily Digest",
      lang: "en",
      tocTitle: "Daily news",
      tocInTOC: false,
      prependChapterTitles: false,
      css: kindleStyles
    },
    content
  );
}
