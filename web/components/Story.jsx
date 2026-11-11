'use client';
// The scroll story on the homepage (after the intro): see story/story.js for how it works.
import { useEffect, useRef } from 'react';
import { STORY_TOP, STORY_END, mountStory } from './story/story';
import { hasSession, track, SB_URL, SB_KEY } from '@/lib/site';
import './story/story.css';

function Part({ html }) {
  const ref = useRef(null);
  useEffect(() => mountStory(ref.current, { track, authed: hasSession(), sbUrl: SB_URL, sbKey: SB_KEY }), []);
  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function StoryTop() {
  return <Part html={STORY_TOP} />;
}

export function StoryEnd() {
  return <Part html={STORY_END} />;
}
