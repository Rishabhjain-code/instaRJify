import { useState } from "react";
import { api } from "../api";
import { Brand, ErrorMessage } from "./Shared";

export default function Auth({ onAuthenticated }) {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      onAuthenticated(
        await api(`/auth/${register ? "register" : "login"}`, {
          method: "POST",
          body: values,
        }),
      );
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-layout">
      <section className="auth-story">
        <Brand />
        <div>
          <span className="eyebrow">A LITTLE MORE INTENTION</span>
          <h1>
            Make room
            <br />
            for what
            <br />
            <em>moves you.</em>
          </h1>
          <p>
            A place to learn something, build a habit, and find people who care about the
            same things.
          </p>
          <div className="story-topics">
            {["Learn", "Move", "Create", "Breathe"].map((word, index) => (
              <span key={word}>
                <small>0{index + 1}</small>
                {word}
              </span>
            ))}
          </div>
        </div>
        <div className="auth-footnote">
          Less noise. More meaning. Your kind of social.
        </div>
      </section>
      <main className="auth-main">
        <div className="auth-form">
          <span className="eyebrow">YOUR NEXT GOOD HABIT</span>
          <h2>{register ? "Start with intention." : "Good to see you."}</h2>
          <p className="muted">
            {register
              ? "Create your space. Find your people."
              : "Pick up where your curiosity left off."}
          </p>
          <form onSubmit={submit} key={String(register)}>
            {register && (
              <>
                <label>
                  Your name
                  <input
                    name="name"
                    autoComplete="name"
                    maxLength={80}
                    required
                    placeholder="How should we call you?"
                  />
                </label>
                <label>
                  Handle
                  <input
                    name="handle"
                    autoComplete="username"
                    minLength={3}
                    maxLength={30}
                    pattern="[A-Za-z0-9][A-Za-z0-9_.]*"
                    required
                    placeholder="your.corner"
                  />
                </label>
              </>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                minLength={register ? 12 : 1}
                maxLength={128}
                required
                placeholder={register ? "At least 12 characters" : "Your password"}
              />
            </label>
            <ErrorMessage message={error} />
            <button className="button primary full-width" disabled={busy}>
              {busy ? "One moment..." : register ? "Create account" : "Sign in"}
              <span aria-hidden="true">&rarr;</span>
            </button>
          </form>
          <p className="auth-switch">
            {register ? "Already have a space here?" : "New around here?"}{" "}
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register ? "Sign in" : "Create an account"}
            </button>
          </p>
          <p className="auth-policy">Your feed, at your pace. No infinite scroll.</p>
        </div>
      </main>
    </div>
  );
}
