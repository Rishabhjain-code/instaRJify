import { api } from "../api";
import {
  AsyncButton,
  Avatar,
  FollowButton,
  LoadMore,
  ResourceState,
  useResource,
} from "./Shared";

export function Suggestions({ revision, onChanged, onProfile }) {
  const resource = useResource("/users/suggestions?limit=4", revision);
  return (
    <section className="panel suggestions">
      <div className="section-label">
        <h3>Find your people</h3>
        <span>+ A GOOD CIRCLE</span>
      </div>
      <ResourceState resource={resource}>
        {resource.data?.length === 0 && (
          <p className="muted">
            Your circle is taking shape. Discover more creators when they join.
          </p>
        )}
        {resource.data?.map((person) => (
          <div className="suggestion" key={person.id}>
            <button className="person-link" onClick={() => onProfile(person.id)}>
              <Avatar user={person} />
              <span>
                <strong>{person.name}</strong>
                <small>
                  {person.mutualCount
                    ? `${person.mutualCount} mutual connection${person.mutualCount === 1 ? "" : "s"}`
                    : `@${person.handle}`}
                </small>
              </span>
            </button>
            <FollowButton profile={person} onChanged={onChanged} />
          </div>
        ))}
      </ResourceState>
    </section>
  );
}

export default function People({ endpoint, onProfile, onChanged, kind, isOwner }) {
  const resource = useResource(endpoint);
  return (
    <ResourceState resource={resource}>
      <div className="panel people-panel">
        {resource.data?.items.length === 0 && (
          <div className="empty-state">
            <h3>A little quiet here.</h3>
            <p>
              {kind === "requests"
                ? "New follow requests will appear here."
                : "Connections will appear here as your circle grows."}
            </p>
          </div>
        )}
        {resource.data?.items.map((person) => (
          <div className="people-row" key={person.id}>
            <button className="person-link" onClick={() => onProfile(person.id)}>
              <Avatar user={person} />
              <span>
                <strong>{person.name}</strong>
                <small>
                  @{person.handle}
                  {!person.isPublic && " / Private"}
                </small>
              </span>
            </button>
            <div className="button-row">
              {kind === "requests" && (
                <>
                  <AsyncButton
                    className="button primary"
                    action={async () => {
                      await api(`/follows/${person.id}/accept`, { method: "PUT" });
                      onChanged();
                    }}
                  >
                    Accept
                  </AsyncButton>
                  <AsyncButton
                    action={async () => {
                      await api(`/followers/${person.id}`, { method: "DELETE" });
                      onChanged();
                    }}
                  >
                    Decline
                  </AsyncButton>
                </>
              )}
              {isOwner && kind === "followers" && (
                <AsyncButton
                  action={async () => {
                    await api(`/followers/${person.id}`, { method: "DELETE" });
                    onChanged();
                  }}
                >
                  Remove
                </AsyncButton>
              )}
              {isOwner && kind === "following" && (
                <AsyncButton
                  action={async () => {
                    await api(`/follows/${person.id}`, { method: "DELETE" });
                    onChanged();
                  }}
                >
                  Unfollow
                </AsyncButton>
              )}
              {kind === "directory" && (
                <FollowButton profile={person} onChanged={onChanged} />
              )}
            </div>
          </div>
        ))}
        <LoadMore resource={resource} endpoint={endpoint} />
      </div>
    </ResourceState>
  );
}
