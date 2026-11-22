import { useEffect, useState } from "react";
import { api } from "../api";

export const purposes = [
  { id: "learning", label: "Learning", symbol: "01" },
  { id: "fitness", label: "Fitness", symbol: "02" },
  { id: "creative", label: "Creativity", symbol: "03" },
  { id: "mindful", label: "Mindful living", symbol: "04" },
];

export function useResource(path, revision = 0) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setData(null);
    api(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision, attempt]);
  return { data, setData, error, loading, retry: () => setAttempt((value) => value + 1) };
}

export function Brand() {
  return (
    <div className="brand">
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <rect width="40" height="40" rx="12" />
        <path d="M12 28V18m8 10V11m8 17V15" />
      </svg>
      <span>
        insta<span className="brand-accent">RJ</span>ify
        <span className="brand-dot">.</span>
      </span>
    </div>
  );
}

export function Avatar({ user, large = false }) {
  const tone =
    [...(user.handle || "")].reduce(
      (sum, character) => sum + character.charCodeAt(0),
      0,
    ) % 5;
  return (
    <span
      className={`avatar tone-${tone} ${large ? "avatar-large" : ""}`}
      aria-hidden="true"
    >
      {user.hasAvatar ? (
        <img src={`/api/v1/users/${user.id}/avatar?v=${user.avatarVersion}`} alt="" />
      ) : (
        user.name
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join("")
      )}
    </span>
  );
}

export function ErrorMessage({ message }) {
  return message ? (
    <div className="error-message" role="alert">
      {message}
    </div>
  ) : null;
}

export function ResourceState({ resource, empty, children }) {
  if (resource.loading)
    return (
      <div className="loading-state" role="status">
        <span className="loading-dot" /> A moment to get things ready...
      </div>
    );
  if (resource.error)
    return (
      <div className="panel">
        <ErrorMessage message={resource.error} />
        <button className="button secondary" onClick={resource.retry}>
          Try again
        </button>
      </div>
    );
  if (!resource.data)
    return <div className="empty-state">{empty || "Nothing here yet."}</div>;
  return children;
}

export function AsyncButton({
  action,
  children,
  className = "button secondary",
  ...props
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function handleClick() {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="async-action">
      <button
        type="button"
        className={className}
        {...props}
        disabled={busy || props.disabled}
        onClick={handleClick}
      >
        {busy ? "Working..." : children}
      </button>
      <ErrorMessage message={error} />
    </div>
  );
}

export function FollowButton({ profile, onChanged }) {
  if (profile.relationship === "self") return null;
  const following = profile.relationship === "accepted";
  const pending = profile.relationship === "pending";
  return (
    <AsyncButton
      className={`button ${following || pending ? "secondary" : "primary"}`}
      action={async () => {
        await api(`/follows/${profile.id}`, {
          method: following || pending ? "DELETE" : "PUT",
        });
        onChanged();
      }}
    >
      {following
        ? "Unfollow"
        : pending
          ? "Cancel request"
          : profile.isPublic
            ? "Follow"
            : "Request to follow"}
    </AsyncButton>
  );
}

export function PurposeSelect({
  value,
  onChange,
  id = "post-purpose",
  disabled = false,
}) {
  return (
    <select
      id={id}
      disabled={disabled}
      aria-label="Post purpose"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {purposes.map((purpose) => (
        <option key={purpose.id} value={purpose.id}>
          {purpose.label}
        </option>
      ))}
    </select>
  );
}

export function dateLabel(value) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value.replace(" ", "T") + "Z"));
}

export function LoadMore({ resource, endpoint }) {
  const cursor = resource.data?.nextCursor;
  if (!cursor) return null;
  return (
    <div className="load-more">
      <AsyncButton
        action={async () => {
          const next = await api(
            `${endpoint}${endpoint.includes("?") ? "&" : "?"}cursor=${encodeURIComponent(cursor)}`,
          );
          resource.setData((current) => ({
            items: [...current.items, ...next.items],
            nextCursor: next.nextCursor,
          }));
        }}
      >
        Load more
      </AsyncButton>
    </div>
  );
}
