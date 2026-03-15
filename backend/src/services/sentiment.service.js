import logger from '../utils/logger.js';

const feedbackStore = [];
const MAX_FEEDBACK = 1000;

const positiveWords = [
  'good', 'great', 'excellent', 'happy', 'satisfied', 'fast', 'easy', 'helpful',
  'love', 'amazing', 'quick', 'thank', 'thanks', 'perfect', 'best', 'recommend',
  'nzuri', 'poa', 'sawa', 'asante', 'vizuri', 'bora', // Swahili positive
];

const negativeWords = [
  'bad', 'slow', 'difficult', 'confused', 'problem', 'fail', 'hate', 'terrible',
  'wrong', 'never', 'worst', 'scam', 'cheat', 'angry', 'complaint', 'delay',
  'mbaya', 'shida', 'tatizo', 'hasira', 'ghali', 'upuzi', // Swahili negative
];

const topicKeywords = {
  payment: ['payment', 'mpesa', 'money', 'pay', 'pesa', 'kulipa', 'malipo'],
  claims: ['claim', 'payout', 'insurance', 'cover', 'bima', 'fidia'],
  registration: ['register', 'signup', 'join', 'account', 'sajili', 'jiandikishe'],
  weather: ['weather', 'rain', 'drought', 'heat', 'hali ya hewa', 'mvua', 'joto'],
  support: ['help', 'support', 'question', 'msaada', 'swali'],
};

export function analyzeSentiment(text, metadata = {}) {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/);

  // Count positive and negative words
  let posCount = 0;
  let negCount = 0;

  for (const word of words) {
    if (positiveWords.some(p => word.includes(p))) posCount++;
    if (negativeWords.some(n => word.includes(n))) negCount++;
  }

  const total = posCount + negCount;
  let score, label;

  if (total === 0) {
    score = 50;
    label = 'neutral';
  } else {
    score = Math.round((posCount / total) * 100);
    label = score >= 65 ? 'positive' : score <= 35 ? 'negative' : 'neutral';
  }

  // Detect topics
  const topics = [];
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(k => lower.includes(k))) {
      topics.push(topic);
    }
  }

  // Urgency detection
  const urgencyWords = ['urgent', 'asap', 'immediately', 'critical', 'haraka', 'sasa'];
  const isUrgent = urgencyWords.some(u => lower.includes(u));

  const result = {
    text: text.slice(0, 200),
    sentiment: { score, label },
    topics: topics.length > 0 ? topics : ['general'],
    urgent: isUrgent,
    wordCount: words.length,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  feedbackStore.push(result);
  if (feedbackStore.length > MAX_FEEDBACK) feedbackStore.shift();

  if (label === 'negative' || isUrgent) {
    logger.warn(`Negative/urgent feedback: "${text.slice(0, 80)}..." [${topics.join(', ')}]`);
  }

  return result;
}

export function getInsights() {
  if (feedbackStore.length === 0) {
    return { totalFeedback: 0, message: 'No feedback collected yet' };
  }

  const total = feedbackStore.length;
  const positive = feedbackStore.filter(f => f.sentiment.label === 'positive').length;
  const negative = feedbackStore.filter(f => f.sentiment.label === 'negative').length;
  const neutral = total - positive - negative;

  // Topic breakdown
  const topicCounts = {};
  for (const fb of feedbackStore) {
    for (const topic of fb.topics) {
      topicCounts[topic] = (topicCounts[topic] || 0) + 1;
    }
  }

  // Sentiment by topic
  const topicSentiment = {};
  for (const topic of Object.keys(topicCounts)) {
    const topicFeedback = feedbackStore.filter(f => f.topics.includes(topic));
    const avgScore = topicFeedback.reduce((s, f) => s + f.sentiment.score, 0) / topicFeedback.length;
    topicSentiment[topic] = {
      count: topicCounts[topic],
      avgSentiment: Math.round(avgScore),
      label: avgScore >= 65 ? 'positive' : avgScore <= 35 ? 'negative' : 'mixed',
    };
  }

  // Recent negative feedback for review
  const recentNegative = feedbackStore
    .filter(f => f.sentiment.label === 'negative')
    .slice(-5)
    .map(f => ({ text: f.text, topics: f.topics, timestamp: f.timestamp }));

  return {
    totalFeedback: total,
    breakdown: { positive, negative, neutral },
    satisfactionRate: Math.round((positive / total) * 100),
    topicSentiment,
    recentNegative,
    avgSentiment: Math.round(feedbackStore.reduce((s, f) => s + f.sentiment.score, 0) / total),
  };
}

export function getRecentFeedback(limit = 20) {
  return feedbackStore.slice(-limit);
}
