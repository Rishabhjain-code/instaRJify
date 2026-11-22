import { useRef, useState } from "react";
import { api } from "../api";
import { Avatar, ErrorMessage } from "./Shared";

export default function Settings({ user, onUpdated, onDeleted }) {
  const [form, setForm] = useState({
    name: user.name,
    handle: user.handle,
    bio: user.bio,
    isPublic: user.isPublic,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const avatarInput = useRef(null);
  async function perform(action) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      await action();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  function change(event) {
    setSaved(false);
    setForm({
      ...form,
      [event.target.name]:
        event.target.type === "checkbox" ? event.target.checked : event.target.value,
    });
  }
  return (
    <section className="panel settings-panel">
      <span className="eyebrow">MAKE IT YOURS</span>
      <h2>Your corner of the internet.</h2>
      <p className="muted">Keep your profile up to date and your boundaries clear.</p>
      <div className="avatar-editor">
        <Avatar user={user} large />
        <label className="button secondary attachment-label">
          Change photo
          <input
            ref={avatarInput}
            disabled={busy}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => {
              const file = event.target.files[0];
              if (!file) return;
              perform(async () => {
                const body = new FormData();
                body.append("image", file);
                onUpdated(await api("/users/me/avatar", { method: "PUT", body }));
                avatarInput.current.value = "";
                setSaved(true);
              });
            }}
          />
        </label>
        <small>JPEG, PNG, or WebP. Up to 5 MB.</small>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          perform(async () => {
            const updated = await api("/users/me", { method: "PATCH", body: form });
            setForm({
              name: updated.name,
              handle: updated.handle,
              bio: updated.bio,
              isPublic: updated.isPublic,
            });
            onUpdated(updated);
            setSaved(true);
          });
        }}
      >
        <div className="form-grid">
          <label>
            Name
            <input
              name="name"
              required
              maxLength={80}
              value={form.name}
              onChange={change}
            />
          </label>
          <label>
            Handle
            <input
              name="handle"
              required
              minLength={3}
              maxLength={30}
              value={form.handle}
              onChange={change}
            />
          </label>
        </div>
        <label>
          Email address
          <input type="email" value={user.email} readOnly />
          <small>Your sign-in identifier; not shown on your public profile.</small>
        </label>
        <label>
          About you
          <textarea
            name="bio"
            rows={3}
            maxLength={320}
            value={form.bio}
            onChange={change}
            placeholder="What are you making room for?"
          />
        </label>
        <label className="privacy-setting">
          <input
            type="checkbox"
            name="isPublic"
            checked={form.isPublic}
            onChange={change}
          />
          <span>
            <strong>Public profile</strong>
            <small>
              {form.isPublic
                ? "Anyone signed in can see your posts. Making a private account public also accepts pending requests."
                : "Only approved followers can see your posts and connections. Existing followers keep their access."}
            </small>
          </span>
        </label>
        <ErrorMessage message={error} />
        {saved && (
          <p className="success-message" role="status" aria-label="Profile save status">
            Your changes have been saved.
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Saving..." : "Save profile"}
        </button>
      </form>
      <details className="account-danger">
        <summary>Delete account</summary>
        <p>
          This permanently removes your account, posts, images, sessions, and follow
          relationships.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const values = Object.fromEntries(new FormData(event.currentTarget));
            if (values.confirmation !== user.handle) {
              setError("Enter your handle exactly to confirm deletion");
              return;
            }
            perform(async () => {
              await api("/users/me", {
                method: "DELETE",
                body: { password: values.password },
              });
              onDeleted();
            });
          }}
        >
          <label>
            Type your handle to confirm
            <input name="confirmation" autoComplete="off" required />
          </label>
          <label>
            Current password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <button className="button danger" disabled={busy}>
            Permanently delete account
          </button>
        </form>
      </details>
    </section>
  );
}
