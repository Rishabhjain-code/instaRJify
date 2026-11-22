import { useEffect, useState } from "react";
import { api } from "./api";
import Auth from "./Components/Auth";
import Feed, { Composer } from "./Components/Feed";
import People, { Suggestions } from "./Components/People";
import Profile from "./Components/Profile";
import Settings from "./Components/Settings";
import { AsyncButton, Avatar, Brand, ErrorMessage, purposes } from "./Components/Shared";

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState("");
  const [view, setView] = useState("feed");
  const [purpose, setPurpose] = useState("");
  const [revision, setRevision] = useState(0);
  const [profileId, setProfileId] = useState(null);
  const [search, setSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api("/auth/session", { signal: controller.signal })
      .then((current) => {
        if (!controller.signal.aborted) setUser(current);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setBootError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setBooting(false);
      });
    return () => controller.abort();
  }, []);
  const changed = () => setRevision((value) => value + 1);
  function openProfile(id) {
    setProfileId(id);
    setView("profile");
  }
  function navigate(next) {
    setView(next);
    if (next === "profile") setProfileId(user.id);
  }
  function authenticated(current) {
    setUser(current);
    setView("feed");
    setPurpose("");
    setSearch("");
    setSearchQuery("");
    changed();
  }
  if (booting)
    return (
      <div className="boot-state">
        <Brand />
        <p role="status">Making a little room...</p>
      </div>
    );
  if (bootError)
    return (
      <div className="boot-state">
        <Brand />
        <ErrorMessage message={bootError} />
        <button className="button primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  if (!user) return <Auth onAuthenticated={authenticated} />;
  const endpoint = `/posts?scope=${view === "discover" ? "discover" : "following"}&limit=6${purpose ? `&purpose=${purpose}` : ""}`;
  const headings = {
    feed: ["Your daily dose of better.", "A few good things from the people you choose."],
    discover: ["Follow your curiosity.", "Find a new idea. Find a new perspective."],
    people: [
      "Good people. Shared purpose.",
      "Find creators by their handle and build your circle.",
    ],
    profile: [
      "A little more you.",
      "The ideas, moments, and people that make your space.",
    ],
    requests: [
      "Your circle, your choice.",
      "Decide who gets a closer look at your journey.",
    ],
    settings: ["A space on your terms.", "The small details that make it yours."],
  };
  const [title, subtitle] = headings[view];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="sidebar-caption">SOCIAL, WITH INTENTION.</div>
        <nav className="main-nav" aria-label="Main navigation">
          {[
            ["feed", "01", "Your feed"],
            ["discover", "02", "Discover"],
            ["people", "03", "Find people"],
            ["profile", "04", "Your profile"],
            ["requests", "05", "Follow requests"],
            ["settings", "06", "Settings"],
          ].map(([key, number, label]) => (
            <button
              key={key}
              className={view === key ? "active" : ""}
              aria-current={view === key ? "page" : undefined}
              onClick={() => navigate(key)}
            >
              <span>{number}</span>
              {label}
              {view === key && <i aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-spark" aria-hidden="true">
            +
          </span>
          <h3>
            A little less scrolling.
            <br />A little more growing.
          </h3>
          <p>
            Your attention is a good thing.
            <br />
            Spend it on what matters.
          </p>
        </div>
        <div className="sidebar-user">
          <button className="person-link" onClick={() => openProfile(user.id)}>
            <Avatar user={user} />
            <span>
              <strong>{user.name}</strong>
              <small>@{user.handle}</small>
            </span>
          </button>
          <AsyncButton
            className="text-button signout"
            action={async () => {
              await api("/auth/logout", { method: "POST" });
              setUser(null);
            }}
          >
            Sign out
          </AsyncButton>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span>
            <span className="status-dot" /> A GOOD PLACE TO BEGIN
          </span>
          <button className="profile-shortcut" onClick={() => openProfile(user.id)}>
            <Avatar user={user} />
            <span>Your space</span>
          </button>
        </header>
        <div className="page-layout">
          <main className="main-content">
            <header className="page-heading">
              <span className="eyebrow">
                {view === "feed" || view === "discover"
                  ? "MAKE TODAY COUNT"
                  : "YOUR KIND OF SOCIAL"}
              </span>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </header>
            {["feed", "discover"].includes(view) && (
              <>
                <div className="purpose-filters" aria-label="Filter by purpose">
                  <button
                    className={!purpose ? "selected" : ""}
                    onClick={() => setPurpose("")}
                    aria-pressed={!purpose}
                  >
                    For you
                  </button>
                  {purposes.map((item) => (
                    <button
                      key={item.id}
                      className={purpose === item.id ? "selected" : ""}
                      onClick={() => setPurpose(item.id)}
                      aria-pressed={purpose === item.id}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {view === "feed" && <Composer user={user} onPublished={changed} />}
                <Feed
                  key={`${view}:${purpose}:${revision}`}
                  endpoint={endpoint}
                  onChanged={changed}
                  onProfile={openProfile}
                />
              </>
            )}
            {view === "people" && (
              <>
                <form
                  className="panel search-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    setSearchQuery(search.trim().toLowerCase());
                  }}
                >
                  <label htmlFor="creator-search">Find a handle</label>
                  <div className="button-row">
                    <input
                      id="creator-search"
                      value={search}
                      maxLength={30}
                      pattern="[A-Za-z0-9_.]*"
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Try avery or a handle prefix"
                    />
                    <button className="button primary">Search people</button>
                  </div>
                </form>
                <People
                  key={`${searchQuery}:${revision}`}
                  endpoint={`/users?query=${encodeURIComponent(searchQuery)}&limit=20`}
                  kind="directory"
                  onChanged={changed}
                  onProfile={openProfile}
                />
              </>
            )}
            {view === "profile" && (
              <Profile
                key={profileId || user.id}
                id={profileId || user.id}
                user={user}
                revision={revision}
                onChanged={changed}
                onProfile={openProfile}
                onSettings={() => navigate("settings")}
              />
            )}
            {view === "requests" && (
              <People
                key={revision}
                endpoint="/users/me/requests?limit=20"
                kind="requests"
                isOwner
                onChanged={changed}
                onProfile={openProfile}
              />
            )}
            {view === "settings" && (
              <Settings
                user={user}
                onUpdated={(updated) => {
                  setUser(updated);
                  changed();
                }}
                onDeleted={() => setUser(null)}
              />
            )}
          </main>
          <aside className="right-rail">
            <div className="daily-note">
              <span className="eyebrow">A GENTLE REMINDER</span>
              <div className="note-art" aria-hidden="true">
                <span />
                <span />
                <span />
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
              <span className="note-bottom">ONE SMALL STEP AT A TIME</span>
            </div>
            <Suggestions
              revision={revision}
              onChanged={changed}
              onProfile={openProfile}
            />
            <div className="rail-footer">
              <Brand />
              <p>
                Built around purpose.
                <br />
                Made for people.
              </p>
            </div>
          </aside>
        </div>
        <footer className="mobile-footer">Less noise. More meaning. instaRJify.</footer>
      </div>
    </div>
  );
}
