import { BaseElement } from "../base-element/base-element";

interface BlogPost {
  title: string;
  description: string;
  link: string;
  category: string;
  pubDate: string;
  imageUrl: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Game Updates": "#ff981f",
  Community: "#0dc10d",
  "Dev Blogs": "#00c8ff",
  "Future Updates": "#ffff00",
  Events: "#ff00ff",
};

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export class BlogPage extends BaseElement {
  posts: BlogPost[];
  loading: boolean;
  error: string;

  constructor() {
    super();
    this.posts = [];
    this.loading = true;
    this.error = "";
  }

  html(): string {
    return `{{blog-page.html}}`;
  }

  connectedCallback(): void {
    super.connectedCallback();
    this.posts = [];
    this.loading = true;
    this.error = "";
    this.render();
    this.fetchBlog();
  }

  async fetchBlog(): Promise<void> {
    try {
      const response = await fetch("/api/osrs-news");
      if (!response.ok) {
        throw new Error("Failed to fetch news");
      }
      const data = await response.json();
      this.posts = data;
      this.loading = false;
      this.render();
    } catch {
      this.loading = false;
      this.error = "Failed to load OSRS news.";
      this.render();
    }
  }

  renderPost(post: BlogPost): string {
    const categoryColor = CATEGORY_COLORS[post.category] || "#cccccc";
    const imageHtml = post.imageUrl
      ? `<img class="blog-page__post-image" src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy" />`
      : "";

    return `
      <a class="blog-page__post" href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer">
        ${imageHtml}
        <div class="blog-page__post-body">
          <div class="blog-page__post-meta">
            <span class="blog-page__post-category" style="color: ${categoryColor}">${escapeHtml(post.category)}</span>
            <span class="blog-page__post-date">${formatDate(post.pubDate)}</span>
          </div>
          <h3 class="blog-page__post-title">${escapeHtml(post.title)}</h3>
          <p class="blog-page__post-desc">${escapeHtml(post.description)}</p>
        </div>
      </a>
    `;
  }

  renderContent(): string {
    if (this.loading) {
      return `<div class="blog-page__loading">Loading news...</div>`;
    }
    if (this.error) {
      return `<div class="blog-page__error">${escapeHtml(this.error)}</div>`;
    }
    if (this.posts.length === 0) {
      return `<div class="blog-page__empty">No news posts found.</div>`;
    }
    return `<div class="blog-page__posts">${this.posts.map((p) => this.renderPost(p)).join("")}</div>`;
  }
}

customElements.define("blog-page", BlogPage);
