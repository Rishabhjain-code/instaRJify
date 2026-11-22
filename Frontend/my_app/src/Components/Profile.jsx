import { useState } from "react";
import Feed from "./Feed";
import People from "./People";
import { Avatar, FollowButton, ResourceState, useResource } from "./Shared";

export default function Profile({
  id,
  user,
  revision,
  onChanged,
  onProfile,
  onSettings,
}) {
  const resource = useResource(`/users/${id}`, revision);
  const [tab, setTab] = useState("posts");
  const profile = resource.data;
  const owner = id === user.id;
  const visible =
    profile && (profile.isPublic || owner || profile.relationship === "accepted");
  return (
    <ResourceState resource={resource}>
      {profile && (
        <>
          <section className="panel profile-header">
            <div className="profile-cover">
              <span>A SPACE TO GROW</span>
            </div>
            <div className="profile-details">
              <Avatar user={profile} large />
              <div className="profile-title">
                <div>
                  <h2>{profile.name}</h2>
                  <p className="muted">
                    @{profile.handle}{" "}
                    <span className="privacy-label">
                      {profile.isPublic ? "Public profile" : "Private circle"}
                    </span>
                  </p>
                </div>
                {owner ? (
                  <button className="button secondary" onClick={onSettings}>
                    Edit profile
                  </button>
                ) : (
                  <FollowButton profile={profile} onChanged={onChanged} />
                )}
              </div>
              {profile.bio && <p className="profile-bio">{profile.bio}</p>}
              <nav className="profile-counts" aria-label="Profile content">
                {[
                  ["posts", "Posts", profile.postsCount],
                  ["followers", "Followers", profile.followersCount],
                  ["following", "Following", profile.followingCount],
                ].map(([key, label, count]) => (
                  <button
                    key={key}
                    className={tab === key ? "selected" : ""}
                    onClick={() => setTab(key)}
                    aria-pressed={tab === key}
                  >
                    <strong>{count}</strong>
                    {label}
                  </button>
                ))}
              </nav>
            </div>
          </section>
          {!visible ? (
            <div className="panel empty-state">
              <h3>A more personal circle.</h3>
              <p>Send a follow request to see this account's posts and connections.</p>
            </div>
          ) : tab === "posts" ? (
            <Feed
              key={`${id}:${revision}`}
              endpoint={`/users/${id}/posts?limit=6`}
              onChanged={onChanged}
              onProfile={onProfile}
            />
          ) : (
            <People
              key={`${id}:${tab}:${revision}`}
              endpoint={`/users/${id}/${tab}?limit=20`}
              kind={tab}
              isOwner={owner}
              onChanged={onChanged}
              onProfile={onProfile}
            />
          )}
        </>
      )}
    </ResourceState>
  );
}
