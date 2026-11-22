import { useEffect, useRef, useState } from "react";
import {
  creators,
  emptyState,
  purposes,
  readState,
  samplePosts,
  storageKey,
  visitor,
} from "./data.js";

const sourceUrl = "https://github.com/Rishabhjain-code/instaRJify";

function Avatar({ person }) {
  return (
    <span
      className="avatar"
      style={{ "--person-color": person.color }}
      aria-hidden="true"
    >
      {person.initials}
    </span>
  );
}

function Illustration({ purpose }) {
  return (
    <svg
      className="post-art"
      viewBox="0 0 800 360"
      role="img"
      aria-label={`Original geometric ${purpose.label.toLowerCase()} illustration`}
      style={{ "--art-color": purpose.color }}
    >
      <rect width="800" height="360" fill="currentColor" opacity=".15" />
      <circle cx="680" cy="30" r="180" fill="currentColor" opacity=".22" />
      <circle cx="110" cy="400" r="200" fill="currentColor" opacity=".12" />
      <rect
        x="330"
        y="60"
        width="145"
        height="250"
        rx="73"
        fill="currentColor"
        opacity=".85"
      />
      <path
        d="M190 310V210a70 70 0 0 1 140 0v100M475 310V235a70 70 0 0 1 140 0v75"
        fill="currentColor"
        opacity=".4"
      />
      <circle cx="402" cy="145" r="32" fill="#1f1f1f" opacity=".65" />
      <path d="M130 310h540" stroke="currentColor" opacity=".4" />
    </svg>
  );
}

export default function Demo() {
  const [initial] = useState(readState);
  const [state, setState] = useState(initial.state);
  const [storageError, setStorageError] = useState(initial.warning);
  const [view, setView] = useState("discover");
  const [purpose, setPurpose] = useState("");
  const [query, setQuery] = useState("");
  const [caption, setCaption] = useState("");
  const [postPurpose, setPostPurpose] = useState("learning");
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const composer = useRef(null);
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      setStorageError(
        "Browser storage is unavailable or full. You can still explore, but your changes will not survive a refresh.",
      );
    }
  }, [state]);

  function navigate(next) {
    setView(next);
    setPurpose("");
    setMessage("");
    setEditing(null);
    setCaption("");
    setFormError("");
  }
  function follow(person) {
    const isFollowing = state.following.includes(person.id);
    setState((current) => ({
      ...current,
      following: isFollowing
        ? current.following.filter((id) => id !== person.id)
        : [...current.following, person.id],
    }));
    setMessage(
      `${isFollowing ? "Unfollowed" : "Following"} ${person.name} in this browser demo.`,
    );
  }
  function publish(event) {
    event.preventDefault();
    const text = caption.trim();
    if (!text) {
      setFormError("Write a little something before publishing.");
      return;
    }
    if (!editing && state.posts.length >= 25) {
      setFormError(
        "This demo keeps up to 25 local posts. Delete one or reset the demo to continue.",
      );
      return;
    }
    setState((current) => ({
      ...current,
      posts: editing
        ? current.posts.map((post) =>
            post.id === editing ? { ...post, caption: text, purpose: postPurpose } : post,
          )
        : [
            {
              id: `local-${crypto.randomUUID()}`,
              authorId: "visitor",
              caption: text,
              purpose: postPurpose,
            },
            ...current.posts,
          ],
    }));
    setCaption("");
    setEditing(null);
    setFormError("");
    setMessage(
      editing ? "Post updated in this browser." : "Post published in this browser only.",
    );
    setPurpose("");
  }
  function edit(post) {
    setCaption(post.caption);
    setPostPurpose(post.purpose);
    setEditing(post.id);
    setFormError("");
    setMessage("");
    composer.current?.focus();
  }
  function reset() {
    setState(emptyState());
    setStorageError("");
    navigate("discover");
    setQuery("");
    setPostPurpose("learning");
    setMessage("Demo reset. Your local posts and follow changes have been cleared.");
  }
  const posts = [...state.posts, ...samplePosts].filter(
    (post) =>
      (!purpose || post.purpose === purpose) &&
      (view !== "following" ||
        post.authorId === "visitor" ||
        state.following.includes(post.authorId)) &&
      (view !== "mine" || post.authorId === "visitor"),
  );
  const people = creators.filter((person) =>
    `${person.name} ${person.handle}`.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const headings = {
    discover: ["Follow your curiosity.", "A few good things. Chosen with intention."],
    following: [
      "Your circle. Your pace.",
      "Posts from the sample creators you choose to follow.",
    ],
    mine: ["Small steps, worth sharing.", "Your posts are visible only in this browser."],
    people: [
      "Good people. Shared purpose.",
      "Meet the fictional creators behind this sample feed.",
    ],
  };
  return (
    <>
      <div className="demo-notice">
        <span className="live-dot" />
        <strong>INTERACTIVE DEMO</strong>
        <span>
          Sample data. Changes stay in your browser. No sign-in or live backend.
        </span>
        <a href={sourceUrl} target="_blank" rel="noreferrer">
          Full-stack source <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="demo-shell">
        <aside className="sidebar">
          <a className="brand" href="#main">
            <span className="brand-mark" aria-hidden="true">
              +
            </span>
            insta<span>RJ</span>ify<span className="brand-dot">.</span>
          </a>
          <p className="sidebar-caption">SOCIAL, WITH INTENTION.</p>
          <nav aria-label="Main navigation">
            {[
              ["discover", "01", "Discover"],
              ["following", "02", "Your feed"],
              ["people", "03", "Find people"],
              ["mine", "04", "Your posts"],
            ].map(([key, number, label]) => (
              <button
                key={key}
                className={view === key ? "nav-item active" : "nav-item"}
                aria-current={view === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                <span aria-hidden="true">{number}</span>
                {label}
              </button>
            ))}
          </nav>
          <div className="sidebar-note">
            <span className="eyebrow">A LITTLE LESS SCROLLING.</span>
            <h2>
              A little more
              <br />
              growing.
            </h2>
            <p>Your attention is a good thing. Spend it on what matters.</p>
          </div>
          <div className="visitor">
            <Avatar person={visitor} />
            <span>
              <strong>Exploring as you</strong>
              <small>@demo.visitor</small>
            </span>
            <span className="badge">DEMO</span>
          </div>
        </aside>
        <div className="workspace">
          <header className="topbar">
            <span>A GOOD PLACE TO BEGIN</span>
            <button className="text-button" onClick={reset}>
              Reset demo
            </button>
          </header>
          <div className="page-layout">
            <main id="main">
              <header className="page-heading">
                <span className="eyebrow">MAKE ROOM FOR WHAT MATTERS</span>
                <h1>{headings[view][0]}</h1>
                <p>{headings[view][1]}</p>
              </header>
              {storageError && (
                <p className="error" role="alert">
                  {storageError}
                </p>
              )}
              <p className="status" role="status">
                {message}
              </p>
              {view !== "people" ? (
                <>
                  <div className="filters" aria-label="Filter by purpose">
                    <button aria-pressed={!purpose} onClick={() => setPurpose("")}>
                      All purposes
                    </button>
                    {purposes.map((item) => (
                      <button
                        key={item.id}
                        aria-pressed={purpose === item.id}
                        onClick={() => setPurpose(item.id)}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <form className="panel composer" onSubmit={publish}>
                    <div className="composer-heading">
                      <Avatar person={visitor} />
                      <label htmlFor="demo-caption">
                        {editing
                          ? "Give your thought a little polish."
                          : "One small thing worth sharing?"}
                      </label>
                    </div>
                    <textarea
                      ref={composer}
                      id="demo-caption"
                      placeholder="Something you learned. A habit you started. A small win."
                      maxLength={1000}
                      rows={3}
                      value={caption}
                      onChange={(event) => {
                        setCaption(event.target.value);
                        setFormError("");
                      }}
                      aria-describedby="local-only"
                    />
                    <p id="local-only" className="muted">
                      Text only in this demo. Use fictional content, not personal
                      information.
                    </p>
                    <div className="composer-actions">
                      <label className="purpose-picker">
                        Purpose
                        <select
                          aria-label="Post purpose"
                          value={postPurpose}
                          onChange={(event) => setPostPurpose(event.target.value)}
                        >
                          {purposes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="button-row">
                        {editing && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => {
                              setEditing(null);
                              setCaption("");
                              setFormError("");
                            }}
                          >
                            Cancel edit
                          </button>
                        )}
                        <button className="primary">
                          {editing ? "Save changes" : "Publish locally"}
                        </button>
                      </div>
                    </div>
                    {formError && (
                      <p className="error" role="alert">
                        {formError}
                      </p>
                    )}
                  </form>
                  <div className="feed-label">
                    <span>
                      {view === "mine" ? "YOUR LOCAL POSTS" : "A LITTLE INSPIRATION"}
                    </span>
                    <span>
                      {posts.length} {posts.length === 1 ? "post" : "posts"}
                    </span>
                  </div>
                  <section aria-label="Posts">
                    {posts.length === 0 ? (
                      <div className="panel empty">
                        <h2>A little room for something good.</h2>
                        <p>
                          {view === "mine"
                            ? "Publish your first local post above."
                            : "Try another purpose or follow a sample creator."}
                        </p>
                      </div>
                    ) : (
                      posts.map((post) => {
                        const person =
                          post.authorId === "visitor"
                            ? visitor
                            : creators.find((item) => item.id === post.authorId);
                        const topic = purposes.find((item) => item.id === post.purpose);
                        return (
                          <article className="panel post-card" key={post.id}>
                            <header className="post-heading">
                              <Avatar person={person} />
                              <div className="post-person">
                                <strong>{person.name}</strong>
                                <small>
                                  @{person.handle} <span aria-hidden="true">·</span>{" "}
                                  {post.authorId === "visitor"
                                    ? "Local post"
                                    : "Sample post"}
                                </small>
                              </div>
                              <span
                                className="purpose-tag"
                                style={{ "--topic-color": topic.color }}
                              >
                                {topic.label}
                              </span>
                            </header>
                            <p className="caption">{post.caption}</p>
                            {post.art && <Illustration purpose={topic} />}
                            {post.authorId === "visitor" && (
                              <footer className="post-actions">
                                <button
                                  className="text-button"
                                  onClick={() => edit(post)}
                                >
                                  Edit post
                                </button>
                                <button
                                  className="text-button danger"
                                  onClick={() => {
                                    setState((current) => ({
                                      ...current,
                                      posts: current.posts.filter(
                                        (item) => item.id !== post.id,
                                      ),
                                    }));
                                    if (editing === post.id) {
                                      setEditing(null);
                                      setCaption("");
                                    }
                                    setMessage("Post deleted from this browser.");
                                  }}
                                >
                                  Delete post
                                </button>
                              </footer>
                            )}
                          </article>
                        );
                      })
                    )}
                  </section>
                </>
              ) : (
                <section className="people-section" aria-label="Sample creators">
                  <label htmlFor="creator-search">Find a sample creator</label>
                  <input
                    id="creator-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search a name or handle"
                    maxLength={80}
                  />
                  {people.length === 0 && (
                    <p className="panel empty">No sample creators match that search.</p>
                  )}
                  {people.map((person) => (
                    <div className="panel person-card" key={person.id}>
                      <Avatar person={person} />
                      <div>
                        <h2>{person.name}</h2>
                        <small>@{person.handle}</small>
                        <p>{person.bio}</p>
                      </div>
                      <button
                        className="follow-button"
                        aria-label={`${state.following.includes(person.id) ? "Unfollow" : "Follow"} ${person.name}`}
                        aria-pressed={state.following.includes(person.id)}
                        onClick={() => follow(person)}
                      >
                        {state.following.includes(person.id) ? "Following" : "Follow"}
                      </button>
                    </div>
                  ))}
                </section>
              )}
            </main>
            <aside className="right-rail">
              <section className="reminder">
                <span className="eyebrow">A GENTLE REMINDER</span>
                <div className="reminder-art" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <h2>
                  Progress is a practice,
                  <br />
                  not a performance.
                </h2>
                <p>
                  You do not have to do it all.
                  <br />
                  Just one thing that matters.
                </p>
                <span className="eyebrow">ONE SMALL STEP AT A TIME</span>
              </section>
              <section className="panel creators">
                <h2>Find your kind of people</h2>
                <p className="muted">Fictional creators. Real curiosity.</p>
                {creators.map((person) => (
                  <div className="creator" key={person.id}>
                    <Avatar person={person} />
                    <div>
                      <strong>{person.name}</strong>
                      <small>@{person.handle}</small>
                    </div>
                    <button
                      className="follow-button"
                      aria-label={`${state.following.includes(person.id) ? "Unfollow" : "Follow"} ${person.name}`}
                      aria-pressed={state.following.includes(person.id)}
                      onClick={() => follow(person)}
                    >
                      {state.following.includes(person.id) ? "Following" : "Follow"}
                    </button>
                  </div>
                ))}
              </section>
              <section className="panel engineering">
                <span className="eyebrow">BEHIND THE DEMO</span>
                <h2>A small, coherent system.</h2>
                <p>
                  The full-stack implementation uses React, Express, and MySQL, with
                  secure sessions, privacy-aware reads, transactional post retries,
                  Docker, and CI.
                </p>
                <details>
                  <summary>What is running here?</summary>
                  <p>
                    This page is a separate React demo on GitHub Pages. It uses fictional
                    posts and localStorage, not the Node.js API or MySQL. Authentication,
                    private accounts, image uploads, and concurrent transactions are
                    available in the full-stack source, not simulated here.
                  </p>
                </details>
                <a href={sourceUrl} target="_blank" rel="noreferrer">
                  Explore the code <span aria-hidden="true">↗</span>
                </a>
              </section>
              <p className="footnote">
                Built to learn. Revisited with intention.
                <br />
                No analytics. No external image services.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
