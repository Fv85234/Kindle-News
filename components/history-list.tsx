"use client";

import { useState, useTransition } from "react";

import { EditionRecord, StoryReaction } from "@/lib/types";

type Props = {
  history: EditionRecord[];
};

export function HistoryList({ history }: Props) {
  const [historyState, setHistoryState] = useState(history);
  const [isPending, startTransition] = useTransition();

  function setStoryFeedback(
    editionId: string,
    url: string,
    reaction: StoryReaction
  ) {
    startTransition(async () => {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ editionId, url, reaction })
      });
      const data = (await response.json()) as {
        deliveryHistory?: EditionRecord[];
      };

      if (response.ok && data.deliveryHistory) {
        setHistoryState(data.deliveryHistory);
      }
    });
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Delivery history</h2>
        </div>
      </div>
      <div className="history-list">
        {historyState.length === 0 ? (
          <p className="empty-state">No editions have been generated yet.</p>
        ) : (
          historyState.map((edition) => (
            <article className="history-card" key={edition.id}>
              <div className="history-card-head">
                <div>
                  <h3>{edition.editionDate}</h3>
                  <p>{edition.selectedCount} stories from {edition.candidateCount} candidates</p>
                </div>
                <span className={`status status-${edition.status}`}>{edition.status}</span>
              </div>
              {edition.reason ? <p className="reason">{edition.reason}</p> : null}
              {edition.epubPath ? <p>EPUB: {edition.epubPath}</p> : null}
              {edition.deliveredTo ? <p>Delivered to: {edition.deliveredTo}</p> : null}
              {edition.status === "sent" ? (
                <p className="feedback-hint">
                  Teach the ranking: mark each story as a good or bad fit.
                </p>
              ) : null}
              <ul>
                {edition.stories.slice(0, 5).map((story) => (
                  <li key={story.url}>
                    <div className="story-row">
                      <div className="story-copy">
                        <a href={story.url} target="_blank" rel="noreferrer">
                          {story.title}
                        </a>
                        <span>{story.sourceName}</span>
                      </div>
                      {edition.status === "sent" ? (
                        <div className="feedback-actions">
                          <button
                            className={`feedback-button ${story.feedback === "up" ? "active" : ""}`}
                            type="button"
                            disabled={isPending}
                            onClick={() => setStoryFeedback(edition.id, story.url, "up")}
                          >
                            Good fit
                          </button>
                          <button
                            className={`feedback-button ${story.feedback === "down" ? "active negative" : ""}`}
                            type="button"
                            disabled={isPending}
                            onClick={() => setStoryFeedback(edition.id, story.url, "down")}
                          >
                            Bad fit
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
