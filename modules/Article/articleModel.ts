import { Schema, model } from "mongoose";
import { addSourceIndex, sourceFields } from "../../helper/sourceFields";

// News article metadata. `url` links back to the original; the body is not
// stored (copyright), so clients open `url` to read the full article.
const articleSchema = new Schema(
  {
    title: { type: String, required: true },
    summary: { type: String, default: "" },
    thumbnail: { type: String, default: "" },
    url: { type: String, required: true },
    published_at: { type: Date, required: true },
    category: { type: String },
    category_slug: { type: String },
    tags: { type: [String], default: [] },
    author: { type: String },
    // Teams the article is about, matched from tags/title at crawl time.
    teams: { type: [{ type: Schema.ObjectId, ref: "Team" }], default: [] },
    // Set once the push for this article went out (or it was backfilled),
    // so a re-run of the notifier never sends it twice.
    notified_at: { type: Date },
    ...sourceFields,
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

addSourceIndex(articleSchema);
articleSchema.index({ published_at: -1 });
articleSchema.index({ category_slug: 1, published_at: -1 });
articleSchema.index({ teams: 1, published_at: -1 });

const ArticleModel = model("Article", articleSchema);
export default ArticleModel;
