import { useRef, useState } from "react";
import { api } from "../api";
import {
  Avatar,
  AsyncButton,
  dateLabel,
  ErrorMessage,
  LoadMore,
  purposes,
  PurposeSelect,
  ResourceState,
  useResource,
} from "./Shared";

export function Composer({ user, onPublished }) {
  const [caption, setCaption] = useState("");
  const [purpose, setPurpose] = useState("learning");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef(null);
  const input = useRef(null);
  async function publish(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (
      !pending.current ||
      pending.current.caption !== caption ||
      pending.current.purpose !== purpose ||
      pending.current.file !== file
    ) {
      pending.current = { caption, purpose, file, key: crypto.randomUUID() };
    }
    const body = new FormData();
    body.append("caption", caption);
    body.append("purpose", purpose);
    if (file) body.append("image", file);
    try {
      await api("/posts", {
        method: "POST",
        body,
        headers: { "Idempotency-Key": pending.current.key },
      });
      setCaption("");
      setFile(null);
      pending.current = null;
      input.current.value = "";
      onPublished();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel composer" onSubmit={publish}>
      <div className="composer-prompt">
        <Avatar user={user} />
        <label htmlFor="new-caption">
          Something worth sharing?
          <span>A small step, a useful idea, a moment of progress.</span>
        </label>
      </div>
      <textarea
        id="new-caption"
        disabled={busy}
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        maxLength={2200}
        rows={3}
        required
        placeholder="What moved you forward today?"
      />
      <div className="composer-tools">
        <label className="attachment-label">
          + Add a photo
          <input
            ref={input}
            disabled={busy}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const selected = event.target.files[0];
              if (selected && selected.size > 5 * 1024 * 1024) {
                setError("Choose an image smaller than 5 MB");
                setFile(null);
                event.target.value = "";
              } else {
                setFile(selected || null);
                setError("");
              }
            }}
          />
        </label>
        <PurposeSelect value={purpose} onChange={setPurpose} disabled={busy} />
        <button className="button primary" disabled={busy || !caption.trim()}>
          {busy ? "Sharing..." : "Share a post"}
        </button>
      </div>
      {file && <div className="attachment-name">Attached: {file.name}</div>}
      <ErrorMessage message={error} />
    </form>
  );
}

function PostCard({ post, onChanged, onProfile }) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [caption, setCaption] = useState(post.caption);
  const [purpose, setPurpose] = useState(post.purpose);
  const topic = purposes.find((item) => item.id === post.purpose);
  return (
    <article className="panel post-card">
      <header className="post-header">
        <button className="person-link" onClick={() => onProfile(post.author.id)}>
          <Avatar user={post.author} />
          <span>
            <strong>{post.author.name}</strong>
            <small>
              @{post.author.handle} <span aria-hidden="true">/</span>{" "}
              {dateLabel(post.createdAt)}
            </small>
          </span>
        </button>
        <span className={`purpose-tag ${post.purpose}`}>{topic.label}</span>
      </header>
      {post.hasImage && (
        <img
          className="post-image"
          src={`/api/v1/posts/${post.id}/image`}
          alt={`A moment shared by ${post.author.name}`}
          loading="lazy"
        />
      )}
      <div className="post-content">
        {editing ? (
          <form onSubmit={(event) => event.preventDefault()}>
            <label>
              Edit caption
              <textarea
                value={caption}
                maxLength={2200}
                rows={4}
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>
            <div className="button-row">
              <PurposeSelect
                id={`purpose-${post.id}`}
                value={purpose}
                onChange={setPurpose}
              />
              <AsyncButton
                disabled={!caption.trim()}
                className="button primary"
                action={async () => {
                  await api(`/posts/${post.id}`, {
                    method: "PATCH",
                    body: { caption, purpose },
                  });
                  setEditing(false);
                  onChanged();
                }}
              >
                Save changes
              </AsyncButton>
              <button className="button secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p>{post.caption}</p>
        )}
        {post.isOwner && !editing && (
          <div className="post-owner-actions">
            <button
              className="text-button"
              onClick={() => {
                setCaption(post.caption);
                setPurpose(post.purpose);
                setEditing(true);
              }}
            >
              Edit post
            </button>
            <button
              className="text-button danger-text"
              onClick={() => setDeleting(!deleting)}
            >
              Delete post
            </button>
          </div>
        )}
        {deleting && (
          <div className="delete-confirm">
            <span>Delete this post permanently?</span>
            <AsyncButton
              className="button danger"
              action={async () => {
                await api(`/posts/${post.id}`, { method: "DELETE" });
                onChanged();
              }}
            >
              Yes, delete
            </AsyncButton>
            <button className="button secondary" onClick={() => setDeleting(false)}>
              Keep post
            </button>
          </div>
        )}
      </div>
      <footer className="post-footer">
        <span className={`purpose-dot ${post.purpose}`} /> A little more{" "}
        {topic.label.toLowerCase()}.
        {!post.author.isPublic && <span className="private-note">Private circle</span>}
      </footer>
    </article>
  );
}

export default function Feed({ endpoint, onChanged, onProfile }) {
  const resource = useResource(endpoint);
  return (
    <ResourceState resource={resource}>
      <div className="post-list">
        {resource.data?.items.length === 0 && (
          <div className="panel empty-state">
            <span className="empty-mark">+</span>
            <h3>Good things start small.</h3>
            <p>Share your first post or discover a few people to follow.</p>
          </div>
        )}
        {resource.data?.items.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            onChanged={onChanged}
            onProfile={onProfile}
          />
        ))}
        <LoadMore resource={resource} endpoint={endpoint} />
        {resource.data?.items.length > 0 && !resource.data.nextCursor && (
          <p className="feed-end">You are all caught up. Make something of the moment.</p>
        )}
      </div>
    </ResourceState>
  );
}
