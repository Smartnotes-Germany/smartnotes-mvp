export const normalizeTopicKey = (topic: string) => topic.trim().toLowerCase();

export const topicsMatchForFocusMode = (topic: string, focusTopic: string) => {
  const normalizedTopic = normalizeTopicKey(topic);
  const normalizedFocusTopic = normalizeTopicKey(focusTopic);

  if (!normalizedTopic || !normalizedFocusTopic) {
    return false;
  }

  return (
    normalizedTopic === normalizedFocusTopic ||
    normalizedTopic.includes(normalizedFocusTopic) ||
    normalizedFocusTopic.includes(normalizedTopic)
  );
};
